import { test } from "node:test";
import assert from "node:assert/strict";

import { imageInfo } from "./imageInfo.ts";

function png(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number) {
  // SOI, an APP0 segment to skip, then SOF0 with the size.
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
}

function webpVp8x(width: number, height: number) {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 255, (w >> 8) & 255, (w >> 16) & 255], 24);
  b.set([h & 255, (h >> 8) & 255, (h >> 16) & 255], 27);
  return b;
}

test("reads PNG, JPEG and WebP sizes", () => {
  assert.deepEqual(imageInfo(png(3840, 2160)), { mime: "image/png", width: 3840, height: 2160 });
  assert.deepEqual(imageInfo(jpeg(1536, 1024)), { mime: "image/jpeg", width: 1536, height: 1024 });
  assert.deepEqual(imageInfo(webpVp8x(4096, 3000)), { mime: "image/webp", width: 4096, height: 3000 });
});

test("refuses what isn't a picture", () => {
  assert.equal(imageInfo(new TextEncoder().encode("<html><body>not an image at all</body></html>")), null);
  assert.equal(imageInfo(new Uint8Array(4)), null);
});
