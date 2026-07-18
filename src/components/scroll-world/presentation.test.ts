import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const componentSource = readFileSync(
  new URL("../ScrollWorldClient.tsx", import.meta.url),
  "utf8",
);
const contentSource = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const stylesSource = readFileSync(
  new URL("../ScrollWorldClient.module.css", import.meta.url),
  "utf8",
);
const playerSource = readFileSync(
  new URL("./FrameSequencePlayer.ts", import.meta.url),
  "utf8",
);

test("scrubs the approved V2 master as a canvas image sequence, not an MP4 currentTime scrub", () => {
  // The frame sequence is derived from the approved master; the source stays declared
  // for the extraction script + safe-keeping, but the runtime no longer scrubs it.
  assert.match(
    contentSource,
    /export const WORLD_FILM_SOURCE = "\/world\/vid\/framers-v2\.mp4"/,
  );
  assert.match(contentSource, /WORLD_FRAME_SEQUENCE/);

  // Presentation is a canvas driven by the frame-sequence player...
  assert.match(componentSource, /canvasRef/);
  assert.match(componentSource, /<canvas/);
  assert.match(componentSource, /FrameSequencePlayer/);

  // ...and there is no MP4 / currentTime scrub controller left anywhere.
  assert.doesNotMatch(componentSource, /masterVideoRef/);
  assert.doesNotMatch(componentSource, /<video/);
  assert.doesNotMatch(componentSource, /currentTime/);
  assert.doesNotMatch(componentSource, /planVideoMotion|planVideoSeek/);
});

test("reduced-motion and data-saver users never construct the frame-sequence player", () => {
  // stillsOnly short-circuits player creation, so no frame is ever requested.
  assert.match(
    componentSource,
    /const stillsOnly =\s*reducedMotion \|\| Boolean\(connection\?\.saveData\)/,
  );
  assert.match(componentSource, /if \(!stillsOnly && canvas\)/);
});

test("the frame-sequence player keeps decode work and memory bounded", () => {
  // Concurrency cap, DPR cap, and an LRU bitmap cache that closes evicted frames.
  assert.match(playerSource, /MAX_CONCURRENCY = 4/);
  assert.match(playerSource, /MAX_DPR = 2/);
  assert.match(playerSource, /LruBitmapCache/);
  assert.match(playerSource, /AbortController/);
});

test("the server-rendered first paint still uses the corrected closed-exterior still", () => {
  assert.match(contentSource, /00-exterior-closed-van\.png/);
});

test("removes the top scroll progress bar", () => {
  assert.doesNotMatch(componentSource, /progressRef/);
  assert.doesNotMatch(componentSource, /styles\.progress/);
  assert.doesNotMatch(stylesSource, /^\.progress(?:\s|\{)/m);
  assert.doesNotMatch(stylesSource, /^\.progress span(?:\s|\{)/m);
});

test("uses a restrained premium palette with no neon navigation", () => {
  assert.doesNotMatch(componentSource, /styles\.topnav/);
  assert.doesNotMatch(componentSource, /styles\.route/);
  assert.match(stylesSource, /--world-brass:/);
  assert.doesNotMatch(stylesSource, /--world-lime:/);
  assert.doesNotMatch(stylesSource, /--world-red:/);
  assert.doesNotMatch(stylesSource, /#ccff00/i);
  assert.doesNotMatch(stylesSource, /#ff0000/i);
});

test("has no chapter story rail", () => {
  assert.doesNotMatch(componentSource, /styles\.storyRail/);
  assert.doesNotMatch(componentSource, /styles\.railMarks/);
  assert.doesNotMatch(stylesSource, /^\.storyRail(?:\s|\{)/m);
  assert.doesNotMatch(stylesSource, /^\.railMarks(?:\s|\{)/m);
});
