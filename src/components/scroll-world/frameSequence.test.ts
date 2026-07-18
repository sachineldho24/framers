import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_SCENES } from "./content.ts";
import {
  coverGeometry,
  frameUrl,
  LruBitmapCache,
  planPreload,
  selectFrameTier,
  timeToFrameIndex,
} from "./frameSequence.ts";
import { getStoryboardTime } from "./timeline.ts";

const manifest = { fps: 15, frameCount: 844, duration: 56.2 };

test("time 0 maps to the first frame", () => {
  assert.equal(timeToFrameIndex(0, manifest), 0);
});

test("the final storyboard time maps to the last frame", () => {
  assert.equal(timeToFrameIndex(56.2, manifest), 843);
});

test("out-of-range times clamp to valid frame indices", () => {
  assert.equal(timeToFrameIndex(-5, manifest), 0);
  assert.equal(timeToFrameIndex(9999, manifest), 843);
  assert.equal(timeToFrameIndex(Number.NaN, manifest), 0);
});

test("every scene seam maps continuously into the next scene start", () => {
  WORLD_SCENES.slice(0, -1).forEach((scene, index) => {
    const next = WORLD_SCENES[index + 1];
    const endIndex = timeToFrameIndex(
      getStoryboardTime(scene, 1),
      manifest,
    );
    const nextStartIndex = timeToFrameIndex(
      getStoryboardTime(next, 0),
      manifest,
    );
    assert.equal(
      endIndex,
      nextStartIndex,
      `${scene.id} end frame must equal ${next.id} start frame`,
    );
  });
});

test("tier selection is deterministic on the short-side CSS width", () => {
  assert.equal(selectFrameTier(390), "mobile");
  assert.equal(selectFrameTier(600), "mobile");
  assert.equal(selectFrameTier(601), "desktop");
  assert.equal(selectFrameTier(1080), "desktop");
});

test("preload ordering puts the requested frame first, then prioritises scroll direction", () => {
  const forward = planPreload({
    current: 100,
    direction: 1,
    ahead: 4,
    behind: 2,
    frameCount: 844,
  });
  assert.equal(forward[0], 100);
  assert.deepEqual(forward, [100, 101, 102, 103, 104, 99, 98]);

  const reverse = planPreload({
    current: 100,
    direction: -1,
    ahead: 4,
    behind: 2,
    frameCount: 844,
  });
  assert.equal(reverse[0], 100);
  assert.deepEqual(reverse, [100, 99, 98, 97, 96, 101, 102]);
});

test("the preload window never emits an out-of-range or duplicate index", () => {
  const nearEnd = planPreload({
    current: 843,
    direction: 1,
    ahead: 4,
    behind: 2,
    frameCount: 844,
  });
  assert.deepEqual(nearEnd, [843, 842, 841]);

  const nearStart = planPreload({
    current: 0,
    direction: -1,
    ahead: 4,
    behind: 2,
    frameCount: 844,
  });
  assert.deepEqual(nearStart, [0, 1, 2]);

  for (const index of nearEnd.concat(nearStart)) {
    assert.ok(index >= 0 && index < 844);
  }
});

test("cover geometry fills the target box and centres the overflow", () => {
  const wide = coverGeometry(1920, 1080, 1000, 1000);
  assert.equal(wide.drawWidth, 1777.7777777777778);
  assert.equal(wide.drawHeight, 1000);
  assert.equal(wide.dx, (1000 - wide.drawWidth) / 2);
  assert.equal(wide.dy, 0);

  const tall = coverGeometry(1920, 1080, 390, 844);
  // Portrait box is narrower than 16:9, so cover scales by height: drawHeight == box height.
  assert.ok(Math.abs(tall.drawHeight - 844) < 1e-9);
  assert.ok(tall.drawWidth >= 390 - 1e-9);
  assert.equal(tall.dy, 0);
  assert.equal(tall.dx, (390 - tall.drawWidth) / 2);
});

test("frame URLs are zero-padded to four digits under the tier directory", () => {
  const base = { baseUrl: "/world/frames", pattern: "frame-####.webp" };
  assert.equal(frameUrl(base, "desktop", 0), "/world/frames/desktop/frame-0000.webp");
  assert.equal(frameUrl(base, "mobile", 843), "/world/frames/mobile/frame-0843.webp");
});

test("the bitmap cache is bounded and closes least-recently-used frames on eviction", () => {
  const closed: number[] = [];
  const bitmap = (id: number) => ({ close: () => closed.push(id) });
  const cache = new LruBitmapCache<{ close: () => void }>(3);

  cache.set(0, bitmap(0));
  cache.set(1, bitmap(1));
  cache.set(2, bitmap(2));
  assert.equal(cache.size, 3);

  cache.get(0); // 0 becomes most-recently-used, 1 is now LRU
  cache.set(3, bitmap(3)); // evicts 1

  assert.deepEqual(closed, [1]);
  assert.equal(cache.has(1), false);
  assert.equal(cache.has(0), true);
  assert.equal(cache.has(3), true);
  assert.equal(cache.size, 3);
});

test("clearing the cache closes every retained bitmap", () => {
  const closed: number[] = [];
  const cache = new LruBitmapCache<{ close: () => void }>(4);
  cache.set(0, { close: () => closed.push(0) });
  cache.set(1, { close: () => closed.push(1) });

  cache.clear();
  assert.deepEqual(closed.sort(), [0, 1]);
  assert.equal(cache.size, 0);
});
