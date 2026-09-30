"use client";

/**
 * The studio's handle on the image-AI worker.
 *
 * One job at a time: the models want the whole GPU (or every CPU core), and
 * running two at once would only make both slower — so jobs queue. Cancelling
 * ends the worker outright — a model mid-inference can't be interrupted any
 * other way — and the next job starts a fresh one, with the weights coming back
 * out of the browser's cache.
 *
 * A GPU that fails a model is written off for the session: the job runs again
 * on the CPU, in a fresh worker, and later jobs go straight there.
 *
 * The worker is also let go after a quiet spell. The models hold a few hundred
 * MB between them, which is worth keeping while someone is working through
 * photos and not worth keeping for the rest of the session.
 */

import type {
  ImageAiOutput,
  ImageAiRequest,
  ImageAiResponse,
  ImageAiStage,
  ImageAiTask,
  MaskCandidate,
  SegPrompt,
} from "./protocol";

export type { MaskCandidate, SegPrompt } from "./protocol";

/**
 * Where the background-removal model is downloaded from. Production points at
 * the Hugging Face repo; unset, a local copy in public/ serves development.
 */
const BG_MODEL_URL =
  process.env.NEXT_PUBLIC_BG_MODEL_URL || "/models/background/isnet-general-use-fp16.onnx";

export type ImageAiJob =
  | { kind: "removeBackground"; image: Blob }
  /** `scale`: the final enlargement, from `planEnhance`. */
  | { kind: "enhance"; image: Blob; scale: number }
  | Extract<ImageAiTask, { kind: "eraseObject" }>;

export interface ImageAiProgress {
  stage: ImageAiStage;
  /** 0–1, or undefined when the step can't be measured. */
  fraction?: number;
  /** False when the job runs on the CPU, which is much slower. */
  gpu: boolean;
}

export interface ImageAiResult {
  image: Blob;
  width: number;
  height: number;
}

export type SelectedObject = Extract<ImageAiOutput, { kind: "object" }>;

export class ImageAiCancelled extends Error {
  constructor() {
    super("Cancelled.");
  }
}

class GpuFailed extends Error {}

const IDLE_MS = 3 * 60 * 1000;

let worker: Worker | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
let active: { id: number; reject: (error: Error) => void } | null = null;
/** The GPU failed once this session, so everything runs on the CPU. */
let cpuOnly = false;
/** Jobs run one after another; each waits for the one before to settle. */
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  worker ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  return worker;
}

function release() {
  worker?.terminate();
  worker = null;
}

function scheduleRelease() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(release, IDLE_MS);
}

const noProgress = () => {};

/** Queue a task; on a GPU failure, retry it once on the CPU in a fresh worker. */
function run(task: ImageAiTask, onProgress: (progress: ImageAiProgress) => void): Promise<ImageAiOutput> {
  const job = queue.then(async () => {
    try {
      return await runOnce(task, onProgress);
    } catch (error) {
      if (!(error instanceof GpuFailed) || cpuOnly) throw error;
      cpuOnly = true;
      release();
      onProgress({ stage: "process", gpu: false });
      return runOnce(task, onProgress);
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

/** Background removal, Enhance, Erase object: a new picture. */
export async function runImageAi(
  job: ImageAiJob,
  onProgress: (progress: ImageAiProgress) => void
): Promise<ImageAiResult> {
  const task: ImageAiTask = job.kind === "removeBackground" ? { ...job, modelUrl: BG_MODEL_URL } : job;
  const result = await run(task, onProgress);
  if (result.kind !== "image") throw new Error("Unexpected result from the image worker.");
  return result;
}

/** Analyse a photo for object selection. Instant when this `src` is already analysed. */
export async function prepareSelection(
  src: string,
  image: Blob,
  onProgress: (progress: ImageAiProgress) => void
): Promise<{ width: number; height: number }> {
  const result = await run({ kind: "segPrepare", src, image }, onProgress);
  if (result.kind !== "prepared") throw new Error("Unexpected result from the image worker.");
  return result;
}

/** The candidate masks for the clicks so far. */
export async function segmentSelection(
  src: string,
  prompts: SegPrompt[]
): Promise<{ candidates: MaskCandidate[]; best: number }> {
  const result = await run({ kind: "segSegment", src, prompts }, noProgress);
  if (result.kind !== "candidates") throw new Error("Unexpected result from the image worker.");
  return result;
}

/** The chosen object's outline — and, with `repair`, the photo with it filled in. */
export async function commitSelection(
  src: string,
  prompts: SegPrompt[],
  candidate: number,
  repair: boolean,
  onProgress: (progress: ImageAiProgress) => void
): Promise<SelectedObject> {
  const result = await run({ kind: "segCommit", src, prompts, candidate, repair }, onProgress);
  if (result.kind !== "object") throw new Error("Unexpected result from the image worker.");
  return result;
}

function runOnce(task: ImageAiTask, onProgress: (progress: ImageAiProgress) => void): Promise<ImageAiOutput> {
  const id = nextId++;
  const w = getWorker();

  return new Promise<ImageAiOutput>((resolve, reject) => {
    const finish = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      active = null;
      scheduleRelease();
    };
    const onMessage = (event: MessageEvent<ImageAiResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === "progress") {
        onProgress({ stage: message.stage, fraction: message.fraction, gpu: message.gpu });
      } else if (message.type === "done") {
        finish();
        resolve(message.result);
      } else {
        finish();
        reject(message.gpuFailed ? new GpuFailed(message.message) : new Error(message.message));
      }
    };
    // A worker that dies outright (out of memory on a phone) fires this, not a
    // message. It can't be trusted for the next job either.
    const onError = (event: ErrorEvent) => {
      finish();
      release();
      reject(new Error(event.message || "Processing stopped unexpectedly."));
    };

    active = {
      id,
      reject: (error) => {
        finish();
        reject(error);
      },
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    const request: ImageAiRequest = { id, cpuOnly, ...task };
    w.postMessage(request);
  });
}

/** Stop the running job, if any. Its promise rejects with `ImageAiCancelled`. */
export function cancelImageAi() {
  if (!active) return;
  const { reject } = active;
  release();
  reject(new ImageAiCancelled());
}
