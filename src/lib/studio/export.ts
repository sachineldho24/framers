/**
 * Export. Renders the document at full resolution through the same
 * `drawDocument` the screen uses, so the print file matches the preview.
 *
 * Browser-only (needs Image/Canvas/Blob); imported lazily by the client.
 */

import type { StudioDocument } from "./document";
import { isImageLayer, MAX_DOC_EDGE, MM_PER_INCH, PRINT_DPI } from "./document";
import { buildImagePdf } from "./pdf";
import { drawDocument, identityViewport, type ImageMap } from "./render";
import type { AnyCanvas } from "./strokes";

export type ExportType = "image/png" | "image/jpeg";

/**
 * What File → Download offers. PDF is not an `ExportType` because it is not
 * something a canvas can encode: it is a raster export with a physical size
 * wrapped around it, so it takes a different path (`renderToPdfBlob`).
 */
export type DownloadFormat = ExportType | "application/pdf";

export interface ExportOptions {
  type?: ExportType;
  /** JPEG quality, 0–1. Ignored for PNG. */
  quality?: number;
  /** Longest output edge in px. Defaults to the document's own size. */
  maxEdge?: number;
  /** PNG only. JPEG has no alpha, so the background is always painted. */
  transparent?: boolean;
  /**
   * Export a single layer instead of the whole document — used by
   * "Download selection". The layer is rendered at the document's scale with a
   * transparent background so it can be dropped onto another design.
   */
  layerId?: string;
}

function createCanvas(w: number, h: number): AnyCanvas {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Load one source into an <img>, decoded and ready to draw. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for `toBlob` on cross-origin sources (Supabase signed URLs).
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

/**
 * Resolve every layer source. `resolveSrc` maps a stored path to a loadable URL
 * (a signed URL, or a blob: URL already in memory).
 *
 * A layer whose image fails to load is skipped rather than failing the export —
 * losing one layer beats losing the whole file. Callers get the list back so
 * they can tell the user.
 */
export async function loadDocumentImages(
  doc: StudioDocument,
  resolveSrc: (src: string) => Promise<string> | string
): Promise<{ images: ImageMap; failed: string[] }> {
  const images: ImageMap = new Map();
  const failed: string[] = [];
  const unique = Array.from(
    new Set(doc.layers.filter(isImageLayer).map((l) => l.src))
  );

  await Promise.all(
    unique.map(async (src) => {
      try {
        const url = await resolveSrc(src);
        images.set(src, await loadImage(url));
      } catch {
        failed.push(src);
      }
    })
  );

  return { images, failed };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: ExportType,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the image.")),
      type,
      type === "image/jpeg" ? quality : undefined
    );
  });
}

/** Render the document to a canvas at `maxEdge`. */
export function renderToCanvas(
  doc: StudioDocument,
  images: ImageMap,
  options: ExportOptions = {}
): HTMLCanvasElement {
  const { maxEdge, transparent = false, type = "image/png", layerId } = options;

  const longest = Math.max(doc.width, doc.height);
  const cap = Math.min(maxEdge ?? longest, MAX_DOC_EDGE);
  const scale = cap / longest;

  const width = Math.max(1, Math.round(doc.width * scale));
  const height = Math.max(1, Math.round(doc.height * scale));

  const canvas = createCanvas(width, height) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  drawDocument(ctx, doc, {
    viewport: identityViewport(scale),
    surfaceWidth: width,
    surfaceHeight: height,
    images,
    createCanvas,
    // JPEG can't hold alpha; a transparent request would render black.
    drawBackground:
      layerId !== undefined ? false : type === "image/jpeg" ? true : !transparent,
    skipLayerId: layerId === undefined ? null : undefined,
    onlyLayerId: layerId,
    maskCache: new Map(),
  });

  return canvas;
}

/** Render and encode. This is what the print file and thumbnail both go through. */
export async function renderToBlob(
  doc: StudioDocument,
  images: ImageMap,
  options: ExportOptions = {}
): Promise<Blob> {
  const { type = "image/png", quality = 0.92 } = options;
  const canvas = renderToCanvas(doc, images, options);
  return canvasToBlob(canvas, type, quality);
}

export function renderToDataUrl(
  doc: StudioDocument,
  images: ImageMap,
  options: ExportOptions = {}
): string {
  const { type = "image/png", quality = 0.92 } = options;
  const canvas = renderToCanvas(doc, images, options);
  return canvas.toDataURL(type, type === "image/jpeg" ? quality : undefined);
}

export interface PdfExportOptions {
  /**
   * Finished print size. Omit it and the document is read as a 300 DPI page,
   * which is what `documentDpi` assumes without a frame — but pass it whenever
   * a frame size is known, because the grid is capped and a large frame is
   * therefore *below* 300 DPI. Getting this wrong is the one mistake a PDF can
   * still make: the pixels would be right and the paper size wrong.
   */
  widthMm?: number;
  heightMm?: number;
  /** JPEG quality for the embedded image. High by default; this is the print. */
  quality?: number;
  /** Document properties in the reader. */
  title?: string;
}

/**
 * Render the page and wrap it in a one-page PDF at its physical size.
 *
 * The image is JPEG rather than PNG because `/DCTDecode` lets the bytes go in
 * exactly as the encoder produced them — a PNG would have to be decoded and
 * re-encoded as a raw or Flate stream, which means shipping a deflate
 * implementation for no gain on photographic artwork.
 */
export async function renderToPdfBlob(
  doc: StudioDocument,
  images: ImageMap,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const { quality = 0.95, title } = options;
  const canvas = renderToCanvas(doc, images, { type: "image/jpeg" });
  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);

  // From the canvas, not the document: `renderToCanvas` clamps to
  // `MAX_DOC_EDGE`, and `/Width` must describe the bytes actually embedded.
  const pixelWidth = canvas.width;
  const pixelHeight = canvas.height;

  const widthMm = options.widthMm ?? (doc.width / PRINT_DPI) * MM_PER_INCH;
  const heightMm = options.heightMm ?? (doc.height / PRINT_DPI) * MM_PER_INCH;

  const bytes = buildImagePdf({
    jpeg: new Uint8Array(await jpeg.arrayBuffer()),
    pixelWidth,
    pixelHeight,
    widthMm,
    heightMm,
    title,
  });

  // Copy into a plain ArrayBuffer: `bytes.buffer` is typed as ArrayBufferLike,
  // which `BlobPart` does not accept under TS's stricter DOM types.
  return new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: "application/pdf",
  });
}

/** Trigger a browser download. Used by File → Download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick — Safari needs the URL alive through the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Filesystem-safe filename from the document title. */
export function exportFilename(title: string, type: DownloadFormat): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "framers-design";
  const extension =
    type === "image/jpeg" ? "jpg" : type === "application/pdf" ? "pdf" : "png";
  return `${slug}.${extension}`;
}

/** Thumbnail for review/orders. 800px is enough for every card we render. */
export const THUMBNAIL_MAX_EDGE = 800;
