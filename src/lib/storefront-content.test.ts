import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  HERO_ORBIT_FRAMES,
  LATEST_CREATIONS,
  SHOP_CATEGORIES,
  TESTIMONIALS,
} from "./storefront-content.ts";

test("storefront content includes all six hero frames and requested categories", () => {
  assert.equal(HERO_ORBIT_FRAMES.length, 6);
  assert.equal(new Set(HERO_ORBIT_FRAMES.map((frame) => frame.image)).size, 6);
  assert.deepEqual(
    SHOP_CATEGORIES.map((category) => category.label),
    ["Cars", "Bikes", "Buses", "Birthday", "Anniversary", "Portraits", "Vans", "Frame mockups"],
  );

  for (const item of [...HERO_ORBIT_FRAMES, ...SHOP_CATEGORIES]) {
    const assetPath = join(process.cwd(), "public", item.image.replace(/^\//, ""));
    assert.ok(existsSync(assetPath), `${item.image} should exist in public`);
    assert.ok(statSync(assetPath).size > 0, `${item.image} should not be empty`);
  }
  assert.ok(SHOP_CATEGORIES.every(category => category.href.startsWith("/works/") && category.count > 0));
});

test("latest creations includes fourteen unique real artworks", () => {
  assert.equal(LATEST_CREATIONS.length, 14);
  assert.equal(new Set(LATEST_CREATIONS.map((item) => item.image)).size, 14);

  for (const item of LATEST_CREATIONS) {
    assert.ok(item.image.startsWith("/work-images/"));
    const assetPath = join(process.cwd(), "public", item.image.replace(/^\//, ""));
    assert.ok(existsSync(assetPath), `${item.image} should exist in public`);
    assert.ok(statSync(assetPath).size > 0, `${item.image} should not be empty`);
  }
});

test("testimonials are complete, unique, and rated within the star scale", () => {
  assert.equal(TESTIMONIALS.length, 6);
  assert.equal(new Set(TESTIMONIALS.map((item) => item.id)).size, 6);

  for (const item of TESTIMONIALS) {
    assert.ok(item.quote.length > 40, `${item.id} quote should be substantive`);
    assert.ok(item.quote.length < 220, `${item.id} quote should fit a card`);
    assert.ok(item.name.trim().length > 0, `${item.id} needs a name`);
    assert.ok(item.city.trim().length > 0, `${item.id} needs a city`);
    assert.ok(item.occasion.trim().length > 0, `${item.id} needs an occasion`);
    assert.ok(
      item.rating >= 1 && item.rating <= 5,
      `${item.id} rating should sit on the 5-star scale`
    );
    // The card renders the quote inside its own typographic quote marks.
    assert.doesNotMatch(item.quote, /["“”]/, `${item.id} should not self-quote`);
  }
});
