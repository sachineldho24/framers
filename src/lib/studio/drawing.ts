/**
 * Freehand drawing — Canva's Draw tool: pen, marker and highlighter strokes,
 * and the signature pad.
 *
 * One stroke is one layer (`DrawLayer`), so a stroke can be selected, moved,
 * recoloured, deleted and undone like any other element. Its points are stored
 * normalised to the layer's box, so resizing the box reshapes the stroke; the
 * weight is doc px and stays put, as a pen line should.
 *
 * Pure: the canvas half is `drawDrawLayer` in `render.ts`.
 */

import type { DrawLayer, Layer } from "./document";
import { createId } from "./document";

export type PenKind = "pen" | "marker" | "highlighter";

export interface PenSettings {
  pen: PenKind;
  /** Colour per pen, so switching back to the marker keeps its red. */
  colors: Record<PenKind, string>;
  /** Thickness step per pen, 0–3. */
  sizes: Record<PenKind, number>;
}

export const DEFAULT_PEN_SETTINGS: PenSettings = {
  pen: "pen",
  colors: { pen: "#1c5cff", marker: "#e53935", highlighter: "#ffeb3b" },
  sizes: { pen: 1, marker: 1, highlighter: 1 },
};

/**
 * Stroke weight as a fraction of the page's short edge, per pen and per
 * thickness step — proportional, so a pen line looks the same on A5 and A2.
 */
const WEIGHTS: Record<PenKind, readonly number[]> = {
  pen: [0.0018, 0.0035, 0.006, 0.01],
  marker: [0.005, 0.009, 0.014, 0.022],
  highlighter: [0.012, 0.02, 0.03, 0.045],
};

export function penWidth(kind: PenKind, step: number, shortEdge: number): number {
  const list = WEIGHTS[kind];
  return Math.max(1, list[Math.max(0, Math.min(list.length - 1, step))] * shortEdge);
}

/** How the highlighter is laid down: see-through, so the words under it read. */
export const HIGHLIGHTER_ALPHA = 0.45;

type Pt = readonly [number, number];

/**
 * A draw layer from absolute document points. The box is the stroke's bounds
 * padded by half its weight, so the selection hugs the ink.
 */
export function drawLayerFromPoints(params: {
  id?: string;
  points: readonly Pt[];
  color: string;
  width: number;
  pen: PenKind;
  name?: string;
}): DrawLayer {
  const pts = params.points.length ? params.points : [[0, 0] as Pt];
  const pad = params.width / 2;
  const minX = Math.min(...pts.map((p) => p[0])) - pad;
  const minY = Math.min(...pts.map((p) => p[1])) - pad;
  const maxX = Math.max(...pts.map((p) => p[0])) + pad;
  const maxY = Math.max(...pts.map((p) => p[1])) + pad;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    id: params.id ?? createId("drw"),
    kind: "draw",
    name: params.name ?? (params.pen === "highlighter" ? "Highlight" : params.pen === "marker" ? "Marker" : "Drawing"),
    x: minX,
    y: minY,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    points: pts.map(([x, y]) => [(x - minX) / width, (y - minY) / height] as [number, number]),
    color: params.color,
    strokeWidth: params.width,
    pen: params.pen,
  };
}

/**
 * Drop points closer than `minGap` to the previous one — a slow drag emits
 * dozens per pixel, which would bloat the document for no visible gain.
 */
export function appendPoint(points: Pt[], next: Pt, minGap: number): Pt[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(next[0] - last[0], next[1] - last[1]) < minGap) return points;
  return [...points, next];
}

/** Distance from a point to a segment. */
function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Does a document point touch this stroke's ink (within `tolerance` doc px)?
 * Ignores rotation, which a freshly drawn stroke never has; a rotated one is
 * tested in its unrotated frame, which is close enough for an eraser.
 */
export function strokeHit(layer: DrawLayer, point: { x: number; y: number }, tolerance: number): boolean {
  const abs = layer.points.map(([x, y]) => [layer.x + x * layer.width, layer.y + y * layer.height] as Pt);
  const reach = layer.strokeWidth / 2 + tolerance;
  const p: Pt = [point.x, point.y];
  if (abs.length === 1) return Math.hypot(p[0] - abs[0][0], p[1] - abs[0][1]) <= reach;
  for (let i = 1; i < abs.length; i += 1) {
    if (segmentDistance(p, abs[i - 1], abs[i]) <= reach) return true;
  }
  return false;
}

export function isDrawLayer(layer: Layer | null | undefined): layer is DrawLayer {
  return layer?.kind === "draw";
}
