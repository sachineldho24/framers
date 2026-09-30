"use client";

/**
 * Pictures in and out of a generation, in the browser.
 *
 * In: the photo scaled to what a model can use (and a request can carry), a
 * *context window* around the selection for Replace/Erase — the model sees the
 * object and its surroundings at a useful resolution, which is how phone
 * "object erasers" work — the selection as a mask in the model's own
 * convention, a tinted copy for models that take no mask, and a padded canvas
 * for masked Expand.
 *
 * Out: the result pasted back into the *full-resolution* original through a
 * softened mask, so every pixel outside the selection is exactly the
 * customer's own — which matters when it's printed.
 */

import type { Ring } from "@/lib/studio/maskTrace";

import type { Padding } from "./sizing";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Canvas2D = OffscreenCanvasRenderingContext2D;

function canvas(width: number, height: number) {
  const c = new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  const ctx = c.getContext("2d") as Canvas2D;
  return { c, ctx };
}

export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

export async function loadUrl(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn’t read the picture. Please try again.");
  return createImageBitmap(await res.blob());
}

function encode(c: OffscreenCanvas, type: "image/png" | "image/jpeg", quality = 0.92): Promise<Blob> {
  return c.convertToBlob(type === "image/jpeg" ? { type, quality } : { type });
}

/** Keep the request under Vercel's 4.5 MB body limit with room for the rest. */
const MAX_PART_BYTES = 3_200_000;

/**
 * A region of `source` scaled to fit `maxEdge`, encoded as `type`. JPEG
 * quality steps down (and then the size) until it fits the request budget.
 */
export async function encodeRegion(
  source: CanvasImageSource & { width: number; height: number },
  region: Rect,
  maxEdge: number,
  type: "image/png" | "image/jpeg"
): Promise<{ blob: Blob; width: number; height: number; scale: number }> {
  let edge = maxEdge;
  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = Math.min(1, edge / Math.max(region.width, region.height));
    const width = Math.max(1, Math.round(region.width * scale));
    const height = Math.max(1, Math.round(region.height * scale));
    const { c, ctx } = canvas(width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, width, height);
    for (const quality of type === "image/jpeg" ? [0.92, 0.85, 0.78] : [1]) {
      const blob = await encode(c, type, quality);
      if (blob.size <= MAX_PART_BYTES) return { blob, width, height, scale };
    }
    edge = Math.round(edge * 0.8);
  }
  throw new Error("This photo is too large to send. Try a smaller one.");
}

/**
 * The part of the photo a Replace/Erase model sees: the selection's box plus
 * generous surroundings (at least 60% of the object's size, and 8% of the
 * photo) so it can match light, texture and perspective.
 */
export function contextWindow(bbox: { x0: number; y0: number; x1: number; y1: number }, width: number, height: number): Rect {
  const bw = bbox.x1 - bbox.x0;
  const bh = bbox.y1 - bbox.y0;
  const margin = Math.max(0.6 * Math.max(bw, bh), 0.08 * Math.max(width, height), 48);
  const x0 = Math.max(0, Math.floor(bbox.x0 - margin));
  const y0 = Math.max(0, Math.floor(bbox.y0 - margin));
  const x1 = Math.min(width, Math.ceil(bbox.x1 + margin));
  const y1 = Math.min(height, Math.ceil(bbox.y1 + margin));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function ringsPath(rings: Ring[], window: Rect, scale: number): Path2D {
  const path = new Path2D();
  for (const ring of rings) {
    ring.forEach(([x, y], i) => {
      const px = (x - window.x) * scale;
      const py = (y - window.y) * scale;
      if (i === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
    path.closePath();
  }
  return path;
}

/**
 * The selection (traced rings in source pixels) drawn white on black over
 * `window`, at `scale`, grown by `grow` source pixels so edges, halos and
 * contact shadows are included.
 */
export function selectionMask(rings: Ring[], window: Rect, scale: number, grow: number): OffscreenCanvas {
  const { c, ctx } = canvas(window.width * scale, window.height * scale);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  const path = ringsPath(rings, window, scale);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.fill(path, "nonzero");
  if (grow > 0) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 2 * grow * scale;
    ctx.stroke(path);
  }
  return c;
}

/** The mask in a model's convention (`AiModel.maskStyle`). */
export async function maskBlob(mask: OffscreenCanvas, style: "white" | "black" | "alpha" = "white"): Promise<Blob> {
  if (style === "white") return encode(mask, "image/png");
  const { c, ctx } = canvas(mask.width, mask.height);
  if (style === "black") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "difference";
    ctx.drawImage(mask, 0, 0);
    return encode(c, "image/png");
  }
  // alpha: opaque everywhere except the selection, which is fully transparent.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(whiteAsAlpha(mask), 0, 0);
  return encode(c, "image/png");
}

/** White-on-black → white with alpha = brightness (so it can cut or clip). */
function whiteAsAlpha(mask: OffscreenCanvas): OffscreenCanvas {
  const { c, ctx } = canvas(mask.width, mask.height);
  ctx.drawImage(mask, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i + 3] = px[i];
    px[i] = px[i + 1] = px[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** The picture with the selection tinted red and outlined — "change this part". */
export async function highlightBlob(picture: OffscreenCanvas | ImageBitmap, mask: OffscreenCanvas): Promise<Blob> {
  const { c, ctx } = canvas(mask.width, mask.height);
  ctx.drawImage(picture, 0, 0, c.width, c.height);
  const tint = canvas(mask.width, mask.height);
  tint.ctx.drawImage(whiteAsAlpha(mask), 0, 0);
  tint.ctx.globalCompositeOperation = "source-in";
  tint.ctx.fillStyle = "rgba(255, 0, 0, 0.55)";
  tint.ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(tint.c, 0, 0);
  return encode(c, "image/jpeg", 0.9);
}

/** Draw a canvas region of an image into a fresh canvas (for masks/highlights). */
export function regionCanvas(source: CanvasImageSource, window: Rect, width: number, height: number): OffscreenCanvas {
  const { c, ctx } = canvas(width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, window.x, window.y, window.width, window.height, 0, 0, width, height);
  return c;
}

/**
 * Paste `result` (the model's version of `window`) back into the full-size
 * `original`, only inside `mask` (window-sized, white = take the result),
 * with its edge softened by `feather` source pixels.
 */
export async function pasteBack(
  original: ImageBitmap,
  result: ImageBitmap,
  window: Rect,
  mask: OffscreenCanvas,
  feather: number,
  alpha: boolean
): Promise<{ blob: Blob; width: number; height: number }> {
  const { c, ctx } = canvas(original.width, original.height);
  ctx.drawImage(original, 0, 0);

  // The result, scaled to the window at full resolution, cut to the softened mask.
  const patch = canvas(window.width, window.height);
  patch.ctx.imageSmoothingQuality = "high";
  patch.ctx.drawImage(result, 0, 0, window.width, window.height);
  const soft = canvas(window.width, window.height);
  if (feather > 0) soft.ctx.filter = `blur(${feather}px)`;
  soft.ctx.drawImage(whiteAsAlpha(mask), 0, 0, window.width, window.height);
  patch.ctx.globalCompositeOperation = "destination-in";
  patch.ctx.drawImage(soft.c, 0, 0);

  ctx.drawImage(patch.c, window.x, window.y);
  return { blob: await encode(c, alpha ? "image/png" : "image/jpeg", 0.95), width: c.width, height: c.height };
}

/**
 * Masked Expand: the picture on a bigger transparent canvas (`padding` in the
 * picture's pixels) and an alpha mask that opens the new border.
 */
export async function paddedCanvas(picture: OffscreenCanvas | ImageBitmap, padding: Padding): Promise<{ image: Blob; mask: Blob; width: number; height: number }> {
  const width = picture.width + padding.left + padding.right;
  const height = picture.height + padding.top + padding.bottom;
  const { c, ctx } = canvas(width, height);
  ctx.drawImage(picture, padding.left, padding.top);
  const m = canvas(width, height);
  m.ctx.fillStyle = "#000";
  m.ctx.fillRect(padding.left, padding.top, picture.width, picture.height);
  return { image: await encode(c, "image/png"), mask: await encode(m.c, "image/png"), width, height };
}

/**
 * Finish an Expand at full resolution: the model's grown picture stretched to
 * the grown size, then the customer's original laid back exactly in place,
 * its outer few pixels blended so there is no seam.
 */
export async function expandBack(
  original: ImageBitmap,
  result: ImageBitmap,
  padding: Padding,
  alpha: boolean
): Promise<{ blob: Blob; width: number; height: number }> {
  const width = original.width + padding.left + padding.right;
  const height = original.height + padding.top + padding.bottom;
  const { c, ctx } = canvas(width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(result, 0, 0, width, height);

  const feather = Math.max(2, Math.round(Math.max(original.width, original.height) * 0.006));
  const inner = canvas(original.width, original.height);
  inner.ctx.drawImage(original, 0, 0);
  const edge = canvas(original.width, original.height);
  edge.ctx.filter = `blur(${feather}px)`;
  edge.ctx.fillStyle = "#fff";
  // Only the sides that grew are blended; the others stay hard (they are the picture's edge).
  const inset = (grew: number) => (grew > 0 ? feather * 2 : -feather * 3);
  const l = inset(padding.left);
  const t = inset(padding.top);
  const r = inset(padding.right);
  const b = inset(padding.bottom);
  edge.ctx.fillRect(l, t, original.width - l - r, original.height - t - b);
  inner.ctx.globalCompositeOperation = "destination-in";
  inner.ctx.drawImage(edge.c, 0, 0);
  ctx.drawImage(inner.c, padding.left, padding.top);
  return { blob: await encode(c, alpha ? "image/png" : "image/jpeg", 0.95), width, height };
}
