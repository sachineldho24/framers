/**
 * Print truth: what the document actually becomes on paper, and where the frame
 * hides it.
 *
 * Two facts drive everything here, and both are easy to get wrong by assuming.
 *
 * 1. The document grid is *not* always 300 DPI. `docSizeForFrame` authors at
 *    `PRINT_DPI` and then clamps the long edge to `MAX_DOC_EDGE`, so an A4 page
 *    is a true 300 DPI while A2 lands near 175. Anything that converts document
 *    pixels to inches must divide by the page's real resolution, not by the
 *    constant — otherwise a large print reports a size and a sharpness it will
 *    never have.
 *
 * 2. A framed print is not a poster. The rabbet — the lip the glass and the
 *    print sit behind — covers a few millimetres of every edge, permanently. A
 *    caption placed 2 mm from the edge is not "tight", it is gone.
 *
 * Pure and unit-tested: no DOM, no canvas. The overlay that draws these rects is
 * DOM chrome positioned by the viewport transform, same as the selection box.
 */

import type { ImageLayer, StudioDocument } from "./document";
import { MM_PER_INCH, PRINT_DPI } from "./document";

/** Physical size of the finished print, from the frame catalogue. */
export interface PrintSize {
  widthMm: number;
  heightMm: number;
}

/**
 * How much of each edge the frame's lip covers. A conservative figure for the
 * moulding profiles in the catalogue — better to keep artwork slightly further
 * in than to promise an edge that gets swallowed.
 */
export const RABBET_MM = 4;

/** Breathing room inside the lip. Text on the line reads as a mistake. */
export const SAFE_MM = 6;

/** Below this, a photo is visibly soft at arm's length. */
export const SOFT_DPI = 240;
/** Below this it is soft from across the room, which is where a frame hangs. */
export const POOR_DPI = 150;

export interface PrintScale {
  /** Document pixels per millimetre. Held per axis because a document restored
   *  from a different frame can disagree with the current one. */
  pxPerMmX: number;
  pxPerMmY: number;
  /** The page's real resolution — the smaller axis wins, since that is what
   *  limits detail. */
  dpi: number;
  /** True when the grid reaches the 300 DPI target rather than being capped. */
  full: boolean;
}

export interface GuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintGuideSet {
  /** The frame's opening: everything outside it disappears under the lip. */
  opening: GuideRect;
  /** Keep words, faces and logos inside this. */
  safe: GuideRect;
  openingMm: number;
  safeMm: number;
  scale: PrintScale;
}

export interface Verdict {
  tone: "good" | "ok" | "poor";
  label: string;
}

/**
 * The page's real scale, or `null` when the physical size isn't known (a
 * document opened without a frame). Callers fall back to `PRINT_DPI`, which is
 * what the document was authored at before any clamping.
 */
export function printScale(
  doc: Pick<StudioDocument, "width" | "height">,
  size: PrintSize | null
): PrintScale | null {
  if (!size) return null;
  if (size.widthMm <= 0 || size.heightMm <= 0) return null;
  if (doc.width <= 0 || doc.height <= 0) return null;

  const pxPerMmX = doc.width / size.widthMm;
  const pxPerMmY = doc.height / size.heightMm;
  const dpi = Math.min(pxPerMmX, pxPerMmY) * MM_PER_INCH;

  return {
    pxPerMmX,
    pxPerMmY,
    dpi,
    // A hair of slack: the clamp and the mm→px rounding both land a fraction
    // under 300 on pages that are, for every practical purpose, full quality.
    full: dpi >= PRINT_DPI - 1,
  };
}

/** The page's resolution, falling back to the authored constant. */
export function documentDpi(
  doc: Pick<StudioDocument, "width" | "height">,
  size: PrintSize | null
): number {
  return printScale(doc, size)?.dpi ?? PRINT_DPI;
}

/** Document pixels → printed inches, at the page's real resolution. */
export function printedInches(px: number, dpi: number): number {
  return dpi > 0 ? px / dpi : 0;
}

/** Document pixels → printed millimetres. */
export function printedMm(px: number, dpi: number): number {
  return printedInches(px, dpi) * MM_PER_INCH;
}

/**
 * The two rects worth drawing on the page.
 *
 * Insets are clamped to a third of each edge so a small frame — a 100 mm print
 * is 10 mm of lip and safe area on a 100 mm edge — still yields a usable box
 * rather than an inverted one.
 */
export function printGuides(
  doc: Pick<StudioDocument, "width" | "height">,
  size: PrintSize | null
): PrintGuideSet | null {
  const scale = printScale(doc, size);
  if (!scale) return null;

  const inset = (mm: number): GuideRect => {
    const dx = Math.min(mm * scale.pxPerMmX, doc.width / 3);
    const dy = Math.min(mm * scale.pxPerMmY, doc.height / 3);
    return {
      x: dx,
      y: dy,
      width: doc.width - dx * 2,
      height: doc.height - dy * 2,
    };
  };

  return {
    opening: inset(RABBET_MM),
    safe: inset(RABBET_MM + SAFE_MM),
    openingMm: RABBET_MM,
    safeMm: RABBET_MM + SAFE_MM,
    scale,
  };
}

/**
 * A photo's real print resolution: the source pixels still in play after the
 * crop, spread over the inches it occupies on the page.
 *
 * Both axes are checked and the worse one reported — a wide crop of a short
 * image is limited by its height, and the eye notices the soft direction.
 */
export function imagePrintDpi(layer: ImageLayer, docDpi: number): number {
  const wIn = printedInches(layer.width, docDpi);
  const hIn = printedInches(layer.height, docDpi);
  if (wIn <= 0 || hIn <= 0) return 0;
  const across = (layer.naturalWidth * layer.crop.w) / wIn;
  const down = (layer.naturalHeight * layer.crop.h) / hIn;
  return Math.min(across, down);
}

/**
 * A source photo measured against a physical frame, before any document exists.
 *
 * This is the size step's arithmetic, and it is not the same question as
 * `imagePrintDpi`: there is no layer and no crop yet, only "this many pixels,
 * that many millimetres of paper". The frame's shape does the cropping, because
 * every preview in the flow fills the opening rather than letterboxing.
 *
 * `pageDpi` is folded in deliberately. The print file is a document, and
 * `docSizeForFrame` clamps its long edge — on a big frame the grid, not the
 * photo, is the limit, and quoting the photo's own figure there would promise
 * sharpness the file cannot carry.
 */
export interface PhotoFit {
  /** What this photo really prints at in this frame, page grid included. */
  dpi: number;
  verdict: Verdict;
  /** Largest print holding `PRINT_DPI` over the whole photo, uncropped, inches. */
  sharpIn: { width: number; height: number };
  /** The same at `POOR_DPI` — the honest upper bound for something on a wall. */
  maxIn: { width: number; height: number };
  /** Fraction of the photo the frame's shape trims away, 0–1. */
  cropped: number;
}

export function photoInFrame(
  source: { width: number; height: number },
  size: PrintSize,
  pageDpi = PRINT_DPI
): PhotoFit | null {
  if (source.width <= 0 || source.height <= 0) return null;
  if (size.widthMm <= 0 || size.heightMm <= 0) return null;

  const wIn = size.widthMm / MM_PER_INCH;
  const hIn = size.heightMm / MM_PER_INCH;

  // Cover, not contain: the softer axis is the one that has to stretch furthest
  // to fill the opening, so it sets the resolution.
  const cover = Math.min(source.width / wIn, source.height / hIn);
  const dpi = Math.min(cover, pageDpi);

  const frameAspect = wIn / hIn;
  const photoAspect = source.width / source.height;
  const kept =
    photoAspect > frameAspect
      ? frameAspect / photoAspect
      : photoAspect / frameAspect;

  return {
    dpi,
    verdict: dpiVerdict(dpi),
    sharpIn: {
      width: source.width / PRINT_DPI,
      height: source.height / PRINT_DPI,
    },
    maxIn: { width: source.width / POOR_DPI, height: source.height / POOR_DPI },
    cropped: 1 - kept,
  };
}

/** A plain verdict, because "187 DPI" tells a buyer nothing. */
export function dpiVerdict(dpi: number): Verdict {
  if (dpi >= SOFT_DPI) return { tone: "good", label: "Sharp at print size" };
  if (dpi >= POOR_DPI)
    return { tone: "ok", label: "Acceptable — slightly soft up close" };
  return { tone: "poor", label: "Low — will look soft when printed" };
}

/**
 * The whole page's print quality, for the persistent readout.
 *
 * The page's own grid is one input and every visible photo is another: a 300 DPI
 * page carrying a phone screenshot blown up to fill it is not a 300 DPI print,
 * and reporting only the grid would say it was.
 */
export function documentQuality(
  doc: StudioDocument,
  size: PrintSize | null
): { dpi: number; pageDpi: number; softest: number; verdict: Verdict } {
  const pageDpi = documentDpi(doc, size);
  let softest = Infinity;

  for (const layer of doc.layers) {
    if (!layer.visible || layer.kind !== "image") continue;
    const dpi = imagePrintDpi(layer, pageDpi);
    if (dpi > 0) softest = Math.min(softest, dpi);
  }

  // A photo can't add detail the grid doesn't have, so the page caps it.
  const effective = Math.min(pageDpi, softest);
  return {
    dpi: effective,
    pageDpi,
    softest: Number.isFinite(softest) ? softest : 0,
    verdict: dpiVerdict(effective),
  };
}

/**
 * Visible photos that will print soft, worst first — what a "check this before
 * you buy" prompt needs to name.
 */
export function softImageLayers(
  doc: StudioDocument,
  size: PrintSize | null
): { layer: ImageLayer; dpi: number }[] {
  const dpi = documentDpi(doc, size);
  return doc.layers
    .filter((l): l is ImageLayer => l.visible && l.kind === "image")
    .map((layer) => ({ layer, dpi: imagePrintDpi(layer, dpi) }))
    .filter((entry) => entry.dpi > 0 && entry.dpi < POOR_DPI)
    .sort((a, b) => a.dpi - b.dpi);
}

/** Layers whose box crosses out of the safe area, so their content is at risk. */
export function layersOutsideSafeArea(
  doc: StudioDocument,
  size: PrintSize | null
): string[] {
  const guides = printGuides(doc, size);
  if (!guides) return [];
  const { safe } = guides;

  return doc.layers
    .filter((layer) => {
      if (!layer.visible) return false;
      // Only text and small elements are worth flagging: a photo is *meant* to
      // run past the safe area and under the lip, that's how a full-bleed print
      // avoids a white edge.
      if (layer.kind !== "text") return false;
      return (
        layer.x < safe.x - 0.5 ||
        layer.y < safe.y - 0.5 ||
        layer.x + layer.width > safe.x + safe.width + 0.5 ||
        layer.y + layer.height > safe.y + safe.height + 0.5
      );
    })
    .map((layer) => layer.id);
}
