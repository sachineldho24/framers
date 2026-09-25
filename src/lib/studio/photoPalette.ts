/**
 * The main colours of a photo — what Canva shows as swatches on a selected
 * image and offers again as "Photo colours" in every colour picker.
 *
 * A small, deterministic quantiser rather than k-means: pixels are bucketed on a
 * 4-bit-per-channel grid, the buckets are ranked by how much of the picture they
 * cover, and near-duplicates are merged so the result is a handful of distinct
 * inks rather than six shades of the same sky. Deterministic matters: the
 * swatches must not reshuffle every time the toolbar re-renders.
 */

export interface PaletteOptions {
  /** How many colours to return, at most. */
  count?: number;
  /** Two colours closer than this (RGB distance, 0–441) count as one. */
  minDistance?: number;
}

interface Bucket {
  r: number;
  g: number;
  b: number;
  n: number;
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Palette from raw RGBA pixels (as `getImageData` returns them). Pure, so it can
 * be tested without a canvas. Transparent pixels — erased areas — are ignored.
 */
export function paletteFromPixels(
  data: ArrayLike<number>,
  { count = 6, minDistance = 48 }: PaletteOptions = {}
): string[] {
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }))
    // Ties broken by value so the order is stable across engines.
    .sort((a, b) => b.n - a.n || a.r + a.g + a.b - (b.r + b.g + b.b));

  const picked: Bucket[] = [];
  for (const c of ranked) {
    const near = picked.find(
      (p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < minDistance
    );
    if (near) {
      // Fold it in, weighted, so the kept swatch is the region's average.
      const n = near.n + c.n;
      near.r = (near.r * near.n + c.r * c.n) / n;
      near.g = (near.g * near.n + c.g * c.n) / n;
      near.b = (near.b * near.n + c.b * c.n) / n;
      near.n = n;
      continue;
    }
    if (picked.length < count) picked.push({ ...c });
  }

  return picked
    .sort((a, b) => b.n - a.n)
    .map((c) => toHex(c.r, c.g, c.b));
}

/** Sample edge for extraction. Enough to find the inks, cheap enough per image. */
const SAMPLE_EDGE = 64;

/**
 * Palette of a loaded image. Returns [] when the pixels can't be read (a
 * cross-origin image without CORS, or no canvas) rather than throwing — photo
 * colours are a convenience, never a reason for the editor to fail.
 */
export function extractPalette(
  image: CanvasImageSource & { width: number; height: number },
  options?: PaletteOptions
): string[] {
  try {
    const natW =
      "naturalWidth" in image ? (image as HTMLImageElement).naturalWidth : image.width;
    const natH =
      "naturalHeight" in image ? (image as HTMLImageElement).naturalHeight : image.height;
    if (!natW || !natH) return [];
    const scale = Math.min(1, SAMPLE_EDGE / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(image, 0, 0, w, h);
    return paletteFromPixels(ctx.getImageData(0, 0, w, h).data, options);
  } catch {
    return [];
  }
}
