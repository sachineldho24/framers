import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_VERSION,
  createDocument,
  createImageLayer,
  createTextLayer,
  isImageLayer,
  migrateDocument,
  repairSeededLetterbox,
  type StudioDocument,
} from "./document.ts";
import { containBox, coverBox } from "./geometry.ts";

/**
 * A portrait page with a landscape photo, so contain and cover differ on both
 * axes and letterboxing is unambiguous (bands top and bottom).
 */
const PAGE = { width: 2000, height: 3000 };
const PHOTO = { naturalWidth: 4000, naturalHeight: 3000 };

function contained() {
  const box = containBox(PAGE.width, PAGE.height, PHOTO.naturalWidth, PHOTO.naturalHeight);
  return createImageLayer({ src: "u/photo.jpg", ...PHOTO, ...box, name: "Your photo" });
}

function doc(layers: StudioDocument["layers"]): StudioDocument {
  const d = createDocument({ width: PAGE.width, height: PAGE.height, title: "T" });
  return { ...d, layers };
}

function assertCovers(d: StudioDocument) {
  const layer = d.layers[0];
  assert.ok(layer && isImageLayer(layer));
  const cover = coverBox(PAGE.width, PAGE.height, PHOTO.naturalWidth, PHOTO.naturalHeight);
  assert.equal(layer.x, cover.x);
  assert.equal(layer.y, cover.y);
  assert.equal(layer.width, cover.width);
  assert.equal(layer.height, cover.height);
}

test("repairSeededLetterbox re-fills a contained seed to cover the page", () => {
  const before = doc([contained()]);
  const after = repairSeededLetterbox(before);
  assertCovers(after);
  // The photo is not distorted and nothing else about the layer moves.
  const [a] = after.layers;
  assert.ok(isImageLayer(a));
  assert.equal(a.width / a.height, PHOTO.naturalWidth / PHOTO.naturalHeight);
  assert.deepEqual(a.crop, { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(a.id, before.layers[0].id);
  assert.equal(a.name, "Your photo");
  // Pure: the input document is untouched.
  assert.equal(before.layers[0].height, containBox(
    PAGE.width, PAGE.height, PHOTO.naturalWidth, PHOTO.naturalHeight
  ).height);
});

test("repairSeededLetterbox leaves a cropped layer alone", () => {
  const layer = { ...contained(), crop: { x: 0.1, y: 0, w: 0.8, h: 1 } };
  const before = doc([layer]);
  assert.deepEqual(repairSeededLetterbox(before), before);
});

test("repairSeededLetterbox leaves a rotated layer alone", () => {
  const before = doc([{ ...contained(), rotation: 12 }]);
  assert.deepEqual(repairSeededLetterbox(before), before);
});

test("repairSeededLetterbox leaves a moved or resized layer alone", () => {
  const moved = doc([{ ...contained(), x: 40 }]);
  assert.deepEqual(repairSeededLetterbox(moved), moved);
  const resized = doc([{ ...contained(), width: 900 }]);
  assert.deepEqual(repairSeededLetterbox(resized), resized);
});

test("repairSeededLetterbox leaves a multi-layer document alone", () => {
  const before = doc([
    contained(),
    createTextLayer({ text: "Hello", x: 10, y: 10, width: 300, height: 80, fontSize: 48 }),
  ]);
  assert.deepEqual(repairSeededLetterbox(before), before);
});

test("repairSeededLetterbox leaves a layer that already covers alone", () => {
  const cover = coverBox(PAGE.width, PAGE.height, PHOTO.naturalWidth, PHOTO.naturalHeight);
  const before = doc([createImageLayer({ src: "u/p.jpg", ...PHOTO, ...cover })]);
  assert.deepEqual(repairSeededLetterbox(before), before);
});

test("repairSeededLetterbox is a no-op when the photo is the page's shape", () => {
  const square = { naturalWidth: 1000, naturalHeight: 1500 }; // 2:3, same as the page
  const box = containBox(PAGE.width, PAGE.height, square.naturalWidth, square.naturalHeight);
  const before = doc([createImageLayer({ src: "u/p.jpg", ...square, ...box })]);
  assert.deepEqual(repairSeededLetterbox(before), before);
});

test("migrateDocument repairs a document saved before version 4", () => {
  const before = { ...doc([contained()]), version: 3 };
  const after = migrateDocument(JSON.parse(JSON.stringify(before)));
  assert.ok(after);
  assert.equal(after.version, DOCUMENT_VERSION);
  assertCovers(after);
});

test("migrateDocument does not repair a document already at version 4", () => {
  const before = { ...doc([contained()]), version: 4 };
  const after = migrateDocument(JSON.parse(JSON.stringify(before)));
  assert.ok(after);
  const layer = after.layers[0];
  assert.ok(isImageLayer(layer));
  assert.equal(layer.height, before.layers[0].height);
});

test("migrateDocument still rejects what it can't salvage", () => {
  assert.equal(migrateDocument(null), null);
  assert.equal(migrateDocument("{}"), null);
  assert.equal(migrateDocument({ width: 0, height: 100 }), null);
});
