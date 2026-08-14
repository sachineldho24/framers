/**
 * Crop maths — pure, so the interaction in `StudioCanvas` stays a thin shell
 * over tested functions.
 *
 * What crop means in this document model is worth restating, because it is not
 * the same as resizing a layer. The renderer draws the cropped *source* rect
 * into the whole layer box:
 *
 *     drawImage(image, sx, sy, sw, sh, 0, 0, layer.width, layer.height)
 *
 * so the crop rect always fills the box. Shrinking it zooms the content in and
 * the layer's footprint on the page never moves. That is why cropping is
 * expressed as a normalised rect over the source, not as a new box.
 *
 * The window is worked on in the layer's *local* space (origin at the layer's
 * top-left, unrotated, in doc px) so `resizeFromHandle` — already tested for
 * all eight handles — does the work, and rotation is handled once by the
 * caller's `docToLocal`.
 */

import type { CropRect, ImageLayer } from "./document";
import {
  clamp,
  handleLocal,
  resizeFromHandle,
  ALL_HANDLES,
  MIN_LAYER_SIZE,
  type Box,
  type HandleId,
  type Vec,
} from "./geometry";

/** Smallest crop on either axis. Matches the reducer's own floor. */
export const MIN_CROP = 0.02;

/** The crop window as a local-space box. Rotation is 0: local space is axis-aligned. */
export function cropWindow(
  crop: CropRect,
  layerWidth: number,
  layerHeight: number
): Box {
  return {
    x: crop.x * layerWidth,
    y: crop.y * layerHeight,
    width: crop.w * layerWidth,
    height: crop.h * layerHeight,
    rotation: 0,
  };
}

/**
 * Clip a window to the layer box and normalise it back to 0–1.
 *
 * Each edge is clipped independently, which is what makes a drag past the image
 * edge stop dead rather than slide the window along it: the far edge keeps its
 * position, so only the dragged edge is limited.
 */
export function normaliseWindow(
  win: Box,
  layerWidth: number,
  layerHeight: number
): CropRect {
  const left = clamp(win.x, 0, layerWidth);
  const top = clamp(win.y, 0, layerHeight);
  const right = clamp(win.x + win.width, 0, layerWidth);
  const bottom = clamp(win.y + win.height, 0, layerHeight);
  const w = Math.max(MIN_CROP, (right - left) / layerWidth);
  const h = Math.max(MIN_CROP, (bottom - top) / layerHeight);
  return {
    x: clamp(left / layerWidth, 0, 1 - w),
    y: clamp(top / layerHeight, 0, 1 - h),
    w,
    h,
  };
}

/** Which of the eight crop handles is under a local-space point, if any. */
export function hitTestCropHandle(
  win: Box,
  point: Vec,
  tolerance: number
): HandleId | null {
  for (const id of ALL_HANDLES) {
    const h = handleLocal(win, id);
    const dx = win.x + h.x - point.x;
    const dy = win.y + h.y - point.y;
    if (Math.hypot(dx, dy) <= tolerance) return id;
  }
  return null;
}

/** Is a local-space point inside the crop window? */
export function insideWindow(win: Box, point: Vec): boolean {
  return (
    point.x >= win.x &&
    point.y >= win.y &&
    point.x <= win.x + win.width &&
    point.y <= win.y + win.height
  );
}

export interface CropDragOptions {
  /** Preserve the window's starting shape (Shift). */
  lockAspect?: boolean;
}

/** Resize the crop window by dragging `handle` to a local-space point. */
export function cropFromHandle(
  startCrop: CropRect,
  handle: HandleId,
  pointLocal: Vec,
  layerWidth: number,
  layerHeight: number,
  options: CropDragOptions = {}
): CropRect {
  const start = cropWindow(startCrop, layerWidth, layerHeight);
  const next = resizeFromHandle(start, handle, pointLocal, {
    aspect: options.lockAspect ? start.width / start.height : null,
    minSize: MIN_CROP * Math.min(layerWidth, layerHeight),
  });
  return normaliseWindow(next, layerWidth, layerHeight);
}

/**
 * Pan the source rect under a fixed window.
 *
 * The sign is inverted on purpose: dragging the image right should reveal what
 * is to its left, so the source rect moves the opposite way to the pointer —
 * the same feel as `FramePreview`'s pan. Clamped so the window can never leave
 * the image.
 */
export function cropFromPan(
  startCrop: CropRect,
  startLocal: Vec,
  pointLocal: Vec,
  layerWidth: number,
  layerHeight: number
): CropRect {
  const dx = (pointLocal.x - startLocal.x) / layerWidth;
  const dy = (pointLocal.y - startLocal.y) / layerHeight;
  return {
    w: startCrop.w,
    h: startCrop.h,
    x: clamp(startCrop.x - dx, 0, 1 - startCrop.w),
    y: clamp(startCrop.y - dy, 0, 1 - startCrop.h),
  };
}

/* ------------------------------------------------------------ aspect ratios */

/**
 * Aspect presets — "make this photo a square", "make it the shape of the frame".
 *
 * The subtlety is that an aspect is a property of *two* things at once here. The
 * renderer stretches the cropped source into the whole layer box, so the shape
 * the viewer sees is the box's, while the shape of the pixels being drawn is the
 * crop's. Setting one without the other distorts the photo. `fitToAspect`
 * therefore returns both, and the reducer commits them in a single action so no
 * intermediate state is ever rendered or undone into.
 */

export interface AspectPreset {
  id: string;
  /** Already turned the way the page is, so it can be shown verbatim. */
  label: string;
  /** Width ÷ height. */
  aspect: number;
  /** Longer, for a tooltip. */
  hint: string;
}

/**
 * The shapes worth one tap, in the order they're offered.
 *
 * Written short-edge-first and turned to match the page below, because the frame
 * decides the orientation of a print: on a portrait frame "4:5" is 4 wide by 5
 * tall, and on a landscape one the same button has to mean 5 by 4 or it would be
 * offering a shape nobody ordered.
 */
const RATIOS: Array<{ short: number; long: number; hint: string }> = [
  { short: 1, long: 1, hint: "Square" },
  { short: 3, long: 4, hint: "Standard camera shape" },
  { short: 4, long: 5, hint: "8×10 inch print" },
  { short: 5, long: 7, hint: "5×7 inch print" },
  { short: 2, long: 3, hint: "4×6 inch print" },
];

export function aspectPresets(
  pageWidth: number,
  pageHeight: number
): AspectPreset[] {
  const portrait = pageHeight >= pageWidth;
  const frame = pageWidth / pageHeight;
  return [
    {
      id: "frame",
      label: "Frame",
      aspect: Number.isFinite(frame) && frame > 0 ? frame : 1,
      hint: "The same shape as the page, so the photo fills the frame",
    },
    ...RATIOS.map(({ short, long, hint }) => {
      const [w, h] = portrait ? [short, long] : [long, short];
      return { id: `${short}:${long}`, label: `${w}:${h}`, aspect: w / h, hint };
    }),
  ];
}

/** Is a box already this shape? Used to light the button, not to gate it. */
export function aspectMatches(
  width: number,
  height: number,
  aspect: number,
  tolerance = 0.005
): boolean {
  if (height <= 0 || aspect <= 0) return false;
  return Math.abs(width / height - aspect) <= aspect * tolerance;
}

/** The largest rect of a given w:h that fits inside `within`, on its centre. */
function ratioRect(ratio: number, within: CropRect): CropRect {
  let w = Math.min(within.w, within.h * ratio);
  let h = w / ratio;
  // Scale both axes together to stay off the reducer's floor and inside the
  // source: anything that moved one axis alone would lose the ratio, which is
  // the only thing this rect is for.
  const grow = Math.max(1, MIN_CROP / w, MIN_CROP / h);
  w *= grow;
  h *= grow;
  const shrink = Math.min(1, 1 / w, 1 / h);
  w *= shrink;
  h *= shrink;
  const cx = within.x + within.w / 2;
  const cy = within.y + within.h / 2;
  return {
    w,
    h,
    x: clamp(cx - w / 2, 0, 1 - w),
    y: clamp(cy - h / 2, 0, 1 - h),
  };
}

export type AspectSource = Pick<
  ImageLayer,
  "x" | "y" | "width" | "height" | "crop" | "naturalWidth" | "naturalHeight"
>;

export interface AspectFit {
  x: number;
  y: number;
  width: number;
  height: number;
  crop: CropRect;
}

/**
 * Reshape a layer to `aspect` without distorting the photo.
 *
 * The box keeps its area and its centre, so the photo carries the same visual
 * weight after the tap as before — but never larger than the page, since a
 * preset is meant to recompose the picture, not push it off the paper. The crop
 * is then the largest rect of the matching *source* shape inside the crop the
 * user already has, so their existing zoom survives and the source can only be
 * narrowed, never re-widened past the edge of the image.
 */
export function fitToAspect(
  layer: AspectSource,
  aspect: number,
  page: { width: number; height: number }
): AspectFit {
  const target = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;

  const area = Math.max(
    layer.width * layer.height,
    MIN_LAYER_SIZE * MIN_LAYER_SIZE
  );
  let width = Math.sqrt(area * target);
  let height = width / target;
  const cap = Math.min(1, page.width / width, page.height / height);
  if (cap < 1) {
    width *= cap;
    height *= cap;
  }

  // A crop rect is normalised over the source, so equal *printed* edges are
  // unequal fractions of a non-square image: the natural size has to come back
  // in here or the photo would come out stretched by exactly its own aspect.
  const nW = Math.max(1, layer.naturalWidth);
  const nH = Math.max(1, layer.naturalHeight);

  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    crop: ratioRect((target * nH) / nW, layer.crop),
  };
}
