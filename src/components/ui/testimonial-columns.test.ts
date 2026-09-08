import assert from "node:assert/strict";
import test from "node:test";

import { distributeTestimonials } from "./testimonial-columns.ts";

test("nine testimonials split into three even columns", () => {
  assert.deepEqual(distributeTestimonials([1, 2, 3, 4, 5, 6, 7, 8, 9], 3), [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]);
});

test("a tenth testimonial lands in a column instead of vanishing", () => {
  const columns = distributeTestimonials([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
  assert.deepEqual(columns.flat(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(columns.map((c) => c.length), [4, 3, 3]);
});

test("columns never differ by more than one card", () => {
  for (let count = 1; count <= 14; count += 1) {
    const items = Array.from({ length: count }, (_, i) => i);
    const sizes = distributeTestimonials(items, 3).map((c) => c.length);
    assert.equal(sizes.reduce((a, b) => a + b, 0), count, `total for ${count}`);
    assert.ok(
      Math.max(...sizes) - Math.min(...sizes) <= 1,
      `balanced for ${count}: ${sizes.join(",")}`
    );
  }
});

test("degenerate column counts still return every item", () => {
  assert.deepEqual(distributeTestimonials([1, 2], 1), [[1, 2]]);
  assert.deepEqual(distributeTestimonials([1, 2], 0), [[1, 2]]);
  assert.deepEqual(distributeTestimonials([], 3), [[], [], []]);
});
