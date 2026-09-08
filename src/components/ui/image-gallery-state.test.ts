import assert from "node:assert/strict";
import test from "node:test";

import {
  nearestCreationIndex,
  nextCreationIndex,
} from "./image-gallery-state.ts";

test("nextCreationIndex advances and wraps the mobile carousel", () => {
  assert.equal(nextCreationIndex(0, 14), 1);
  assert.equal(nextCreationIndex(13, 14), 0);
});

test("nextCreationIndex safely handles an empty gallery", () => {
  assert.equal(nextCreationIndex(0, 0), 0);
});

test("nearestCreationIndex follows the card nearest the scroll position", () => {
  assert.equal(nearestCreationIndex(0, [0, 300, 600]), 0);
  assert.equal(nearestCreationIndex(340, [0, 300, 600]), 1);
  assert.equal(nearestCreationIndex(520, [0, 300, 600]), 2);
});
