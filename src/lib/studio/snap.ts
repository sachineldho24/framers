/**
 * Alignment snapping — the reason a dragged photo lands *centred* rather than
 * one pixel off centre.
 *
 * Pure, and deliberately ignorant of pointers: the canvas computes the box a
 * drag would produce, asks for a nudge, and adds it. That keeps the whole
 * behaviour testable and means the same nudge can later be reused by the arrow
 * keys or the alignment buttons.
 *
 * Two rules shape what is offered:
 *
 * 1. Centres beat edges. On a print, "in the middle of the page" is the thing
 *    people are actually trying to do, and it is the one alignment the eye
 *    notices being wrong from across a room.
 * 2. The safe box is a snap target, not just an overlay. It is where the frame's
 *    lip stops covering the artwork, so it is the real inner edge of the page —
 *    lining a caption up with the paper's edge would put it under the moulding.
 *
 * Rotated boxes are not snapped: `x/y/width/height` describe the *unrotated*
 * box, so its edges are not the edges the user can see, and snapping them would
 * move the layer to line up with something invisible.
 */

import type { GuideRect } from "./print";

/** How close, in screen pixels, an edge has to come before it grabs. */
export const SNAP_TOLERANCE = 6;

export type SnapKind = "page-centre" | "page-edge" | "safe" | "layer";

export interface SnapAxis {
  position: number;
  kind: SnapKind;
}

export interface SnapCandidates {
  x: SnapAxis[];
  y: SnapAxis[];
}

export interface SnapLine {
  axis: "x" | "y";
  /** Document pixels along that axis. */
  position: number;
  kind: SnapKind;
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** Every guide the box is aligned to once the nudge is applied. */
  lines: SnapLine[];
}

export const NO_SNAP: SnapResult = { dx: 0, dy: 0, lines: [] };

/** A box as the snapper needs it: unrotated extents in document pixels. */
export interface SnapBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface SnapLayer extends SnapBox {
  id: string;
  visible: boolean;
}

/**
 * The lines worth snapping to, in priority order — earlier entries win a tie, so
 * the page's centre beats a neighbour's edge that happens to sit on it.
 */
export function snapCandidates(
  page: { width: number; height: number },
  safe: GuideRect | null,
  layers: SnapLayer[],
  excludeId: string | null
): SnapCandidates {
  const x: SnapAxis[] = [{ position: page.width / 2, kind: "page-centre" }];
  const y: SnapAxis[] = [{ position: page.height / 2, kind: "page-centre" }];

  x.push({ position: 0, kind: "page-edge" });
  x.push({ position: page.width, kind: "page-edge" });
  y.push({ position: 0, kind: "page-edge" });
  y.push({ position: page.height, kind: "page-edge" });

  if (safe) {
    x.push({ position: safe.x, kind: "safe" });
    x.push({ position: safe.x + safe.width, kind: "safe" });
    y.push({ position: safe.y, kind: "safe" });
    y.push({ position: safe.y + safe.height, kind: "safe" });
  }

  for (const layer of layers) {
    if (layer.id === excludeId || !layer.visible) continue;
    // See the header: a turned box's stored edges aren't its visible ones.
    if ((layer.rotation ?? 0) !== 0) continue;
    x.push({ position: layer.x, kind: "layer" });
    x.push({ position: layer.x + layer.width / 2, kind: "layer" });
    x.push({ position: layer.x + layer.width, kind: "layer" });
    y.push({ position: layer.y, kind: "layer" });
    y.push({ position: layer.y + layer.height / 2, kind: "layer" });
    y.push({ position: layer.y + layer.height, kind: "layer" });
  }

  return { x, y };
}

/** The three places on one axis a box can line up from. Centre first: see the header. */
function edges(start: number, size: number): number[] {
  return [start + size / 2, start, start + size];
}

function bestNudge(
  positions: number[],
  candidates: SnapAxis[],
  tolerance: number
): number {
  let best = 0;
  let bestDistance = Infinity;
  for (const position of positions) {
    for (const candidate of candidates) {
      const delta = candidate.position - position;
      const distance = Math.abs(delta);
      // Strictly closer, so the priority order in `snapCandidates` decides ties.
      if (distance <= tolerance && distance < bestDistance) {
        bestDistance = distance;
        best = delta;
      }
    }
  }
  return best;
}

function alignedLines(
  axis: "x" | "y",
  positions: number[],
  candidates: SnapAxis[],
  nudge: number
): SnapLine[] {
  const lines: SnapLine[] = [];
  const seen = new Set<number>();
  for (const candidate of candidates) {
    if (seen.has(candidate.position)) continue;
    const hit = positions.some(
      (position) => Math.abs(candidate.position - (position + nudge)) < 0.01
    );
    if (!hit) continue;
    seen.add(candidate.position);
    lines.push({ axis, position: candidate.position, kind: candidate.kind });
  }
  return lines;
}

/**
 * How far to nudge `box` so it lines up, and what to draw as proof.
 *
 * `tolerance` is in document pixels — pass `SNAP_TOLERANCE / viewport.scale`, so
 * the pull feels the same at every zoom instead of grabbing half the page when
 * the view is zoomed out.
 */
export function snapBox(
  box: SnapBox,
  candidates: SnapCandidates,
  tolerance: number
): SnapResult {
  if ((box.rotation ?? 0) !== 0) return NO_SNAP;

  const xs = edges(box.x, box.width);
  const ys = edges(box.y, box.height);
  const dx = bestNudge(xs, candidates.x, tolerance);
  const dy = bestNudge(ys, candidates.y, tolerance);

  return {
    dx,
    dy,
    lines: [
      ...alignedLines("x", xs, candidates.x, dx),
      ...alignedLines("y", ys, candidates.y, dy),
    ],
  };
}

/** Stable identity for a set of lines, so the overlay only re-renders on a change. */
export function snapKey(lines: SnapLine[]): string {
  return lines
    .map((l) => `${l.axis}${Math.round(l.position * 100)}${l.kind}`)
    .join("|");
}
