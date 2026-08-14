import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDocument,
  createImageLayer,
  docSizeForFrame,
  MAX_DOC_EDGE,
  PRINT_DPI,
} from "./document.ts";
import { createPresetTextLayer } from "./textInsert.ts";
import {
  documentDpi,
  documentQuality,
  dpiVerdict,
  imagePrintDpi,
  layersOutsideSafeArea,
  POOR_DPI,
  photoInFrame,
  printedInches,
  printGuides,
  printScale,
  RABBET_MM,
  SAFE_MM,
  softImageLayers,
} from "./print.ts";

/**
 * The interesting cases are all about the gap between what the document *claims*
 * (a 300 DPI grid) and what it is (clamped at `MAX_DOC_EDGE`). A2 is the size
 * that exposes it, so it appears here as often as A4.
 */

const A4_MM = { widthMm: 210, heightMm: 297 };
const A2_MM = { widthMm: 420, heightMm: 594 };

function pageFor(mm: { widthMm: number; heightMm: number }) {
  const size = docSizeForFrame(mm.widthMm, mm.heightMm);
  return createDocument(size);
}

test("A4 is a true 300 DPI page", () => {
  const scale = printScale(pageFor(A4_MM), A4_MM);
  assert.ok(scale);
  assert.ok(Math.abs(scale.dpi - PRINT_DPI) < 1, `${scale.dpi}`);
  assert.equal(scale.full, true);
});

test("A2 is not, and says so", () => {
  const doc = pageFor(A2_MM);
  assert.equal(Math.max(doc.width, doc.height), MAX_DOC_EDGE);
  const scale = printScale(doc, A2_MM);
  assert.ok(scale);
  assert.ok(scale.dpi < 200, `${scale.dpi}`);
  assert.equal(scale.full, false);
});

test("without a physical size there is nothing to measure against", () => {
  const doc = pageFor(A4_MM);
  assert.equal(printScale(doc, null), null);
  assert.equal(printGuides(doc, null), null);
  // Callers still need a number, and the authored constant is the honest one.
  assert.equal(documentDpi(doc, null), PRINT_DPI);
});

test("a nonsense size is refused rather than dividing by zero", () => {
  const doc = pageFor(A4_MM);
  assert.equal(printScale(doc, { widthMm: 0, heightMm: 297 }), null);
  assert.equal(printScale({ width: 0, height: 0 }, A4_MM), null);
});

test("printed inches follow the page, not the constant", () => {
  const a2 = pageFor(A2_MM);
  const dpi = documentDpi(a2, A2_MM);
  // The full width of an A2 page is 420 mm — 16.5 in — however many pixels the
  // grid happens to have.
  assert.ok(Math.abs(printedInches(a2.width, dpi) - 420 / 25.4) < 0.05);
  // Using PRINT_DPI here is the bug this module exists to prevent.
  assert.ok(printedInches(a2.width, PRINT_DPI) < 10);
});

test("the guides sit inside the page, safe area inside the opening", () => {
  const doc = pageFor(A4_MM);
  const g = printGuides(doc, A4_MM);
  assert.ok(g);
  assert.ok(g.opening.x > 0 && g.opening.y > 0);
  assert.ok(g.safe.x > g.opening.x);
  assert.ok(g.safe.y > g.opening.y);
  assert.ok(g.safe.width < g.opening.width);
  assert.ok(g.opening.width < doc.width);
  // Both are centred: equal margin on both sides.
  assert.ok(Math.abs(doc.width - (g.safe.x * 2 + g.safe.width)) < 0.001);
  assert.ok(Math.abs(doc.height - (g.safe.y * 2 + g.safe.height)) < 0.001);
});

test("the lip inset is the stated millimetres, measured on the page", () => {
  const doc = pageFor(A4_MM);
  const g = printGuides(doc, A4_MM);
  assert.ok(g);
  const dpi = documentDpi(doc, A4_MM);
  const mm = (g.opening.x / dpi) * 25.4;
  assert.ok(Math.abs(mm - RABBET_MM) < 0.1, `${mm} mm`);
  const safeMm = (g.safe.x / dpi) * 25.4;
  assert.ok(Math.abs(safeMm - (RABBET_MM + SAFE_MM)) < 0.1, `${safeMm} mm`);
});

test("a tiny print still gets a usable safe box", () => {
  // 30 mm square: 10 mm of inset per edge would leave nothing at all.
  const mm = { widthMm: 30, heightMm: 30 };
  const g = printGuides(pageFor(mm), mm);
  assert.ok(g);
  assert.ok(g.safe.width > 0);
  assert.ok(g.safe.height > 0);
});

test("a photo's resolution is its own pixels over its printed size", () => {
  const doc = pageFor(A4_MM);
  const dpi = documentDpi(doc, A4_MM);
  // Full-page 4 in wide at 300 DPI would need 1200 px; give it 600 and expect
  // half the resolution.
  const layer = createImageLayer({
    src: "u/1.jpg",
    naturalWidth: 600,
    naturalHeight: 600,
    x: 0,
    y: 0,
    width: 4 * dpi,
    height: 4 * dpi,
  });
  assert.ok(Math.abs(imagePrintDpi(layer, dpi) - 150) < 1);
});

test("cropping away pixels lowers the resolution", () => {
  const doc = pageFor(A4_MM);
  const dpi = documentDpi(doc, A4_MM);
  const base = createImageLayer({
    src: "u/1.jpg",
    naturalWidth: 4000,
    naturalHeight: 3000,
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
  });
  const cropped = { ...base, crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } };
  assert.ok(imagePrintDpi(cropped, dpi) < imagePrintDpi(base, dpi));
  assert.ok(
    Math.abs(imagePrintDpi(cropped, dpi) - imagePrintDpi(base, dpi) / 2) < 1
  );
});

test("the worse axis is the one reported", () => {
  const doc = pageFor(A4_MM);
  const dpi = documentDpi(doc, A4_MM);
  const layer = createImageLayer({
    src: "u/1.jpg",
    naturalWidth: 4000,
    naturalHeight: 200, // plenty across, nothing down
    x: 0,
    y: 0,
    width: 4 * dpi,
    height: 4 * dpi,
  });
  assert.ok(Math.abs(imagePrintDpi(layer, dpi) - 50) < 1);
});

test("verdicts read as words, and the bands are ordered", () => {
  assert.equal(dpiVerdict(300).tone, "good");
  assert.equal(dpiVerdict(200).tone, "ok");
  assert.equal(dpiVerdict(80).tone, "poor");
  assert.ok(dpiVerdict(POOR_DPI).tone !== "poor");
});

test("the page caps the document's quality even with a perfect photo", () => {
  const doc = pageFor(A2_MM);
  const big = createImageLayer({
    src: "u/1.jpg",
    naturalWidth: 12000,
    naturalHeight: 9000,
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
  });
  const q = documentQuality({ ...doc, layers: [big] }, A2_MM);
  assert.ok(Math.abs(q.dpi - q.pageDpi) < 1);
  assert.ok(q.dpi < PRINT_DPI);
});

test("a soft photo drags the document's quality below the page's", () => {
  const doc = pageFor(A4_MM);
  const small = createImageLayer({
    src: "u/1.jpg",
    naturalWidth: 500,
    naturalHeight: 700,
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
  });
  const q = documentQuality({ ...doc, layers: [small] }, A4_MM);
  assert.ok(q.dpi < q.pageDpi);
  assert.equal(q.verdict.tone, "poor");
  assert.deepEqual(
    softImageLayers({ ...doc, layers: [small] }, A4_MM).map((s) => s.layer.id),
    [small.id]
  );
});

test("a hidden photo is not held against the print", () => {
  const doc = pageFor(A4_MM);
  const hidden = {
    ...createImageLayer({
      src: "u/1.jpg",
      naturalWidth: 40,
      naturalHeight: 40,
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
    }),
    visible: false,
  };
  const q = documentQuality({ ...doc, layers: [hidden] }, A4_MM);
  assert.ok(Math.abs(q.dpi - q.pageDpi) < 1);
  assert.equal(softImageLayers({ ...doc, layers: [hidden] }, A4_MM).length, 0);
});

test("an empty page reports the grid and no complaints", () => {
  const doc = pageFor(A4_MM);
  const q = documentQuality(doc, A4_MM);
  assert.equal(q.softest, 0);
  assert.equal(q.verdict.tone, "good");
  assert.equal(softImageLayers(doc, A4_MM).length, 0);
});

test("text straying under the lip is flagged; a full-bleed photo is not", () => {
  const doc = pageFor(A4_MM);
  const inside = createPresetTextLayer(doc, "body");
  assert.deepEqual(layersOutsideSafeArea({ ...doc, layers: [inside] }, A4_MM), []);

  const edge = { ...inside, x: 0, y: 0 };
  assert.deepEqual(layersOutsideSafeArea({ ...doc, layers: [edge] }, A4_MM), [
    edge.id,
  ]);

  // A photo is *meant* to run to the edge — flagging it would train people to
  // ignore the warning.
  const photo = createImageLayer({
    src: "u/1.jpg",
    naturalWidth: 4000,
    naturalHeight: 3000,
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
  });
  assert.deepEqual(layersOutsideSafeArea({ ...doc, layers: [photo] }, A4_MM), []);
});

/* ------------------------------------------------------- photoInFrame */

test("a photo's frame DPI is the axis that has to stretch furthest", () => {
  // 4:5 portrait photo into A4 (1:√2). A4 is 8.268 × 11.693 in.
  const fit = photoInFrame({ width: 2400, height: 3000 }, A4_MM);
  assert.ok(fit);
  // Height is the binding axis: 3000 / 11.693 = 256, against 2400 / 8.268 = 290.
  assert.ok(Math.abs(fit.dpi - 256.6) < 1);
  // 256 clears SOFT_DPI, so this is a sharp print — the point is that quoting
  // the *width* would have claimed 290 and a quality it doesn't have.
  assert.equal(fit.verdict.tone, "good");
});

test("the page grid caps the figure, so a big frame can't over-promise", () => {
  const source = { width: 6000, height: 8000 };
  const page = pageFor(A2_MM);
  const pageDpi = documentDpi(page, A2_MM);
  // The photo alone would carry ~340 DPI on A2; the clamped grid can't.
  const uncapped = photoInFrame(source, A2_MM);
  const capped = photoInFrame(source, A2_MM, pageDpi);
  assert.ok(uncapped && capped);
  assert.ok(uncapped.dpi > pageDpi);
  assert.ok(Math.abs(capped.dpi - pageDpi) < 0.01);
});

test("max print size is quoted at both thresholds, not just 300 DPI", () => {
  const fit = photoInFrame({ width: 900, height: 1200 }, A4_MM);
  assert.ok(fit);
  assert.ok(Math.abs(fit.sharpIn.width - 3) < 0.01);
  assert.ok(Math.abs(fit.sharpIn.height - 4) < 0.01);
  // 150 DPI is twice the edge, which is the number a framer would actually give.
  assert.ok(Math.abs(fit.maxIn.width - 900 / POOR_DPI) < 0.01);
  assert.equal(fit.verdict.tone, "poor");
});

test("the crop the frame's shape costs is reported, and is zero for a match", () => {
  const square = photoInFrame({ width: 1000, height: 1000 }, { widthMm: 305, heightMm: 305 });
  assert.ok(square);
  assert.ok(Math.abs(square.cropped) < 1e-9);

  // A 3:2 landscape photo in a portrait A4 loses most of its width.
  const wide = photoInFrame({ width: 3000, height: 2000 }, A4_MM);
  assert.ok(wide);
  assert.ok(wide.cropped > 0.5 && wide.cropped < 0.55);

  // Turning the frame the same way keeps nearly all of it.
  const landscapeFrame = photoInFrame({ width: 3000, height: 2000 }, { widthMm: 297, heightMm: 210 });
  assert.ok(landscapeFrame);
  assert.ok(landscapeFrame.cropped < 0.06);
});

test("a photo with no pixels, or a frame with no size, is refused", () => {
  assert.equal(photoInFrame({ width: 0, height: 100 }, A4_MM), null);
  assert.equal(photoInFrame({ width: 100, height: 100 }, { widthMm: 0, heightMm: 10 }), null);
});
