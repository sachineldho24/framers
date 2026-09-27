import assert from "node:assert/strict";
import { test } from "node:test";

import { createImageLayer, PRINT_DPI } from "../document.ts";
import { imagePrintDpi } from "../print.ts";
import { MAX_ENHANCED_PIXELS, MODEL_SCALE, planEnhance } from "./plan.ts";

/** A photo filling a 6×4 in box on a 300 DPI page. */
function photo(naturalWidth: number, naturalHeight: number) {
  return createImageLayer({
    src: "p.jpg",
    naturalWidth,
    naturalHeight,
    x: 0,
    y: 0,
    width: 6 * PRINT_DPI,
    height: 4 * PRINT_DPI,
  });
}

test("a soft photo is enlarged just enough to reach the page's resolution", () => {
  const layer = photo(900, 600); // 150 DPI over 6×4 in
  const plan = planEnhance(layer, PRINT_DPI);
  assert.ok(plan.ok);
  assert.equal(plan.scale, 2);
  assert.equal(plan.width, 1800);
  assert.equal(plan.height, 1200);
  assert.equal(Math.round(plan.dpiAfter), PRINT_DPI);
});

test("the model's ×4 is the most one pass gives", () => {
  const plan = planEnhance(photo(300, 200), PRINT_DPI); // 50 DPI: wants ×6
  assert.ok(plan.ok);
  assert.equal(plan.scale, MODEL_SCALE);
  assert.equal(Math.round(plan.dpiAfter), 200);
});

test("a photo that is already sharp is left alone", () => {
  const plan = planEnhance(photo(1800, 1200), PRINT_DPI);
  assert.equal(plan.ok, false);
  assert.equal(!plan.ok && plan.reason, "sharp");
});

test("a capped page grid lowers the target: no point beating the page", () => {
  const layer = photo(1050, 700); // 175 DPI on a page whose grid is 175
  const pageDpi = 175;
  const box = { width: 6 * pageDpi, height: 4 * pageDpi };
  const plan = planEnhance({ ...layer, ...box }, pageDpi);
  assert.equal(plan.ok, false);
});

test("the result never passes the pixel cap a phone can handle", () => {
  // A big, heavily cropped photo: soft on the page, but already huge.
  const layer = { ...photo(3000, 2000), crop: { x: 0, y: 0, w: 0.2, h: 0.2 } };
  assert.ok(imagePrintDpi(layer, PRINT_DPI) < PRINT_DPI);
  const plan = planEnhance(layer, PRINT_DPI);
  assert.ok(plan.ok);
  assert.ok(plan.width * plan.height <= MAX_ENHANCED_PIXELS * 1.001);
});

test("when the cap leaves almost nothing to gain, it says so instead", () => {
  const layer = { ...photo(4000, 3600), crop: { x: 0, y: 0, w: 0.1, h: 0.1 } };
  const plan = planEnhance(layer, PRINT_DPI);
  assert.equal(plan.ok, false);
  assert.equal(!plan.ok && plan.reason, "large");
});
