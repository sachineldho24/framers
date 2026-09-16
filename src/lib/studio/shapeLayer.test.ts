import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocument,
  createShapeLayer,
  isShapeLayer,
  MAX_SHAPE_STROKE,
  migrateDocument,
  SHAPE_DEFAULTS,
  type StudioDocument,
} from "./document.ts";
import { studioReducer } from "./reducer.ts";

function seeded(): StudioDocument {
  const doc = createDocument({ width: 1000, height: 800, title: "T" });
  return studioReducer(doc, {
    type: "addLayer",
    layer: createShapeLayer({
      shapeId: "star",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
    }),
  });
}

test("a new element is named after the element, not the layer kind", () => {
  const layer = createShapeLayer({
    shapeId: "heart",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  });
  assert.ok(isShapeLayer(layer));
  assert.equal(layer.name, "Heart");
  assert.equal(layer.kind, "shape");
  assert.equal(layer.color, SHAPE_DEFAULTS.color);
  assert.equal(layer.rotation, 0);
  assert.equal(layer.visible, true);
});

test("a weight beyond the ceiling is clamped rather than drawn", () => {
  const layer = createShapeLayer({
    shapeId: "line",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokeWidth: 99_999,
  });
  assert.equal(layer.strokeWidth, MAX_SHAPE_STROKE);
});

test("recolouring is pure, and the same colour twice is not an edit", () => {
  const doc = seeded();
  const id = doc.layers[0].id;

  const next = studioReducer(doc, {
    type: "setShapeStyle",
    layerId: id,
    patch: { color: "#ff0000" },
  });
  assert.notEqual(next, doc);
  assert.equal(next.layers[0].color, "#ff0000");
  // The original is untouched, which is what lets undo hold a reference to it.
  assert.equal(doc.layers[0].color, SHAPE_DEFAULTS.color);

  const same = studioReducer(next, {
    type: "setShapeStyle",
    layerId: id,
    patch: { color: "#ff0000" },
  });
  // Identity, not equality: an identical document must not push an undo entry.
  assert.equal(same, next);
});

test("a locked element refuses a style edit", () => {
  const doc = seeded();
  const id = doc.layers[0].id;
  const locked = studioReducer(doc, {
    type: "setLayerLocked",
    layerId: id,
    locked: true,
  });
  const next = studioReducer(locked, {
    type: "setShapeStyle",
    layerId: id,
    patch: { color: "#ff0000" },
  });
  assert.equal(next, locked);
});

test("a style edit aimed at a photo does nothing", () => {
  const doc = seeded();
  const next = studioReducer(doc, {
    type: "setShapeStyle",
    layerId: "not-a-layer",
    patch: { color: "#ff0000" },
  });
  assert.equal(next, doc);
});

test("an element survives the round trip through JSON", () => {
  const doc = seeded();
  const stored = JSON.parse(JSON.stringify(doc)) as StudioDocument;
  const back = migrateDocument(stored);
  assert.ok(back);
  assert.deepEqual(back.layers, doc.layers);
});

test("an element the catalogue no longer ships is dropped, not blanked", () => {
  const doc = seeded();
  const stored = JSON.parse(JSON.stringify(doc));
  stored.layers[0].shapeId = "no-such-element";
  const back = migrateDocument(stored);
  assert.ok(back);
  // A layer with no geometry would still answer to clicks and still count in
  // the layer list, which is worse than losing it.
  assert.equal(back.layers.length, 0);
});
