import assert from "node:assert/strict";
import { test } from "node:test";

import { localToDoc } from "./geometry.ts";
import { boxToSource, expandedBox, sourcePxToTightBox, sourceToBox, tightLayerFor } from "./objectGeometry.ts";

const crop = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };
const FLIPS = [
  { flipX: false, flipY: false },
  { flipX: true, flipY: false },
  { flipX: false, flipY: true },
  { flipX: true, flipY: true },
];

test("box and source coordinates round-trip under every mirror", () => {
  for (const flips of FLIPS) {
    const layer = { crop, ...flips };
    for (const p of [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.8 },
      { x: 1, y: 1 },
    ]) {
      const back = sourceToBox(layer, boxToSource(layer, p));
      assert.ok(Math.abs(back.x - p.x) < 1e-12 && Math.abs(back.y - p.y) < 1e-12);
    }
  }
});

test("the box corners read the crop window's corners, mirrored when flipped", () => {
  assert.deepEqual(boxToSource({ crop }, { x: 0, y: 0 }), { x: 0.1, y: 0.2 });
  const flipped = boxToSource({ crop, flipX: true }, { x: 0, y: 0 });
  // The crop is in mirrored (display) space: display x 0.1 is source x 0.9, and
  // that is what the box's left edge shows.
  assert.ok(Math.abs(flipped.x - 0.9) < 1e-12 && Math.abs(flipped.y - 0.2) < 1e-12);
});

/** Page position of a source point, as drawn by a given layer. */
function onPage(
  layer: { x: number; y: number; width: number; height: number; rotation: number; crop: typeof crop; flipX?: boolean; flipY?: boolean },
  source: { x: number; y: number }
) {
  const b = sourceToBox(layer, source);
  return localToDoc(layer, { x: b.x * layer.width, y: b.y * layer.height });
}

test("a lifted object stays exactly where it was on the page — rotated, cropped, mirrored", () => {
  const rect = { x0: 0.3, y0: 0.35, x1: 0.5, y1: 0.6 };
  for (const rotation of [0, 30, -75, 180]) {
    for (const flips of FLIPS) {
      const layer = { x: 120, y: 80, width: 900, height: 600, rotation, crop, ...flips };
      const tight = tightLayerFor(layer, rect)!;
      assert.ok(tight);
      const lifted = { ...layer, x: tight.x, y: tight.y, width: tight.width, height: tight.height, crop: tight.crop };
      for (const q of [
        { x: 0.3, y: 0.35 },
        { x: 0.42, y: 0.51 },
        { x: 0.5, y: 0.6 },
      ]) {
        const a = onPage(layer, q);
        const b = onPage(lifted, q);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.5, `rot ${rotation} ${JSON.stringify(flips)}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      }
    }
  }
});

test("the tight box keeps the photo's scale: object pixels aren't stretched", () => {
  const layer = { x: 0, y: 0, width: 900, height: 600, rotation: 0, crop };
  const tight = tightLayerFor(layer, { x0: 0.3, y0: 0.35, x1: 0.5, y1: 0.6 })!;
  assert.ok(Math.abs(tight.width / tight.crop.w - layer.width / crop.w) < 1e-9);
  assert.ok(Math.abs(tight.height / tight.crop.h - layer.height / crop.h) < 1e-9);
});

test("an object partly outside the crop is clamped to what the layer shows", () => {
  const layer = { x: 0, y: 0, width: 600, height: 500, rotation: 0, crop };
  const tight = tightLayerFor(layer, { x0: 0.0, y0: 0.3, x1: 0.2, y1: 0.4 })!;
  assert.ok(tight.crop.x >= crop.x - 1e-12);
  assert.equal(tightLayerFor(layer, { x0: 0.0, y0: 0.0, x1: 0.05, y1: 0.1 }), null);
});

test("source pixels land in the tight box's own viewBox space", () => {
  const layer = { x: 0, y: 0, width: 600, height: 500, rotation: 0, crop, flipX: true };
  const natural = { width: 2000, height: 1000 };
  const tight = tightLayerFor(layer, { x0: 0.3, y0: 0.35, x1: 0.5, y1: 0.6 })!;
  // The rect's corners map to the tight box's edges (x mirrored).
  const [ax, ay] = sourcePxToTightBox(layer, natural, tight, 0.5 * 2000, 0.35 * 1000);
  const [bx, by] = sourcePxToTightBox(layer, natural, tight, 0.3 * 2000, 0.6 * 1000);
  assert.ok(Math.abs(ax) < 1e-9 && Math.abs(ay) < 1e-9);
  assert.ok(Math.abs(bx - tight.width) < 1e-9 && Math.abs(by - tight.height) < 1e-9);
});

test("an expanded photo keeps its original pixels exactly in place — rotated, cropped, mirrored", () => {
  const growth = { left: 0.25, top: 0.1, right: 0.05, bottom: 0.4 };
  for (const rotation of [0, 30, -75, 180]) {
    for (const flips of FLIPS) {
      const layer = { x: 120, y: 80, width: 900, height: 600, rotation, crop, ...flips };
      const box = expandedBox(layer, growth);
      const grown = { ...layer, ...box, crop: { x: 0, y: 0, w: 1, h: 1 } };
      for (const q of [
        { x: 0.1, y: 0.2 },
        { x: 0.42, y: 0.51 },
        { x: 0.7, y: 0.7 },
      ]) {
        // The same source pixel in the grown picture's coordinates.
        const moved = { x: (q.x + growth.left) / (1 + growth.left + growth.right), y: (q.y + growth.top) / (1 + growth.top + growth.bottom) };
        const a = onPage(layer, q);
        const b = onPage(grown, moved);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.5, `rot ${rotation} ${JSON.stringify(flips)}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      }
    }
  }
});
