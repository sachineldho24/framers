/**
 * Picture-shape arithmetic shared by the studio and the provider adapters:
 * each provider takes size in its own form (a ratio string, "WxH" presets,
 * free width/height on a grid, a pixel budget), and Expand needs to know how
 * much to add on each side to reach a new shape.
 */

import type { AspectId, ResolutionId } from "./catalog";

/** Width ÷ height of "W:H" (or "WxH"). */
export function ratioOf(aspect: string): number {
  const [w, h] = aspect.split(/[:x]/).map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

/** The option whose shape is closest to `ratio` (compared in log space, so 1:2 and 2:1 are equally far from 1:1). */
export function nearestAspect<T extends string>(ratio: number, options: readonly T[]): T {
  let best = options[0];
  let bestD = Infinity;
  for (const option of options) {
    if (option === "auto") continue;
    const d = Math.abs(Math.log(ratioOf(option)) - Math.log(ratio));
    if (d < bestD) {
      bestD = d;
      best = option;
    }
  }
  return best;
}

/** Megapixels a resolution tier stands for (square at that edge). */
export const TIER_MEGAPIXELS: Record<ResolutionId, number> = {
  "0.5K": 0.26,
  "1K": 1.05,
  "2K": 4.2,
  "4K": 8.3,
  "8K": 33,
};

export interface SizeLimits {
  /** Both edges are multiples of this. */
  multiple?: number;
  maxEdge?: number;
  minEdge?: number;
  /** Total pixels allowed. */
  maxPixels?: number;
  minPixels?: number;
}

/** Width and height with `ratio`, about `megapixels` in area, within the provider's limits. */
export function sizeFor(ratio: number, megapixels: number, limits: SizeLimits = {}): { width: number; height: number } {
  const { multiple = 16, maxEdge = 4096, minEdge = 256, maxPixels = Infinity, minPixels = 0 } = limits;
  const pixels = Math.min(maxPixels, Math.max(minPixels, megapixels * 1_000_000));
  let width = Math.sqrt(pixels * ratio);
  let height = width / ratio;
  const shrink = Math.min(1, maxEdge / width, maxEdge / height);
  width *= shrink;
  height *= shrink;
  const snap = (v: number) => Math.max(minEdge, Math.min(maxEdge, Math.round(v / multiple) * multiple));
  width = snap(width);
  height = snap(height);
  // Rounding up can overshoot a pixel budget; step the longer edge back.
  while (width * height > maxPixels && Math.max(width, height) > minEdge) {
    if (width >= height) width -= multiple;
    else height -= multiple;
  }
  return { width, height };
}

/** From "WxH" presets, the one closest in shape, then closest in area to `megapixels`. */
export function nearestPreset(presets: readonly string[], ratio: number, megapixels: number): string {
  let best = presets[0];
  let bestD = Infinity;
  for (const preset of presets) {
    const [w, h] = preset.split("x").map(Number);
    const shape = Math.abs(Math.log(w / h) - Math.log(ratio));
    const area = Math.abs(Math.log((w * h) / (megapixels * 1_000_000)));
    const d = shape * 4 + area;
    if (d < bestD) {
      bestD = d;
      best = preset;
    }
  }
  return best;
}

export function aspectLabel(aspect: AspectId): string {
  return aspect;
}

export interface Padding {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How much to add to a `width`×`height` picture so it becomes `targetRatio`,
 * then `extra` (0.25 = 25%) more room all round. The picture stays centred.
 * Whole pixels; never negative — Expand only ever grows.
 */
export function expandPadding(width: number, height: number, targetRatio: number, extra = 0): Padding {
  let w = width;
  let h = height;
  if (w / h < targetRatio) w = h * targetRatio;
  else h = w / targetRatio;
  w *= 1 + extra;
  h *= 1 + extra;
  const addW = Math.max(0, Math.round(w - width));
  const addH = Math.max(0, Math.round(h - height));
  const left = Math.floor(addW / 2);
  const top = Math.floor(addH / 2);
  return { left, top, right: addW - left, bottom: addH - top };
}

/** Scale a padding measured on one size of a picture to another size of it. */
export function scalePadding(p: Padding, scale: number): Padding {
  return {
    left: Math.round(p.left * scale),
    top: Math.round(p.top * scale),
    right: Math.round(p.right * scale),
    bottom: Math.round(p.bottom * scale),
  };
}

/** Largest edge after scaling a picture down to fit `maxEdge` (never up). */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}
