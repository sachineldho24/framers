/**
 * Custom page sizes: what "6 × 4 in" or "1080 px" means to this document.
 *
 * One rule holds the whole file together: **a page has a physical size, and the
 * pixel grid is derived from it** — never the other way round. `docSizeForFrame`
 * authors at `PRINT_DPI` and then clamps the long edge to `MAX_DOC_EDGE`, so a
 * big page is deliberately below 300 DPI. If a custom size stored only pixels,
 * everything physical downstream (the lip guides, the DPI readout, the PDF's
 * `/MediaBox`) would have to guess the paper back out of the grid and would get
 * a large print wrong by the clamp ratio.
 *
 * So px input is physical too: pixels are read at `PRINT_DPI`, converted to
 * millimetres, and then run through the same path as mm/cm/in. Typing 2480 ×
 * 3508 px gives A4, which is what someone typing those numbers means.
 *
 * Pure and unit-tested apart from the two clearly-marked `localStorage` helpers
 * at the bottom, which the recents list needs and tests don't touch.
 */

import {
  docSizeForFrame,
  MM_PER_INCH,
  PRINT_DPI,
  type StudioDocument,
} from "./document";
import { documentDpi, type PrintSize } from "./print";

export type SizeUnit = "px" | "mm" | "cm" | "in";

export const SIZE_UNITS: readonly SizeUnit[] = ["px", "mm", "cm", "in"];

/** Millimetres in one of each unit. `px` is a print pixel, hence `PRINT_DPI`. */
const MM_PER_UNIT: Record<SizeUnit, number> = {
  px: MM_PER_INCH / PRINT_DPI,
  mm: 1,
  cm: 10,
  in: MM_PER_INCH,
};

/**
 * Sane paper bounds, in millimetres. The floor is a business card's short edge;
 * the ceiling is well past the largest frame we sell and exists so a typo (or a
 * unit mix-up — 300 *cm* rather than mm) can't author a 3-metre page.
 */
export const MIN_SIZE_MM = 20;
export const MAX_SIZE_MM = 1500;

/** How many hand-entered sizes are offered back. Enough to be useful, not a list. */
export const MAX_RECENT_SIZES = 6;

export function mmPerUnit(unit: SizeUnit): number {
  return MM_PER_UNIT[unit];
}

/** Unit value → millimetres. */
export function toMm(value: number, unit: SizeUnit): number {
  return value * MM_PER_UNIT[unit];
}

/** Millimetres → unit value. Not rounded; the caller decides the precision. */
export function fromMm(mm: number, unit: SizeUnit): number {
  return mm / MM_PER_UNIT[unit];
}

/** Decimals worth showing per unit: whole pixels, tenths of a cm or inch. */
export function unitPrecision(unit: SizeUnit): number {
  return unit === "px" ? 0 : unit === "mm" ? 1 : 2;
}

/** Round for display, without a trailing `.00` on a whole number. */
export function formatInUnit(mm: number, unit: SizeUnit): string {
  const value = fromMm(mm, unit);
  const rounded = Number(value.toFixed(unitPrecision(unit)));
  return String(rounded);
}

/**
 * Parse one typed field. Accepts a bare number with optional spaces and a
 * comma decimal separator (an Indian keyboard's numeric row is the same, but a
 * pasted "21,0" shouldn't silently become 210).
 */
export function parseSizeValue(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface ResolvedSize {
  /** Document pixel grid to resize to. */
  width: number;
  height: number;
  /** The physical size that grid represents — what gets stored on the document. */
  widthMm: number;
  heightMm: number;
  /** The grid's real resolution. Below 300 whenever `MAX_DOC_EDGE` bit. */
  dpi: number;
  /** True when the page is large enough that the grid had to be capped. */
  capped: boolean;
}

export type SizeResult =
  | { ok: true; size: ResolvedSize }
  | { ok: false; error: string };

/**
 * Turn typed numbers into a page. The single entry point: the dialog, a preset
 * and a recent entry all come through here, so none of them can disagree.
 */
export function resolveSize(
  width: number,
  height: number,
  unit: SizeUnit
): SizeResult {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { ok: false, error: "Enter a width and a height." };
  }
  const widthMm = toMm(width, unit);
  const heightMm = toMm(height, unit);
  const min = Math.min(widthMm, heightMm);
  const max = Math.max(widthMm, heightMm);
  if (min < MIN_SIZE_MM) {
    return {
      ok: false,
      error: `Too small to print — the shortest side must be at least ${formatInUnit(
        MIN_SIZE_MM,
        unit
      )} ${unit}.`,
    };
  }
  if (max > MAX_SIZE_MM) {
    return {
      ok: false,
      error: `Too large — the longest side can be at most ${formatInUnit(
        MAX_SIZE_MM,
        unit
      )} ${unit}.`,
    };
  }
  const grid = docSizeForFrame(widthMm, heightMm);
  const dpi = documentDpi(grid, { widthMm, heightMm });
  return {
    ok: true,
    size: {
      ...grid,
      widthMm,
      heightMm,
      dpi,
      capped: dpi < PRINT_DPI - 1,
    },
  };
}

/**
 * The other side of an aspect-locked field. Returned in the same unit, so the
 * dialog can put it straight back in the input the user isn't typing in.
 */
export function lockedCounterpart(
  value: number,
  ratio: number,
  axis: "width" | "height"
): number {
  if (!Number.isFinite(value) || !Number.isFinite(ratio) || ratio <= 0) return value;
  return axis === "width" ? value / ratio : value * ratio;
}

/** The page's current aspect (w/h), for seeding the lock. */
export function documentRatio(doc: Pick<StudioDocument, "width" | "height">): number {
  return doc.height > 0 ? doc.width / doc.height : 1;
}

/**
 * The physical size a document is currently at: its own custom size if it has
 * one, else the frame it was opened with, else the grid read at 300 DPI so the
 * dialog opens on real numbers rather than blank fields.
 */
export function documentPrintSize(
  doc: Pick<StudioDocument, "width" | "height" | "printMm">,
  frame: PrintSize | null
): PrintSize {
  if (doc.printMm) return doc.printMm;
  if (frame) return frame;
  return {
    widthMm: (doc.width / PRINT_DPI) * MM_PER_INCH,
    heightMm: (doc.height / PRINT_DPI) * MM_PER_INCH,
  };
}

/* ------------------------------------------------------------------ presets */

export interface SizePreset {
  /** Stable enough to key a list and to dedupe by. */
  id: string;
  label: string;
  width: number;
  height: number;
  unit: SizeUnit;
}

/** Rounded to the unit's precision, so `1:1` reads as `1` not `1.0000001`. */
function tidy(value: number, unit: SizeUnit): number {
  return Number(value.toFixed(unitPrecision(unit)));
}

export function sizePresetLabel(
  width: number,
  height: number,
  unit: SizeUnit
): string {
  return `${tidy(width, unit)} × ${tidy(height, unit)} ${unit}`;
}

export function makeSizePreset(
  width: number,
  height: number,
  unit: SizeUnit
): SizePreset {
  const w = tidy(width, unit);
  const h = tidy(height, unit);
  return {
    id: `${w}x${h}${unit}`,
    label: sizePresetLabel(w, h, unit),
    width: w,
    height: h,
    unit,
  };
}

/**
 * Most recent first, no duplicates, capped. Pure — the caller decides whether
 * the result is worth persisting.
 */
export function addRecentSize(
  list: SizePreset[],
  preset: SizePreset,
  cap = MAX_RECENT_SIZES
): SizePreset[] {
  const rest = list.filter((p) => p.id !== preset.id);
  return [preset, ...rest].slice(0, Math.max(1, cap));
}

/** Anything off the wire or out of storage. Bad entries are dropped, not fixed. */
export function coerceSizePresets(input: unknown): SizePreset[] {
  if (!Array.isArray(input)) return [];
  const out: SizePreset[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Partial<SizePreset>;
    const unit = SIZE_UNITS.find((u) => u === v.unit);
    const width = Number(v.width);
    const height = Number(v.height);
    if (!unit || !(width > 0) || !(height > 0)) continue;
    const preset = makeSizePreset(width, height, unit);
    if (!out.some((p) => p.id === preset.id)) out.push(preset);
  }
  return out.slice(0, MAX_RECENT_SIZES);
}

/* ------------------------------------------ localStorage (the only impurity) */

const RECENT_KEY = "framers.studio.recentSizes";

/** Per-browser, not per-session: a size someone likes outlives one design. */
export function loadRecentSizes(): SizePreset[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? coerceSizePresets(JSON.parse(raw)) : [];
  } catch {
    // Corrupt entry, or storage denied entirely (Safari private mode).
    return [];
  }
}

/** Best-effort: losing the recents list is not worth failing a resize over. */
export function rememberRecentSize(preset: SizePreset): SizePreset[] {
  const next = addRecentSize(loadRecentSizes(), preset);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* nothing to do — the list is a convenience */
  }
  return next;
}
