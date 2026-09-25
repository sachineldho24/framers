/**
 * Pen tool geometry — the Illustrator/Photoshop pen: anchors joined by straight
 * or cubic Bézier segments, each anchor with optional in/out control handles.
 *
 * A `PathLayer` stores its anchors normalised to its box so the ordinary
 * selection handles can move, scale and rotate it. Editing works the other way
 * round: the UI hands us anchors in px in the layer's *local* frame (the
 * unrotated box, origin top-left), and `fitPath` finds the new box that hugs
 * the curve and re-normalises — keeping the rotation, so a turned path edits
 * in place.
 *
 * The same commands feed the canvas (`render.ts`), the SVG overlays, photo
 * masks (`maskFromPath`) and template export, so what you draw is what prints.
 *
 * Pure: no React, no canvas.
 */

import {
  clonePathNode,
  createId,
  type Mask,
  type ImageLayer,
  type PathGlow,
  type PathLayer,
  type PathNode,
} from "./document";
import { docToLocal, localToDoc, type Box, type Vec } from "./geometry";
import type { ShapeCommand } from "./shapes";

type Pair = [number, number];

/* -------------------------------------------------------------------------- */
/* Commands                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Path commands for anchors already in the target space. A segment with no
 * handles at either end is a straight line; otherwise a cubic whose missing
 * control point sits on its anchor.
 *
 * Live Corners: an anchor with a radius, sitting between two straight
 * segments, is replaced by a circular arc tangent to both. `radiusScale` maps
 * the stored radius (layer px) into the space the anchors are in — the
 * viewport scale on screen, 1 in the layer's own px.
 */
export function pathCommands(
  nodes: readonly PathNode[],
  closed: boolean,
  radiusScale = 1
): ShapeCommand[] {
  const count = nodes.length;
  if (count === 0) return [];
  const wraps = closed && count > 2;
  const corners = nodes.map((_, i) => cornerGeometry(nodes, wraps, i, radiusScale));
  const entry = (i: number): Pair => corners[i]?.entry ?? [nodes[i].x, nodes[i].y];
  const exit = (i: number): Pair => corners[i]?.exit ?? [nodes[i].x, nodes[i].y];

  const [sx, sy] = exit(0);
  const out: ShapeCommand[] = [{ c: "M", x: sx, y: sy }];
  const segment = (ia: number, ib: number) => {
    const a = nodes[ia];
    const b = nodes[ib];
    const [ex, ey] = entry(ib);
    if (!a.out && !b.in) out.push({ c: "L", x: ex, y: ey });
    else {
      const [x1, y1] = a.out ?? [a.x, a.y];
      const [x2, y2] = b.in ?? [b.x, b.y];
      out.push({ c: "C", x1, y1, x2, y2, x: ex, y: ey });
    }
    const corner = corners[ib];
    if (corner) {
      out.push({
        c: "C",
        x1: corner.c1[0],
        y1: corner.c1[1],
        x2: corner.c2[0],
        y2: corner.c2[1],
        x: corner.exit[0],
        y: corner.exit[1],
      });
    }
  };
  for (let i = 1; i < count; i += 1) segment(i - 1, i);
  if (wraps) {
    segment(count - 1, 0);
    out.push({ c: "Z" });
  }
  return out;
}

export interface CornerGeometry {
  /** Where the arc leaves the incoming line, and joins the outgoing one. */
  entry: Pair;
  exit: Pair;
  /** The arc's control points. */
  c1: Pair;
  c2: Pair;
  /** Unit vector from the anchor into the corner, splitting its angle. */
  bisector: Pair;
  /** Tangent length used, and the most the neighbours allow. */
  distance: number;
  maxDistance: number;
  /** tan(half the corner's angle): radius = distance × this. */
  tanHalf: number;
}

/** Can this anchor take a Live Corner? A sharp point between two straight lines. */
export function isRoundable(nodes: readonly PathNode[], closed: boolean, i: number): boolean {
  const count = nodes.length;
  const wraps = closed && count > 2;
  const n = nodes[i];
  if (!n || n.in || n.out) return false;
  const prev = i > 0 ? nodes[i - 1] : wraps ? nodes[count - 1] : null;
  const next = i < count - 1 ? nodes[i + 1] : wraps ? nodes[0] : null;
  if (!prev || !next || prev.out || next.in) return false;
  const u1: Pair = [prev.x - n.x, prev.y - n.y];
  const u2: Pair = [next.x - n.x, next.y - n.y];
  const l1 = Math.hypot(u1[0], u1[1]);
  const l2 = Math.hypot(u2[0], u2[1]);
  if (l1 < 1e-6 || l2 < 1e-6) return false;
  const cos = (u1[0] * u2[0] + u1[1] * u2[1]) / (l1 * l2);
  // A straight run through the anchor has no corner to round.
  return cos > -0.9999;
}

/**
 * The fillet at anchor `i` with `radius` (in the anchors' space), or with the
 * anchor's own stored radius × `radiusScale`. Null when it isn't a roundable
 * corner. The tangent length is capped at half of each neighbouring segment,
 * so two rounded corners on one side can meet but never overlap.
 */
export function cornerGeometry(
  nodes: readonly PathNode[],
  closed: boolean,
  i: number,
  radiusScale = 1,
  radius?: number
): CornerGeometry | null {
  const r = radius ?? (nodes[i]?.r ?? 0) * radiusScale;
  if (!(r > 0) || !isRoundable(nodes, closed, i)) return null;
  const count = nodes.length;
  const n = nodes[i];
  const prev = i > 0 ? nodes[i - 1] : nodes[count - 1];
  const next = i < count - 1 ? nodes[i + 1] : nodes[0];
  const l1 = Math.hypot(prev.x - n.x, prev.y - n.y);
  const l2 = Math.hypot(next.x - n.x, next.y - n.y);
  const u1: Pair = [(prev.x - n.x) / l1, (prev.y - n.y) / l1];
  const u2: Pair = [(next.x - n.x) / l2, (next.y - n.y) / l2];
  const cos = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
  const theta = Math.acos(cos);
  const tanHalf = Math.tan(theta / 2);
  const maxDistance = Math.min(l1, l2) / 2;
  const distance = Math.min(r / tanHalf, maxDistance);
  const radiusUsed = distance * tanHalf;
  // A cubic that hugs a circular arc of angle (π − θ).
  const k = (4 / 3) * Math.tan((Math.PI - theta) / 4) * radiusUsed;
  const entry: Pair = [n.x + u1[0] * distance, n.y + u1[1] * distance];
  const exit: Pair = [n.x + u2[0] * distance, n.y + u2[1] * distance];
  let bx = u1[0] + u2[0];
  let by = u1[1] + u2[1];
  const bl = Math.hypot(bx, by) || 1;
  bx /= bl;
  by /= bl;
  return {
    entry,
    exit,
    c1: [entry[0] - u1[0] * k, entry[1] - u1[1] * k],
    c2: [exit[0] - u2[0] * k, exit[1] - u2[1] * k],
    bisector: [bx, by],
    distance,
    maxDistance,
    tanHalf,
  };
}

/**
 * Set the Live Corner radius (layer px) on one anchor, or — `index` null — on
 * every anchor that can take one. 0 removes it.
 */
export function setCornerRadius(
  nodes: readonly PathNode[],
  closed: boolean,
  index: number | null,
  radius: number
): PathNode[] {
  return nodes.map((n, i) => {
    const next = clonePathNode(n);
    if (index !== null && i !== index) return next;
    if (!isRoundable(nodes, closed, i)) return next;
    if (radius > 0) next.r = radius;
    else delete next.r;
    return next;
  });
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Commands as an SVG `d` string. */
export function commandsToD(commands: readonly ShapeCommand[]): string {
  return commands
    .map((c) =>
      c.c === "M" || c.c === "L"
        ? `${c.c}${r2(c.x)} ${r2(c.y)}`
        : c.c === "Q"
          ? `Q${r2(c.x1)} ${r2(c.y1)} ${r2(c.x)} ${r2(c.y)}`
          : c.c === "C"
            ? `C${r2(c.x1)} ${r2(c.y1)} ${r2(c.x2)} ${r2(c.y2)} ${r2(c.x)} ${r2(c.y)}`
            : "Z"
    )
    .join(" ");
}

/** Map every point of a node (anchor and handles) through `f`. */
export function mapNode(n: PathNode, f: (x: number, y: number) => Pair): PathNode {
  const [x, y] = f(n.x, n.y);
  return {
    x,
    y,
    ...(n.in ? { in: f(n.in[0], n.in[1]) } : {}),
    ...(n.out ? { out: f(n.out[0], n.out[1]) } : {}),
    // A radius is a length, not a point: it rides along untouched.
    ...(n.r ? { r: n.r } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Frames                                                                      */
/* -------------------------------------------------------------------------- */

/** The layer's anchors in px in its own unrotated box. */
export function localNodes(layer: PathLayer): PathNode[] {
  return layer.nodes.map((n) => mapNode(n, (x, y) => [x * layer.width, y * layer.height]));
}

/** The layer's anchors in document space (rotation applied). */
export function docNodes(layer: PathLayer): PathNode[] {
  const box = boxOf(layer);
  return localNodes(layer).map((n) =>
    mapNode(n, (x, y) => {
      const p = localToDoc(box, { x, y });
      return [p.x, p.y];
    })
  );
}

export function boxOf(l: { x: number; y: number; width: number; height: number; rotation: number }): Box {
  return { x: l.x, y: l.y, width: l.width, height: l.height, rotation: l.rotation };
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Bounds of the drawn curve (not the handles), by sampling each segment. */
export function curveBounds(nodes: readonly PathNode[], closed: boolean) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  forEachSegment(nodes, closed, (a, b) => {
    add(a.x, a.y);
    if (!a.out && !b.in) return add(b.x, b.y);
    const [x1, y1] = a.out ?? [a.x, a.y];
    const [x2, y2] = b.in ?? [b.x, b.y];
    for (let s = 1; s <= 24; s += 1) {
      const t = s / 24;
      add(cubicAt(a.x, x1, x2, b.x, t), cubicAt(a.y, y1, y2, b.y, t));
    }
  });
  if (nodes.length === 1) add(nodes[0].x, nodes[0].y);
  return { minX, minY, maxX, maxY };
}

function forEachSegment(
  nodes: readonly PathNode[],
  closed: boolean,
  fn: (a: PathNode, b: PathNode, index: number) => void
): void {
  for (let i = 1; i < nodes.length; i += 1) fn(nodes[i - 1], nodes[i], i - 1);
  if (closed && nodes.length > 2) fn(nodes[nodes.length - 1], nodes[0], nodes.length - 1);
}

/** Smallest box edge, so a perfectly straight horizontal line still has a height. */
const MIN_EDGE = 2;

/**
 * Re-box a path. `frame` is the box the `local` anchors are measured in (px,
 * unrotated, origin top-left). Returns the new box — same rotation, centred on
 * the curve — and the anchors normalised to it. Padded by half the stroke so
 * the selection hugs the ink, not the centre line.
 */
export function fitPath(
  frame: Box,
  local: readonly PathNode[],
  closed: boolean,
  strokeWidth: number
): Pick<PathLayer, "x" | "y" | "width" | "height" | "nodes"> {
  const b = curveBounds(local, closed);
  const pad = Math.max(1, strokeWidth / 2);
  let w = b.maxX - b.minX + pad * 2;
  let h = b.maxY - b.minY + pad * 2;
  let ox = b.minX - pad;
  let oy = b.minY - pad;
  if (w < MIN_EDGE) {
    ox -= (MIN_EDGE - w) / 2;
    w = MIN_EDGE;
  }
  if (h < MIN_EDGE) {
    oy -= (MIN_EDGE - h) / 2;
    h = MIN_EDGE;
  }
  const centre = localToDoc(frame, { x: ox + w / 2, y: oy + h / 2 });
  return {
    x: centre.x - w / 2,
    y: centre.y - h / 2,
    width: w,
    height: h,
    nodes: local.map((n) => mapNode(n, (x, y) => [(x - ox) / w, (y - oy) / h])),
  };
}

/** Frame whose local space *is* document space: for anchors placed on the page. */
export const PAGE_FRAME: Box = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

export interface PathStyle {
  stroke: string;
  strokeWidth: number;
  fill?: string;
  glow?: PathGlow;
}

/** A new path layer from anchors in document px. */
export function createPathLayer(params: {
  nodes: readonly PathNode[];
  closed: boolean;
  style: PathStyle;
  id?: string;
  name?: string;
}): PathLayer {
  const { nodes, closed, style } = params;
  const fit = fitPath(PAGE_FRAME, nodes.map(clonePathNode), closed, style.strokeWidth);
  return {
    id: params.id ?? createId("pth"),
    kind: "path",
    name: params.name ?? (closed ? "Shape path" : "Path"),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    ...fit,
    closed,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    ...(closed && style.fill ? { fill: style.fill } : {}),
    ...(style.glow ? { glow: { ...style.glow } } : {}),
  };
}

/** Default look for a new path, sized to the page. */
export function defaultPathStyle(page: { width: number; height: number }): PathStyle {
  return { stroke: "#ccff00", strokeWidth: Math.max(2, Math.round(Math.min(page.width, page.height) * 0.006)) };
}

/** A glow that reads at this page size, for the Glow toggle. */
export function defaultGlow(layer: Pick<PathLayer, "stroke" | "strokeWidth">): PathGlow {
  return { color: layer.stroke, size: Math.max(12, layer.strokeWidth * 6), strength: 70 };
}

/* -------------------------------------------------------------------------- */
/* Editing (all in local px)                                                   */
/* -------------------------------------------------------------------------- */

const add = (p: Pair, dx: number, dy: number): Pair => [p[0] + dx, p[1] + dy];

/** Move an anchor and its handles together. */
export function moveAnchor(nodes: readonly PathNode[], i: number, dx: number, dy: number): PathNode[] {
  return nodes.map((n, k) => (k === i ? mapNode(n, (x, y) => [x + dx, y + dy]) : clonePathNode(n)));
}

/**
 * Drag one handle to `to`. On a smooth anchor the opposite handle turns with
 * it, keeping its own length (Illustrator's behaviour); `breakLink` (Alt) moves
 * this one alone and turns the anchor into a corner-with-handles.
 */
export function moveHandle(
  nodes: readonly PathNode[],
  i: number,
  which: "in" | "out",
  to: Vec,
  breakLink = false
): PathNode[] {
  return nodes.map((n, k) => {
    if (k !== i) return clonePathNode(n);
    const next = clonePathNode(n);
    next[which] = [to.x, to.y];
    const other = which === "in" ? "out" : "in";
    const opposite = n[other];
    if (!breakLink && opposite) {
      const len = Math.hypot(opposite[0] - n.x, opposite[1] - n.y);
      const dx = n.x - to.x;
      const dy = n.y - to.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) next[other] = [n.x + (dx / d) * len, n.y + (dy / d) * len];
    }
    return next;
  });
}

/**
 * Bend a segment by dragging it — the quickest way to turn a straight line into
 * a curve. Moving both control points by 4/3 of the drag moves the curve's
 * midpoint by exactly the drag, so the line follows the pointer.
 *
 * `start` are the nodes when the drag began; `dx/dy` the total drag so far.
 */
export function bendSegment(
  start: readonly PathNode[],
  segment: number,
  dx: number,
  dy: number
): PathNode[] {
  const nodes = start.map(clonePathNode);
  const ia = segment;
  const ib = (segment + 1) % nodes.length;
  const a = nodes[ia];
  const b = nodes[ib];
  const straight = !a.out && !b.in;
  const c1: Pair = a.out ?? (straight ? [a.x + (b.x - a.x) / 3, a.y + (b.y - a.y) / 3] : [a.x, a.y]);
  const c2: Pair = b.in ?? (straight ? [a.x + ((b.x - a.x) * 2) / 3, a.y + ((b.y - a.y) * 2) / 3] : [b.x, b.y]);
  const k = 4 / 3;
  a.out = add(c1, dx * k, dy * k);
  b.in = add(c2, dx * k, dy * k);
  return nodes;
}

/**
 * Corner ⇄ smooth. A smooth anchor loses its handles; a corner gets a pair
 * along the line joining its neighbours, a third of the way to each.
 */
export function toggleSmooth(nodes: readonly PathNode[], i: number, closed: boolean): PathNode[] {
  const out = nodes.map(clonePathNode);
  const n = out[i];
  if (n.in || n.out) {
    delete n.in;
    delete n.out;
    return out;
  }
  delete n.r;
  const count = out.length;
  const prev = i > 0 ? out[i - 1] : closed ? out[count - 1] : null;
  const next = i < count - 1 ? out[i + 1] : closed ? out[0] : null;
  const from = prev ?? n;
  const to = next ?? n;
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return out;
  dx /= d;
  dy /= d;
  const lin = prev ? Math.hypot(n.x - prev.x, n.y - prev.y) / 3 : 0;
  const lout = next ? Math.hypot(next.x - n.x, next.y - n.y) / 3 : 0;
  if (prev) n.in = [n.x - dx * lin, n.y - dy * lin];
  if (next) n.out = [n.x + dx * lout, n.y + dy * lout];
  return out;
}

/**
 * Alt-drag on an anchor (Illustrator's Anchor Point tool): pull brand-new
 * symmetric handles out of it toward `to`, turning a corner into a curve.
 */
export function pullHandles(nodes: readonly PathNode[], i: number, to: Vec): PathNode[] {
  return nodes.map((n, k) => {
    const next = clonePathNode(n);
    if (k !== i) return next;
    next.out = [to.x, to.y];
    next.in = [2 * n.x - to.x, 2 * n.y - to.y];
    delete next.r;
    return next;
  });
}

/** Remove an anchor; a path keeps at least two. */
export function removeNode(nodes: readonly PathNode[], i: number): PathNode[] {
  if (nodes.length <= 2) return nodes.map(clonePathNode);
  return nodes.filter((_, k) => k !== i).map(clonePathNode);
}

/**
 * Add an anchor on a segment at `t` without changing the curve's shape (de
 * Casteljau split). Returns the nodes and the new anchor's index.
 */
export function insertNode(
  nodes: readonly PathNode[],
  segment: number,
  t: number
): { nodes: PathNode[]; index: number } {
  const out = nodes.map(clonePathNode);
  const ia = segment;
  const ib = (segment + 1) % out.length;
  const a = out[ia];
  const b = out[ib];
  const lerp = (p: Pair, q: Pair, u: number): Pair => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  const p0: Pair = [a.x, a.y];
  const p3: Pair = [b.x, b.y];
  let mid: PathNode;
  if (!a.out && !b.in) {
    const m = lerp(p0, p3, t);
    mid = { x: m[0], y: m[1] };
  } else {
    const p1: Pair = a.out ?? p0;
    const p2: Pair = b.in ?? p3;
    const q0 = lerp(p0, p1, t);
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const m = lerp(r0, r1, t);
    a.out = q0;
    b.in = q2;
    mid = { x: m[0], y: m[1], in: r0, out: r1 };
  }
  const index = ia + 1;
  out.splice(index, 0, mid);
  return { nodes: out, index };
}

/**
 * The segment nearest to `p`, with the curve parameter there — for bending and
 * inserting. Null when nothing is within `tolerance` (px, same space as nodes).
 */
export function nearestSegment(
  nodes: readonly PathNode[],
  closed: boolean,
  p: Vec,
  tolerance: number
): { segment: number; t: number; distance: number } | null {
  let best: { segment: number; t: number; distance: number } | null = null;
  forEachSegment(nodes, closed, (a, b, index) => {
    const [x1, y1] = a.out ?? [a.x, a.y];
    const [x2, y2] = b.in ?? [b.x, b.y];
    for (let s = 0; s <= 40; s += 1) {
      const t = s / 40;
      const x = cubicAt(a.x, x1, x2, b.x, t);
      const y = cubicAt(a.y, y1, y2, b.y, t);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d <= tolerance && (!best || d < best.distance)) best = { segment: index, t, distance: d };
    }
  });
  return best;
}

/** Snap `p` to the nearest 45° from `from` — Shift while placing an anchor. */
export function snap45(from: Vec, p: Vec): Vec {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

/* -------------------------------------------------------------------------- */
/* Masking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The path as a photo mask: its outline re-expressed in the photo's own box,
 * as the `path` mask kind the renderer already clips with. Always closed — a
 * mask is a region. Works across rotations: every point goes page → photo.
 */
export function maskFromPath(path: PathLayer, image: Pick<ImageLayer, "x" | "y" | "width" | "height" | "rotation">): Mask {
  const box = boxOf(image);
  const local = docNodes(path).map((n) =>
    mapNode(n, (x, y) => {
      const q = docToLocal(box, { x, y });
      return [q.x, q.y];
    })
  );
  const d = commandsToD(pathCommands(local, true));
  return {
    kind: "path",
    radius: 0.08,
    path: { d, viewBox: [0, 0, r2(image.width), r2(image.height)] },
  };
}

/** Whether two layers' boxes overlap on the page — for "the photo under this path". */
export function boxesOverlap(a: Box, b: Box): boolean {
  const ext = (box: Box) => {
    const corners = [
      { x: 0, y: 0 },
      { x: box.width, y: 0 },
      { x: box.width, y: box.height },
      { x: 0, y: box.height },
    ].map((c) => localToDoc(box, c));
    return {
      minX: Math.min(...corners.map((c) => c.x)),
      maxX: Math.max(...corners.map((c) => c.x)),
      minY: Math.min(...corners.map((c) => c.y)),
      maxY: Math.max(...corners.map((c) => c.y)),
    };
  };
  const p = ext(a);
  const q = ext(b);
  return p.minX < q.maxX && q.minX < p.maxX && p.minY < q.maxY && q.minY < p.maxY;
}
