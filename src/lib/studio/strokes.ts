/**
 * Erase / restore brush.
 *
 * Strokes are stored as normalised polylines and replayed into an offscreen
 * alpha mask, which is then composited onto the layer with `destination-in`.
 * Nothing is ever baked into the source pixels, so undo is exact and the
 * document stays JSON.
 *
 * Normalised space (0–1 across the layer's own box) means a stroke survives the
 * layer being resized — erase a face at 40% zoom, scale the layer up, the hole
 * scales with it.
 */

import type { Point, Stroke, StrokeMode } from "./document";
import { createId } from "./document";
import { getShape, type ShapeCommand } from "./shapes";
import { parseSvgPathCached, pathFingerprint, scaleCommands } from "./svgPath";

/** Anything we can draw into: HTMLCanvasElement or OffscreenCanvas. */
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyCtx =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export function createStroke(
  mode: StrokeMode,
  size: number,
  feather: number,
  first: Point
): Stroke {
  return {
    id: createId("s"),
    mode,
    size,
    feather: feather < 0 ? 0 : feather > 1 ? 1 : feather,
    points: [{ ...first }],
  };
}

/**
 * Append a point, skipping ones too close to matter. Returns a new stroke when
 * the point was taken and the same reference when it was skipped, so callers can
 * cheaply tell whether a redraw is needed.
 */
export function extendStroke(
  stroke: Stroke,
  point: Point,
  minDistance = 0.002
): Stroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) {
    return stroke;
  }
  return { ...stroke, points: [...stroke.points, { ...point }] };
}

/**
 * A soft round brush as a radial-gradient fill.
 *
 * Drawn as a gradient stamp rather than a `lineWidth` stroke because feathered
 * edges are the whole point of an eraser — a hard-edged stroke looks cut out.
 */
function stampBrush(
  ctx: AnyCtx,
  x: number,
  y: number,
  radius: number,
  feather: number
): void {
  if (radius <= 0) return;
  if (feather <= 0.001) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const inner = radius * (1 - feather);
  const gradient = ctx.createRadialGradient(x, y, inner, x, y, radius);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Walk the polyline stamping the brush at a spacing fine enough to look
 * continuous. Spacing is a fraction of the radius, so big brushes take fewer
 * stamps and the cost stays roughly constant per unit length.
 */
function replayStroke(
  ctx: AnyCtx,
  stroke: Stroke,
  width: number,
  height: number
): void {
  // Stroke size is normalised against the layer's shorter edge so a brush stays
  // visually round on non-square layers.
  const radius = (stroke.size * Math.min(width, height)) / 2;
  if (radius <= 0) return;
  const spacing = Math.max(0.75, radius * 0.25);

  const pts = stroke.points;
  if (pts.length === 1) {
    stampBrush(ctx, pts[0].x * width, pts[0].y * height, radius, stroke.feather);
    return;
  }

  for (let i = 1; i < pts.length; i += 1) {
    const ax = pts[i - 1].x * width;
    const ay = pts[i - 1].y * height;
    const bx = pts[i].x * width;
    const by = pts[i].y * height;
    const segment = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(segment / spacing));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      stampBrush(
        ctx,
        ax + (bx - ax) * t,
        ay + (by - ay) * t,
        radius,
        stroke.feather
      );
    }
  }
}

export interface MaskShape {
  kind: "none" | "circle" | "rounded" | "shape" | "path";
  /** Fraction (0–0.5) of the shorter edge. */
  radius: number;
  shapeId?: string;
  path?: { d: string; viewBox: [number, number, number, number] };
}

/**
 * The outline a `shape` or `path` mask clips to, in px inside a `width` ×
 * `height` box — or null when there is nothing traceable, which callers treat
 * as the plain box.
 */
export function maskCommands(
  shape: MaskShape,
  width: number,
  height: number
): ShapeCommand[] | null {
  if (shape.kind === "shape" && shape.shapeId) {
    const def = getShape(shape.shapeId);
    return def && def.mode === "fill" ? def.path(width, height) : null;
  }
  if (shape.kind === "path" && shape.path) {
    const parsed = parseSvgPathCached(shape.path.d);
    return parsed ? scaleCommands(parsed, shape.path.viewBox, width, height) : null;
  }
  return null;
}

/** Trace a mask shape as a path on `ctx`, without filling it. */
export function traceMaskPath(
  ctx: AnyCtx,
  shape: MaskShape,
  width: number,
  height: number
): void {
  ctx.beginPath();
  const commands = maskCommands(shape, width, height);
  if (commands) {
    for (const c of commands) {
      if (c.c === "M") ctx.moveTo(c.x, c.y);
      else if (c.c === "L") ctx.lineTo(c.x, c.y);
      else if (c.c === "Q") ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
      else if (c.c === "C") ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      else ctx.closePath();
    }
    return;
  }
  if (shape.kind === "circle") {
    const cx = width / 2;
    const cy = height / 2;
    // Ellipse rather than a circle so the mask fills a non-square layer, which
    // is what "circle frame" means visually in Canva-style editors.
    ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (shape.kind === "rounded") {
    const r = Math.min(width, height) * Math.min(0.5, Math.max(0, shape.radius));
    if (typeof (ctx as CanvasRenderingContext2D).roundRect === "function") {
      (ctx as CanvasRenderingContext2D).roundRect(0, 0, width, height, r);
    } else {
      // Manual fallback for Safari < 16.4.
      ctx.moveTo(r, 0);
      ctx.lineTo(width - r, 0);
      ctx.arcTo(width, 0, width, r, r);
      ctx.lineTo(width, height - r);
      ctx.arcTo(width, height, width - r, height, r);
      ctx.lineTo(r, height);
      ctx.arcTo(0, height, 0, height - r, r);
      ctx.lineTo(0, r);
      ctx.arcTo(0, 0, r, 0, r);
      ctx.closePath();
    }
    return;
  }
  ctx.rect(0, 0, width, height);
}

export interface BuildMaskParams {
  width: number;
  height: number;
  strokes: Stroke[];
  shape: MaskShape;
  /** Factory so this works with both HTMLCanvasElement and OffscreenCanvas. */
  createCanvas: (w: number, h: number) => AnyCanvas;
}

/**
 * Build the layer's alpha mask: opaque where the pixel should show.
 *
 * Returns `null` when the mask would be fully opaque (no shape, no strokes), so
 * the renderer can skip an entire offscreen pass in the common case.
 */
export function buildLayerMask(params: BuildMaskParams): AnyCanvas | null {
  const { width, height, strokes, shape, createCanvas } = params;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  const hasShape = shape.kind !== "none";
  const hasStrokes = strokes.length > 0;
  if (!hasShape && !hasStrokes) return null;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as AnyCtx | null;
  if (!ctx) return null;

  // Start from the shape (or the full rect) as the opaque region.
  ctx.fillStyle = "#000000";
  traceMaskPath(ctx, shape, w, h);
  ctx.fill();

  if (!hasStrokes) return canvas;

  // Erase punches holes; restore paints opacity back. Replayed in recorded
  // order so a restore over an earlier erase behaves like the user expects.
  for (const stroke of strokes) {
    ctx.globalCompositeOperation =
      stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = "#000000";
    replayStroke(ctx, stroke, w, h);
  }
  ctx.globalCompositeOperation = "source-over";

  // A restore stroke must not paint outside the shape, so re-clip to it.
  if (hasShape) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#000000";
    traceMaskPath(ctx, shape, w, h);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  return canvas;
}

/**
 * Cheap identity for a mask's inputs. The renderer caches the built mask against
 * this, so a pan or a colour change doesn't rebuild it.
 */
export function maskCacheKey(
  width: number,
  height: number,
  strokes: Stroke[],
  shape: MaskShape
): string {
  const strokePart = strokes
    .map((s) => `${s.id}:${s.points.length}:${s.size}:${s.feather}:${s.mode}`)
    .join(",");
  const outline =
    shape.kind === "shape"
      ? shape.shapeId ?? ""
      : shape.kind === "path" && shape.path
        ? `${pathFingerprint(shape.path.d)}@${shape.path.viewBox.join(",")}`
        : "";
  return `${Math.round(width)}x${Math.round(height)}|${shape.kind}:${shape.radius}:${outline}|${strokePart}`;
}
