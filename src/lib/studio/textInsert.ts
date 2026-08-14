"use client";

/**
 * Inserting a text box.
 *
 * Three presets rather than one, because "add text" with no size is a decision
 * pushed onto the user at the worst moment. The sizes are fractions of the
 * page's short edge, so a heading is a heading on A5 and on A2 — a fixed pixel
 * size would be a banner on one and a caption on the other.
 *
 * Shared by the Text panel, the Tools rail and the `T` shortcut so all three
 * insert the same thing.
 */

import type { StudioDocument, TextLayer } from "./document";
import { createTextLayer } from "./document";
import { DEFAULT_FONT_ID } from "./fonts";
import { DEFAULT_LINE_HEIGHT } from "./text";
import { textLayerHeight, textLayerWidth } from "./textMeasure";

export type TextPreset = "heading" | "subheading" | "body";

interface PresetSpec {
  label: string;
  /** What the box says before the user types over it. */
  text: string;
  /** Font size as a fraction of the page's short edge. */
  scale: number;
  fontWeight: number;
  uppercase: boolean;
  /** Preview size in the panel, in CSS px. */
  previewPx: number;
}

export const TEXT_PRESETS: Record<TextPreset, PresetSpec> = {
  heading: {
    label: "Add a heading",
    text: "Add a heading",
    scale: 0.085,
    fontWeight: 700,
    uppercase: true,
    previewPx: 22,
  },
  subheading: {
    label: "Add a subheading",
    text: "Add a subheading",
    scale: 0.05,
    fontWeight: 600,
    uppercase: false,
    previewPx: 16,
  },
  body: {
    label: "Add body text",
    text: "Add a little bit of body text",
    scale: 0.028,
    fontWeight: 400,
    uppercase: false,
    previewPx: 13,
  },
};

export const TEXT_PRESET_ORDER: TextPreset[] = ["heading", "subheading", "body"];

/**
 * A text layer centred on the page, sized to its own words.
 *
 * The box is measured rather than guessed: a heading given the full page width
 * would show a caret miles from the glyphs, and one given a guessed width would
 * wrap "heading" onto its own line. Where measurement isn't available (SSR, or
 * before the face lands) it falls back to a proportional estimate, which the
 * first edit corrects.
 */
export function createPresetTextLayer(
  doc: StudioDocument,
  preset: TextPreset,
  fontId?: string
): TextLayer {
  const spec = TEXT_PRESETS[preset];
  const shortEdge = Math.min(doc.width, doc.height);
  const fontSize = Math.round(shortEdge * spec.scale);
  const maxWidth = doc.width * 0.86;

  const metrics = {
    text: spec.text,
    fontId: fontId ?? DEFAULT_FONT_ID,
    fontWeight: spec.fontWeight,
    italic: false,
    fontSize,
    lineHeight: DEFAULT_LINE_HEIGHT,
    letterSpacing: 0,
    uppercase: spec.uppercase,
    width: maxWidth,
  };

  // 0.62 em per character is a middling average across the catalogue — only
  // used when there is no canvas to ask.
  const estimate = Math.min(
    maxWidth,
    Math.max(fontSize * 4, spec.text.length * fontSize * 0.62)
  );
  const width = textLayerWidth(metrics, maxWidth) ?? estimate;
  const height =
    textLayerHeight(metrics, { width }) ?? fontSize * DEFAULT_LINE_HEIGHT;

  return createTextLayer({
    text: spec.text,
    x: (doc.width - width) / 2,
    y: nextFreeY(doc, height),
    width,
    height,
    fontSize,
    fontId: fontId,
    fontWeight: spec.fontWeight,
    uppercase: spec.uppercase,
  });
}

/**
 * Centred, but stepped down while something already starts there — inserting
 * three headings in a row should give three readable boxes, not one stack that
 * looks like a single layer.
 */
function nextFreeY(doc: StudioDocument, height: number): number {
  const centred = (doc.height - height) / 2;
  const step = height * 0.75;
  let y = centred;
  for (let guard = 0; guard < 12; guard += 1) {
    const taken = doc.layers.some(
      (layer) => layer.kind === "text" && Math.abs(layer.y - y) < 2
    );
    if (!taken) break;
    y += step;
  }
  // Never past the bottom edge, however many are stacked up.
  return Math.min(y, Math.max(0, doc.height - height));
}
