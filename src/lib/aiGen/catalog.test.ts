import { test } from "node:test";
import assert from "node:assert/strict";

import { MODELS, TASK_ORDER, defaultQuality, estimateCost, findModel, formatCost, modelsFor } from "./catalog.ts";

test("model ids are unique and prefixed with their provider", () => {
  const seen = new Set<string>();
  for (const m of MODELS) {
    assert.ok(!seen.has(m.id), `duplicate ${m.id}`);
    seen.add(m.id);
    assert.ok(m.id.startsWith(`${m.provider}:`), m.id);
  }
});

test("every model is priced and every task has a model", () => {
  for (const m of MODELS) {
    assert.ok((m.usd ?? 0) > 0 || Object.values(m.qualities ?? {}).some((v) => (v ?? 0) > 0), `${m.id} has no price`);
    assert.ok(m.tasks.length > 0 && m.maxImages >= 1, m.id);
  }
  for (const task of TASK_ORDER) assert.ok(MODELS.some((m) => m.tasks.includes(task)), task);
});

test("replace models say how they take the selection", () => {
  for (const m of MODELS.filter((m) => m.tasks.includes("replace") || m.tasks.includes("erase"))) {
    assert.ok(m.mask === "native" || m.mask === "composite", m.id);
  }
});

test("modelsFor filters by task and configured provider", () => {
  const fal = modelsFor("layerize", ["fal"]);
  assert.ok(fal.length >= 1 && fal.every((m) => m.provider === "fal"));
  assert.equal(modelsFor("layerize", ["openai"]).length, 0);
});

test("estimateCost uses the tier, resolution and count", () => {
  const gpt = findModel("openai:gpt-image-2.5-flare")!;
  assert.equal(defaultQuality(gpt), "medium");
  assert.equal(estimateCost(gpt), 0.013);
  assert.equal(estimateCost(gpt, { quality: "max", count: 2 }), 0.422);
  const banana = findModel("fal:nano-banana-2")!;
  assert.equal(estimateCost(banana, { resolution: "4K" }), 0.16);
  // Count is clamped to what the model allows.
  assert.equal(estimateCost(findModel("bfl:flux-2-pro")!, { count: 4 }), 0.03);
});

test("formatCost reads naturally in dollars and rupees", () => {
  assert.equal(formatCost(0.013), "≈ $0.013");
  assert.equal(formatCost(0.013, "INR"), "≈ ₹1.1");
  assert.equal(formatCost(0.5, "INR"), "≈ ₹44");
});
