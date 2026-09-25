import assert from "node:assert/strict";
import test from "node:test";

import { displayName, libraryPath, sha256Hex } from "./uploadLibrary.ts";

test("the same bytes always map to the same library path, so a repeat pick skips the upload", async () => {
  const a = await sha256Hex(new Blob([new Uint8Array([1, 2, 3])]));
  const b = await sha256Hex(new Blob([new Uint8Array([1, 2, 3])]));
  const c = await sha256Hex(new Blob([new Uint8Array([1, 2, 4])]));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(libraryPath("u1", a, "Holiday.JPG"), `u1/library/${a}.jpg`);
  assert.equal(libraryPath("u1", a, "Holiday.JPG"), libraryPath("u1", b, "other-name.jpg"));
});

test("library paths and names stay tidy", () => {
  assert.equal(libraryPath("u1", "ab", "weird.p n?g"), "u1/library/ab.png");
  assert.equal(libraryPath("u1", "ab", "noext"), "u1/library/ab.img");
  assert.equal(displayName("IMG_2041.jpeg"), "IMG_2041");
  assert.equal(displayName(".png"), "Image");
});
