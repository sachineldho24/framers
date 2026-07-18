import assert from "node:assert/strict";
import { test } from "node:test";

import { WORLD_SCENES } from "./content.ts";
import * as timeline from "./timeline.ts";

test("the walkthrough exposes all eight storyboard stages in order", () => {
  assert.equal(WORLD_SCENES.length, 8);
  assert.deepEqual(
    WORLD_SCENES.map((scene) => scene.id),
    [
      "arrival",
      "reveal",
      "intake",
      "design",
      "craft",
      "quality",
      "dispatch",
      "shipping",
    ],
  );
});

test("storyboard time windows cover the complete film without gaps", () => {
  const windows = WORLD_SCENES.map((scene) => {
    const timedScene = scene as typeof scene & {
      videoStart: number;
      videoEnd: number;
    };
    return [timedScene.videoStart, timedScene.videoEnd];
  });

  assert.equal(windows[0]?.[0], 0);
  assert.equal(windows.at(-1)?.[1], 56.2);
  windows.slice(1).forEach((window, index) => {
    assert.equal(window[0], windows[index]?.[1]);
  });
});

test("scroll progress maps linearly across each scene's full motion range", () => {
  const getStoryboardTime = (
    timeline as unknown as {
      getStoryboardTime?: (
        scene: { videoStart: number; videoEnd: number },
        progress: number,
      ) => number;
    }
  ).getStoryboardTime;

  assert.equal(typeof getStoryboardTime, "function");
  assert.equal(
    getStoryboardTime?.({ videoStart: 10.5, videoEnd: 20.5 }, 0),
    10.5,
  );
  assert.equal(
    getStoryboardTime?.({ videoStart: 10.5, videoEnd: 20.5 }, 0.5),
    15.5,
  );
  assert.equal(
    getStoryboardTime?.({ videoStart: 10.5, videoEnd: 20.5 }, 1),
    20.5,
  );
});
