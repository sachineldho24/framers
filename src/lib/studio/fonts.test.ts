import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_ORDER,
  DEFAULT_FONT_ID,
  FONT_CATALOGUE,
  fontCssUrl,
  fontCssUrlFor,
  fontShorthand,
  fontStack,
  fontsByCategory,
  getFont,
  nearestWeight,
} from "./fonts.ts";

test("catalogue ids are unique", () => {
  const ids = new Set(FONT_CATALOGUE.map((f) => f.id));
  assert.equal(ids.size, FONT_CATALOGUE.length);
});

test("catalogue families are unique", () => {
  const families = new Set(FONT_CATALOGUE.map((f) => f.family));
  assert.equal(families.size, FONT_CATALOGUE.length);
});

test("every font has at least one weight and a fallback", () => {
  for (const font of FONT_CATALOGUE) {
    assert.ok(font.weights.length > 0, `${font.id} has no weights`);
    assert.ok(font.fallback.length > 0, `${font.id} has no fallback`);
    for (const w of font.weights) {
      assert.ok(
        Number.isInteger(w) && w >= 100 && w <= 900,
        `${font.id} weight ${w} is out of range`
      );
    }
  }
});

test("every category in the catalogue is listed in CATEGORY_ORDER", () => {
  for (const font of FONT_CATALOGUE) {
    assert.ok(
      CATEGORY_ORDER.includes(font.category),
      `${font.category} missing from CATEGORY_ORDER`
    );
  }
});

test("every ordered category has at least one font", () => {
  for (const category of CATEGORY_ORDER) {
    assert.ok(fontsByCategory(category).length > 0, `${category} is empty`);
  }
});

test("the Kerala-first audience has Malayalam and Devanagari faces", () => {
  const indic = fontsByCategory("indic").map((f) => f.family);
  assert.ok(indic.some((f) => f.includes("Malayalam")));
  assert.ok(indic.some((f) => f.includes("Devanagari")));
});

test("getFont falls back to the default for an unknown id", () => {
  assert.equal(getFont("not-a-font").id, DEFAULT_FONT_ID);
  assert.equal(getFont(DEFAULT_FONT_ID).id, DEFAULT_FONT_ID);
});

test("the default font id exists in the catalogue", () => {
  assert.ok(FONT_CATALOGUE.some((f) => f.id === DEFAULT_FONT_ID));
});

test("nearestWeight snaps to a weight the family ships", () => {
  const oswald = getFont("oswald");
  assert.equal(nearestWeight(oswald, 900), 700);
  assert.equal(nearestWeight(oswald, 100), 300);
  assert.equal(nearestWeight(oswald, 500), 500);

  const anton = getFont("anton");
  assert.equal(nearestWeight(anton, 900), 400);
});

test("fontCssUrl requests only catalogued weights", () => {
  const url = fontCssUrl(getFont("libre-baskerville"));
  assert.match(url, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/);
  assert.ok(url.includes("Libre+Baskerville"));
  // Italic family, so the tuple form with every axis on every tuple.
  assert.ok(url.includes("ital,wght@0,400;0,700;1,400;1,700"));
  assert.ok(url.endsWith("&display=swap"));
});

test("fontCssUrl uses the plain wght form for families without italics", () => {
  const url = fontCssUrl(getFont("oswald"));
  assert.ok(url.includes("wght@300;400;500;600;700"));
  assert.ok(!url.includes("ital"));
});

test("fontCssUrl escapes spaces in family names", () => {
  assert.ok(fontCssUrl(getFont("bebas-neue")).includes("Bebas+Neue"));
  assert.ok(!fontCssUrl(getFont("bebas-neue")).includes("Bebas Neue"));
});

test("every catalogue entry produces a well-formed css2 URL", () => {
  for (const font of FONT_CATALOGUE) {
    const url = fontCssUrl(font);
    assert.ok(url.startsWith("https://fonts.googleapis.com/css2?family="));
    assert.ok(!url.includes(" "), `${font.id} URL contains a raw space`);
    assert.ok(url.includes(":"), `${font.id} URL has no axis spec`);
  }
});

test("fontCssUrlFor batches families into one request", () => {
  const url = fontCssUrlFor([getFont("anton"), getFont("oswald")]);
  assert.ok(url);
  assert.equal(url!.match(/family=/g)?.length, 2);
  assert.ok(url!.includes("Anton"));
  assert.ok(url!.includes("Oswald"));
  assert.ok(url!.endsWith("&display=swap"));
});

test("fontCssUrlFor is order-independent so it hits the cache", () => {
  const a = fontCssUrlFor([getFont("anton"), getFont("oswald")]);
  const b = fontCssUrlFor([getFont("oswald"), getFont("anton")]);
  assert.equal(a, b);
});

test("fontCssUrlFor returns null for an empty set", () => {
  assert.equal(fontCssUrlFor([]), null);
});

test("fontStack quotes the family and keeps the fallback", () => {
  assert.equal(fontStack(getFont("anton")), '"Anton", system-ui, sans-serif');
});

test("fontShorthand is a valid CSS font shorthand", () => {
  assert.equal(
    fontShorthand({ fontId: "anton", weight: 400, italic: false, sizePx: 48 }),
    '400 48px "Anton", system-ui, sans-serif'
  );
});

test("fontShorthand ignores italic for families without one", () => {
  const shorthand = fontShorthand({
    fontId: "anton",
    weight: 400,
    italic: true,
    sizePx: 48,
  });
  assert.ok(!shorthand.startsWith("italic"));
});

test("fontShorthand emits italic for families that ship one", () => {
  const shorthand = fontShorthand({
    fontId: "montserrat",
    weight: 700,
    italic: true,
    sizePx: 32,
  });
  assert.ok(shorthand.startsWith("italic 700 32px"));
});

test("fontShorthand snaps the weight to a shipped one", () => {
  const shorthand = fontShorthand({
    fontId: "anton",
    weight: 900,
    italic: false,
    sizePx: 20,
  });
  assert.ok(shorthand.startsWith("400 20px"));
});

test("fontShorthand guards against sizes canvas would reject", () => {
  for (const sizePx of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    const shorthand = fontShorthand({
      fontId: "anton",
      weight: 400,
      italic: false,
      sizePx,
    });
    const size = Number(shorthand.match(/(\d+(?:\.\d+)?)px/)?.[1]);
    assert.ok(Number.isFinite(size) && size >= 1, `size ${sizePx} → ${shorthand}`);
  }
});
