import assert from "node:assert/strict";
import { test } from "node:test";

import { inpaint, InpaintError, type RgbaImage } from "./inpaint.ts";

function image(w: number, h: number, color: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = color(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h };
}

function rectMask(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * w + x] = 255;
  return mask;
}

/** Paint a red "object" into the picture where the mask is. */
function withObject(img: RgbaImage, mask: Uint8Array): RgbaImage {
  const data = new Uint8ClampedArray(img.data);
  for (let i = 0; i < mask.length; i++) if (mask[i]) data.set([255, 0, 0, 255], i * 4);
  return { ...img, data };
}

/** Mean absolute error against the clean picture, over the masked pixels. */
function errorInside(out: Uint8ClampedArray, truth: RgbaImage, mask: Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    for (let c = 0; c < 3; c++) sum += Math.abs(out[i * 4 + c] - truth.data[i * 4 + c]);
    n += 3;
  }
  return sum / n;
}

const W = 96;
const H = 80;

test("an object on a flat background disappears into it", () => {
  const clean = image(W, H, () => [40, 120, 200]);
  const mask = rectMask(W, H, 30, 25, 55, 50);
  const out = inpaint(withObject(clean, mask), mask, { seed: 1 });
  assert.ok(errorInside(out, clean, mask) < 1, "the fill is the background colour");
});

test("stripes carry on through the hole", () => {
  // Horizontal bands 6 px tall: the fill has to continue the pattern, not blur it.
  const clean = image(W, H, (_x, y) => (Math.floor(y / 6) % 2 ? [230, 230, 230] : [20, 20, 20]));
  const mask = rectMask(W, H, 36, 30, 60, 50);
  const out = inpaint(withObject(clean, mask), mask, { seed: 1 });
  // Blurring the bands together would score ~105; continuing them scores low.
  const error = errorInside(out, clean, mask);
  assert.ok(error < 25, `mean error ${error.toFixed(1)}`);
});

test("only the masked pixels change — and the few just around them", () => {
  const clean = image(W, H, (x, y) => [(x * 7) % 256, (y * 5) % 256, ((x + y) * 3) % 256]);
  const mask = rectMask(W, H, 40, 30, 50, 40);
  const input = withObject(clean, mask);
  const out = inpaint(input, mask, { seed: 1 });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The mask is grown by 2 px to catch an object's soft edge.
      const near = x >= 38 && x < 52 && y >= 28 && y < 42;
      if (near) continue;
      const i = (y * W + x) * 4;
      assert.deepEqual([...out.subarray(i, i + 4)], [...input.data.subarray(i, i + 4)], `(${x},${y}) changed`);
    }
  }
});

test("a hole touching the picture's edge still fills", () => {
  const clean = image(W, H, () => [90, 160, 60]);
  const mask = rectMask(W, H, 0, 0, 20, 18);
  const out = inpaint(withObject(clean, mask), mask, { seed: 1 });
  assert.ok(errorInside(out, clean, mask) < 1);
});

test("the same seed gives the same result", () => {
  const clean = image(W, H, (x, y) => [(x * 11) % 256, (y * 13) % 256, 128]);
  const mask = rectMask(W, H, 30, 30, 50, 45);
  const a = inpaint(withObject(clean, mask), mask, { seed: 7 });
  const b = inpaint(withObject(clean, mask), mask, { seed: 7 });
  assert.deepEqual(a, b);
});

test("an empty mask returns the picture unchanged, and progress reaches 1 on real work", () => {
  const clean = image(W, H, () => [1, 2, 3]);
  assert.deepEqual(inpaint(clean, new Uint8Array(W * H)), clean.data);

  let last = 0;
  inpaint(clean, rectMask(W, H, 10, 10, 20, 20), { onProgress: (f) => (last = f) });
  assert.equal(last, 1);
});

test("a mask covering nearly everything is refused rather than filled with garbage", () => {
  const clean = image(W, H, () => [1, 2, 3]);
  const mask = rectMask(W, H, 0, 0, W, H - 3);
  assert.throws(() => inpaint(clean, mask), InpaintError);
});
