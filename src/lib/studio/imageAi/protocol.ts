/**
 * Messages between the studio and the image-AI worker (`worker.ts`).
 *
 * Images cross as Blobs: they are cheap to post (no copy of the pixels on the
 * main thread) and the worker decodes them where the decode doesn't stall the
 * editor.
 */

export type ImageAiTask =
  /** `modelUrl`: where the ISNet model is hosted (NEXT_PUBLIC_BG_MODEL_URL). */
  | { kind: "removeBackground"; image: Blob; modelUrl: string }
  /** `scale` is the final factor, 1–4; the model runs at ×4 and is drawn down. */
  | { kind: "enhance"; image: Blob; scale: number };

/** `cpuOnly`: the GPU already failed once this session; don't try it again. */
export type ImageAiRequest = { id: number; cpuOnly?: boolean } & ImageAiTask;

/**
 * `download`: fetching model weights, which happens once per browser (they are
 * cached). `process`: running the model. `fraction` is absent when there is
 * nothing honest to measure — one opaque model call.
 */
export type ImageAiStage = "download" | "process";

export type ImageAiResponse =
  | { id: number; type: "progress"; stage: ImageAiStage; fraction?: number; gpu: boolean }
  | { id: number; type: "done"; image: Blob; width: number; height: number }
  /** `gpuFailed`: worth retrying in a fresh worker, on the CPU. */
  | { id: number; type: "error"; message: string; gpuFailed?: boolean };
