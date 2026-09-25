import assert from "node:assert/strict";
import test from "node:test";

import { createTextLayer, type Layer } from "./document.ts";
import {
  alignLayersTo,
  groupOf,
  isWholeGroup,
  layersInRect,
  scaleLayers,
  selectionBounds,
  withGroups,
} from "./multiSelect.ts";

function box(id: string, x: number, y: number, w: number, h: number, over: Partial<Layer> = {}): Layer {
  return {
    ...createTextLayer({ text: id, x, y, width: w, height: h, fontSize: 20 }),
    id,
    ...over,
  } as Layer;
}

const a = box("a", 0, 0, 100, 50);
const b = box("b", 200, 100, 100, 50);
const c = box("c", 500, 500, 50, 50);

test("the marquee picks up anything it touches, but not hidden layers", () => {
  const hits = layersInRect([a, b, c, box("h", 0, 0, 10, 10, { visible: false })], {
    x: 50, y: 25, width: 200, height: 100,
  });
  assert.deepEqual(hits.map((l) => l.id), ["a", "b"]);
});

test("selection bounds are the union of the layers", () => {
  assert.deepEqual(selectionBounds([a, b]), { x: 0, y: 0, width: 300, height: 150 });
  assert.equal(selectionBounds([]), null);
});

test("groups select as a whole", () => {
  const g1 = box("g1", 0, 0, 10, 10, { groupId: "G" });
  const g2 = box("g2", 20, 0, 10, 10, { groupId: "G" });
  const all = [g1, g2, c];
  assert.deepEqual(groupOf(all, g1).map((l) => l.id), ["g1", "g2"]);
  assert.deepEqual(withGroups(all, [g2, c]).map((l) => l.id), ["g1", "g2", "c"]);
  assert.equal(isWholeGroup(all, [g1, g2]), true);
  assert.equal(isWholeGroup(all, [g1, c]), false);
});

test("scaling a selection keeps its proportions and scales text with it", () => {
  const bounds = selectionBounds([a, b])!;
  // Dragging the south-east corner out to double the width.
  const patches = scaleLayers([a, b], bounds, "se", { x: 600, y: 300 });
  const pa = patches.find((p) => p.id === "a")!;
  const pb = patches.find((p) => p.id === "b")!;
  assert.deepEqual(pa.box, { x: 0, y: 0, width: 200, height: 100 });
  assert.deepEqual(pb.box, { x: 400, y: 200, width: 200, height: 100 });
  assert.equal(pa.fontSize, 40);
});

test("aligning several layers moves them to the joint edge", () => {
  const moves = alignLayersTo([a, b], "right");
  assert.deepEqual(moves, [
    { id: "a", dx: 200, dy: 0 },
    { id: "b", dx: 0, dy: 0 },
  ]);
});
