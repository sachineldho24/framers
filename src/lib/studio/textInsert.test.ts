import assert from "node:assert/strict";
import { test } from "node:test";

import { createDocument, createImageLayer } from "./document.ts";
import { DEFAULT_FONT_ID } from "./fonts.ts";
import { DEFAULT_LINE_HEIGHT } from "./text.ts";
import { textLayerHeight, textLayerWidth } from "./textMeasure.ts";
import {
  createPresetTextLayer,
  TEXT_PRESETS,
  TEXT_PRESET_ORDER,
} from "./textInsert.ts";

/**
 * There is no canvas under `node:test`, so these exercise the fallback path on
 * purpose — which is the path that has to hold up during SSR and before a face
 * lands. `textMeasure` returning `undefined` rather than 0 is what makes it
 * safe, so that contract is asserted first.
 */

const A4 = { width: 2480, height: 3508 };

test("measurement reports absence rather than zero when there is no canvas", () => {
  const metrics = {
    text: "Add a heading",
    fontId: DEFAULT_FONT_ID,
    fontWeight: 700,
    italic: false,
    fontSize: 200,
    lineHeight: DEFAULT_LINE_HEIGHT,
    letterSpacing: 0,
    uppercase: true,
    width: 1000,
  };
  assert.equal(textLayerHeight(metrics), undefined);
  assert.equal(textLayerWidth(metrics, 1000), undefined);
});

test("every preset produces a usable box on a portrait page", () => {
  const doc = createDocument(A4);
  for (const preset of TEXT_PRESET_ORDER) {
    const layer = createPresetTextLayer(doc, preset);
    assert.equal(layer.kind, "text");
    assert.equal(layer.text, TEXT_PRESETS[preset].text);
    assert.ok(layer.width > 0, `${preset} width`);
    assert.ok(layer.height > 0, `${preset} height`);
    assert.ok(layer.fontSize > 0, `${preset} font size`);
    // Inside the page on both axes — an inserted box the user has to hunt for
    // is worse than no box.
    assert.ok(layer.x >= 0 && layer.x + layer.width <= doc.width);
    assert.ok(layer.y >= 0 && layer.y + layer.height <= doc.height);
  }
});

test("preset sizes scale with the page, so a heading stays a heading", () => {
  const small = createPresetTextLayer(createDocument({ width: 620, height: 877 }), "heading");
  const large = createPresetTextLayer(createDocument(A4), "heading");
  assert.ok(large.fontSize > small.fontSize * 3);
});

test("the presets stay ordered largest to smallest", () => {
  const doc = createDocument(A4);
  const sizes = TEXT_PRESET_ORDER.map((p) => createPresetTextLayer(doc, p).fontSize);
  for (let i = 1; i < sizes.length; i += 1) {
    assert.ok(sizes[i] < sizes[i - 1], `${TEXT_PRESET_ORDER[i]} smaller than the one above`);
  }
});

test("a heading is horizontally centred", () => {
  const doc = createDocument(A4);
  const layer = createPresetTextLayer(doc, "heading");
  const leftGap = layer.x;
  const rightGap = doc.width - (layer.x + layer.width);
  assert.ok(Math.abs(leftGap - rightGap) < 1);
});

test("a second insert steps down instead of hiding under the first", () => {
  const doc = createDocument(A4);
  const first = createPresetTextLayer(doc, "heading");
  const withFirst = { ...doc, layers: [first] };
  const second = createPresetTextLayer(withFirst, "heading");
  assert.ok(second.y > first.y);
});

test("stacking never walks a box off the bottom of the page", () => {
  let doc = createDocument(A4);
  for (let i = 0; i < 20; i += 1) {
    const layer = createPresetTextLayer(doc, "heading");
    assert.ok(layer.y >= 0);
    assert.ok(layer.y + layer.height <= doc.height, `insert ${i} inside the page`);
    doc = { ...doc, layers: [...doc.layers, layer] };
  }
});

test("an image already on the page does not displace the text", () => {
  const doc = createDocument(A4);
  const alone = createPresetTextLayer(doc, "heading");
  // Only text is stepped around: a photo is usually the background the heading
  // is meant to sit on top of, so moving away from it would be wrong.
  const withImage = {
    ...doc,
    layers: [
      createImageLayer({
        src: "u/1.jpg",
        naturalWidth: 4000,
        naturalHeight: 3000,
        x: 0,
        y: alone.y,
        width: doc.width,
        height: doc.height,
      }),
    ],
  };
  assert.equal(createPresetTextLayer(withImage, "heading").y, alone.y);
});

test("the requested family is honoured", () => {
  const doc = createDocument(A4);
  assert.equal(createPresetTextLayer(doc, "body", "inter").fontId, "inter");
  assert.equal(createPresetTextLayer(doc, "body").fontId, DEFAULT_FONT_ID);
});

test("the layer name comes from the words, not a counter", () => {
  const doc = createDocument(A4);
  const layer = createPresetTextLayer(doc, "subheading");
  assert.ok(layer.name.toLowerCase().includes("subheading"));
});
