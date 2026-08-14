/**
 * Filter presets.
 *
 * Two implementations of the same maths: a CSS filter string for the fast path
 * (`ctx.filter`, hardware-accelerated) and a per-pixel LUT for browsers that
 * don't support `ctx.filter` on a 2D context. Both must agree — `filters.test.ts`
 * pins the parity — otherwise the export wouldn't match what was on screen.
 */

import type { Adjustments } from "./document";

export type FilterId =
  | "none"
  | "mono"
  | "noir"
  | "sepia"
  | "warm"
  | "cool"
  | "fade"
  | "punch"
  | "vintage";

export const DEFAULT_FILTER: FilterId = "none";

export interface FilterPreset {
  id: FilterId;
  label: string;
  /** Multiplicative, 1 = neutral. */
  brightness: number;
  contrast: number;
  saturate: number;
  /** 0–1. */
  sepia: number;
  grayscale: number;
  /** Degrees. */
  hueRotate: number;
}

const preset = (
  id: FilterId,
  label: string,
  over: Partial<Omit<FilterPreset, "id" | "label">> = {}
): FilterPreset => ({
  id,
  label,
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
  ...over,
});

export const FILTER_PRESETS: FilterPreset[] = [
  preset("none", "Original"),
  preset("mono", "Mono", { grayscale: 1, contrast: 1.05 }),
  preset("noir", "Noir", { grayscale: 1, contrast: 1.4, brightness: 0.92 }),
  preset("sepia", "Sepia", { sepia: 0.7, contrast: 1.05, brightness: 1.02 }),
  preset("warm", "Warm", { saturate: 1.2, sepia: 0.2, brightness: 1.04 }),
  preset("cool", "Cool", { saturate: 1.1, hueRotate: -12, brightness: 1.02 }),
  preset("fade", "Fade", { contrast: 0.82, saturate: 0.78, brightness: 1.08 }),
  preset("punch", "Punch", { contrast: 1.28, saturate: 1.35 }),
  preset("vintage", "Vintage", {
    sepia: 0.4,
    contrast: 1.1,
    saturate: 0.85,
    brightness: 1.04,
  }),
];

const PRESET_BY_ID = new Map(FILTER_PRESETS.map((p) => [p.id, p]));

export function getPreset(id: FilterId): FilterPreset {
  return PRESET_BY_ID.get(id) ?? PRESET_BY_ID.get("none")!;
}

/**
 * Blend a preset toward neutral by `strength` (0 = off, 1 = full).
 * hue-rotate is an absolute angle so it scales directly; the rest are ratios
 * around 1, so they lerp from 1.
 */
function scalePreset(p: FilterPreset, strength: number): FilterPreset {
  const t = strength < 0 ? 0 : strength > 1 ? 1 : strength;
  const lerp1 = (v: number) => 1 + (v - 1) * t;
  return {
    ...p,
    brightness: lerp1(p.brightness),
    contrast: lerp1(p.contrast),
    saturate: lerp1(p.saturate),
    sepia: p.sepia * t,
    grayscale: p.grayscale * t,
    hueRotate: p.hueRotate * t,
  };
}

/** −100…100 slider → multiplicative factor around 1. */
export function adjustToFactor(value: number, range = 1): number {
  const v = value < -100 ? -100 : value > 100 ? 100 : value;
  return 1 + (v / 100) * range;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Combined CSS filter string for a layer's preset + manual adjustments.
 * Returns "none" when nothing is applied so callers can skip the work.
 */
export function buildFilterString(
  filterId: FilterId,
  strength: number,
  adjust: Adjustments
): string {
  const p = scalePreset(getPreset(filterId), strength);
  const brightness = round(p.brightness * adjustToFactor(adjust.brightness));
  const contrast = round(p.contrast * adjustToFactor(adjust.contrast));
  const saturate = round(p.saturate * adjustToFactor(adjust.saturation));

  const parts: string[] = [];
  if (brightness !== 1) parts.push(`brightness(${brightness})`);
  if (contrast !== 1) parts.push(`contrast(${contrast})`);
  if (saturate !== 1) parts.push(`saturate(${saturate})`);
  if (p.sepia > 0) parts.push(`sepia(${round(p.sepia)})`);
  if (p.grayscale > 0) parts.push(`grayscale(${round(p.grayscale)})`);
  if (p.hueRotate !== 0) parts.push(`hue-rotate(${round(p.hueRotate)}deg)`);

  return parts.length > 0 ? parts.join(" ") : "none";
}

export function hasVisibleEffect(
  filterId: FilterId,
  strength: number,
  adjust: Adjustments
): boolean {
  return buildFilterString(filterId, strength, adjust) !== "none";
}

/* -------------------------------------------------------------------------- */
/* Manual fallback                                                             */
/* -------------------------------------------------------------------------- */

/** Rec. 601 luma weights — the same ones the CSS filter spec uses. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

/**
 * Apply the same pipeline as `buildFilterString` directly to pixel data, in the
 * order the CSS filter spec composes them: brightness → contrast → saturate →
 * sepia → grayscale. hue-rotate is approximated by the standard matrix.
 *
 * Mutates `data` in place.
 */
export function applyFilterToPixels(
  data: Uint8ClampedArray,
  filterId: FilterId,
  strength: number,
  adjust: Adjustments
): void {
  const p = scalePreset(getPreset(filterId), strength);
  const brightness = p.brightness * adjustToFactor(adjust.brightness);
  const contrast = p.contrast * adjustToFactor(adjust.contrast);
  const saturate = p.saturate * adjustToFactor(adjust.saturation);
  const { sepia, grayscale, hueRotate } = p;

  const contrastOffset = 127.5 * (1 - contrast);
  const hueRad = (hueRotate * Math.PI) / 180;
  const cosH = Math.cos(hueRad);
  const sinH = Math.sin(hueRad);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightness !== 1) {
      r *= brightness;
      g *= brightness;
      b *= brightness;
    }

    if (contrast !== 1) {
      r = r * contrast + contrastOffset;
      g = g * contrast + contrastOffset;
      b = b * contrast + contrastOffset;
    }

    if (saturate !== 1) {
      const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b;
      r = luma + (r - luma) * saturate;
      g = luma + (g - luma) * saturate;
      b = luma + (b - luma) * saturate;
    }

    if (hueRotate !== 0) {
      const nr =
        r * (0.213 + cosH * 0.787 - sinH * 0.213) +
        g * (0.715 - cosH * 0.715 - sinH * 0.715) +
        b * (0.072 - cosH * 0.072 + sinH * 0.928);
      const ng =
        r * (0.213 - cosH * 0.213 + sinH * 0.143) +
        g * (0.715 + cosH * 0.285 + sinH * 0.14) +
        b * (0.072 - cosH * 0.072 - sinH * 0.283);
      const nb =
        r * (0.213 - cosH * 0.213 - sinH * 0.787) +
        g * (0.715 - cosH * 0.715 + sinH * 0.715) +
        b * (0.072 + cosH * 0.928 + sinH * 0.072);
      r = nr;
      g = ng;
      b = nb;
    }

    if (sepia > 0) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }

    if (grayscale > 0) {
      const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b;
      r += (luma - r) * grayscale;
      g += (luma - g) * grayscale;
      b += (luma - b) * grayscale;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}
