import "server-only";

import type { AiModel, AiTask, AspectId, QualityId, ResolutionId } from "../catalog";
import type { ImageInfo } from "../imageInfo";
import type { Padding } from "../sizing";

/** A picture the studio sent, already checked and measured. */
export interface InputImage extends ImageInfo {
  bytes: Uint8Array;
}

/** Everything an adapter needs for one call, normalised by the route. */
export interface AdapterInput {
  model: AiModel;
  task: AiTask;
  prompt: string;
  aspect?: AspectId;
  quality?: QualityId;
  resolution?: ResolutionId;
  count: number;
  factor?: number;
  padding?: Padding;
  /** The photo being worked on (every task but create/sticker). */
  image?: InputImage;
  /** References: extra pictures for edit/create. */
  refs: InputImage[];
  mask?: InputImage;
  /** The photo with the selection tinted — for models that take no mask. */
  highlight?: InputImage;
  /** Deadline for the whole call (epoch ms). */
  deadline: number;
  /**
   * A public URL for a picture, for providers that only take URLs (a
   * short-lived signed link to a copy in our own storage).
   */
  publicUrl: (image: InputImage) => Promise<string>;
}

/** One result: bytes, or a URL the route downloads. */
export interface OutputImage {
  bytes?: Uint8Array;
  url?: string;
}

export interface AdapterOutput {
  images: OutputImage[];
  /** Layerize: for `images[1..]`, their names and boxes in `images[0]`'s pixels. */
  layers?: { name?: string; box?: [number, number, number, number]; z: number }[];
  /** What the provider says it charged, in US dollars, when it says. */
  costUsd?: number;
}

export type Adapter = (input: AdapterInput) => Promise<AdapterOutput>;

export function dataUrl(image: InputImage): string {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`;
}

export function toBlob(image: InputImage): Blob {
  return new Blob([image.bytes as Uint8Array<ArrayBuffer>], { type: image.mime });
}

export function fileName(image: InputImage, base: string): string {
  return `${base}.${image.mime.split("/")[1] === "jpeg" ? "jpg" : image.mime.split("/")[1]}`;
}

/**
 * The instruction for models that take no mask: they edit the whole picture,
 * so we point at the tinted region and paste back only what's inside it.
 */
export function highlightPrompt(prompt: string, task: AiTask): string {
  const what =
    task === "erase" || !prompt.trim()
      ? "Remove the object in that area and fill the space naturally with what would be behind it"
      : prompt.trim();
  return `Edit the first image. Only change the area that is tinted red in the second image: ${what}. Keep everything outside that area exactly as it is — same framing, same size, same lighting, no other changes. Return only the edited first image, without any red tint.`;
}
