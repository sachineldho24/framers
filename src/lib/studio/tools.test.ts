import assert from "node:assert/strict";
import test from "node:test";

import { createDocument, migrateDocument } from "./document.ts";
import { appendPoint, drawLayerFromPoints, penWidth, strokeHit } from "./drawing.ts";
import { studioReducer } from "./reducer.ts";
import { createShapeAtCentre, createSignature, createStickyNote, createTable } from "./toolInserts.ts";

const doc = () => createDocument({ width: 1000, height: 1400 });

test("a stroke's box hugs its ink and its points are normalised to it", () => {
  const layer = drawLayerFromPoints({ points: [[100, 100], [300, 200]], color: "#000000", width: 10, pen: "pen" });
  assert.deepEqual([layer.x, layer.y, layer.width, layer.height], [95, 95, 210, 110]);
  for (const [x, y] of layer.points) {
    assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
  }
});

test("the eraser finds a stroke under the pointer and misses empty space", () => {
  const layer = drawLayerFromPoints({ points: [[0, 0], [100, 0]], color: "#000000", width: 4, pen: "pen" });
  assert.equal(strokeHit(layer, { x: 50, y: 1 }, 2), true);
  assert.equal(strokeHit(layer, { x: 50, y: 40 }, 2), false);
});

test("samples closer than the gap are dropped", () => {
  const pts: [number, number][] = [[0, 0]];
  assert.equal(appendPoint(pts, [0.2, 0], 1), pts);
  assert.equal(appendPoint(pts, [2, 0], 1).length, 2);
});

test("pens are proportional to the page, and a highlighter is broader than a pen", () => {
  assert.ok(penWidth("highlighter", 1, 1000) > penWidth("pen", 1, 1000));
  assert.ok(penWidth("pen", 1, 2000) > penWidth("pen", 1, 1000));
});

test("drawings survive a save and reload", () => {
  const d = doc();
  d.layers.push(drawLayerFromPoints({ points: [[10, 10], [50, 60]], color: "#ff0000", width: 6, pen: "marker" }));
  const back = migrateDocument(JSON.parse(JSON.stringify(d)));
  const layer = back?.layers[0];
  assert.equal(layer?.kind, "draw");
  assert.ok(layer?.kind === "draw" && layer.pen === "marker" && layer.points.length === 2);
});

test("replaceLayer swaps a stroke in place as it is drawn", () => {
  const d = doc();
  const first = drawLayerFromPoints({ id: "s1", points: [[0, 0]], color: "#000000", width: 4, pen: "pen" });
  const withStroke = studioReducer(d, { type: "addLayer", layer: first });
  const longer = drawLayerFromPoints({ id: "s1", points: [[0, 0], [40, 40]], color: "#000000", width: 4, pen: "pen" });
  const next = studioReducer(withStroke, { type: "replaceLayer", layer: longer });
  assert.equal(next.layers.length, 1);
  assert.ok(next.layers[0].kind === "draw" && next.layers[0].points.length === 2);
});

test("a sticky note is a grouped square and text", () => {
  const [note, text] = createStickyNote(doc(), "#ffd43b");
  assert.equal(note.kind, "shape");
  assert.equal(text.kind, "text");
  assert.ok(note.groupId && note.groupId === text.groupId);
});

test("a table has one outlined cell and one text box per cell, grouped", () => {
  const layers = createTable(doc(), 3, 4);
  assert.equal(layers.length, 24);
  assert.equal(new Set(layers.map((l) => l.groupId)).size, 1);
  const cells = layers.filter((l) => l.kind === "shape");
  assert.equal(cells.length, 12);
  assert.ok(cells.every((c) => c.kind === "shape" && c.shapeId === "table-cell"));
});

test("lines come out wide; shapes square", () => {
  const line = createShapeAtCentre(doc(), "line-elbow");
  const square = createShapeAtCentre(doc(), "circle");
  assert.ok(line.width > line.height);
  assert.equal(square.width, square.height);
});

test("a drawn signature is scaled onto the page as grouped strokes", () => {
  const layers = createSignature(doc(), [[[0, 0], [100, 20]], [[50, 0], [60, 40]]], "#111111");
  assert.equal(layers.length, 2);
  assert.ok(layers[0].groupId && layers[0].groupId === layers[1].groupId);
  assert.ok(layers.every((l) => l.x >= 0 && l.x + l.width <= 1000));
});
