"use client";

/**
 * Measuring text the way the renderer will draw it.
 *
 * `drawTextLayer` recomputes layout at the drawn scale on every frame, which is
 * what keeps preview and print identical — it never needs a stored height. But
 * a *selection box* does: the handles, the hit test and the edit overlay all
 * need to know how tall the words came out before the next paint. That is why
 * `setText`/`setTextStyle`/`setLayerBox` all take an optional `height`, and this
 * module is the only thing that can supply it.
 *
 * It measures through the same `layoutText` + `makeMeasure` pair the renderer
 * uses, at the document's own scale (scale 1), so the box the user drags always
 * matches the glyphs they see. Anything measured before the webfont lands is a
 * fallback-face estimate; it is corrected by the next edit, which is why nothing
 * durable is derived from it.
 */

import type { TextLayer } from "./document";
import { fontShorthand } from "./fonts";
import { makeMeasure, spacingModeFor } from "./render";
import type { AnyCtx } from "./strokes";
import { layoutText, type TextLayout } from "./text";

/** The fields a layout depends on — so callers can measure a pending edit. */
export type TextMetrics = Pick<
  TextLayer,
  | "text"
  | "fontId"
  | "fontWeight"
  | "italic"
  | "fontSize"
  | "lineHeight"
  | "letterSpacing"
  | "uppercase"
  | "width"
>;

/**
 * One offscreen context for the whole session. Creating a canvas per keystroke
 * would allocate a backing store each time; all we ever touch here is `font`
 * and `measureText`, so a 1×1 surface is enough.
 */
let shared: AnyCtx | null = null;

function measureCtx(): AnyCtx | null {
  if (shared) return shared;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  shared = canvas.getContext("2d");
  return shared;
}

/**
 * Lay out a text layer at document scale, or `null` where there is no canvas
 * (SSR). Pass `patch` to measure an edit that hasn't been applied yet.
 */
export function layoutTextLayer(
  layer: TextMetrics,
  patch: Partial<TextMetrics> = {}
): TextLayout | null {
  const ctx = measureCtx();
  if (!ctx) return null;

  const next = { ...layer, ...patch };
  ctx.font = fontShorthand({
    fontId: next.fontId,
    weight: next.fontWeight,
    italic: next.italic,
    sizePx: next.fontSize,
  });

  const spacingPx = next.letterSpacing * next.fontSize;
  const mode = spacingModeFor(ctx, spacingPx);
  if (mode === "native") {
    (ctx as CanvasRenderingContext2D).letterSpacing = `${spacingPx}px`;
  }

  const layout = layoutText({
    text: next.text,
    maxWidth: next.width,
    fontSize: next.fontSize,
    lineHeight: next.lineHeight,
    uppercase: next.uppercase,
    measure: makeMeasure(ctx, spacingPx, mode),
  });

  // Reset, or the next measurement inherits this layer's spacing.
  if (mode === "native") {
    (ctx as CanvasRenderingContext2D).letterSpacing = "0px";
  }
  return layout;
}

/**
 * The height the words need, or `undefined` when it can't be measured — the
 * reducer's `height` is optional precisely so an unmeasurable edit leaves the
 * stored box alone rather than collapsing it to zero.
 */
export function textLayerHeight(
  layer: TextMetrics,
  patch: Partial<TextMetrics> = {}
): number | undefined {
  const layout = layoutTextLayer(layer, patch);
  if (!layout) return undefined;
  // At least one line: an empty box still has to be grabbable.
  return Math.max(layout.totalHeight, layout.lineHeightPx);
}

/**
 * The narrowest box that fits the text without wrapping, capped at `maxWidth`.
 * Used when inserting, so a heading starts sized to its own words instead of
 * spanning the page with one word per line.
 */
export function textLayerWidth(
  layer: TextMetrics,
  maxWidth: number
): number | undefined {
  const layout = layoutTextLayer(layer, { width: maxWidth });
  if (!layout) return undefined;
  return Math.min(maxWidth, Math.max(layout.maxLineWidth, layer.fontSize));
}
