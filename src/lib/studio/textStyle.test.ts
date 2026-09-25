import assert from "node:assert/strict";
import test from "node:test";

import { createDocument, createTextLayer, migrateDocument } from "./document.ts";
import { pasteStyleActions } from "./copyStyle.ts";
import { studioReducer } from "./reducer.ts";
import { applyListMarkers, layoutText } from "./text.ts";
import { coerceTextEffect, EFFECT_DEFAULTS, switchEffect } from "./textEffects.ts";

const text = (over: Record<string, unknown> = {}) => ({
  ...createTextLayer({ text: "One\nTwo", x: 0, y: 0, width: 400, height: 100, fontSize: 40 }),
  ...over,
});

test("list markers prefix each non-empty paragraph and leave the stored text alone", () => {
  assert.equal(applyListMarkers("One\n\nTwo", "bullet"), "• One\n\n• Two");
  assert.equal(applyListMarkers("One\nTwo", "number"), "1. One\n2. Two");
  assert.equal(applyListMarkers("One", "none"), "One");
  const layout = layoutText({
    text: "One\nTwo",
    maxWidth: 1000,
    fontSize: 10,
    lineHeight: 1.2,
    uppercase: false,
    list: "number",
    measure: (t) => t.length,
  });
  assert.deepEqual(layout.lines.map((l) => l.text), ["1. One", "2. Two"]);
});

test("effects are coerced to valid values, and 'none' is stored as absent", () => {
  assert.equal(coerceTextEffect({ kind: "none" }), undefined);
  assert.equal(coerceTextEffect({ kind: "sparkles" }), undefined);
  const neon = coerceTextEffect({ kind: "neon", intensity: 500, color: "red" });
  assert.equal(neon?.intensity, 100);
  assert.equal(neon?.color, EFFECT_DEFAULTS.neon.color);
});

test("switching effect keeps the user's colour where both effects have one", () => {
  const shadow = { ...EFFECT_DEFAULTS.shadow, color: "#ff0000" };
  assert.equal(switchEffect(shadow, "echo")?.color, "#ff0000");
  assert.equal(switchEffect(shadow, "none"), undefined);
});

test("underline, strike, list and effect round-trip through the reducer and a reload", () => {
  const doc = createDocument({ width: 1000, height: 1000 });
  doc.layers.push(text());
  const id = doc.layers[0].id;
  const styled = studioReducer(doc, {
    type: "setTextStyle",
    layerId: id,
    patch: { underline: true, strike: true, list: "bullet", effect: { ...EFFECT_DEFAULTS.glitch } },
  });
  const reloaded = migrateDocument(JSON.parse(JSON.stringify(styled)));
  const layer = reloaded?.layers[0];
  assert.ok(layer?.kind === "text");
  assert.equal(layer.underline, true);
  assert.equal(layer.strike, true);
  assert.equal(layer.list, "bullet");
  assert.equal(layer.effect?.kind, "glitch");

  const cleared = studioReducer(styled, { type: "setTextStyle", layerId: id, patch: { effect: null } });
  const plain = cleared.layers[0];
  assert.ok(plain.kind === "text" && plain.effect === undefined);
});

test("copy style moves typography onto text, never the words", () => {
  const source = text({ id: "a", text: "Source", fontId: "oswald", color: "#ff0000", effect: EFFECT_DEFAULTS.neon });
  const target = text({ id: "b", text: "Target" });
  const [first] = pasteStyleActions(source, target);
  assert.equal(first.type, "setTextStyle");
  if (first.type !== "setTextStyle") return;
  assert.equal(first.patch.fontId, "oswald");
  assert.equal(first.patch.color, "#ff0000");
  assert.equal(first.patch.effect?.kind, "neon");
  assert.ok(!("text" in first.patch));
  assert.deepEqual(pasteStyleActions(source, source), []);
});
