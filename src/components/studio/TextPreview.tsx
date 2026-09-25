"use client";

/**
 * A small canvas that draws a throwaway document with the real renderer — for
 * the Effects tiles and the font-combination tiles.
 *
 * Drawn rather than imitated in CSS, because a CSS preview of "Neon" or
 * "Splice" would be a second implementation that drifts from the first; this
 * way the tile is exactly what lands on the page and in the print.
 *
 * `build` makes the document, and is re-run when a font arrives: text is
 * measured with whatever face is loaded, so a tile built before its font landed
 * would keep the fallback's line breaks.
 */

import { useEffect, useRef, useState } from "react";

import type { StudioDocument } from "@/lib/studio/document";
import { loadDocumentFonts, onFontsChanged } from "@/lib/studio/fontLoader";
import { boundingRect } from "@/lib/studio/geometry";
import { drawDocument } from "@/lib/studio/render";

const EMPTY_IMAGES = new Map();

export function TextPreview({
  build,
  width,
  height,
  className,
  label,
  fitContent = false,
}: {
  build: () => StudioDocument;
  /**
   * Zoom to the layers' own bounds instead of the whole page, so a lockup fills
   * its tile. The page background still fills the canvas.
   */
  fitContent?: boolean;
  /** CSS px. */
  width: number;
  height: number;
  className?: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => onFontsChanged(() => setRevision((n) => n + 1)), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const doc = build();
    void loadDocumentFonts(doc);

    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // The region to show: the page, or the layers' rotated bounds plus room
    // for effects (shadows, plates) that reach past the box.
    let region = { x: 0, y: 0, width: doc.width, height: doc.height };
    if (fitContent && doc.layers.length) {
      const boxes = doc.layers.map(boundingRect);
      const x0 = Math.min(...boxes.map((b) => b.x));
      const y0 = Math.min(...boxes.map((b) => b.y));
      const x1 = Math.max(...boxes.map((b) => b.x + b.width));
      const y1 = Math.max(...boxes.map((b) => b.y + b.height));
      const pad = Math.max(x1 - x0, y1 - y0) * 0.12;
      region = { x: x0 - pad, y: y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 };
    }
    const scale = Math.min(canvas.width / region.width, canvas.height / region.height);
    // Zoomed in, the page overfills the canvas, so its background still
    // reaches every edge.
    drawDocument(ctx, doc, {
      viewport: {
        scale,
        offsetX: (canvas.width - region.width * scale) / 2 - region.x * scale,
        offsetY: (canvas.height - region.height * scale) / 2 - region.y * scale,
      },
      surfaceWidth: canvas.width,
      surfaceHeight: canvas.height,
      images: EMPTY_IMAGES,
      createCanvas: (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      },
    });
    // Callers memoise `build`, so this redraws on a new font, size or content.
  }, [revision, width, height, build, fitContent]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={className}
      style={{ width, height }}
    />
  );
}
