import type { CropRect, Stroke } from "../document";
import type { Ring } from "../maskTrace";

/**
 * Messages between the studio and the image-AI worker (`worker.ts`).
 *
 * Images cross as Blobs: they are cheap to post (no copy of the pixels on the
 * main thread) and the worker decodes them where the decode doesn't stall the
 * editor.
 */

/** A click on the photo, in source-normalised coordinates (0–1 of the natural image). */
export interface SegPrompt {
  x: number;
  y: number;
  /** false = "not this": exclude the area around the point. */
  include: boolean;
}

export type ImageAiTask =
  /** `modelUrl`: where the ISNet model is hosted (NEXT_PUBLIC_BG_MODEL_URL). */
  | { kind: "removeBackground"; image: Blob; modelUrl: string }
  /** `scale` is the final factor, 1–4; the model runs at ×4 and is drawn down. */
  | { kind: "enhance"; image: Blob; scale: number }
  /**
   * Content-aware fill under the painted strokes. The strokes are in the
   * layer's box (0–1), so the crop and mirror come along to place them on the
   * source pixels. No model: see `inpaint.ts`.
   */
  | {
      kind: "eraseObject";
      image: Blob;
      strokes: Stroke[];
      crop: CropRect;
      flipX: boolean;
      flipY: boolean;
    }
  /**
   * Object selection, step 1: decode the photo and analyse it once (SAM's image
   * encoder). Kept in the worker keyed by `src` — every pixel-changing edit in
   * Framers produces a new `src`, so the key is also the pixel revision.
   */
  | { kind: "segPrepare"; src: string; image: Blob }
  /** Step 2, per click: SAM's three candidate masks for the prompts so far. */
  | { kind: "segSegment"; src: string; prompts: SegPrompt[] }
  /**
   * Step 3: settle on one candidate, sharpen it with a zoomed second pass,
   * trace its outline — and with `repair`, fill the area it covered.
   */
  | { kind: "segCommit"; src: string; prompts: SegPrompt[]; candidate: number; repair: boolean };

/** `cpuOnly`: the GPU already failed once this session; don't try it again. */
export type ImageAiRequest = { id: number; cpuOnly?: boolean } & ImageAiTask;

/**
 * `download`: fetching model weights, which happens once per browser (they are
 * cached). `process`: running the model. `fraction` is absent when there is
 * nothing honest to measure — one opaque model call.
 */
export type ImageAiStage = "download" | "process";

/** One of SAM's candidates, on its low-resolution grid over the whole photo. */
export interface MaskCandidate {
  /** 1 = selected, row-major, `width` × `height`. */
  mask: Uint8Array;
  width: number;
  height: number;
  /** SAM's own estimate of the mask's quality. */
  score: number;
  /** Selected cells — for ordering candidates from smallest to largest. */
  area: number;
}

export type ImageAiOutput =
  | { kind: "image"; image: Blob; width: number; height: number }
  /** The photo's natural size, now analysed. */
  | { kind: "prepared"; width: number; height: number }
  | { kind: "candidates"; candidates: MaskCandidate[]; best: number }
  | {
      kind: "object";
      /** Outline in source pixels: outer rings clockwise, holes counter-clockwise. */
      rings: Ring[];
      /** Bounds of the object in source pixels (x1, y1 exclusive). */
      bbox: { x0: number; y0: number; x1: number; y1: number };
      /** The photo with the object filled in, when `repair` was asked for. */
      repaired?: { image: Blob; width: number; height: number };
    };

export type ImageAiResponse =
  | { id: number; type: "progress"; stage: ImageAiStage; fraction?: number; gpu: boolean }
  | { id: number; type: "done"; result: ImageAiOutput }
  /** `gpuFailed`: worth retrying in a fresh worker, on the CPU. */
  | { id: number; type: "error"; message: string; gpuFailed?: boolean };
