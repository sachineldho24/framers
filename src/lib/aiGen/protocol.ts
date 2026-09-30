/**
 * The contract between the studio and `POST /api/studio/ai/generate`.
 *
 * The request is multipart: a `request` JSON part (below) plus the pictures —
 * `image` (the photo being worked on), `ref` (zero or more references), `mask`
 * (white = change, or the model's own convention, see `AiModel.maskStyle`) and
 * `highlight` (the photo with the selection tinted, for models that take no
 * mask). The studio prepares all of them: it knows the photo, the selection and
 * the model, and doing it in the browser keeps the server free of image code.
 */

import type { AiTask, AspectId, QualityId, ResolutionId } from "./catalog";
import type { Padding } from "./sizing";

export interface AiGenerateRequest {
  task: AiTask;
  model: string;
  prompt?: string;
  aspect?: AspectId;
  quality?: QualityId;
  resolution?: ResolutionId;
  /** How many pictures to make (clamped to the model's maximum). */
  count?: number;
  /** Upscale factor. */
  factor?: number;
  /** Expand: pixels to add on each side of `image`. */
  padding?: Padding;
}

/** A picture the server stored for this user. */
export interface GeneratedImage {
  /** Storage path — what a layer keeps. */
  src: string;
  /** Short-lived signed URL, to show it straight away. */
  url: string;
  width: number;
  height: number;
  contentType: string;
}

/** Layerize: one separated element and where it sat in the base picture. */
export interface GeneratedLayer {
  image: GeneratedImage;
  name?: string;
  /** [left, top, right, bottom] in the base picture's pixels. */
  box?: [number, number, number, number];
  z: number;
}

export interface AiGenerateResponse {
  images: GeneratedImage[];
  /** Layerize only: `images[0]` is the base, these are the elements above it. */
  layers?: GeneratedLayer[];
  /** Estimated cost of this request, in US dollars. */
  costUsd: number;
  /** Requests left for this user today (null = unlimited). */
  remaining: number | null;
}

export interface AiModelsResponse {
  /** False when generation is switched off or not open to this user. */
  enabled: boolean;
  reason?: string;
  /** Ids of the catalogue models whose provider is configured. */
  models: string[];
  remaining: number | null;
}

export interface AiErrorBody {
  error: { code: string; message: string };
}
