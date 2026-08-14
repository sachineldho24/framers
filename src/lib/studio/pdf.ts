/**
 * A minimal PDF writer, for one purpose: wrap the rendered page in a file that
 * states its own physical size.
 *
 * Why this exists at all, when we already produce a PNG. A raster file has no
 * units — 2480 × 3508 pixels is A4 at 300 DPI or a billboard, depending on what
 * the person at the other end assumes. Every print shop asks for a PDF because
 * its `/MediaBox` is in points, so the paper size is a fact in the file rather
 * than a note in an email. Same pixels, no reinterpretation.
 *
 * Zero dependencies, deliberately (see CLAUDE.md). That's affordable because the
 * document is one page holding one image: the JPEG is embedded *as* the JPEG,
 * with `/DCTDecode` telling the reader it is already compressed, so there is no
 * encoder here — only the object graph and the byte offsets around it.
 *
 * Pure: bytes in, bytes out, no DOM. `export.ts` is what renders the page and
 * hands the JPEG over.
 */

import { MM_PER_INCH } from "./document";

/** PostScript points per inch — the unit `/MediaBox` is written in. */
export const POINTS_PER_INCH = 72;

export interface PdfImagePage {
  /** Baseline JPEG bytes, exactly as the encoder produced them. */
  jpeg: Uint8Array;
  /** The JPEG's pixel dimensions. */
  pixelWidth: number;
  pixelHeight: number;
  /** Finished physical size. This is the whole point of the format. */
  widthMm: number;
  heightMm: number;
  /** Shown in a reader's document properties. */
  title?: string;
}

export function mmToPoints(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}

/** Trim to 2 dp: PDF numbers are text, and 14 digits of float noise is waste. */
function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Escape a string for a PDF literal. Unbalanced parens or a stray backslash in a
 * document title would otherwise end the string early and corrupt the file.
 */
function literal(text: string): string {
  return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/**
 * PDF strings are byte strings; anything outside ASCII has no agreed meaning in a
 * literal, so non-ASCII is dropped from the title rather than written as
 * mojibake. The title is metadata, not content — the artwork is unaffected.
 */
function asciiOnly(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, "");
}

function latin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * Build a single-page PDF containing `page.jpeg` scaled to fill the page.
 *
 * The cross-reference table needs each object's byte offset, so the file is
 * assembled as a list of chunks with a running total rather than as one string —
 * a string would also mangle the JPEG, since its bytes are not text.
 */
export function buildImagePdf(page: PdfImagePage): Uint8Array {
  const widthPt = mmToPoints(page.widthMm);
  const heightPt = mmToPoints(page.heightMm);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? latin1(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };

  /** Record where this object starts, then write its header. */
  const beginObject = (id: number, dict: string) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${dict}\n`);
  };

  // 1.4 is the oldest version with everything used here, which keeps the file
  // openable by the widest range of print RIPs. The binary comment on line 2 is
  // the convention that stops naive tools treating it as text and rewriting the
  // line endings — which would break every offset in the xref.
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

  beginObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  push("endobj\n");

  beginObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  push("endobj\n");

  beginObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(widthPt)} ${num(
      heightPt
    )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  );
  push("endobj\n");

  // The image itself. `/DCTDecode` hands the JPEG to the reader untouched;
  // DeviceRGB matches what a canvas produces (a browser never writes CMYK).
  beginObject(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${
      page.pixelHeight
    } /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${
      page.jpeg.length
    } >>`
  );
  push("stream\n");
  push(page.jpeg);
  push("\nendstream\nendobj\n");

  // `cm` maps the unit square the image is drawn into onto the whole page, so
  // the pixels land at exactly the page size — the scale is the mm, not the DPI.
  const content = `q\n${num(widthPt)} 0 0 ${num(heightPt)} 0 0 cm\n/Im0 Do\nQ\n`;
  beginObject(5, `<< /Length ${content.length} >>`);
  push(`stream\n${content}endstream\n`);
  push("endobj\n");

  const title = asciiOnly(page.title?.trim() || "Framers design");
  beginObject(
    6,
    `<< /Title ${literal(title)} /Producer ${literal(
      "Framers Studio"
    )} /Creator ${literal("Framers Studio")} >>`
  );
  push("endobj\n");

  // xref: one 20-byte line per object, byte offsets into the file above.
  const xrefOffset = length;
  const count = 7; // objects 1–6 plus the mandatory free entry 0
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(
    `trailer\n<< /Size ${count} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
