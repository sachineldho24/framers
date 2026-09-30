/**
 * Turn a selection mask into a vector outline — the path a photo is clipped to
 * when an object is lifted out of it.
 *
 * Framers stores clipping masks as paths (`Mask { kind: "path" }`), which the
 * renderer, the print file and templates already understand, so a mask from the
 * object selector is traced into one rather than stored as pixels. The cost is
 * partial transparency: hair and glass edges become a crisp line.
 *
 * 1. Crack following: every border between a selected and an unselected pixel
 *    is a unit edge, walked with the selection always on the right. Outlines
 *    come out clockwise and holes counter-clockwise (y down), which is exactly
 *    what the canvas's default non-zero fill needs to leave the holes open.
 * 2. Douglas–Peucker simplification, with a tolerance proportional to the
 *    object's size and a cap on the number of nodes.
 *
 * Pure: no DOM, so it runs in a worker and in unit tests alike.
 */

export type Ring = [number, number][];

export interface TraceOptions {
  /** Rings smaller than this many px² are specks and are dropped. */
  minArea?: number;
}

/**
 * Outlines of the selected pixels (mask > 0), in pixel-corner coordinates:
 * pixel (x, y) is the square from (x, y) to (x + 1, y + 1).
 */
export function traceMask(mask: ArrayLike<number>, width: number, height: number, options: TraceOptions = {}): Ring[] {
  const minArea = options.minArea ?? 4;
  const W = width + 1;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] > 0;

  // Up to two outgoing edges per corner (a saddle has two). Stored as the
  // direction taken: 0 right, 1 down, 2 left, 3 up; -1 = none.
  const out0 = new Int8Array(W * (height + 1)).fill(-1);
  const out1 = new Int8Array(W * (height + 1)).fill(-1);
  const add = (x: number, y: number, dir: number) => {
    const v = y * W + x;
    if (out0[v] < 0) out0[v] = dir;
    else out1[v] = dir;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) add(x, y, 0); // top edge, heading right
      if (!on(x + 1, y)) add(x + 1, y, 1); // right edge, heading down
      if (!on(x, y + 1)) add(x + 1, y + 1, 2); // bottom edge, heading left
      if (!on(x - 1, y)) add(x, y + 1, 3); // left edge, heading up
    }
  }

  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  /** Take an outgoing edge from `v`: at a saddle, turn right (keeps diagonal pixels apart). */
  const take = (v: number, incoming: number): number => {
    const a = out0[v];
    const b = out1[v];
    let dir: number;
    if (b < 0 || incoming < 0) dir = a;
    else {
      const right = (incoming + 1) % 4;
      dir = a === right ? a : b === right ? b : a;
    }
    if (dir === out0[v]) {
      out0[v] = out1[v];
      out1[v] = -1;
    } else out1[v] = -1;
    return dir;
  };

  const rings: Ring[] = [];
  for (let start = 0; start < out0.length; start++) {
    while (out0[start] >= 0) {
      const ring: Ring = [];
      let x = start % W;
      let y = (start / W) | 0;
      let dir = -1;
      let v = start;
      // Record a corner only where the direction changes: straight runs of
      // unit edges collapse to one segment.
      for (;;) {
        const next = take(v, dir);
        if (next !== dir) ring.push([x, y]);
        dir = next;
        x += DX[dir];
        y += DY[dir];
        v = y * W + x;
        if (v === start && (out0[v] < 0 || ring.length > 0)) {
          // Closed. The start corner may still have a second, separate loop.
          break;
        }
      }
      if (Math.abs(signedArea(ring)) >= minArea) rings.push(ring);
    }
  }
  return rings;
}

/** Shoelace area; positive for clockwise rings in y-down coordinates. */
export function signedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** Douglas–Peucker on a closed ring. Always keeps at least 3 points. */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4) return ring;
  // Split at the point farthest from the first, so both halves are open chains.
  let far = 0;
  let farD = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const keep = new Uint8Array(ring.length + 1);
  const closed = [...ring, ring[0]];
  keep[0] = keep[far] = keep[ring.length] = 1;
  const t2 = tolerance * tolerance;
  const stack: [number, number][] = [
    [0, far],
    [far, ring.length],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const [ax, ay] = closed[a];
    const [bx, by] = closed[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let worstD = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = closed[i];
      let d: number;
      if (len2 === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const cross = dx * (py - ay) - dy * (px - ax);
        d = (cross * cross) / len2;
      }
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worstD > t2) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) if (keep[i]) out.push(ring[i]);
  return out.length >= 3 ? out : ring;
}

export interface OutlineOptions extends TraceOptions {
  /** Tolerance as a fraction of the mask's bounding-box diagonal. */
  tolerance?: number;
  /** Never simplify finer than this, px (default 1). */
  minTolerance?: number;
  /** Most nodes across all rings; the tolerance grows until it fits. */
  maxNodes?: number;
}

/**
 * Trace and simplify: the outline of a mask, fit to be a path mask. The
 * tolerance scales with the object (0.2% of its diagonal by default) so a
 * large object keeps its curves without carrying thousands of nodes.
 */
export function outlineMask(
  mask: ArrayLike<number>,
  width: number,
  height: number,
  options: OutlineOptions = {}
): Ring[] {
  const rings = traceMask(mask, width, height, options);
  if (rings.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  const maxNodes = options.maxNodes ?? 1500;
  // At least a pixel: the traced staircase deviates 0.7 px on diagonals, and a
  // source pixel is invisible in print.
  let tolerance = Math.max(options.minTolerance ?? 1, diagonal * (options.tolerance ?? 0.002));
  for (;;) {
    const simplified = rings.map((r) => simplifyRing(r, tolerance));
    const nodes = simplified.reduce((n, r) => n + r.length, 0);
    if (nodes <= maxNodes) return simplified;
    tolerance *= 1.5;
  }
}

/** SVG path data for rings, each point passed through `map` first. */
export function ringsToPathData(rings: Ring[], map: (x: number, y: number) => [number, number] = (x, y) => [x, y]): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return rings
    .map((ring) =>
      ring
        .map(([x, y], i) => {
          const [mx, my] = map(x, y);
          return `${i === 0 ? "M" : "L"}${r(mx)} ${r(my)}`;
        })
        .join("") + "Z"
    )
    .join("");
}
