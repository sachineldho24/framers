/**
 * Where a photo layer's box and its source pixels meet.
 *
 * A layer shows the `crop` window of its source image, mirrored when flipped,
 * stretched over its box. Object selection works on the *source* (so its cache
 * survives moving, scaling, rotating, cropping and flipping the layer) while
 * clicks and masks live in the *box*. These are the two directions of that
 * mapping — the same one `render.ts` draws with — plus the layer a lifted
 * object gets: a box tight around the object, showing just that part of the
 * source, at exactly the same place on the page.
 *
 * Coordinates:
 * - box-normalised: 0–1 across the layer's own (unrotated) box;
 * - source-normalised: 0–1 across the natural image.
 * `crop` is kept in display space (after the mirror), as the document does.
 */

import type { CropRect } from "./document";
import { localToDoc, type Box } from "./geometry";

export interface PlacedImage {
  crop: CropRect;
  flipX?: boolean;
  flipY?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** The source rect the crop window reads, in source-normalised space. */
function sourceWindow(layer: PlacedImage) {
  const { crop } = layer;
  return {
    x: layer.flipX ? 1 - crop.x - crop.w : crop.x,
    y: layer.flipY ? 1 - crop.y - crop.h : crop.y,
    w: crop.w,
    h: crop.h,
  };
}

/** Box-normalised → source-normalised. */
export function boxToSource(layer: PlacedImage, p: Point): Point {
  const s = sourceWindow(layer);
  return {
    x: s.x + (layer.flipX ? 1 - p.x : p.x) * s.w,
    y: s.y + (layer.flipY ? 1 - p.y : p.y) * s.h,
  };
}

/** Source-normalised → box-normalised. Outside 0–1 when outside the crop. */
export function sourceToBox(layer: PlacedImage, p: Point): Point {
  const s = sourceWindow(layer);
  const u = (p.x - s.x) / s.w;
  const v = (p.y - s.y) / s.h;
  return { x: layer.flipX ? 1 - u : u, y: layer.flipY ? 1 - v : v };
}

export interface SourceRect {
  /** Source-normalised, x0 < x1, y0 < y1. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TightLayer {
  x: number;
  y: number;
  width: number;
  height: number;
  crop: CropRect;
  /** The same rect in the ORIGINAL box, normalised — for mapping mask points. */
  inBox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * A layer showing only `rect` of the source, placed exactly where that part of
 * the original layer is on the page: same rotation and mirror, a box around
 * just the object, and a crop reading just the object's pixels. Clamped to the
 * original crop — what isn't visible in the layer can't be lifted out of it.
 */
export function tightLayerFor(
  layer: PlacedImage & { x: number; y: number; width: number; height: number; rotation: number },
  rect: SourceRect
): TightLayer | null {
  const a = sourceToBox(layer, { x: rect.x0, y: rect.y0 });
  const b = sourceToBox(layer, { x: rect.x1, y: rect.y1 });
  const bx0 = Math.max(0, Math.min(a.x, b.x));
  const bx1 = Math.min(1, Math.max(a.x, b.x));
  const by0 = Math.max(0, Math.min(a.y, b.y));
  const by1 = Math.min(1, Math.max(a.y, b.y));
  if (bx1 <= bx0 || by1 <= by0) return null;

  const width = (bx1 - bx0) * layer.width;
  const height = (by1 - by0) * layer.height;
  // The sub-box's centre, carried through the layer's rotation about its own centre.
  const box: Box = layer;
  const centre = localToDoc(box, {
    x: ((bx0 + bx1) / 2) * layer.width,
    y: ((by0 + by1) / 2) * layer.height,
  });
  const { crop } = layer;
  return {
    x: centre.x - width / 2,
    y: centre.y - height / 2,
    width,
    height,
    // Display space is linear in the box, mirror or not.
    crop: {
      x: crop.x + bx0 * crop.w,
      y: crop.y + by0 * crop.h,
      w: (bx1 - bx0) * crop.w,
      h: (by1 - by0) * crop.h,
    },
    inBox: { x0: bx0, y0: by0, x1: bx1, y1: by1 },
  };
}

/**
 * Map a point in source *pixels* to the tight layer's box, in its own px — the
 * space a path mask's `viewBox: [0, 0, width, height]` is drawn in.
 */
export function sourcePxToTightBox(
  layer: PlacedImage & { width: number; height: number },
  natural: { width: number; height: number },
  tight: TightLayer,
  px: number,
  py: number
): [number, number] {
  const p = sourceToBox(layer, { x: px / natural.width, y: py / natural.height });
  return [(p.x - tight.inBox.x0) * layer.width, (p.y - tight.inBox.y0) * layer.height];
}

/** Growth on each side of a source image, as fractions of its width/height. */
export interface Growth {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The box a photo needs after Expand grew its source by `growth`, so the
 * original part stays exactly where it is on the page and the new border
 * appears around it — through the layer's crop, mirror and rotation. The
 * expanded layer shows its whole (new) source: crop resets to full.
 */
export function expandedBox(
  layer: PlacedImage & { x: number; y: number; width: number; height: number; rotation: number },
  growth: Growth
): { x: number; y: number; width: number; height: number } {
  const { crop } = layer;
  // Display space mirrors the source, so the sides swap with the flip.
  const left = layer.flipX ? growth.right : growth.left;
  const right = layer.flipX ? growth.left : growth.right;
  const top = layer.flipY ? growth.bottom : growth.top;
  const bottom = layer.flipY ? growth.top : growth.bottom;
  const u0 = (-left - crop.x) / crop.w;
  const u1 = (1 + right - crop.x) / crop.w;
  const v0 = (-top - crop.y) / crop.h;
  const v1 = (1 + bottom - crop.y) / crop.h;
  const width = (u1 - u0) * layer.width;
  const height = (v1 - v0) * layer.height;
  const box: Box = layer;
  const centre = localToDoc(box, { x: ((u0 + u1) / 2) * layer.width, y: ((v0 + v1) / 2) * layer.height });
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
}
