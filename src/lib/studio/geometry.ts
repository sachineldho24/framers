/**
 * Studio geometry — pure math for selection, hit-testing, resize and viewport.
 *
 * Everything here works on a structural `Box` (position, size, rotation about
 * the centre) so it has no dependency on the document model and stays trivially
 * unit-testable. Doc space is the document's own pixel grid; screen space is
 * CSS px inside the canvas viewport.
 */

export interface Vec {
  x: number;
  y: number;
}

/** Axis-aligned size + position, rotated about its own centre. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
}

export interface Viewport {
  /** Doc px → screen px multiplier. */
  scale: number;
  /** Screen px offset of doc origin. */
  offsetX: number;
  offsetY: number;
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type GrabTarget = HandleId | "rotate" | "body";

export const CORNER_HANDLES: HandleId[] = ["nw", "ne", "se", "sw"];
export const EDGE_HANDLES: HandleId[] = ["n", "e", "s", "w"];
export const ALL_HANDLES: HandleId[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

/** Smallest layer edge we allow, in doc px. */
export const MIN_LAYER_SIZE = 8;

/**
 * Screen-space interaction constants. These live in screen px, not doc px, so a
 * handle stays the same physical size to grab at every zoom level. Callers
 * divide by `viewport.scale` when hit-testing in doc space.
 */
export const HANDLE_HIT_TOLERANCE = 11;
/** Gap from the box's bottom edge to the rotate grip's centre. */
export const ROTATE_GRIP_OFFSET = 30;

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Normalise any angle into [0, 360). */
export function normaliseAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function rotateVec(v: Vec, rad: number): Vec {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function boxCentre(box: Box): Vec {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Local coords (origin at the box's top-left, unrotated) → doc coords. */
export function localToDoc(box: Box, local: Vec): Vec {
  const c = boxCentre(box);
  const rel = { x: local.x - box.width / 2, y: local.y - box.height / 2 };
  const rot = rotateVec(rel, degToRad(box.rotation));
  return { x: c.x + rot.x, y: c.y + rot.y };
}

/** Doc coords → local coords (origin at the box's top-left, unrotated). */
export function docToLocal(box: Box, p: Vec): Vec {
  const c = boxCentre(box);
  const rel = rotateVec({ x: p.x - c.x, y: p.y - c.y }, -degToRad(box.rotation));
  return { x: rel.x + box.width / 2, y: rel.y + box.height / 2 };
}

/** The four corners in doc space, clockwise from top-left. */
export function boxCorners(box: Box): Vec[] {
  return [
    localToDoc(box, { x: 0, y: 0 }),
    localToDoc(box, { x: box.width, y: 0 }),
    localToDoc(box, { x: box.width, y: box.height }),
    localToDoc(box, { x: 0, y: box.height }),
  ];
}

/** Handle position in the box's local (unrotated) frame. */
export function handleLocal(box: Box, handle: HandleId): Vec {
  const midX = box.width / 2;
  const midY = box.height / 2;
  switch (handle) {
    case "nw":
      return { x: 0, y: 0 };
    case "n":
      return { x: midX, y: 0 };
    case "ne":
      return { x: box.width, y: 0 };
    case "e":
      return { x: box.width, y: midY };
    case "se":
      return { x: box.width, y: box.height };
    case "s":
      return { x: midX, y: box.height };
    case "sw":
      return { x: 0, y: box.height };
    case "w":
      return { x: 0, y: midY };
  }
}

/** Handle position in doc space. */
export function handlePoint(box: Box, handle: HandleId): Vec {
  return localToDoc(box, handleLocal(box, handle));
}

/** The rotate grip sits below the box's bottom edge, as in the mockup. */
export function rotateHandlePoint(box: Box, offsetDoc: number): Vec {
  return localToDoc(box, { x: box.width / 2, y: box.height + offsetDoc });
}

export function oppositeHandle(handle: HandleId): HandleId {
  const map: Record<HandleId, HandleId> = {
    nw: "se",
    n: "s",
    ne: "sw",
    e: "w",
    se: "nw",
    s: "n",
    sw: "ne",
    w: "e",
  };
  return map[handle];
}

/** Which axes a handle drives: -1 grows left/up, +1 grows right/down, 0 locked. */
export function handleAxes(handle: HandleId): { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } {
  const map: Record<HandleId, { sx: -1 | 0 | 1; sy: -1 | 0 | 1 }> = {
    nw: { sx: -1, sy: -1 },
    n: { sx: 0, sy: -1 },
    ne: { sx: 1, sy: -1 },
    e: { sx: 1, sy: 0 },
    se: { sx: 1, sy: 1 },
    s: { sx: 0, sy: 1 },
    sw: { sx: -1, sy: 1 },
    w: { sx: -1, sy: 0 },
  };
  return map[handle];
}

/** CSS cursor for a handle, accounting for the box's rotation. */
export function handleCursor(handle: HandleId, rotation: number): string {
  const base: Record<HandleId, number> = {
    n: 0,
    ne: 45,
    e: 90,
    se: 135,
    s: 180,
    sw: 225,
    w: 270,
    nw: 315,
  };
  const cursors = [
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
  ];
  const angle = normaliseAngle(base[handle] + rotation);
  // Each cursor covers a 45° arc, offset by half an arc so the boundaries land
  // between the named directions rather than on them.
  const index = Math.round(angle / 45) % 4;
  return cursors[index];
}

/** Is the doc-space point inside the (rotated) box? */
export function hitTestBox(box: Box, p: Vec): boolean {
  const local = docToLocal(box, p);
  return (
    local.x >= 0 && local.x <= box.width && local.y >= 0 && local.y <= box.height
  );
}

/**
 * Which grab target is under the pointer, handles first.
 * `tolerance` is in doc px so callers pass `screenTolerance / viewport.scale`.
 */
export function hitTestTargets(
  box: Box,
  p: Vec,
  tolerance: number,
  rotateOffset: number
): GrabTarget | null {
  const rotate = rotateHandlePoint(box, rotateOffset);
  if (distance(rotate, p) <= tolerance) return "rotate";
  for (const handle of ALL_HANDLES) {
    if (distance(handlePoint(box, handle), p) <= tolerance) return handle;
  }
  return hitTestBox(box, p) ? "body" : null;
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface ResizeOptions {
  /** width/height to preserve. `null` resizes freely. */
  aspect?: number | null;
  /** Resize symmetrically about the box centre (Alt). */
  fromCentre?: boolean;
  minSize?: number;
}

/**
 * Resize a box by dragging `handle` to `pointer` (doc space).
 *
 * Works in the box's own rotated frame and keeps the opposite handle pinned,
 * so a rotated box resizes along its own axes rather than the screen's.
 */
export function resizeFromHandle(
  box: Box,
  handle: HandleId,
  pointer: Vec,
  options: ResizeOptions = {}
): Box {
  const { aspect = null, fromCentre = false, minSize = MIN_LAYER_SIZE } =
    options;
  const rad = degToRad(box.rotation);
  const { sx, sy } = handleAxes(handle);

  const anchor = fromCentre
    ? boxCentre(box)
    : handlePoint(box, oppositeHandle(handle));

  // Pointer in the anchor-relative, unrotated frame.
  const rel = rotateVec(
    { x: pointer.x - anchor.x, y: pointer.y - anchor.y },
    -rad
  );

  const span = fromCentre ? 2 : 1;
  let width = sx === 0 ? box.width : Math.abs(rel.x) * span;
  let height = sy === 0 ? box.height : Math.abs(rel.y) * span;

  if (aspect && aspect > 0) {
    if (sx === 0) {
      width = height * aspect;
    } else if (sy === 0) {
      height = width / aspect;
    } else {
      // Corner drag: follow whichever axis moved further, proportionally.
      const byWidth = width / box.width;
      const byHeight = height / box.height;
      if (byWidth >= byHeight) height = width / aspect;
      else width = height * aspect;
    }
  }

  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  // Re-derive the centre so the anchor stays exactly where it was.
  let centre: Vec;
  if (fromCentre) {
    centre = anchor;
  } else {
    const offsetLocal = { x: (sx * width) / 2, y: (sy * height) / 2 };
    const offsetDoc = rotateVec(offsetLocal, rad);
    centre = { x: anchor.x + offsetDoc.x, y: anchor.y + offsetDoc.y };
  }

  return {
    x: centre.x - width / 2,
    y: centre.y - height / 2,
    width,
    height,
    rotation: box.rotation,
  };
}

/**
 * Rotation (degrees) implied by dragging the rotate grip to `pointer`.
 * `grabOffset` is the angle between the grip and the pointer when the drag
 * started, so the box doesn't jump on the first move.
 */
export function rotationFromPointer(
  box: Box,
  pointer: Vec,
  grabOffset = 0
): number {
  const c = boxCentre(box);
  const raw = radToDeg(Math.atan2(pointer.y - c.y, pointer.x - c.x)) - 90;
  return normaliseAngle(raw - grabOffset);
}

/** Snap to 15° steps when forced, otherwise nudge onto the nearest right angle. */
export function snapRotation(deg: number, force: boolean, threshold = 4): number {
  const angle = normaliseAngle(deg);
  if (force) return normaliseAngle(Math.round(angle / 15) * 15);
  const nearest = Math.round(angle / 90) * 90;
  return Math.abs(angle - nearest) <= threshold
    ? normaliseAngle(nearest)
    : angle;
}

/** Axis-aligned bounds of a rotated box, in doc space. */
export function boundingRect(box: Box): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const corners = boxCorners(box);
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/** Viewport that centres the document in the viewer with `padding` screen px. */
export function fitViewport(
  docWidth: number,
  docHeight: number,
  viewWidth: number,
  viewHeight: number,
  padding = 48
): Viewport {
  const availW = Math.max(1, viewWidth - padding * 2);
  const availH = Math.max(1, viewHeight - padding * 2);
  const scale = Math.min(availW / docWidth, availH / docHeight);
  return {
    scale,
    offsetX: (viewWidth - docWidth * scale) / 2,
    offsetY: (viewHeight - docHeight * scale) / 2,
  };
}

export function docToScreen(vp: Viewport, p: Vec): Vec {
  return { x: p.x * vp.scale + vp.offsetX, y: p.y * vp.scale + vp.offsetY };
}

export function screenToDoc(vp: Viewport, p: Vec): Vec {
  return { x: (p.x - vp.offsetX) / vp.scale, y: (p.y - vp.offsetY) / vp.scale };
}

/**
 * Zoom to an absolute scale about a fixed screen point (cursor or viewport
 * centre). Clamped, so a fast wheel spin can't leave the document at a scale
 * it can't be recovered from.
 */
export function zoomAt(
  vp: Viewport,
  nextScale: number,
  anchorScreen: Vec
): Viewport {
  const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
  const anchorDoc = screenToDoc(vp, anchorScreen);
  return {
    scale,
    offsetX: anchorScreen.x - anchorDoc.x * scale,
    offsetY: anchorScreen.y - anchorDoc.y * scale,
  };
}

/** Multiply the current zoom about a screen point. */
export function zoomBy(vp: Viewport, factor: number, anchorScreen: Vec): Viewport {
  return zoomAt(vp, vp.scale * factor, anchorScreen);
}

/** Largest box of `aspect` that fits fully inside the document. */
export function containBox(
  docWidth: number,
  docHeight: number,
  naturalWidth: number,
  naturalHeight: number
): Box {
  const aspect = naturalWidth / naturalHeight;
  let width = docWidth;
  let height = width / aspect;
  if (height > docHeight) {
    height = docHeight;
    width = height * aspect;
  }
  return {
    x: (docWidth - width) / 2,
    y: (docHeight - height) / 2,
    width,
    height,
    rotation: 0,
  };
}

/** Smallest box of `aspect` that fully covers the document. */
export function coverBox(
  docWidth: number,
  docHeight: number,
  naturalWidth: number,
  naturalHeight: number
): Box {
  const aspect = naturalWidth / naturalHeight;
  let width = docWidth;
  let height = width / aspect;
  if (height < docHeight) {
    height = docHeight;
    width = height * aspect;
  }
  return {
    x: (docWidth - width) / 2,
    y: (docHeight - height) / 2,
    width,
    height,
    rotation: 0,
  };
}

export type AlignMode =
  | "left"
  | "centre"
  | "right"
  | "top"
  | "middle"
  | "bottom";

/** Align a box to the page. Uses the rotated bounds so it looks right visually. */
export function alignToPage(
  box: Box,
  docWidth: number,
  docHeight: number,
  mode: AlignMode
): Box {
  const bounds = boundingRect(box);
  const dx = box.x - bounds.x;
  const dy = box.y - bounds.y;
  const next = { ...box };
  switch (mode) {
    case "left":
      next.x = dx;
      break;
    case "centre":
      next.x = (docWidth - bounds.width) / 2 + dx;
      break;
    case "right":
      next.x = docWidth - bounds.width + dx;
      break;
    case "top":
      next.y = dy;
      break;
    case "middle":
      next.y = (docHeight - bounds.height) / 2 + dy;
      break;
    case "bottom":
      next.y = docHeight - bounds.height + dy;
      break;
  }
  return next;
}
