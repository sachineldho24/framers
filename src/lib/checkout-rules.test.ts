import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * The two rules checkout has to keep: a frame costs its own price, and a size
 * we cannot price sends the customer to a human. Both are asserted against the
 * source because both are decisions, not calculations - a modifier creeping
 * back into a component would be a silent price change.
 */

const orderRoute = readFileSync(
  new URL("../app/api/payments/create-order/route.ts", import.meta.url),
  "utf8"
);
// Every designer screen, whoever adds one next: the rule is about the folder,
// not about a list that has to be kept up to date.
const designerDir = new URL("../components/designer/", import.meta.url);
const designerScreens = readdirSync(designerDir)
  .filter((name) => name.endsWith(".tsx"))
  .map(
    (name) =>
      [name, readFileSync(new URL(name, designerDir), "utf8")] as const
  );
const sizeStep = readFileSync(
  new URL("../components/designer/SizeStep.tsx", import.meta.url),
  "utf8"
);
const migration = readFileSync(
  new URL("../../supabase/migrations/0011_flat_frame_pricing.sql", import.meta.url),
  "utf8"
);

test("checkout charges the frame's own price and never adds a modifier", () => {
  assert.match(orderRoute, /const amountPaise = frame\.price_paise;/);
  assert.doesNotMatch(orderRoute, /amountPaise\s*\+=/);
});

test("no designer screen quotes a style or finish upcharge", () => {
  for (const [name, source] of designerScreens) {
    assert.doesNotMatch(
      source,
      /price_modifier_paise/,
      `${name} prices a design choice again`
    );
  }
});

test("the migration zeroes both modifier tables, idempotently", () => {
  assert.match(
    migration,
    /update public\.frame_styles[\s\S]*?set price_modifier_paise = 0[\s\S]*?where price_modifier_paise <> 0/
  );
  assert.match(
    migration,
    /update public\.finishes[\s\S]*?set price_modifier_paise = 0[\s\S]*?where price_modifier_paise <> 0/
  );
});

test("a size we do not stock leads to the contact page", () => {
  assert.match(sizeStep, /href="\/contact"/);
  assert.equal(
    existsSync(new URL("../app/contact/page.tsx", import.meta.url)),
    true,
    "the size step links to a contact page that does not exist"
  );
});
