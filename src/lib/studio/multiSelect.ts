/**
 * Multi-selection geometry: the marquee, groups, and moving or scaling several
 * layers as one — Canva's rubber-band selection and Group.
 *
 * Pure, so the canvas gesture code only wires pointer events to it.
 */

import type { Layer } from "./document";
import { boundingRect, type AlignMode, type HandleId } from "./geometry";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Union of the layers' on-page (rotated) bounds. */
export function selectionBounds(layers: Layer[]): Rect | null {
  if (layers.length === 0) return null;
  const boxes = layers.map(boundingRect);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** Normalise a drag from `a` to `b` into a rect with positive size. */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * Layers the marquee touches, as Canva does it: any overlap selects, so a
 * sweep across the middle of a photo picks it up without having to enclose it.
 * Hidden layers can't be seen, so they can't be swept up either.
 */
export function layersInRect(layers: Layer[], rect: Rect): Layer[] {
  return layers.filter((layer) => {
    if (!layer.visible) return false;
    const b = boundingRect(layer);
    return (
      b.x < rect.x + rect.width &&
      b.x + b.width > rect.x &&
      b.y < rect.y + rect.height &&
      b.y + b.height > rect.y
    );
  });
}

/** Expand a selection to whole groups: picking one member picks them all. */
export function withGroups(all: Layer[], picked: Layer[]): Layer[] {
  const groups = new Set(picked.map((l) => l.groupId).filter(Boolean));
  const ids = new Set(picked.map((l) => l.id));
  return all.filter((l) => ids.has(l.id) || (l.groupId !== undefined && groups.has(l.groupId)));
}

/** Every layer in `layer`'s group, or just the layer. */
export function groupOf(all: Layer[], layer: Layer): Layer[] {
  return layer.groupId ? all.filter((l) => l.groupId === layer.groupId) : [layer];
}

/** Whether exactly these layers form one whole group (so "Ungroup" applies). */
export function isWholeGroup(all: Layer[], selected: Layer[]): boolean {
  if (selected.length < 2) return false;
  const id = selected[0].groupId;
  if (!id || selected.some((l) => l.groupId !== id)) return false;
  return all.filter((l) => l.groupId === id).length === selected.length;
}

export interface LayerPatch {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  /** Text only: the type scales with its box. */
  fontSize?: number;
}

/**
 * Scale layers uniformly about the corner opposite `handle` of their joint
 * bounds, so a lockup grows as one piece and keeps its proportions — the
 * spacing between lines scales along with the lines.
 */
export function scaleLayers(
  start: Layer[],
  bounds: Rect,
  handle: HandleId,
  pointer: { x: number; y: number },
  minSize = 8
): LayerPatch[] {
  const west = handle.includes("w");
  const north = handle.includes("n");
  const anchor = {
    x: west ? bounds.x + bounds.width : bounds.x,
    y: north ? bounds.y + bounds.height : bounds.y,
  };
  const sx = Math.abs(pointer.x - anchor.x) / Math.max(1, bounds.width);
  const sy = Math.abs(pointer.y - anchor.y) / Math.max(1, bounds.height);
  // The larger pull wins, as with any aspect-locked corner drag.
  const smallest = Math.min(...start.map((l) => Math.min(l.width, l.height)));
  const s = Math.max(minSize / Math.max(1, smallest), Math.max(sx, sy));

  return start.map((layer) => {
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    const ncx = anchor.x + (cx - anchor.x) * s;
    const ncy = anchor.y + (cy - anchor.y) * s;
    const width = layer.width * s;
    const height = layer.height * s;
    return {
      id: layer.id,
      box: { x: ncx - width / 2, y: ncy - height / 2, width, height },
      ...(layer.kind === "text" ? { fontSize: layer.fontSize * s } : {}),
    };
  });
}

/**
 * Align layers to each other — to their joint bounds' edge or centre — the
 * way Canva's Position panel does with several selected.
 */
export function alignLayersTo(layers: Layer[], mode: AlignMode): { id: string; dx: number; dy: number }[] {
  const bounds = selectionBounds(layers);
  if (!bounds) return [];
  return layers.map((layer) => {
    const b = boundingRect(layer);
    let dx = 0;
    let dy = 0;
    if (mode === "left") dx = bounds.x - b.x;
    if (mode === "right") dx = bounds.x + bounds.width - (b.x + b.width);
    if (mode === "centre") dx = bounds.x + bounds.width / 2 - (b.x + b.width / 2);
    if (mode === "top") dy = bounds.y - b.y;
    if (mode === "bottom") dy = bounds.y + bounds.height - (b.y + b.height);
    if (mode === "middle") dy = bounds.y + bounds.height / 2 - (b.y + b.height / 2);
    return { id: layer.id, dx, dy };
  });
}
