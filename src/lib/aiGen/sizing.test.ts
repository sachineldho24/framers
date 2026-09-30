import { test } from "node:test";
import assert from "node:assert/strict";

import { expandPadding, fitWithin, nearestAspect, nearestPreset, ratioOf, sizeFor } from "./sizing.ts";

test("ratioOf reads both separators", () => {
  assert.equal(ratioOf("16:9"), 16 / 9);
  assert.equal(ratioOf("1024x512"), 2);
});

test("nearestAspect compares shapes symmetrically and skips auto", () => {
  assert.equal(nearestAspect(1.02, ["auto", "1:1", "4:3"]), "1:1");
  assert.equal(nearestAspect(0.5, ["1:1", "9:16", "1:4"]), "9:16");
});

test("sizeFor keeps the shape on the grid and within limits", () => {
  const s = sizeFor(16 / 9, 1.05, { multiple: 16, maxEdge: 3840 });
  assert.equal(s.width % 16, 0);
  assert.equal(s.height % 16, 0);
  assert.ok(Math.abs(s.width / s.height - 16 / 9) < 0.02);
  const big = sizeFor(1, 33, { multiple: 16, maxEdge: 3840, maxPixels: 8_294_400 });
  assert.ok(big.width * big.height <= 8_294_400 && big.width <= 3840);
});

test("nearestPreset prefers the right shape, then the right size", () => {
  const presets = ["1024x1024", "2048x2048", "1280x720", "2560x1440"];
  assert.equal(nearestPreset(presets, 16 / 9, 1), "1280x720");
  assert.equal(nearestPreset(presets, 16 / 9, 4), "2560x1440");
  assert.equal(nearestPreset(presets, 1, 4), "2048x2048");
});

test("expandPadding reaches the target shape, centred, and only grows", () => {
  const p = expandPadding(1000, 1000, 16 / 9);
  assert.equal(p.top + p.bottom, 0);
  assert.equal(p.left + p.right, 778);
  assert.ok(Math.abs(p.left - p.right) <= 1);
  const extra = expandPadding(800, 600, 4 / 3, 0.25);
  assert.equal(extra.left + extra.right, 200);
  assert.equal(extra.top + extra.bottom, 150);
  // Already wider than the target: grows in height, never shrinks width.
  const tall = expandPadding(1600, 900, 1);
  assert.equal(tall.left + tall.right, 0);
  assert.equal(tall.top + tall.bottom, 700);
});

test("fitWithin only ever scales down", () => {
  assert.deepEqual(fitWithin(4000, 2000, 2048), { width: 2048, height: 1024, scale: 0.512 });
  assert.deepEqual(fitWithin(800, 600, 2048), { width: 800, height: 600, scale: 1 });
});
