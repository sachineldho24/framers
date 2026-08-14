import assert from "node:assert/strict";
import test from "node:test";

import {
  aspectMatches,
  aspectPresets,
  cropFromHandle,
  cropFromPan,
  cropWindow,
  fitToAspect,
  hitTestCropHandle,
  insideWindow,
  normaliseWindow,
  MIN_CROP,
  type AspectSource,
} from "./crop.ts";
import { FULL_CROP, type CropRect } from "./document.ts";
import type { Box } from "./geometry.ts";

/** A 400×200 layer, so the two axes can't be confused for each other. */
const W = 400;
const H = 200;

function near(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function assertValid(crop: CropRect) {
  assert.ok(crop.w >= MIN_CROP && crop.w <= 1, `w out of range: ${crop.w}`);
  assert.ok(crop.h >= MIN_CROP && crop.h <= 1, `h out of range: ${crop.h}`);
  assert.ok(crop.x >= 0, `x below 0: ${crop.x}`);
  assert.ok(crop.y >= 0, `y below 0: ${crop.y}`);
  assert.ok(crop.x + crop.w <= 1 + 1e-9, `right edge past 1: ${crop.x + crop.w}`);
  assert.ok(crop.y + crop.h <= 1 + 1e-9, `bottom edge past 1: ${crop.y + crop.h}`);
}

test("cropWindow scales the normalised rect into layer-local pixels", () => {
  const win = cropWindow({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, W, H);
  assert.deepEqual(win, { x: 100, y: 100, width: 200, height: 50, rotation: 0 });
});

test("normaliseWindow round-trips a window that is already inside", () => {
  const crop: CropRect = { x: 0.1, y: 0.2, w: 0.4, h: 0.5 };
  const back = normaliseWindow(cropWindow(crop, W, H), W, H);
  near(back.x, crop.x);
  near(back.y, crop.y);
  near(back.w, crop.w);
  near(back.h, crop.h);
});

test("normaliseWindow clips each edge independently rather than sliding", () => {
  // Overhangs the left edge by 40px. The right edge must stay at 200px, so the
  // window narrows — it does not keep its width and shift right.
  const win: Box = { x: -40, y: 20, width: 240, height: 100, rotation: 0 };
  const crop = normaliseWindow(win, W, H);
  near(crop.x, 0);
  near(crop.w, 200 / W);
  near(crop.y, 20 / H);
  near(crop.h, 100 / H);
  assertValid(crop);
});

test("normaliseWindow never returns a degenerate rect", () => {
  const flat: Box = { x: 10, y: 10, width: 0, height: 0, rotation: 0 };
  const crop = normaliseWindow(flat, W, H);
  assert.equal(crop.w, MIN_CROP);
  assert.equal(crop.h, MIN_CROP);
  assertValid(crop);
});

test("normaliseWindow keeps a fully-outside window inside the image", () => {
  const away: Box = { x: 900, y: 900, width: 100, height: 100, rotation: 0 };
  assertValid(normaliseWindow(away, W, H));
});

test("hitTestCropHandle finds each of the eight handles", () => {
  const win = cropWindow({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, W, H);
  const expected: Array<[string, { x: number; y: number }]> = [
    ["nw", { x: 100, y: 50 }],
    ["n", { x: 200, y: 50 }],
    ["ne", { x: 300, y: 50 }],
    ["e", { x: 300, y: 100 }],
    ["se", { x: 300, y: 150 }],
    ["s", { x: 200, y: 150 }],
    ["sw", { x: 100, y: 150 }],
    ["w", { x: 100, y: 100 }],
  ];
  for (const [id, point] of expected) {
    assert.equal(hitTestCropHandle(win, point, 6), id, `at ${id}`);
  }
});

test("hitTestCropHandle misses the window's interior and the outside", () => {
  const win = cropWindow({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, W, H);
  assert.equal(hitTestCropHandle(win, { x: 200, y: 100 }, 6), null);
  assert.equal(hitTestCropHandle(win, { x: 0, y: 0 }, 6), null);
});

test("insideWindow answers for the window, not the layer", () => {
  const win = cropWindow({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, W, H);
  assert.equal(insideWindow(win, { x: 200, y: 100 }), true);
  assert.equal(insideWindow(win, { x: 20, y: 100 }), false);
});

test("cropFromHandle shrinks toward the dragged corner and pins the opposite", () => {
  // Drag `se` from (400,200) in to (200,100): the nw corner must not move.
  const crop = cropFromHandle(FULL_CROP, "se", { x: 200, y: 100 }, W, H);
  near(crop.x, 0);
  near(crop.y, 0);
  near(crop.w, 0.5);
  near(crop.h, 0.5);
  assertValid(crop);
});

test("cropFromHandle on an edge moves only that axis", () => {
  const crop = cropFromHandle(FULL_CROP, "w", { x: 100, y: 0 }, W, H);
  near(crop.x, 0.25);
  near(crop.w, 0.75);
  near(crop.y, 0);
  near(crop.h, 1);
});

test("cropFromHandle with lockAspect preserves the window's shape", () => {
  const start: CropRect = { x: 0, y: 0, w: 0.5, h: 0.5 };
  // Starting window is 200×100 — aspect 2. Dragging se well off-axis must
  // still come back with aspect 2.
  const crop = cropFromHandle(
    start,
    "se",
    { x: 100, y: 90 },
    W,
    H,
    { lockAspect: true }
  );
  near((crop.w * W) / (crop.h * H), 2, 1e-6);
  assertValid(crop);
});

test("cropFromHandle stops at the image edge instead of sliding along it", () => {
  const start: CropRect = { x: 0.5, y: 0, w: 0.5, h: 1 };
  // Drag the `e` handle far past the right edge. The left edge is pinned at
  // 0.5, so the result must be exactly the right half — not a wider window
  // pushed back inside.
  const crop = cropFromHandle(start, "e", { x: 10_000, y: 100 }, W, H);
  near(crop.x, 0.5);
  near(crop.w, 0.5);
  assertValid(crop);
});

test("cropFromHandle never returns something the reducer would have to fix", () => {
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
  const points = [
    { x: -500, y: -500 },
    { x: 5000, y: 5000 },
    { x: 200, y: 100 },
    { x: 0, y: 200 },
    { x: 399, y: 1 },
  ];
  for (const handle of handles) {
    for (const point of points) {
      assertValid(cropFromHandle(FULL_CROP, handle, point, W, H));
      assertValid(
        cropFromHandle({ x: 0.2, y: 0.3, w: 0.5, h: 0.4 }, handle, point, W, H)
      );
    }
  }
});

test("cropFromPan moves the source against the pointer and keeps the size", () => {
  const start: CropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  // Drag right by 40px (a tenth of the width): the source rect moves left.
  const crop = cropFromPan(start, { x: 0, y: 0 }, { x: 40, y: 0 }, W, H);
  near(crop.x, 0.15);
  near(crop.y, 0.25);
  near(crop.w, 0.5);
  near(crop.h, 0.5);
});

test("cropFromPan clamps at the image edge without resizing", () => {
  const start: CropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const crop = cropFromPan(start, { x: 0, y: 0 }, { x: 5000, y: 5000 }, W, H);
  near(crop.x, 0);
  near(crop.y, 0);
  near(crop.w, 0.5);
  near(crop.h, 0.5);
  assertValid(crop);
});

test("cropFromPan is a no-op when the pointer hasn't moved", () => {
  const start: CropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const crop = cropFromPan(start, { x: 12, y: 34 }, { x: 12, y: 34 }, W, H);
  assert.deepEqual(crop, start);
});

/* ------------------------------------------------------------ aspect ratios */

const PAGE = { width: 1000, height: 800 };

/** A 2:1 photo placed at 2:1, so a distortion shows up as a number, not a look. */
const PHOTO: AspectSource = {
  x: 100,
  y: 50,
  width: 400,
  height: 200,
  crop: FULL_CROP,
  naturalWidth: 4000,
  naturalHeight: 2000,
};

/** The shape of the pixels actually drawn: source px wide ÷ source px tall. */
function sourceAspect(crop: CropRect, layer: AspectSource): number {
  return (crop.w * layer.naturalWidth) / (crop.h * layer.naturalHeight);
}

test("an aspect preset never stretches the photo", () => {
  const sources: AspectSource[] = [
    PHOTO,
    { ...PHOTO, naturalWidth: 1200, naturalHeight: 1600 },
    { ...PHOTO, width: 300, height: 300, naturalWidth: 900, naturalHeight: 900 },
    // Already cropped and already the wrong shape for its box — the case that
    // arrives after a free handle drag.
    { ...PHOTO, width: 500, height: 120, crop: { x: 0.2, y: 0.3, w: 0.5, h: 0.4 } },
  ];
  const aspects = [1, 0.75, 0.8, 5 / 7, 2 / 3, 1000 / 800, 3];
  for (const source of sources) {
    for (const aspect of aspects) {
      const fit = fitToAspect(source, aspect, PAGE);
      near(fit.width / fit.height, aspect, 1e-9);
      // The box's shape and the source's shape have to be the same number, or
      // `drawImage` stretches the difference.
      near(sourceAspect(fit.crop, source), aspect, 1e-9);
      assertValid(fit.crop);
    }
  }
});

test("the box keeps its area and its centre, so the photo keeps its weight", () => {
  const fit = fitToAspect(PHOTO, 1, PAGE);
  near(fit.width * fit.height, PHOTO.width * PHOTO.height, 1e-6);
  near(fit.x + fit.width / 2, PHOTO.x + PHOTO.width / 2, 1e-9);
  near(fit.y + fit.height / 2, PHOTO.y + PHOTO.height / 2, 1e-9);
});

test("a preset shrinks to the page rather than hanging off the paper", () => {
  // A photo covering the whole 1000×800 page, asked for a square: an
  // area-preserving square would be 894 wide, taller than the page.
  const full: AspectSource = { ...PHOTO, x: 0, y: 0, width: 1000, height: 800 };
  const fit = fitToAspect(full, 1, PAGE);
  near(fit.width, 800);
  near(fit.height, 800);
  near(fit.x, 100);
  near(fit.y, 0);
});

test("a preset keeps the zoom the user already had", () => {
  const zoomed: AspectSource = {
    ...PHOTO,
    naturalWidth: 1000,
    naturalHeight: 1000,
    crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
  };
  for (const aspect of [1, 2, 0.5, 4 / 5]) {
    const { crop } = fitToAspect(zoomed, aspect, PAGE);
    // Inside the old window: a preset may narrow what's shown, never re-widen
    // it past where the user had zoomed to.
    assert.ok(crop.w <= zoomed.crop.w + 1e-9, `w grew: ${crop.w}`);
    assert.ok(crop.h <= zoomed.crop.h + 1e-9, `h grew: ${crop.h}`);
    near(crop.x + crop.w / 2, 0.5, 1e-9);
    near(crop.y + crop.h / 2, 0.5, 1e-9);
  }
  // Square source, square box, square crop: nothing to change.
  assert.deepEqual(fitToAspect(zoomed, 1, PAGE).crop, zoomed.crop);
});

test("a nonsense aspect falls back to square instead of NaN", () => {
  for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
    const fit = fitToAspect(PHOTO, bad, PAGE);
    near(fit.width / fit.height, 1, 1e-9);
    assertValid(fit.crop);
  }
});

test("the ratio buttons turn to match the page", () => {
  const portrait = aspectPresets(2480, 3508);
  assert.deepEqual(
    portrait.map((p) => p.label),
    ["Frame", "1:1", "3:4", "4:5", "5:7", "2:3"]
  );
  near(portrait[2].aspect, 0.75);

  const landscape = aspectPresets(3508, 2480);
  assert.deepEqual(
    landscape.map((p) => p.label),
    ["Frame", "1:1", "4:3", "5:4", "7:5", "3:2"]
  );
  near(landscape[2].aspect, 4 / 3);

  // "Frame" is the page itself, whichever way round it is.
  near(portrait[0].aspect, 2480 / 3508);
  near(landscape[0].aspect, 3508 / 2480);
});

test("aspectMatches lights the button only for the shape you're actually in", () => {
  assert.equal(aspectMatches(400, 400, 1), true);
  assert.equal(aspectMatches(400, 401, 1), true); // rounding, not a reshape
  assert.equal(aspectMatches(400, 500, 1), false);
  // A4 (1:√2) must not light 5:7, which is only 1% away.
  assert.equal(aspectMatches(2480, 3508, 5 / 7), false);
  assert.equal(aspectMatches(400, 0, 1), false);
});
