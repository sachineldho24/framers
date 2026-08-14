import assert from "node:assert/strict";
import test from "node:test";

import {
  addRecentSize,
  coerceSizePresets,
  documentPrintSize,
  documentRatio,
  formatInUnit,
  fromMm,
  lockedCounterpart,
  makeSizePreset,
  MAX_RECENT_SIZES,
  MAX_SIZE_MM,
  MIN_SIZE_MM,
  mmPerUnit,
  parseSizeValue,
  resolveSize,
  sizePresetLabel,
  toMm,
  unitPrecision,
} from "./customSize.ts";
import { MAX_DOC_EDGE, MM_PER_INCH, PRINT_DPI } from "./document.ts";

/* --------------------------------------------------------------- conversion */

test("units convert through millimetres", () => {
  assert.equal(toMm(1, "mm"), 1);
  assert.equal(toMm(1, "cm"), 10);
  assert.equal(toMm(1, "in"), MM_PER_INCH);
  assert.equal(toMm(300, "px"), MM_PER_INCH);
  assert.equal(mmPerUnit("cm"), 10);
});

test("fromMm is the inverse of toMm", () => {
  for (const unit of ["px", "mm", "cm", "in"] as const) {
    const round = fromMm(toMm(7.5, unit), unit);
    assert.ok(Math.abs(round - 7.5) < 1e-9, `${unit}: ${round}`);
  }
});

test("formatInUnit drops trailing zeroes", () => {
  assert.equal(formatInUnit(210, "mm"), "210");
  assert.equal(formatInUnit(MM_PER_INCH, "in"), "1");
  assert.equal(formatInUnit(MM_PER_INCH, "px"), "300");
});

test("unitPrecision is whole pixels and fractions elsewhere", () => {
  assert.equal(unitPrecision("px"), 0);
  assert.equal(unitPrecision("mm"), 1);
  assert.equal(unitPrecision("in"), 2);
});

/* -------------------------------------------------------------------- parse */

test("parseSizeValue accepts plain numbers and a comma decimal", () => {
  assert.equal(parseSizeValue("210"), 210);
  assert.equal(parseSizeValue(" 21.5 "), 21.5);
  assert.equal(parseSizeValue("21,5"), 21.5);
});

test("parseSizeValue rejects anything that isn't a positive number", () => {
  for (const bad of ["", "0", "-5", "abc", "12mm", "1.2.3", "1e3"]) {
    assert.equal(parseSizeValue(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
});

/* ------------------------------------------------------------------ resolve */

test("resolveSize turns A4 millimetres into a 300 DPI grid", () => {
  const result = resolveSize(210, 297, "mm");
  assert.ok(result.ok);
  assert.equal(result.size.width, 2480);
  assert.equal(result.size.height, 3508);
  assert.equal(result.size.widthMm, 210);
  assert.ok(Math.round(result.size.dpi) === PRINT_DPI);
  assert.equal(result.size.capped, false);
});

test("pixels are read at print resolution, so 2480 × 3508 px is A4", () => {
  const px = resolveSize(2480, 3508, "px");
  const mm = resolveSize(210, 297, "mm");
  assert.ok(px.ok && mm.ok);
  assert.equal(px.size.width, mm.size.width);
  assert.equal(px.size.height, mm.size.height);
  assert.ok(Math.abs(px.size.widthMm - 210) < 0.1);
});

test("inches and centimetres reach the same grid as their millimetres", () => {
  const inches = resolveSize(8.27, 11.69, "in");
  const cm = resolveSize(21, 29.7, "cm");
  assert.ok(inches.ok && cm.ok);
  assert.ok(Math.abs(inches.size.width - cm.size.width) <= 2);
});

test("a large page is capped by MAX_DOC_EDGE and says so", () => {
  const result = resolveSize(420, 594, "mm"); // A2
  assert.ok(result.ok);
  assert.equal(Math.max(result.size.width, result.size.height), MAX_DOC_EDGE);
  assert.ok(result.size.dpi < PRINT_DPI);
  assert.equal(result.size.capped, true);
  // The paper size survives the cap — that is the whole point of storing mm.
  assert.equal(result.size.widthMm, 420);
});

test("resolveSize rejects sizes outside the printable bounds", () => {
  const small = resolveSize(MIN_SIZE_MM - 1, 100, "mm");
  assert.equal(small.ok, false);
  const large = resolveSize(MAX_SIZE_MM + 1, 100, "mm");
  assert.equal(large.ok, false);
  const nonsense = resolveSize(Number.NaN, 100, "mm");
  assert.equal(nonsense.ok, false);
});

test("resolveSize measures the bounds per edge, not per axis", () => {
  // A tall banner: the short edge is fine, the long edge decides.
  assert.equal(resolveSize(100, MAX_SIZE_MM, "mm").ok, true);
  assert.equal(resolveSize(MAX_SIZE_MM, 100, "mm").ok, true);
  assert.equal(resolveSize(MIN_SIZE_MM, MIN_SIZE_MM, "mm").ok, true);
});

/* --------------------------------------------------------------- lock + doc */

test("lockedCounterpart holds the ratio from either side", () => {
  const ratio = 4 / 5;
  assert.equal(lockedCounterpart(400, ratio, "width"), 500);
  assert.equal(lockedCounterpart(500, ratio, "height"), 400);
});

test("lockedCounterpart passes a nonsense ratio straight through", () => {
  assert.equal(lockedCounterpart(400, 0, "width"), 400);
  assert.equal(lockedCounterpart(400, Number.NaN, "height"), 400);
});

test("documentRatio reads the page's aspect", () => {
  assert.equal(documentRatio({ width: 400, height: 200 }), 2);
  assert.equal(documentRatio({ width: 400, height: 0 }), 1);
});

test("documentPrintSize prefers the page's own mm over the frame", () => {
  const doc = {
    width: 2480,
    height: 3508,
    printMm: { widthMm: 150, heightMm: 200 },
  };
  assert.deepEqual(documentPrintSize(doc, { widthMm: 210, heightMm: 297 }), {
    widthMm: 150,
    heightMm: 200,
  });
});

test("documentPrintSize falls back to the frame, then to 300 DPI", () => {
  const doc = { width: 2480, height: 3508 };
  assert.deepEqual(documentPrintSize(doc, { widthMm: 297, heightMm: 420 }), {
    widthMm: 297,
    heightMm: 420,
  });
  const guessed = documentPrintSize(doc, null);
  assert.ok(Math.abs(guessed.widthMm - 210) < 0.2, String(guessed.widthMm));
  assert.ok(Math.abs(guessed.heightMm - 297) < 0.2, String(guessed.heightMm));
});

/* ------------------------------------------------------------------ presets */

test("makeSizePreset rounds to the unit and labels itself", () => {
  const preset = makeSizePreset(210.04, 296.96, "mm");
  assert.equal(preset.width, 210);
  assert.equal(preset.height, 297);
  assert.equal(preset.label, "210 × 297 mm");
  assert.equal(preset.id, "210x297mm");
  assert.equal(sizePresetLabel(8, 10, "in"), "8 × 10 in");
});

test("addRecentSize is most-recent-first, deduped and capped", () => {
  const a = makeSizePreset(210, 297, "mm");
  const b = makeSizePreset(8, 10, "in");
  let list = addRecentSize([], a);
  list = addRecentSize(list, b);
  assert.deepEqual(
    list.map((p) => p.id),
    [b.id, a.id]
  );
  // Re-picking an existing size moves it to the front rather than duplicating.
  list = addRecentSize(list, a);
  assert.deepEqual(
    list.map((p) => p.id),
    [a.id, b.id]
  );
  let long = list;
  for (let i = 1; i <= MAX_RECENT_SIZES + 3; i += 1) {
    long = addRecentSize(long, makeSizePreset(100 + i, 200, "mm"));
  }
  assert.equal(long.length, MAX_RECENT_SIZES);
});

test("coerceSizePresets drops junk and keeps valid entries once", () => {
  const presets = coerceSizePresets([
    null,
    "nope",
    { width: 0, height: 10, unit: "mm" },
    { width: 10, height: 10, unit: "furlong" },
    { width: 210, height: 297, unit: "mm" },
    { width: 210, height: 297, unit: "mm" },
  ]);
  assert.equal(presets.length, 1);
  assert.equal(presets[0].id, "210x297mm");
  assert.deepEqual(coerceSizePresets("not an array"), []);
});
