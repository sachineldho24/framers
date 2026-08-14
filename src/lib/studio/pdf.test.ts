import assert from "node:assert/strict";
import { test } from "node:test";

import { buildImagePdf, mmToPoints, POINTS_PER_INCH } from "./pdf.ts";

/**
 * A PDF is only useful if a reader can parse it, and the part that breaks
 * silently is the cross-reference table: wrong offsets still *look* like a file.
 * So these tests read the xref back and follow it, rather than only checking that
 * some expected text appears somewhere.
 */

/** Stand-in for encoder output: the bytes only have to survive the round trip. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x0a, 0x28,
  0x29, 0x5c, 0xff, 0xd9,
]);

function pdf(overrides: Partial<Parameters<typeof buildImagePdf>[0]> = {}) {
  return buildImagePdf({
    jpeg: JPEG,
    pixelWidth: 2480,
    pixelHeight: 3508,
    widthMm: 210,
    heightMm: 297,
    ...overrides,
  });
}

function text(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

test("millimetres become points at 72 to the inch", () => {
  assert.equal(mmToPoints(25.4), POINTS_PER_INCH);
  // A4's long edge is the number every print shop recognises.
  assert.ok(Math.abs(mmToPoints(297) - 841.89) < 0.01);
});

test("the file is a PDF at both ends", () => {
  const out = text(pdf());
  assert.ok(out.startsWith("%PDF-1.4\n"));
  assert.ok(out.trimEnd().endsWith("%%EOF"));
});

test("the page carries its physical size, not its pixel count", () => {
  const out = text(pdf());
  // A4 in points, which is what makes the file unambiguous.
  assert.match(out, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.doesNotMatch(out, /\/MediaBox \[0 0 2480 3508\]/);
});

test("the pixel dimensions travel with the image object", () => {
  const out = text(pdf());
  assert.match(out, /\/Width 2480 \/Height 3508/);
  assert.match(out, /\/Filter \/DCTDecode/);
});

test("the JPEG is embedded byte for byte", () => {
  const bytes = pdf();
  // Locating it by its own signature rather than by an offset we computed the
  // same way the writer did.
  let at = -1;
  for (let i = 0; i + JPEG.length <= bytes.length; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
      at = i;
      break;
    }
  }
  assert.ok(at > 0, "no JPEG found");
  assert.deepEqual(bytes.slice(at, at + JPEG.length), JPEG);
});

test("every xref offset lands on the object it claims", () => {
  const out = text(pdf());
  const startxref = /startxref\n(\d+)\n/.exec(out);
  assert.ok(startxref);
  const xrefAt = Number(startxref[1]);
  assert.equal(out.slice(xrefAt, xrefAt + 4), "xref");

  const table = out.slice(xrefAt);
  const entries = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
    Number(m[1])
  );
  assert.equal(entries.length, 6);
  entries.forEach((offset, index) => {
    assert.equal(
      out.slice(offset, offset + `${index + 1} 0 obj`.length),
      `${index + 1} 0 obj`,
      `object ${index + 1}`
    );
  });
});

test("the declared stream length is the JPEG's real length", () => {
  const declared = /\/Length (\d+) >>\nstream/.exec(text(pdf()));
  assert.ok(declared);
  assert.equal(Number(declared[1]), JPEG.length);
});

test("the content stream scales the image to the page", () => {
  const out = text(pdf());
  assert.match(out, /595\.28 0 0 841\.89 0 0 cm\n\/Im0 Do/);
});

test("the content stream's declared length matches its bytes", () => {
  const out = text(pdf());
  // The second stream in the file is the page content; a length that disagreed
  // with the bytes is the classic way a PDF opens blank in one reader only.
  const object = /5 0 obj\n<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/.exec(
    out
  );
  assert.ok(object);
  assert.equal(object[2].length, Number(object[1]));
});

test("the trailer's size agrees with the table it points at", () => {
  const out = text(pdf());
  const header = /xref\n0 (\d+)\n/.exec(out);
  const trailer = /\/Size (\d+) \/Root 1 0 R \/Info 6 0 R/.exec(out);
  assert.ok(header && trailer);
  assert.equal(header[1], trailer[1]);
  assert.equal(Number(header[1]), 7); // six objects plus the free entry
});

test("a title with parentheses can't run off the end of a string", () => {
  const out = text(pdf({ title: "Ravi's (best) \\ poster" }));
  assert.match(out, /\/Title \(Ravi's \\\(best\\\) \\\\ poster\)/);
  // The escaping must not have moved anything: the xref is still valid.
  const startxref = /startxref\n(\d+)\n/.exec(out);
  assert.ok(startxref);
  assert.equal(out.slice(Number(startxref[1]), Number(startxref[1]) + 4), "xref");
});

test("a non-ASCII title degrades to metadata we can actually write", () => {
  const out = text(pdf({ title: "ചിത്രം poster" }));
  assert.match(out, /\/Title \(\s*poster\)/);
});

test("an empty title still yields a named document", () => {
  assert.match(text(pdf({ title: "   " })), /\/Title \(Framers design\)/);
});

test("a landscape page is landscape in the file", () => {
  const out = text(pdf({ widthMm: 297, heightMm: 210 }));
  assert.match(out, /\/MediaBox \[0 0 841\.89 595\.28\]/);
});
