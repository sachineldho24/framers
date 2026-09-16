import assert from "node:assert/strict";
import test from "node:test";

import {
  getShape,
  SHAPE_CATALOG,
  SHAPE_CATEGORIES,
  shapePathD,
  type ShapeCommand,
  type ShapeDef,
} from "./shapes.ts";

/** A landscape box, so a shape that only works square is caught. */
const W = 120;
const H = 80;
const EPS = 0.01;

/**
 * Every number a command carries. Control points are included on purpose: a
 * curve whose control point is off the page draws off the page.
 */
function numbers(c: ShapeCommand): number[] {
  if (c.c === "M" || c.c === "L") return [c.x, c.y];
  if (c.c === "Q") return [c.x1, c.y1, c.x, c.y];
  if (c.c === "C") return [c.x1, c.y1, c.x2, c.y2, c.x, c.y];
  return [];
}

function allNumbers(def: ShapeDef, w = W, h = H): number[] {
  return def.path(w, h).flatMap(numbers);
}

test("every element has a unique id and a real shelf", () => {
  const seen = new Set<string>();
  for (const def of SHAPE_CATALOG) {
    assert.ok(!seen.has(def.id), `duplicate id: ${def.id}`);
    seen.add(def.id);
    assert.ok(def.label.trim().length > 0, `${def.id} has no label`);
    assert.ok(
      SHAPE_CATEGORIES.some((c) => c.id === def.category),
      `${def.id} sits on a shelf that does not exist`
    );
    assert.equal(getShape(def.id), def);
  }
  // A search box over six elements is furniture; over this many it is a library.
  assert.ok(
    SHAPE_CATALOG.length >= 20,
    `the library is too thin to be worth a search box (${SHAPE_CATALOG.length})`
  );
});

test("no shelf of the panel is empty", () => {
  for (const category of SHAPE_CATEGORIES) {
    assert.ok(
      SHAPE_CATALOG.some((def) => def.category === category.id),
      `${category.id} has nothing on it`
    );
  }
});

test("an element draws inside the box it is given", () => {
  for (const def of SHAPE_CATALOG) {
    const values = allNumbers(def);
    assert.ok(values.length > 0, `${def.id} has no geometry`);
    for (const value of values) {
      assert.ok(Number.isFinite(value), `${def.id} has a broken coordinate`);
    }
    for (let i = 0; i < values.length; i += 2) {
      assert.ok(
        values[i] >= -EPS && values[i] <= W + EPS,
        `${def.id} escapes its box on x`
      );
      assert.ok(
        values[i + 1] >= -EPS && values[i + 1] <= H + EPS,
        `${def.id} escapes its box on y`
      );
    }
  }
});

test("a filled element is closed and a line is left open", () => {
  for (const def of SHAPE_CATALOG) {
    const closed = def.path(W, H).some((c) => c.c === "Z");
    // Filling an open run paints a region the user never drew, and closing a
    // line puts a stroke across the gap it was meant to leave.
    assert.equal(
      closed,
      def.mode === "fill",
      `${def.id} is a ${def.mode} but ${closed ? "closes" : "stays open"}`
    );
  }
});

test("a line knows how thick it is", () => {
  for (const def of SHAPE_CATALOG) {
    if (def.mode !== "stroke") continue;
    assert.ok(
      (def.strokeRatio ?? 0) > 0,
      `${def.id} would be inserted with no weight at all`
    );
  }
});

test("geometry scales with the box, so a tile is the page in miniature", () => {
  for (const def of SHAPE_CATALOG) {
    const small = def.path(100, 100).flatMap(numbers);
    const large = def.path(300, 300).flatMap(numbers);
    assert.equal(large.length, small.length, `${def.id} changes shape with size`);
    small.forEach((value, i) => {
      assert.ok(
        Math.abs(value * 3 - large[i]) < 1e-6,
        `${def.id} does not scale linearly`
      );
    });
  }
});

test("an element we stopped shipping has no geometry to draw", () => {
  assert.equal(getShape("no-such-element"), null);
});

test("pathD is an SVG path, not a description of one", () => {
  for (const def of SHAPE_CATALOG) {
    const d = shapePathD(def, W, H);
    assert.match(d, /^M/, `${def.id} does not start with a move`);
    assert.ok(!/NaN|Infinity|undefined|null/.test(d), `${def.id} produced garbage`);
    assert.ok(d.length > 8, `${def.id} produced a path too short to draw`);
  }
});
