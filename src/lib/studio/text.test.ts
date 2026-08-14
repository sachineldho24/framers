import assert from "node:assert/strict";
import test from "node:test";

import {
  alignOffsetX,
  alignOffsetY,
  DEFAULT_LINE_HEIGHT,
  layoutText,
  letterSpacingPx,
  lineTop,
  transformText,
  type MeasureText,
} from "./text.ts";

/** Every code point is 10 units wide, so expected line breaks are countable. */
const mono: MeasureText = (text) => Array.from(text).length * 10;

function lay(text: string, maxWidth: number, extra: Partial<{ uppercase: boolean; lineHeight: number; fontSize: number }> = {}) {
  return layoutText({
    text,
    maxWidth,
    fontSize: extra.fontSize ?? 10,
    lineHeight: extra.lineHeight ?? DEFAULT_LINE_HEIGHT,
    uppercase: extra.uppercase ?? false,
    measure: mono,
  });
}

test("transformText uppercases only when asked", () => {
  assert.equal(transformText("Track Day", false), "Track Day");
  assert.equal(transformText("Track Day", true), "TRACK DAY");
  // Malayalam is caseless — uppercasing must not corrupt it.
  assert.equal(transformText("കേരളം", true), "കേരളം");
});

test("short text stays on one line", () => {
  const layout = lay("GT3 RS", 1000);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["GT3 RS"]
  );
  assert.equal(layout.maxLineWidth, 60);
});

test("wrapping is greedy on word boundaries", () => {
  // "aaa bbb ccc" — 30 units per word, 10 for a space.
  const layout = lay("aaa bbb ccc", 70);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["aaa bbb", "ccc"]
  );
});

test("a line that exactly fits is not broken", () => {
  const layout = lay("aaa bbb", 70);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["aaa bbb"]
  );
});

test("explicit newlines are honoured", () => {
  const layout = lay("PORSCHE\n911", 1000);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["PORSCHE", "911"]
  );
});

test("blank lines are preserved so spacing survives a round-trip", () => {
  const layout = lay("a\n\nb", 1000);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["a", "", "b"]
  );
  assert.equal(layout.lines[1].width, 0);
});

test("CRLF and CR lay out the same as LF", () => {
  const lf = lay("a\nb", 1000).lines.map((l) => l.text);
  assert.deepEqual(lay("a\r\nb", 1000).lines.map((l) => l.text), lf);
  assert.deepEqual(lay("a\rb", 1000).lines.map((l) => l.text), lf);
});

test("a word wider than the box is broken by character, never overflowed", () => {
  const layout = lay("abcdefg", 30);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["abc", "def", "g"]
  );
  for (const line of layout.lines) {
    assert.ok(line.width <= 30, `${line.text} overflows`);
  }
});

test("an over-wide word after a fitting word breaks on its own line", () => {
  const layout = lay("hi abcdefg", 30);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["hi", "abc", "def", "g"]
  );
});

test("a box narrower than one glyph still emits one glyph per line", () => {
  const layout = lay("abc", 1);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["a", "b", "c"]
  );
});

test("runs of spaces and tabs collapse rather than producing empty lines", () => {
  const layout = lay("a   \t b", 1000);
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["a b"]
  );
});

test("wrapping measures the uppercased text, not the source", () => {
  // A fake metric where lowercase is free makes the difference visible.
  const caseAware: MeasureText = (text) =>
    Array.from(text).filter((c) => c !== c.toLowerCase()).length * 10;
  const layout = layoutText({
    text: "ab cd",
    maxWidth: 25,
    fontSize: 10,
    lineHeight: 1,
    uppercase: true,
    measure: caseAware,
  });
  assert.deepEqual(
    layout.lines.map((l) => l.text),
    ["AB", "CD"]
  );
});

test("empty text still occupies one line so the caret has a home", () => {
  const layout = lay("", 100, { fontSize: 20, lineHeight: 1 });
  assert.equal(layout.lines.length, 1);
  assert.equal(layout.lines[0].text, "");
  assert.equal(layout.totalHeight, 20);
});

test("totalHeight is lineHeightPx per line", () => {
  const layout = lay("a\nb\nc", 1000, { fontSize: 20, lineHeight: 1.5 });
  assert.equal(layout.lineHeightPx, 30);
  assert.equal(layout.totalHeight, 90);
});

test("layout survives degenerate sizes without producing NaN", () => {
  const layout = layoutText({
    text: "abc",
    maxWidth: 0,
    fontSize: 0,
    lineHeight: 0,
    uppercase: false,
    measure: mono,
  });
  assert.ok(Number.isFinite(layout.lineHeightPx));
  assert.ok(Number.isFinite(layout.totalHeight));
  assert.ok(layout.lineHeightPx > 0);
  assert.ok(layout.lines.length > 0);
});

test("alignOffsetX places the line per alignment", () => {
  assert.equal(alignOffsetX(40, 100, "left"), 0);
  assert.equal(alignOffsetX(40, 100, "center"), 30);
  assert.equal(alignOffsetX(40, 100, "right"), 60);
});

test("alignOffsetY places the block per vertical alignment", () => {
  assert.equal(alignOffsetY(40, 100, "top"), 0);
  assert.equal(alignOffsetY(40, 100, "middle"), 30);
  assert.equal(alignOffsetY(40, 100, "bottom"), 60);
});

test("a block taller than its box overhangs symmetrically when centred", () => {
  assert.equal(alignOffsetY(120, 100, "middle"), -10);
});

test("lineTop splits the extra leading above and below the glyphs", () => {
  // fontSize 20, lineHeight 1.5 → 30px lines, 5px of leading each side.
  assert.equal(lineTop(0, 30, 20), 5);
  assert.equal(lineTop(1, 30, 20), 35);
  // With lineHeight 1 there is no leading to split.
  assert.equal(lineTop(0, 20, 20), 0);
  assert.equal(lineTop(2, 20, 20), 40);
});

test("letterSpacingPx scales with the font size", () => {
  assert.equal(letterSpacingPx(0.1, 200), 20);
  assert.equal(letterSpacingPx(0, 200), 0);
  assert.equal(letterSpacingPx(-0.05, 100), -5);
});
