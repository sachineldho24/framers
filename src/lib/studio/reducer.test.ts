import assert from "node:assert/strict";
import test from "node:test";

import {
  borderInsetPx,
  cloneDocument,
  createDocument,
  createImageLayer,
  createTextLayer,
  docSizeForFrame,
  findLayer,
  MAX_BORDER,
  migrateDocument,
  type ImageLayer,
  type StudioDocument,
} from "./document.ts";
import { applyActions, studioReducer } from "./reducer.ts";
import { createStroke } from "./strokes.ts";

function seed(): StudioDocument {
  const doc = createDocument({ width: 1000, height: 800, title: "Test" });
  const a = createImageLayer({
    src: "a.png",
    naturalWidth: 400,
    naturalHeight: 200,
    x: 100,
    y: 100,
    width: 400,
    height: 200,
    name: "A",
  });
  const b = createImageLayer({
    src: "b.png",
    naturalWidth: 100,
    naturalHeight: 100,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    name: "B",
  });
  return studioReducer(studioReducer(doc, { type: "addLayer", layer: a }), {
    type: "addLayer",
    layer: b,
  });
}

function layerA(doc: StudioDocument): ImageLayer {
  return doc.layers[0] as ImageLayer;
}

test("the reducer never mutates the document it is given", () => {
  const doc = seed();
  const snapshot = JSON.stringify(doc);
  applyActions(doc, [
    { type: "nudgeLayer", layerId: doc.layers[0].id, dx: 10, dy: 10 },
    { type: "setLayerOpacity", layerId: doc.layers[0].id, opacity: 0.5 },
    { type: "removeLayer", layerId: doc.layers[1].id },
    { type: "setAdjust", layerId: doc.layers[0].id, adjust: { contrast: 40 } },
    { type: "setCrop", layerId: doc.layers[0].id, crop: { w: 0.4 } },
  ]);
  assert.equal(JSON.stringify(doc), snapshot);
});

test("an action that changes nothing returns the identical object", () => {
  const doc = seed();
  assert.equal(studioReducer(doc, { type: "setTitle", title: "Test" }), doc);
  assert.equal(studioReducer(doc, { type: "removeLayer", layerId: "nope" }), doc);
  assert.equal(
    studioReducer(doc, { type: "reorderLayer", layerId: doc.layers[0].id, to: 0 }),
    doc
  );
  assert.equal(
    studioReducer(doc, { type: "clearStrokes", layerId: doc.layers[0].id }),
    doc
  );
});

test("layers stack bottom-first and reorder within bounds", () => {
  const doc = seed();
  const [a, b] = doc.layers;
  assert.deepEqual(doc.layers.map((l) => l.name), ["A", "B"]);

  const front = studioReducer(doc, { type: "bringToFront", layerId: a.id });
  assert.deepEqual(front.layers.map((l) => l.name), ["B", "A"]);

  const back = studioReducer(doc, { type: "sendToBack", layerId: b.id });
  assert.deepEqual(back.layers.map((l) => l.name), ["B", "A"]);

  // Out-of-range targets clamp rather than throw or drop the layer.
  const clamped = studioReducer(doc, {
    type: "reorderLayer",
    layerId: a.id,
    to: 99,
  });
  assert.deepEqual(clamped.layers.map((l) => l.name), ["B", "A"]);
  assert.equal(clamped.layers.length, 2);
});

test("duplicate inserts above the original with independent nested state", () => {
  const doc = studioReducer(seed(), {
    type: "addStroke",
    layerId: seed().layers[0].id,
    stroke: createStroke("erase", 0.1, 0.5, { x: 0.5, y: 0.5 }),
  });
  const source = doc.layers[0];
  const next = studioReducer(doc, {
    type: "duplicateLayer",
    layerId: source.id,
  });

  assert.equal(next.layers.length, 3);
  assert.equal(next.layers[1].name, "A copy");
  assert.notEqual(next.layers[1].id, source.id);
  // Nested objects must be copies, not shared references.
  assert.notEqual(next.layers[1].crop, source.crop);
  assert.notEqual(next.layers[1].adjust, source.adjust);
  if (source.strokes.length > 0) {
    assert.notEqual(next.layers[1].strokes[0].id, source.strokes[0].id);
  }
});

test("locked layers refuse geometry edits but still accept lock and rename", () => {
  const doc = seed();
  const id = doc.layers[0].id;
  const locked = studioReducer(doc, {
    type: "setLayerLocked",
    layerId: id,
    locked: true,
  });

  assert.equal(
    studioReducer(locked, { type: "nudgeLayer", layerId: id, dx: 50, dy: 0 }),
    locked
  );
  assert.equal(
    studioReducer(locked, { type: "setLayerBox", layerId: id, box: { x: 9 } }),
    locked
  );
  assert.equal(
    studioReducer(locked, { type: "setCrop", layerId: id, crop: { w: 0.5 } }),
    locked
  );

  // Non-geometry edits are still allowed — you can rename or unlock it.
  const renamed = studioReducer(locked, {
    type: "renameLayer",
    layerId: id,
    name: "Pinned",
  });
  assert.equal(renamed.layers[0].name, "Pinned");
  const unlocked = studioReducer(locked, {
    type: "setLayerLocked",
    layerId: id,
    locked: false,
  });
  assert.equal(unlocked.layers[0].locked, false);
});

test("crop stays inside the source and never collapses", () => {
  const doc = seed();
  const id = doc.layers[0].id;

  const out = studioReducer(doc, {
    type: "setCrop",
    layerId: id,
    crop: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 },
  });
  const crop = layerA(out).crop;
  assert.ok(crop.x + crop.w <= 1 + 1e-9);
  assert.ok(crop.y + crop.h <= 1 + 1e-9);

  const tiny = studioReducer(doc, {
    type: "setCrop",
    layerId: id,
    crop: { w: 0, h: -1 },
  });
  assert.ok(layerA(tiny).crop.w >= 0.02);
  assert.ok(layerA(tiny).crop.h >= 0.02);
});

test("flip inverts the crop on one axis and is its own inverse", () => {
  const base = seed();
  const id = base.layers[0].id;
  const doc = studioReducer(base, {
    type: "setCrop",
    layerId: id,
    crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
  });
  const once = studioReducer(doc, {
    type: "flipLayer",
    layerId: id,
    axis: "horizontal",
  });
  assert.ok(Math.abs(layerA(once).crop.x - 0.4) < 1e-9);
  assert.equal(layerA(once).flipX, true);

  const twice = studioReducer(once, {
    type: "flipLayer",
    layerId: id,
    axis: "horizontal",
  });
  assert.ok(Math.abs(layerA(twice).crop.x - 0.1) < 1e-9);
  assert.equal(layerA(twice).flipX, false);
});

test("flip mirrors an uncropped image rather than doing nothing", () => {
  const base = seed();
  const id = base.layers[0].id;
  const once = studioReducer(base, { type: "flipLayer", layerId: id, axis: "vertical" });
  assert.equal(layerA(once).flipY, true);
  assert.deepEqual(layerA(once).crop, layerA(base).crop);
});

test("replaceLayerImage swaps the source and covers the existing box, not stretches into it", () => {
  const base = seed();
  const id = base.layers[0].id;
  const before = layerA(base);
  assert.equal(before.width / before.height, 2); // 400x200 box

  const out = studioReducer(base, {
    type: "replaceLayerImage",
    layerId: id,
    src: "c.png",
    naturalWidth: 100,
    naturalHeight: 200, // portrait photo into a landscape box
  });
  const after = layerA(out);

  assert.equal(after.src, "c.png");
  assert.equal(after.naturalWidth, 100);
  assert.equal(after.naturalHeight, 200);
  // Box, position and everything else about the layer is untouched.
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.deepEqual(after.mask, before.mask);

  // The cropped source's own pixel aspect matches the box's, so the new photo
  // covers the frame instead of distorting into its shape.
  const pixelAspect =
    (after.crop.w * after.naturalWidth) / (after.crop.h * after.naturalHeight);
  assert.ok(Math.abs(pixelAspect - after.width / after.height) < 1e-9);
});

test("adjustments and opacity clamp to their ranges", () => {
  const doc = seed();
  const id = doc.layers[0].id;
  const next = applyActions(doc, [
    { type: "setAdjust", layerId: id, adjust: { brightness: 900, contrast: -900 } },
    { type: "setLayerOpacity", layerId: id, opacity: 4 },
    { type: "setFilterStrength", layerId: id, strength: -3 },
  ]);
  assert.equal(layerA(next).adjust.brightness, 100);
  assert.equal(layerA(next).adjust.contrast, -100);
  assert.equal(layerA(next).opacity, 1);
  assert.equal(layerA(next).filterStrength, 0);
});

test("resetAdjust clears both the sliders and the preset", () => {
  const doc = seed();
  const id = doc.layers[0].id;
  const dirty = applyActions(doc, [
    { type: "setAdjust", layerId: id, adjust: { saturation: 60 } },
    { type: "setFilter", layerId: id, filter: "noir", strength: 0.7 },
  ]);
  assert.equal(layerA(dirty).filter, "noir");

  const clean = studioReducer(dirty, { type: "resetAdjust", layerId: id });
  assert.deepEqual(layerA(clean).adjust, {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  });
  assert.equal(layerA(clean).filter, "none");
  assert.equal(layerA(clean).filterStrength, 1);
});

test("strokes append, update in place, and clear", () => {
  const doc = seed();
  const id = doc.layers[0].id;
  const stroke = createStroke("erase", 0.1, 0.5, { x: 0.1, y: 0.1 });

  const added = studioReducer(doc, { type: "addStroke", layerId: id, stroke });
  assert.equal(layerA(added).strokes.length, 1);

  const extended = { ...stroke, points: [...stroke.points, { x: 0.2, y: 0.2 }] };
  const updated = studioReducer(added, {
    type: "updateStroke",
    layerId: id,
    stroke: extended,
  });
  assert.equal(layerA(updated).strokes.length, 1);
  assert.equal(layerA(updated).strokes[0].points.length, 2);

  const cleared = studioReducer(updated, { type: "clearStrokes", layerId: id });
  assert.equal(layerA(cleared).strokes.length, 0);
});

test("setLayerAsBackground covers the page, drops to the back, and locks", () => {
  const doc = seed();
  const id = doc.layers[1].id; // the top 100×100 layer
  const next = studioReducer(doc, { type: "setLayerAsBackground", layerId: id });

  assert.equal(next.layers[0].id, id);
  assert.equal(next.layers[0].locked, true);
  assert.equal(next.layers[0].rotation, 0);
  // A square layer covering a 1000×800 page must be at least 1000 on both edges.
  assert.ok(next.layers[0].width >= 1000 - 1e-9);
  assert.ok(next.layers[0].height >= 800 - 1e-9);
});

test("resizeDocument reflows layers so nothing is stranded off-canvas", () => {
  const doc = seed();
  const next = studioReducer(doc, {
    type: "resizeDocument",
    width: 500,
    height: 400,
  });
  assert.equal(next.width, 500);
  assert.equal(next.height, 400);
  // Halving the page halves the layer.
  assert.ok(Math.abs(next.layers[0].width - 200) < 1e-9);
  assert.ok(Math.abs(next.layers[0].x - 50) < 1e-9);

  const noReflow = studioReducer(doc, {
    type: "resizeDocument",
    width: 500,
    height: 400,
    reflow: false,
  });
  assert.equal(noReflow.layers[0].width, doc.layers[0].width);
});

test("resizeDocument carries, keeps and clears the hand-set paper size", () => {
  const doc = seed();
  assert.equal(doc.printMm, undefined);

  // A custom size states its millimetres; the grid alone can't imply them.
  const custom = studioReducer(doc, {
    type: "resizeDocument",
    width: 2480,
    height: 3508,
    printMm: { widthMm: 210, heightMm: 297 },
  });
  assert.deepEqual(custom.printMm, { widthMm: 210, heightMm: 297 });

  // Omitting it leaves whatever is there — a later reflow must not lose the paper.
  const kept = studioReducer(custom, {
    type: "resizeDocument",
    width: 1240,
    height: 1754,
  });
  assert.deepEqual(kept.printMm, { widthMm: 210, heightMm: 297 });

  // `null` hands authority back to the frame row (picking a catalogue size).
  const cleared = studioReducer(custom, {
    type: "resizeDocument",
    width: 2480,
    height: 3508,
    printMm: null,
  });
  assert.equal(cleared.printMm, undefined);
  // Same pixels, different paper — so this is a change, not a no-op.
  assert.notEqual(cleared, custom);
});

test("resizeDocument is a no-op only when the pixels AND the paper match", () => {
  const doc = studioReducer(seed(), {
    type: "resizeDocument",
    width: 2480,
    height: 3508,
    printMm: { widthMm: 210, heightMm: 297 },
  });
  const same = studioReducer(doc, {
    type: "resizeDocument",
    width: 2480,
    height: 3508,
    printMm: { widthMm: 210, heightMm: 297 },
  });
  assert.equal(same, doc);
  const repaper = studioReducer(doc, {
    type: "resizeDocument",
    width: 2480,
    height: 3508,
    printMm: { widthMm: 216, heightMm: 305 },
  });
  assert.notEqual(repaper, doc);
  assert.deepEqual(repaper.printMm, { widthMm: 216, heightMm: 305 });
});

test("docSizeForFrame converts mm at print resolution and caps the long edge", () => {
  // A4-ish: 210mm at 300dpi ≈ 2480px.
  const a4 = docSizeForFrame(210, 297);
  assert.equal(a4.width, 2480);
  assert.equal(a4.height, 3508);

  // A very large frame is scaled down but keeps its aspect ratio.
  const huge = docSizeForFrame(1000, 500);
  assert.equal(Math.max(huge.width, huge.height), 4096);
  assert.ok(Math.abs(huge.width / huge.height - 2) < 0.01);
});

test("migrateDocument salvages partial data and rejects unusable input", () => {
  assert.equal(migrateDocument(null), null);
  assert.equal(migrateDocument({ width: 0, height: 10 }), null);
  assert.equal(migrateDocument("not a document"), null);

  const salvaged = migrateDocument({
    width: 100,
    height: 50,
    layers: [
      { kind: "image", src: "ok.png", x: 1, y: 2, width: 10, height: 10 },
      { kind: "text", src: "unsupported" },
      null,
      { kind: "image" },
    ],
  });
  assert.ok(salvaged);
  // Only the one valid image layer survives; the rest are dropped, not fatal.
  assert.equal(salvaged.layers.length, 1);
  assert.equal(salvaged.layers[0].src, "ok.png");
  assert.equal(salvaged.layers[0].opacity, 1);
  assert.equal(salvaged.layers[0].filter, "none");
  assert.deepEqual(salvaged.layers[0].crop, { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(salvaged.title, "Untitled design");
});

test("migrateDocument round-trips a real document through JSON", () => {
  const doc = applyActions(seed(), [
    { type: "setFilter", layerId: seed().layers[0].id, filter: "warm" },
  ]);
  const restored = migrateDocument(JSON.parse(JSON.stringify(doc)));
  assert.ok(restored);
  assert.equal(restored.layers.length, doc.layers.length);
  assert.equal(restored.width, doc.width);
  assert.equal(findLayer(restored, restored.layers[0].id)?.name, "A");
});

test("migrateDocument keeps a usable printMm and drops a broken one", () => {
  const kept = migrateDocument({
    width: 2480,
    height: 3508,
    printMm: { widthMm: 210, heightMm: 297 },
    layers: [],
  });
  assert.ok(kept);
  assert.deepEqual(kept.printMm, { widthMm: 210, heightMm: 297 });

  // A page whose paper size is junk is still a page — the field just goes away,
  // and `printSize` falls back to the frame rather than quoting nonsense.
  for (const printMm of [
    null,
    "A4",
    {},
    { widthMm: 0, heightMm: 297 },
    { widthMm: 210, heightMm: -1 },
  ]) {
    const doc = migrateDocument({ width: 100, height: 50, printMm, layers: [] });
    assert.ok(doc, JSON.stringify(printMm));
    assert.equal(doc.printMm, undefined, JSON.stringify(printMm));
  }
});

/* ------------------------------------------------------------------ aspect */

test("an aspect preset commits the box and the crop in one action", () => {
  const doc = seed();
  const id = doc.layers[0].id;
  // Layer A is a 2:1 photo (400×200 of a 400×200 source) on a 1000×800 page.
  const square = studioReducer(doc, {
    type: "setLayerAspect",
    layerId: id,
    aspect: 1,
  });
  const l = layerA(square);
  assert.ok(Math.abs(l.width - l.height) < 1e-9);
  // Half the source, full height: 200×200 source pixels into a square box.
  assert.ok(Math.abs(l.crop.w - 0.5) < 1e-9);
  assert.ok(Math.abs(l.crop.h - 1) < 1e-9);
  assert.ok(Math.abs(l.crop.x - 0.25) < 1e-9);
  // One history-visible change, and a repeat is the identical document.
  assert.equal(
    studioReducer(square, { type: "setLayerAspect", layerId: id, aspect: 1 }),
    square
  );
});

test("an aspect preset is a geometry edit, so a locked layer refuses it", () => {
  const doc = seed();
  const id = doc.layers[0].id;
  const locked = studioReducer(doc, {
    type: "setLayerLocked",
    layerId: id,
    locked: true,
  });
  assert.equal(
    studioReducer(locked, { type: "setLayerAspect", layerId: id, aspect: 1 }),
    locked
  );
});

test("the frame preset makes the layer the shape of the page", () => {
  const doc = seed();
  const next = studioReducer(doc, {
    type: "setLayerAspect",
    layerId: doc.layers[0].id,
    aspect: doc.width / doc.height,
  });
  const l = layerA(next);
  assert.ok(Math.abs(l.width / l.height - doc.width / doc.height) < 1e-9);
  assert.ok(l.width <= doc.width + 1e-9);
  assert.ok(l.height <= doc.height + 1e-9);
});

/* ------------------------------------------------------------------ border */
test("a new page has no printed border", () => {
  const doc = createDocument({ width: 1000, height: 800 });
  assert.equal(doc.border.width, 0);
  assert.equal(borderInsetPx(doc), 0);
});

test("the border is measured off the short edge, so all four sides match", () => {
  const doc = studioReducer(createDocument({ width: 1000, height: 800 }), {
    type: "setPageBorder",
    patch: { width: 0.05 },
  });
  // 5% of 800, not of 1000 — a band that differed by axis wouldn't read as one.
  assert.equal(borderInsetPx(doc), 40);
});

test("the border can't be widened until the page is solid colour", () => {
  const doc = studioReducer(createDocument({ width: 1000, height: 800 }), {
    type: "setPageBorder",
    patch: { width: 99 },
  });
  assert.equal(doc.border.width, MAX_BORDER);
  assert.ok(borderInsetPx(doc) * 2 < doc.height);
});

test("setting the border to what it already is returns the same document", () => {
  const doc = studioReducer(createDocument({ width: 1000, height: 800 }), {
    type: "setPageBorder",
    patch: { width: 0.05, color: "#ffffff" },
  });
  const again = studioReducer(doc, {
    type: "setPageBorder",
    patch: { width: 0.05 },
  });
  // Identity, not just equality: the slider fires on every pointermove.
  assert.equal(again, doc);
});

test("a border survives the round trip, and a version-2 document gains none", () => {
  const doc = studioReducer(createDocument({ width: 1000, height: 800 }), {
    type: "setPageBorder",
    patch: { width: 0.08, color: "#111111" },
  });
  const restored = migrateDocument(JSON.parse(JSON.stringify(doc)));
  assert.ok(restored);
  assert.deepEqual(restored.border, { width: 0.08, color: "#111111" });

  const old = migrateDocument({ width: 100, height: 100, layers: [] });
  assert.ok(old);
  assert.deepEqual(old.border, { width: 0, color: "#ffffff" });
});

test("a border colour we can't hand to canvas is refused", () => {
  const restored = migrateDocument({
    width: 100,
    height: 100,
    layers: [],
    // `fillStyle` silently keeps its previous value for an unparseable colour,
    // which would paint the band in whatever was set last.
    border: { width: 0.05, color: "javascript:alert(1)" },
  });
  assert.ok(restored);
  assert.equal(restored.border.color, "#ffffff");
});

test("cloneDocument copies the border rather than sharing it", () => {
  const doc = studioReducer(createDocument({ width: 100, height: 100 }), {
    type: "setPageBorder",
    patch: { width: 0.05 },
  });
  const copy = cloneDocument(doc);
  copy.border.width = 0.2;
  assert.equal(doc.border.width, 0.05);
});

test("an image border is set, clamped, and never grows the photo's box", () => {
  const base = seed();
  const id = base.layers[0].id;
  const before = layerA(base);
  const doc = studioReducer(base, {
    type: "setImageOutline",
    layerId: id,
    outline: { width: 12, color: "#ff0000", style: "dashed" },
  });
  assert.deepEqual(layerA(doc).outline, { width: 12, color: "#ff0000", style: "dashed" });
  assert.equal(layerA(doc).width, before.width);

  const clamped = studioReducer(doc, { type: "setImageOutline", layerId: id, outline: { width: -5 } });
  assert.equal(layerA(clamped).outline?.width, 0);
  assert.equal(layerA(clamped).outline?.style, "dashed");
});

test("an uploaded font is stored once and applied to text in the same step", () => {
  const base = studioReducer(seed(), {
    type: "addLayer",
    layer: createTextLayer({ text: "Hello", x: 0, y: 0, width: 300, height: 80, fontSize: 48 }),
  });
  const text = base.layers[base.layers.length - 1];
  const font = { id: "custom-f1", name: "Brand Sans", src: "user/fonts/f1.ttf" };
  const once = studioReducer(base, { type: "addCustomFont", font, applyToLayerId: text.id });
  const twice = studioReducer(once, { type: "addCustomFont", font });
  assert.deepEqual(twice.fonts, [font]);
  const applied = twice.layers.find((l) => l.id === text.id);
  assert.equal(applied?.kind === "text" && applied.fontId, "custom-f1");
});

test("a saved document keeps its uploaded fonts and the text set in them", () => {
  const doc = migrateDocument({
    ...seed(),
    fonts: [{ id: "custom-f1", name: "Brand Sans", src: "user/fonts/f1.ttf" }, { id: "anton", src: "x" }],
    layers: [
      { ...createTextLayer({ text: "Hi", x: 0, y: 0, width: 100, height: 40, fontSize: 32 }), fontId: "custom-f1" },
    ],
  });
  assert.deepEqual(doc?.fonts?.map((f) => f.id), ["custom-f1"]);
  const layer = doc?.layers[0];
  assert.equal(layer?.kind === "text" && layer.fontId, "custom-f1");
});
