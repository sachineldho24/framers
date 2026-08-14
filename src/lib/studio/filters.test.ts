import assert from "node:assert/strict";
import test from "node:test";

import { NO_ADJUSTMENTS, type Adjustments } from "./document.ts";
import {
  adjustToFactor,
  applyFilterToPixels,
  buildFilterString,
  FILTER_PRESETS,
  getPreset,
  hasVisibleEffect,
} from "./filters.ts";

const NEUTRAL: Adjustments = { ...NO_ADJUSTMENTS };

test("a neutral layer produces no filter at all", () => {
  assert.equal(buildFilterString("none", 1, NEUTRAL), "none");
  assert.equal(hasVisibleEffect("none", 1, NEUTRAL), false);
});

test("zero strength disables a preset entirely", () => {
  assert.equal(buildFilterString("noir", 0, NEUTRAL), "none");
  assert.equal(hasVisibleEffect("noir", 0, NEUTRAL), false);
  assert.equal(hasVisibleEffect("noir", 1, NEUTRAL), true);
});

test("strength interpolates a preset toward neutral", () => {
  const full = buildFilterString("mono", 1, NEUTRAL);
  const half = buildFilterString("mono", 0.5, NEUTRAL);
  assert.match(full, /grayscale\(1\)/);
  assert.match(half, /grayscale\(0\.5\)/);
});

test("manual adjustments multiply onto the preset", () => {
  const out = buildFilterString("none", 1, {
    brightness: 50,
    contrast: -50,
    saturation: 0,
  });
  assert.match(out, /brightness\(1\.5\)/);
  assert.match(out, /contrast\(0\.5\)/);
  assert.doesNotMatch(out, /saturate/);
});

test("adjustToFactor maps the slider range around 1", () => {
  assert.equal(adjustToFactor(0), 1);
  assert.equal(adjustToFactor(100), 2);
  assert.equal(adjustToFactor(-100), 0);
  // Out-of-range input clamps instead of producing a negative factor.
  assert.equal(adjustToFactor(500), 2);
  assert.equal(adjustToFactor(-500), 0);
});

test("every preset is registered and retrievable by id", () => {
  for (const preset of FILTER_PRESETS) {
    assert.equal(getPreset(preset.id).id, preset.id);
    assert.ok(preset.label.length > 0);
  }
  // An unknown id falls back to the neutral preset rather than throwing.
  assert.equal(getPreset("bogus" as never).id, "none");
});

test("filter order in the string matches the CSS filter spec order", () => {
  const out = buildFilterString("vintage", 1, {
    brightness: 10,
    contrast: 10,
    saturation: 10,
  });
  const order = ["brightness", "contrast", "saturate", "sepia"];
  const positions = order.map((name) => out.indexOf(name));
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i] > positions[i - 1],
      `${order[i]} should follow ${order[i - 1]} in "${out}"`
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Pixel fallback parity                                                       */
/* -------------------------------------------------------------------------- */

function px(r: number, g: number, b: number): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, 255]);
}

test("the pixel fallback leaves a neutral layer untouched", () => {
  const data = px(10, 120, 250);
  applyFilterToPixels(data, "none", 1, NEUTRAL);
  assert.deepEqual(Array.from(data), [10, 120, 250, 255]);
});

test("the pixel fallback preserves alpha", () => {
  const data = new Uint8ClampedArray([10, 120, 250, 77]);
  applyFilterToPixels(data, "punch", 1, { brightness: 40, contrast: 0, saturation: 0 });
  assert.equal(data[3], 77);
});

test("grayscale in the pixel fallback equalises the channels", () => {
  const data = px(200, 50, 100);
  applyFilterToPixels(data, "mono", 1, NEUTRAL);
  // Mono also lifts contrast slightly, so compare channels to each other.
  assert.equal(data[0], data[1]);
  assert.equal(data[1], data[2]);
});

test("brightness in the pixel fallback matches the CSS multiplier", () => {
  const data = px(50, 100, 150);
  applyFilterToPixels(data, "none", 1, { brightness: 100, contrast: 0, saturation: 0 });
  // brightness(2) doubles each channel, clamped at 255.
  assert.equal(data[0], 100);
  assert.equal(data[1], 200);
  assert.equal(data[2], 255);
});

test("contrast in the pixel fallback pivots around mid-grey", () => {
  const mid = px(128, 128, 128);
  applyFilterToPixels(mid, "none", 1, { brightness: 0, contrast: 100, saturation: 0 });
  // Mid-grey is (almost) the fixed point of a contrast change.
  assert.ok(Math.abs(mid[0] - 128) <= 1, `mid-grey moved to ${mid[0]}`);

  const dark = px(60, 60, 60);
  applyFilterToPixels(dark, "none", 1, { brightness: 0, contrast: 100, saturation: 0 });
  assert.ok(dark[0] < 60, "contrast should push a dark pixel darker");
});

test("full desaturation in the pixel fallback equalises the channels", () => {
  const data = px(200, 50, 100);
  applyFilterToPixels(data, "none", 1, {
    brightness: 0,
    contrast: 0,
    saturation: -100,
  });
  assert.equal(data[0], data[1]);
  assert.equal(data[1], data[2]);
});

test("the pixel fallback clamps rather than wrapping around", () => {
  const bright = px(250, 250, 250);
  applyFilterToPixels(bright, "punch", 1, {
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });
  for (let i = 0; i < 3; i += 1) {
    assert.ok(bright[i] >= 0 && bright[i] <= 255, `channel ${i} = ${bright[i]}`);
  }

  const dark = px(2, 2, 2);
  applyFilterToPixels(dark, "noir", 1, {
    brightness: -100,
    contrast: 100,
    saturation: 0,
  });
  for (let i = 0; i < 3; i += 1) {
    assert.ok(dark[i] >= 0 && dark[i] <= 255, `channel ${i} = ${dark[i]}`);
  }
});

test("every preset is a no-op at strength 0 in the pixel fallback too", () => {
  for (const preset of FILTER_PRESETS) {
    const data = px(37, 111, 203);
    applyFilterToPixels(data, preset.id, 0, NEUTRAL);
    assert.deepEqual(
      Array.from(data),
      [37, 111, 203, 255],
      `${preset.id} altered pixels at strength 0`
    );
  }
});

test("the pixel fallback and the CSS string agree on which presets do nothing", () => {
  for (const preset of FILTER_PRESETS) {
    const data = px(37, 111, 203);
    const before = Array.from(data);
    applyFilterToPixels(data, preset.id, 1, NEUTRAL);
    const changed = Array.from(data).some((v, i) => v !== before[i]);
    const cssChanged = buildFilterString(preset.id, 1, NEUTRAL) !== "none";
    assert.equal(
      changed,
      cssChanged,
      `${preset.id}: pixels changed=${changed} but CSS changed=${cssChanged}`
    );
  }
});
