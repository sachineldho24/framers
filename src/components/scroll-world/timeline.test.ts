import assert from "node:assert/strict";
import test from "node:test";

import {
  recoverBrokenImage,
  selectInitialImageSource,
} from "./imageFallback.ts";
import {
  buildTimeline,
  getActiveSceneIndex,
  getCopyCrossfade,
  remapWithLinger,
} from "./timeline.ts";

const scenes = [
  { id: "art", scroll: 1.6 },
  { id: "design", scroll: 1.35 },
  { id: "craft", scroll: 1.45 },
  { id: "wall", scroll: 1.8 },
];

test("buildTimeline gives all four story beats a contiguous scroll range", () => {
  const timeline = buildTimeline(scenes, 1000, 1);

  assert.equal(timeline.totalHeight, 7200);
  assert.deepEqual(
    timeline.segments.map(({ id, start, end }) => ({ id, start, end })),
    [
      { id: "art", start: 0, end: 1600 },
      { id: "design", start: 1600, end: 2950 },
      { id: "craft", start: 2950, end: 4400 },
      { id: "wall", start: 4400, end: 6200 },
    ],
  );
});

test("getActiveSceneIndex clamps before the first and after the final beat", () => {
  const timeline = buildTimeline(scenes, 1000, 1);

  assert.equal(getActiveSceneIndex(timeline.segments, -100), 0);
  assert.equal(getActiveSceneIndex(timeline.segments, 2000), 1);
  assert.equal(getActiveSceneIndex(timeline.segments, 99999), 3);
});

test("linger remapping preserves exact seam endpoints", () => {
  assert.equal(remapWithLinger(0, 0.5), 0);
  assert.equal(remapWithLinger(1, 0.5), 1);
  assert.equal(remapWithLinger(0.5, 0.5), 0.5);
  assert.ok(remapWithLinger(0.25, 0.5) > 0.25);
  assert.ok(remapWithLinger(0.75, 0.5) < 0.75);
});

test("copy crossfades never leave a blank chapter boundary", () => {
  for (let step = 0; step <= 100; step += 1) {
    const opacity = getCopyCrossfade(step / 100, true);
    assert.ok(opacity.current + opacity.next > 0.999);
  }

  assert.deepEqual(getCopyCrossfade(0.77, true), { current: 1, next: 0 });
  assert.deepEqual(getCopyCrossfade(1, true), { current: 0, next: 1 });
  assert.deepEqual(getCopyCrossfade(1, false), { current: 1, next: 0 });
});

test("a generated asset that failed before hydration is replaced by its local fallback", () => {
  const image = {
    src: "http://127.0.0.1:3000/world/art-poster.webp",
    complete: true,
    naturalWidth: 0,
  };

  assert.equal(recoverBrokenImage(image, "/posters/hilux.jpg"), true);
  assert.equal(image.src, "/posters/hilux.jpg");
  assert.equal(recoverBrokenImage(image, "/posters/hilux.jpg"), false);
});

test("the server-rendered first paint uses the supplied storyboard frame", () => {
  assert.equal(
    selectInitialImageSource(
      "/world/keyframes/00-exterior-closed-van.png",
      "/posters/hilux.jpg",
    ),
    "/world/keyframes/00-exterior-closed-van.png",
  );
});
