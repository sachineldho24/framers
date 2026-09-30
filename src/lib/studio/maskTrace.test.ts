import assert from "node:assert/strict";
import { test } from "node:test";

import { outlineMask, ringsToPathData, signedArea, traceMask, type Ring } from "./maskTrace.ts";

function maskFrom(rows: string[]): { mask: Uint8Array; w: number; h: number } {
  const h = rows.length;
  const w = rows[0].length;
  const mask = new Uint8Array(w * h);
  rows.forEach((row, y) => [...row].forEach((c, x) => (mask[y * w + x] = c === "#" ? 255 : 0)));
  return { mask, w, h };
}

/** Non-zero winding at a point — how the canvas fills a path by default. */
function winding(rings: Ring[], px: number, py: number): number {
  let wn = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % ring.length];
      if (y0 <= py) {
        if (y1 > py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) > 0) wn++;
      } else if (y1 <= py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) < 0) wn--;
    }
  }
  return wn;
}

/** Fill the rings back in at pixel centres and compare with the mask. */
function iouWithMask(rings: Ring[], mask: Uint8Array, w: number, h: number): number {
  let inter = 0;
  let uni = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = mask[y * w + x] > 0;
      const b = winding(rings, x + 0.5, y + 0.5) !== 0;
      if (a && b) inter++;
      if (a || b) uni++;
    }
  }
  return uni === 0 ? 1 : inter / uni;
}

test("a square traces to its four corners, clockwise", () => {
  const { mask, w, h } = maskFrom(["......", "..###.", "..###.", "..###.", "......"]);
  const rings = traceMask(mask, w, h, { minArea: 0 });
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 4);
  assert.equal(signedArea(rings[0]), 9);
});

test("a hole winds the other way, so a non-zero fill leaves it open", () => {
  const { mask, w, h } = maskFrom([
    "#######",
    "#######",
    "##...##",
    "##...##",
    "#######",
    "#######",
  ]);
  const rings = traceMask(mask, w, h, { minArea: 0 });
  assert.equal(rings.length, 2);
  const areas = rings.map(signedArea).sort((a, b) => a - b);
  assert.deepEqual(areas, [-6, 42]);
  assert.equal(iouWithMask(rings, mask, w, h), 1);
});

test("separate blobs, an L-shape and diagonal neighbours all fill back exactly", () => {
  const { mask, w, h } = maskFrom([
    "##....##..",
    "##....##..",
    "..........",
    "#.....###.",
    "##....#...",
    "###...#...",
    "....#.....",
    ".....#....",
  ]);
  const rings = traceMask(mask, w, h, { minArea: 0 });
  assert.ok(rings.length >= 5);
  assert.equal(iouWithMask(rings, mask, w, h), 1);
});

test("specks below the minimum area are dropped", () => {
  const { mask, w, h } = maskFrom(["#.......", "........", "..####..", "..####..", "..####.."]);
  const rings = traceMask(mask, w, h, { minArea: 4 });
  assert.equal(rings.length, 1);
});

test("a simplified circle stays within a hair of the mask, with far fewer nodes", () => {
  const w = 300;
  const h = 300;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - 150) ** 2 + (y - 150) ** 2 < 120 ** 2) mask[y * w + x] = 1;
  const raw = traceMask(mask, w, h);
  const outline = outlineMask(mask, w, h);
  const nodes = outline.reduce((n, r) => n + r.length, 0);
  assert.ok(nodes < raw[0].length / 3, `${nodes} nodes vs ${raw[0].length} raw`);
  assert.ok(iouWithMask(outline, mask, w, h) > 0.99);
});

test("the node cap is respected on a ragged outline", () => {
  const w = 400;
  const h = 400;
  const mask = new Uint8Array(w * h);
  // A comb: many teeth, many corners.
  for (let y = 50; y < 350; y++) for (let x = 50; x < 350; x++) if (y < 150 || x % 6 < 3) mask[y * w + x] = 1;
  const outline = outlineMask(mask, w, h, { maxNodes: 200 });
  assert.ok(outline.reduce((n, r) => n + r.length, 0) <= 200);
});

test("path data closes each ring and applies the mapping", () => {
  const d = ringsToPathData(
    [
      [
        [0, 0],
        [2, 0],
        [2, 1],
      ],
    ],
    (x, y) => [x * 10, y * 10 + 0.123]
  );
  assert.equal(d, "M0 0.12L20 0.12L20 10.12Z");
});
