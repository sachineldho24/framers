/**
 * Content-aware fill: erase an object by painting over it, and fill the hole
 * with texture borrowed from the rest of the picture.
 *
 * No AI model and nothing to download. This is the algorithm behind the first
 * "Content-Aware Fill" in Photoshop — PatchMatch (Barnes et al. 2009) inside the
 * multi-scale completion of Wexler et al. (2007):
 *
 * 1. Build a pyramid of the picture, halving until it is small.
 * 2. At the smallest size, find for every small square ("patch") that touches
 *    the hole the most similar patch elsewhere in the picture — PatchMatch finds
 *    near-best matches fast by trying random candidates and passing good ones to
 *    neighbours, because neighbouring patches usually match neighbouring patches.
 * 3. Rebuild the hole from those matches, each pixel a weighted vote of every
 *    patch covering it, and repeat until it settles.
 * 4. Move up a size, starting from the smaller answer, and refine.
 *
 * The whole surrounding region is the context — the fill is chosen by looking at
 * everything around the hole — but only the pixels under the mask are written.
 *
 * Works best on texture: road, grass, sky, walls, water, foliage. It copies what
 * is there; it can't invent structure it hasn't seen (a face, a wheel).
 *
 * Pure: typed arrays in, typed array out, no DOM, so it runs in a worker and in
 * unit tests alike.
 */

export interface RgbaImage {
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface InpaintOptions {
  /** For repeatable results (tests). */
  seed?: number;
  /** 0–1 as the work proceeds. */
  onProgress?: (fraction: number) => void;
  /**
   * Largest region processed at full detail, in pixels. Bigger holes are worked
   * on at a reduced size and the fill scaled back up — softer, but bounded in
   * time and memory on a phone.
   */
  maxRegionPixels?: number;
}

/** Patches are (2 × 3 + 1)² = 7 × 7. */
const RADIUS = 3;
/** Stop halving at this long edge. */
const COARSEST_EDGE = 64;
/** Grow the mask a little: brush strokes stop just short of an object's halo. */
const MASK_GROW = 2;
const DEFAULT_MAX_REGION = 2_000_000;

export class InpaintError extends Error {}

/**
 * The picture with the masked pixels (mask > 0) filled in. Every other pixel is
 * returned exactly as it was. The input is not modified.
 */
export function inpaint(
  image: RgbaImage,
  mask: Uint8Array,
  options: InpaintOptions = {}
): Uint8ClampedArray<ArrayBuffer> {
  const { width, height } = image;
  if (mask.length !== width * height) throw new InpaintError("Mask size doesn't match the image.");
  const out = new Uint8ClampedArray(image.data);

  const hole = grow(mask, width, height, MASK_GROW);
  const box = bounds(hole, width, height);
  if (!box) return out;

  const random = mulberry32(options.seed ?? 0x5eed);
  const region = contextRegion(box, width, height, options.maxRegionPixels ?? DEFAULT_MAX_REGION);
  const level0 = extract(image, hole, region);

  const filled = complete(level0, random, options.onProgress);

  paste(out, width, hole, region, level0, filled);
  options.onProgress?.(1);
  return out;
}

/* ------------------------------------------------------------ the region */

interface Box {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number;
}

function bounds(hole: Uint8Array, width: number, height: number): Box | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!hole[row + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

interface Region extends Box {
  /** Processing size relative to the picture: 1, or less for a huge region. */
  scale: number;
}

/**
 * The hole plus generous surroundings — twice its size on every side — so the
 * fill can draw on what is actually around it. Capped in area; past the cap the
 * surroundings shrink first, then the whole region is processed smaller.
 */
function contextRegion(box: Box, width: number, height: number, maxPixels: number): Region {
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0);
  const area = (margin: number) =>
    (Math.min(width, box.x1 + margin) - Math.max(0, box.x0 - margin)) *
    (Math.min(height, box.y1 + margin) - Math.max(0, box.y0 - margin));

  let margin = Math.max(48, size * 2);
  const least = Math.max(32, Math.ceil(size / 2));
  while (margin > least && area(margin) > maxPixels) margin = Math.max(least, Math.floor(margin * 0.8));

  const region = {
    x0: Math.max(0, box.x0 - margin),
    y0: Math.max(0, box.y0 - margin),
    x1: Math.min(width, box.x1 + margin),
    y1: Math.min(height, box.y1 + margin),
  };
  const pixels = (region.x1 - region.x0) * (region.y1 - region.y0);
  return { ...region, scale: pixels > maxPixels ? Math.sqrt(maxPixels / pixels) : 1 };
}

/* ---------------------------------------------------------------- levels */

interface Level {
  w: number;
  h: number;
  /** RGB, interleaved, 0–255. Hole pixels hold the current guess. */
  rgb: Float32Array;
  hole: Uint8Array;
}

/** The region as a level, resampled by `region.scale`. */
function extract(image: RgbaImage, hole: Uint8Array, region: Region): Level {
  const rw = region.x1 - region.x0;
  const rh = region.y1 - region.y0;
  const w = Math.max(1, Math.round(rw * region.scale));
  const h = Math.max(1, Math.round(rh * region.scale));
  const rgb = new Float32Array(w * h * 3);
  const out = new Uint8Array(w * h);
  const fx = rw / w;
  const fy = rh / h;

  // Box resampling: each output pixel averages the known pixels under it, and
  // is hole if any pixel under it is — so the hole never shrinks.
  for (let y = 0; y < h; y++) {
    const sy0 = region.y0 + Math.floor(y * fy);
    const sy1 = Math.max(sy0 + 1, region.y0 + Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const sx0 = region.x0 + Math.floor(x * fx);
      const sx1 = Math.max(sx0 + 1, region.x0 + Math.floor((x + 1) * fx));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      let isHole = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = sy * image.width + sx;
          if (hole[i]) {
            isHole = 1;
            continue;
          }
          r += image.data[i * 4];
          g += image.data[i * 4 + 1];
          b += image.data[i * 4 + 2];
          n++;
        }
      }
      const o = y * w + x;
      out[o] = isHole;
      if (n > 0) {
        rgb[o * 3] = r / n;
        rgb[o * 3 + 1] = g / n;
        rgb[o * 3 + 2] = b / n;
      }
    }
  }
  return { w, h, rgb, hole: out };
}

/** Half size; hole wherever any of the four pixels below was. */
function halve(level: Level): Level {
  const w = Math.max(1, level.w >> 1);
  const h = Math.max(1, level.h >> 1);
  const rgb = new Float32Array(w * h * 3);
  const hole = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      let isHole = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(level.w - 1, x * 2 + dx);
          const sy = Math.min(level.h - 1, y * 2 + dy);
          const i = sy * level.w + sx;
          if (level.hole[i]) {
            isHole = 1;
            continue;
          }
          r += level.rgb[i * 3];
          g += level.rgb[i * 3 + 1];
          b += level.rgb[i * 3 + 2];
          n++;
        }
      }
      const o = y * w + x;
      hole[o] = isHole;
      if (n > 0) {
        rgb[o * 3] = r / n;
        rgb[o * 3 + 1] = g / n;
        rgb[o * 3 + 2] = b / n;
      }
    }
  }
  return { w, h, rgb, hole };
}

/* ------------------------------------------------------------ completion */

/** Per level: where each patch touching the hole found its match. */
interface Field {
  /** Centres of the patches that overlap the hole, in scan order. */
  targets: Int32Array;
  /** Per pixel: index of the matched source centre, or -1. */
  nnf: Int32Array;
  /** Per pixel: that match's distance. */
  nnd: Float32Array;
}

function complete(level0: Level, random: () => number, onProgress?: (f: number) => void): Float32Array {
  const pyramid = [level0];
  for (;;) {
    const last = pyramid[pyramid.length - 1];
    if (Math.max(last.w, last.h) <= COARSEST_EDGE || Math.min(last.w, last.h) < (RADIUS * 2 + 1) * 3) break;
    const next = halve(last);
    // A level whose hole leaves no whole patch to copy from is no use.
    if (validSources(next).count === 0) break;
    pyramid.push(next);
  }

  const schedule = pyramid.map((_, i) => {
    const fromTop = pyramid.length - 1 - i;
    return fromTop === 0 ? { em: 8, passes: 4 } : { em: Math.max(2, 5 - fromTop), passes: 3 };
  });
  const work = pyramid.map((l, i) => countTargets(l) * schedule[i].em * schedule[i].passes);
  const total = work.reduce((a, b) => a + b, 0) || 1;
  let done = 0;

  let field: Field | null = null;
  let previous: Level | null = null;
  for (let i = pyramid.length - 1; i >= 0; i--) {
    const level = pyramid[i];
    const sources = validSources(level);
    if (sources.count === 0) {
      throw new InpaintError("The area to erase is too large — there is too little picture left to fill it from.");
    }
    if (previous) upsampleGuess(previous, level);
    else initialGuess(level);
    field = previous && field ? upsampleField(field, previous, level, sources, random) : randomField(level, sources, random);

    const { em, passes } = schedule[i];
    for (let e = 0; e < em; e++) {
      for (let p = 0; p < passes; p++) patchMatch(level, field, sources, random, p % 2 === 1);
      // Averaging overlapping patches is what makes the fill settle, and also
      // what makes it soft. The very last step at full size takes each pixel
      // from its single best patch instead, so the texture stays crisp.
      vote(level, field, i === 0 && e === em - 1);
      done += countTargets(level) * passes;
      onProgress?.(Math.min(0.99, done / total));
    }
    previous = level;
  }
  return level0.rgb;
}

function countTargets(level: Level): number {
  let n = 0;
  const r = RADIUS;
  // Cheap overestimate for progress: hole pixels grown by the patch radius.
  for (let i = 0; i < level.hole.length; i++) if (level.hole[i]) n++;
  return n + Math.sqrt(n) * 4 * r + 1;
}

interface Sources {
  /** Per pixel: 1 when the whole patch around it is inside the picture and known. */
  ok: Uint8Array;
  /** Their indices, for random picks. */
  list: Int32Array;
  count: number;
}

function validSources(level: Level): Sources {
  const { w, h, hole } = level;
  // Summed-area table of the hole: a patch is clean when its sum is zero.
  const sat = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += hole[y * w + x];
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  const ok = new Uint8Array(w * h);
  const list: number[] = [];
  const r = RADIUS;
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      const a = sat[(y - r) * (w + 1) + (x - r)];
      const b = sat[(y - r) * (w + 1) + (x + r + 1)];
      const c = sat[(y + r + 1) * (w + 1) + (x - r)];
      const d = sat[(y + r + 1) * (w + 1) + (x + r + 1)];
      if (d - b - c + a === 0) {
        ok[y * w + x] = 1;
        list.push(y * w + x);
      }
    }
  }
  return { ok, list: Int32Array.from(list), count: list.length };
}

/** Centres whose patch overlaps the hole: the hole grown by the patch radius. */
function findTargets(level: Level): Int32Array {
  const grown = grow(level.hole, level.w, level.h, RADIUS);
  const out: number[] = [];
  for (let i = 0; i < grown.length; i++) if (grown[i]) out.push(i);
  return Int32Array.from(out);
}

/** Onion peel: fill the hole from its edge inwards with the average of known neighbours. */
function initialGuess(level: Level) {
  const { w, h, rgb } = level;
  const known = new Uint8Array(w * h);
  let remaining: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (level.hole[i]) remaining.push(i);
    else known[i] = 1;
  }
  while (remaining.length > 0) {
    const next: number[] = [];
    const fill: [number, number, number, number][] = [];
    for (const i of remaining) {
      const x = i % w;
      const y = (i / w) | 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (!known[j]) continue;
          r += rgb[j * 3];
          g += rgb[j * 3 + 1];
          b += rgb[j * 3 + 2];
          n++;
        }
      }
      if (n > 0) fill.push([i, r / n, g / n, b / n]);
      else next.push(i);
    }
    if (fill.length === 0) break; // nothing known at all
    for (const [i, r, g, b] of fill) {
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
      known[i] = 1;
    }
    remaining = next;
  }
}

/** Hole pixels at this level start from the smaller level's answer, bilinearly. */
function upsampleGuess(coarse: Level, fine: Level) {
  const sx = coarse.w / fine.w;
  const sy = coarse.h / fine.h;
  for (let y = 0; y < fine.h; y++) {
    for (let x = 0; x < fine.w; x++) {
      const i = y * fine.w + x;
      if (!fine.hole[i]) continue;
      const cx = Math.min(coarse.w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const cy = Math.min(coarse.h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
      const x0 = Math.floor(cx);
      const y0 = Math.floor(cy);
      const x1 = Math.min(coarse.w - 1, x0 + 1);
      const y1 = Math.min(coarse.h - 1, y0 + 1);
      const tx = cx - x0;
      const ty = cy - y0;
      for (let c = 0; c < 3; c++) {
        const a = coarse.rgb[(y0 * coarse.w + x0) * 3 + c];
        const b = coarse.rgb[(y0 * coarse.w + x1) * 3 + c];
        const d = coarse.rgb[(y1 * coarse.w + x0) * 3 + c];
        const e = coarse.rgb[(y1 * coarse.w + x1) * 3 + c];
        fine.rgb[i * 3 + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      }
    }
  }
}

function randomField(level: Level, sources: Sources, random: () => number): Field {
  const targets = findTargets(level);
  const nnf = new Int32Array(level.w * level.h).fill(-1);
  const nnd = new Float32Array(level.w * level.h);
  for (const t of targets) {
    const s = sources.list[(random() * sources.count) | 0];
    nnf[t] = s;
    nnd[t] = distance(level, t, s, Infinity);
  }
  return { targets, nnf, nnd };
}

/** The smaller level's matches, doubled, as the starting point here. */
function upsampleField(coarseField: Field, coarse: Level, fine: Level, sources: Sources, random: () => number): Field {
  const targets = findTargets(fine);
  const nnf = new Int32Array(fine.w * fine.h).fill(-1);
  const nnd = new Float32Array(fine.w * fine.h);
  for (const t of targets) {
    const x = t % fine.w;
    const y = (t / fine.w) | 0;
    const cx = Math.min(coarse.w - 1, Math.floor((x * coarse.w) / fine.w));
    const cy = Math.min(coarse.h - 1, Math.floor((y * coarse.h) / fine.h));
    const cs = coarseField.nnf[cy * coarse.w + cx];
    let s = -1;
    if (cs >= 0) {
      const sx = Math.round(((cs % coarse.w) * fine.w) / coarse.w) + (x - Math.floor((cx * fine.w) / coarse.w));
      const sy = Math.round((((cs / coarse.w) | 0) * fine.h) / coarse.h) + (y - Math.floor((cy * fine.h) / coarse.h));
      if (sx >= 0 && sy >= 0 && sx < fine.w && sy < fine.h && sources.ok[sy * fine.w + sx]) s = sy * fine.w + sx;
    }
    if (s < 0) s = sources.list[(random() * sources.count) | 0];
    nnf[t] = s;
    nnd[t] = distance(fine, t, s, Infinity);
  }
  return { targets, nnf, nnd };
}

/**
 * Sum of squared colour differences between the patch around target `t` and
 * the patch around source `s`, stopping early once it passes `best`. Target
 * pixels outside the picture are skipped; sources are always whole.
 */
function distance(level: Level, t: number, s: number, best: number): number {
  const { w, h, rgb } = level;
  const tx = t % w;
  const ty = (t / w) | 0;
  const sx = s % w;
  const sy = (s / w) | 0;
  let sum = 0;
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    const y = ty + dy;
    if (y < 0 || y >= h) continue;
    const trow = y * w;
    const srow = (sy + dy) * w;
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const x = tx + dx;
      if (x < 0 || x >= w) continue;
      const a = (trow + x) * 3;
      const b = (srow + sx + dx) * 3;
      const d0 = rgb[a] - rgb[b];
      const d1 = rgb[a + 1] - rgb[b + 1];
      const d2 = rgb[a + 2] - rgb[b + 2];
      sum += d0 * d0 + d1 * d1 + d2 * d2;
    }
    if (sum > best) return sum;
  }
  return sum;
}

/** One PatchMatch sweep: propagate good matches from neighbours, then search at random. */
function patchMatch(level: Level, field: Field, sources: Sources, random: () => number, backwards: boolean) {
  const { w, h } = level;
  const { targets, nnf, nnd } = field;
  const step = backwards ? -1 : 1;
  const n = targets.length;
  const maxRadius = Math.max(w, h);

  const tryCandidate = (t: number, s: number) => {
    if (s < 0 || s >= w * h || !sources.ok[s] || s === nnf[t]) return;
    const d = distance(level, t, s, nnd[t]);
    if (d < nnd[t]) {
      nnd[t] = d;
      nnf[t] = s;
    }
  };

  for (let k = 0; k < n; k++) {
    const t = targets[backwards ? n - 1 - k : k];
    const x = t % w;
    const y = (t / w) | 0;

    // Propagation: the neighbour just visited found a match; the pixel beside
    // that match is a good guess for this one.
    const nx = x - step;
    if (nx >= 0 && nx < w) {
      const ns = nnf[t - step];
      if (ns >= 0 && (ns % w) + step >= 0 && (ns % w) + step < w) tryCandidate(t, ns + step);
    }
    const ny = y - step;
    if (ny >= 0 && ny < h) {
      const ns = nnf[t - step * w];
      if (ns >= 0) tryCandidate(t, ns + step * w);
    }

    // Random search around the current best, in ever smaller windows.
    const bx = nnf[t] % w;
    const by = (nnf[t] / w) | 0;
    for (let radius = maxRadius; radius >= 1; radius >>= 1) {
      const rx = Math.min(w - 1, Math.max(0, bx + Math.round((random() * 2 - 1) * radius)));
      const ry = Math.min(h - 1, Math.max(0, by + Math.round((random() * 2 - 1) * radius)));
      tryCandidate(t, ry * w + rx);
    }
  }
}

/**
 * Rebuild the hole: every pixel becomes the weighted average of what each patch
 * covering it says it should be — close matches get more say. With `sharpest`,
 * each pixel instead takes the value of the one patch that matched best.
 */
function vote(level: Level, field: Field, sharpest = false) {
  const { w, h, rgb, hole } = level;
  const { targets, nnf, nnd } = field;
  const patchPixels = (RADIUS * 2 + 1) ** 2 * 3;

  // Weight scale: the typical match error, so weights mean the same thing on a
  // noisy photo and a flat one.
  const errors = new Float32Array(targets.length);
  for (let k = 0; k < targets.length; k++) errors[k] = nnd[targets[k]] / patchPixels;
  const sorted = Float32Array.from(errors).sort();
  const sigma2 = Math.max(1, sorted[Math.floor(sorted.length * 0.75)] ?? 1);

  const acc = new Float32Array(w * h * 3);
  const weights = new Float32Array(w * h);
  for (let k = 0; k < targets.length; k++) {
    const t = targets[k];
    const s = nnf[t];
    if (s < 0) continue;
    const weight = Math.exp(-errors[k] / (2 * sigma2));
    const tx = t % w;
    const ty = (t / w) | 0;
    const sx = s % w;
    const sy = (s / w) | 0;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      const y = ty + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const x = tx + dx;
        if (x < 0 || x >= w) continue;
        const p = y * w + x;
        if (!hole[p]) continue;
        const q = ((sy + dy) * w + sx + dx) * 3;
        if (sharpest) {
          if (weight <= weights[p]) continue;
          acc[p * 3] = rgb[q];
          acc[p * 3 + 1] = rgb[q + 1];
          acc[p * 3 + 2] = rgb[q + 2];
          weights[p] = weight;
          continue;
        }
        acc[p * 3] += weight * rgb[q];
        acc[p * 3 + 1] += weight * rgb[q + 1];
        acc[p * 3 + 2] += weight * rgb[q + 2];
        weights[p] += weight;
      }
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (!hole[p] || weights[p] === 0) continue;
    const norm = sharpest ? 1 : weights[p];
    rgb[p * 3] = acc[p * 3] / norm;
    rgb[p * 3 + 1] = acc[p * 3 + 1] / norm;
    rgb[p * 3 + 2] = acc[p * 3 + 2] / norm;
  }
}

/* ---------------------------------------------------------------- output */

/** Write the fill into the hole — and nowhere else — at full resolution. */
function paste(out: Uint8ClampedArray, width: number, hole: Uint8Array, region: Region, level: Level, rgb: Float32Array) {
  const rw = region.x1 - region.x0;
  const rh = region.y1 - region.y0;
  const sx = level.w / rw;
  const sy = level.h / rh;
  for (let y = region.y0; y < region.y1; y++) {
    for (let x = region.x0; x < region.x1; x++) {
      const i = y * width + x;
      if (!hole[i]) continue;
      // Straight copy at full detail; bilinear when the region was worked small.
      const fx = Math.min(level.w - 1, Math.max(0, (x - region.x0 + 0.5) * sx - 0.5));
      const fy = Math.min(level.h - 1, Math.max(0, (y - region.y0 + 0.5) * sy - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(level.w - 1, x0 + 1);
      const y1 = Math.min(level.h - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      for (let c = 0; c < 3; c++) {
        const a = rgb[(y0 * level.w + x0) * 3 + c];
        const b = rgb[(y0 * level.w + x1) * 3 + c];
        const d = rgb[(y1 * level.w + x0) * 3 + c];
        const e = rgb[(y1 * level.w + x1) * 3 + c];
        out[i * 4 + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      }
      // An erased object leaves the picture as solid as its surroundings.
      out[i * 4 + 3] = 255;
    }
  }
}

/* --------------------------------------------------------------- helpers */

/** A square dilation by `r` pixels (separable, so cheap at any radius). */
function grow(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const src = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) src[i] = mask[i] > 0 ? 1 : 0;
  if (r <= 0) return src;
  const across = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) {
      if (src[y * w + x]) last = x;
      if (x - last <= r) across[y * w + x] = 1;
    }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (src[y * w + x]) last = x;
      if (last - x <= r) across[y * w + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let last = -Infinity;
    for (let y = 0; y < h; y++) {
      if (across[y * w + x]) last = y;
      if (y - last <= r) out[y * w + x] = 1;
    }
    last = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (across[y * w + x]) last = y;
      if (last - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

/** Small, fast, seedable PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
