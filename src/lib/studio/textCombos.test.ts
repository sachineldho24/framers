import assert from "node:assert/strict";
import test from "node:test";

import { createDocument } from "./document.ts";
import { FONT_CATALOGUE, getFont } from "./fonts.ts";
import { createComboLayers, TEXT_COMBOS } from "./textCombos.ts";

test("every combo uses real catalogue fonts at weights they ship", () => {
  const ids = new Set(FONT_CATALOGUE.map((f) => f.id));
  for (const combo of TEXT_COMBOS) {
    for (const line of combo.lines) {
      assert.ok(ids.has(line.fontId), `${combo.id}: unknown font ${line.fontId}`);
      const weight = line.fontWeight ?? 400;
      assert.ok(getFont(line.fontId).weights.includes(weight), `${combo.id}: ${line.fontId} has no ${weight}`);
    }
  }
});

test("combo ids are unique", () => {
  assert.equal(new Set(TEXT_COMBOS.map((c) => c.id)).size, TEXT_COMBOS.length);
});

test("a combo inserts one centred text layer per line, stacked in order", () => {
  const doc = createDocument({ width: 1000, height: 1400 });
  const combo = TEXT_COMBOS.find((c) => c.id === "seasonal-exclusives")!;
  const layers = createComboLayers(doc, combo);
  assert.equal(layers.length, 2);
  for (const layer of layers) {
    assert.ok(Math.abs(layer.x + layer.width / 2 - 500) < 1, "centred");
    assert.equal(layer.align, "center");
  }
  assert.ok(layers[0].y < layers[1].y);
  assert.equal(layers[0].effect?.kind, "shadow");
  assert.ok(layers[1].strokeWidth > 0);
});
