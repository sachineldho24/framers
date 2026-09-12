import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { WORKS, WORK_CATEGORIES, HERO_WORKS, getWorksPage } from "./works.ts";

test("every retained artwork belongs to one public category and has web images", () => {
  const originals = readdirSync(join(process.cwd(), "public/posterx"))
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
  assert.equal(WORKS.length, originals.length);
  assert.equal(new Set(WORKS.map((work) => work.id)).size, originals.length);
  assert.deepEqual(new Set(WORKS.map((work) => work.source.split("/").at(-1))), new Set(originals));
  for (const work of WORKS) {
    assert.ok(WORK_CATEGORIES.some((category) => category.id === work.category));
    for (const path of [work.image, work.fullImage, work.source]) {
      assert.ok(existsSync(join(process.cwd(), "public", path)), path);
    }
    assert.ok(work.width > 0 && work.height > 0);
    assert.ok(work.title.length > 0 && work.alt.length > 0);
  }
});

test("six hero artworks are different pieces from six categories", () => {
  assert.equal(HERO_WORKS.length, 6);
  assert.equal(new Set(HERO_WORKS.map((work) => work.id)).size, 6);
  assert.equal(new Set(HERO_WORKS.map((work) => work.category)).size, 6);
});

test("category pagination exposes every artwork once without mixing categories", () => {
  for (const category of WORK_CATEGORIES) {
    const first = getWorksPage(category.id)!;
    const all = [];
    for (let page = 1; page <= first.totalPages; page++) {
      const result = getWorksPage(category.id, String(page))!;
      assert.ok(result.items.length <= 24);
      assert.ok(result.items.every((work) => work.category === category.id));
      all.push(...result.items.map((work) => work.id));
    }
    assert.equal(new Set(all).size, first.total);
    assert.equal(all.length, WORKS.filter((work) => work.category === category.id).length);
  }
});

test("unknown categories fail safely and malformed page queries stay usable", () => {
  assert.equal(getWorksPage("not-a-category"), null);
  for (const query of ["-1", "0", "1.5", "nope", ["2", "3"]]) {
    assert.equal(getWorksPage("cars", query)!.page, 1);
  }
  assert.equal(getWorksPage("cars", "9999")!.page, getWorksPage("cars")!.totalPages);
  const overview = getWorksPage()!;
  assert.equal(overview.total, WORKS.length);
  assert.ok(new Set(overview.items.map((work) => work.category)).size >= 6);
});
