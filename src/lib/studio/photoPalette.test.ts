import assert from "node:assert/strict";
import test from "node:test";

import { paletteFromPixels } from "./photoPalette.ts";

/** RGBA pixels: `n` copies of each [r, g, b, a]. */
function pixels(...runs: [number, number, number, number, number][]): number[] {
  const out: number[] = [];
  for (const [r, g, b, a, n] of runs) {
    for (let i = 0; i < n; i += 1) out.push(r, g, b, a);
  }
  return out;
}

test("ranks colours by how much of the photo they cover", () => {
  const data = pixels([200, 30, 30, 255, 10], [20, 20, 60, 255, 30], [240, 240, 240, 255, 5]);
  const palette = paletteFromPixels(data);
  assert.deepEqual(palette, ["#14143c", "#c81e1e", "#f0f0f0"]);
});

test("merges near-duplicate shades into one swatch", () => {
  const data = pixels([100, 100, 100, 255, 10], [106, 104, 102, 255, 10]);
  assert.equal(paletteFromPixels(data).length, 1);
});

test("ignores transparent (erased) pixels and caps the count", () => {
  const data = pixels(
    [255, 0, 0, 0, 100],
    [0, 0, 0, 255, 5],
    [255, 255, 255, 255, 4],
    [0, 120, 255, 255, 3],
    [0, 200, 0, 255, 2]
  );
  const palette = paletteFromPixels(data, { count: 3 });
  assert.equal(palette.length, 3);
  assert.ok(!palette.includes("#ff0000"));
  assert.equal(palette[0], "#000000");
});

test("an empty or fully transparent image has no palette", () => {
  assert.deepEqual(paletteFromPixels([]), []);
  assert.deepEqual(paletteFromPixels(pixels([1, 2, 3, 0, 9])), []);
});
