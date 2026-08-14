"use client";

/**
 * The DOM half of the font catalogue.
 *
 * Canvas fails silently on a family the browser hasn't loaded: it substitutes
 * the default sans and draws happily, so the preview looks fine and the *print*
 * comes back in the wrong typeface. Everything here exists to stop that:
 *
 *   - `loadFont` injects the css2 stylesheet and then waits on
 *     `document.fonts.load`, which is the only signal that the face is
 *     actually available to `ctx.fillText`;
 *   - listeners are notified when a face lands, so the canvas repaints;
 *   - `waitForFonts` is awaited before export, so the print file can never be
 *     rendered with a fallback face.
 *
 * `fonts.ts` stays pure (and server-importable); this module touches the DOM.
 */

import type { StudioDocument } from "./document";
import { isTextLayer } from "./document";
import {
  FONT_CATALOGUE,
  fontCssUrlFor,
  fontShorthand,
  getFont,
  nearestWeight,
  type FontDefinition,
} from "./fonts";

/** Marks our <link> elements, so it's obvious in devtools who added them. */
const LINK_ATTR = "data-studio-fonts";

/** Families whose stylesheet is already in the document head. */
const linked = new Set<string>();
/** Load key → in-flight promise, so N layers on one family make one request. */
const inflight = new Map<string, Promise<void>>();
/** Load keys that resolved, and ones that failed (never retried on a loop). */
const settled = new Set<string>();
const failures = new Set<string>();

const listeners = new Set<() => void>();

/**
 * Subscribe to "a face arrived". The canvas uses this to repaint: a document
 * that referenced Anton before Anton loaded drew in the fallback, and nothing
 * else would invalidate it.
 */
export function onFontsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Inject one stylesheet covering whichever of these families isn't linked yet.
 * Batching matters: `fontCssUrlFor` sorts the families, so the same set always
 * produces the same URL and hits the HTTP cache.
 */
function ensureStylesheet(fonts: FontDefinition[]): void {
  if (typeof document === "undefined") return;
  const missing = fonts.filter((font) => !linked.has(font.id));
  if (missing.length === 0) return;

  const href = fontCssUrlFor(missing);
  if (!href) return;

  // Marked as linked before the request resolves — a second caller must not
  // queue a duplicate stylesheet while the first is still loading.
  missing.forEach((font) => linked.add(font.id));

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(LINK_ATTR, missing.map((font) => font.id).join(" "));
  document.head.appendChild(link);
}

/**
 * A bounded fingerprint of the scripts a string needs.
 *
 * css2 splits a family into unicode-range subsets and `document.fonts.load`
 * only fetches the subsets its sample text covers — so for Malayalam and
 * Devanagari the sample decides whether the glyphs arrive at all. Keying the
 * cache on the text itself would grow it per keystroke, so key on the 256-point
 * blocks instead: Malayalam is U+0D00–0D7F, Devanagari U+0900–097F, and one
 * character from a block is enough to pull that whole subset in.
 */
export function textSubsetKey(text: string): string {
  const blocks = new Set<number>();
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0x7f) blocks.add(cp >> 8);
  }
  return Array.from(blocks)
    .sort((a, b) => a - b)
    .map((block) => block.toString(16))
    .join(",");
}

export interface FontLoadOptions {
  /** Defaults to every weight the family ships. */
  weights?: number[];
  italic?: boolean;
  /** The text about to be drawn, so non-Latin subsets are fetched too. */
  text?: string;
}

/** Await the faces themselves. Resolves even when the network fails. */
async function loadFaces(
  font: FontDefinition,
  weights: number[],
  italic: boolean,
  text: string
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;

  const styles = italic && font.italic ? [true, false] : [false];
  const specs = styles.flatMap((isItalic) =>
    weights.map((weight) =>
      fontShorthand({
        fontId: font.id,
        weight,
        italic: isItalic,
        // Size is irrelevant to which file loads, but the shorthand needs one.
        sizePx: 32,
      })
    )
  );

  await Promise.all(
    specs.map((spec) =>
      // A bad spec rejects rather than throwing synchronously; either way the
      // fallback stack still draws, so one miss must not fail the batch.
      text ? document.fonts.load(spec, text) : document.fonts.load(spec)
    )
  );
}

/**
 * Make one family drawable. Idempotent and safe to call from a render path —
 * repeat calls for the same weight/script return the same promise.
 */
export function loadFont(
  fontId: string,
  options: FontLoadOptions = {}
): Promise<void> {
  const font = getFont(fontId);
  ensureStylesheet([font]);

  const requested = options.weights?.length ? options.weights : font.weights;
  // Snapped to weights the family actually ships: asking css2 for a missing
  // weight fails the whole stylesheet, taking the other weights with it.
  const weights = Array.from(
    new Set(requested.map((weight) => nearestWeight(font, weight)))
  ).sort((a, b) => a - b);
  const italic = options.italic === true && font.italic;
  const text = options.text ?? "";

  const key = `${font.id}|${weights.join("+")}|${italic ? "i" : "n"}|${textSubsetKey(text)}`;
  if (settled.has(key) || failures.has(key)) return Promise.resolve();
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = loadFaces(font, weights, italic, text)
    .then(() => {
      settled.add(key);
    })
    .catch(() => {
      // Recorded rather than retried: a render-path retry loop would hammer the
      // network, and the fallback stack keeps the text legible meanwhile.
      failures.add(key);
    })
    .then(() => {
      inflight.delete(key);
      notify();
    });

  inflight.set(key, task);
  return task;
}

/** Load exactly what this document's text layers need, and nothing else. */
export function loadDocumentFonts(doc: StudioDocument): Promise<void> {
  const requests = doc.layers.filter(isTextLayer).map((layer) =>
    loadFont(layer.fontId, {
      weights: [layer.fontWeight],
      italic: layer.italic,
      text: layer.text,
    })
  );
  return Promise.all(requests).then(() => undefined);
}

/**
 * The whole catalogue's stylesheet, for the picker's previews.
 *
 * Only the stylesheet: the previews are DOM, so CSS is all they need, and
 * `document.fonts.load` for 28 families would download megabytes to show a few
 * rows. The canvas path loads faces on demand instead.
 */
export function loadFontCatalogue(): void {
  ensureStylesheet(FONT_CATALOGUE);
}

/**
 * Await before rendering the print file. `document.fonts.ready` covers faces
 * requested by the DOM (the picker previews) as well as ours, so after this the
 * export cannot silently substitute a fallback.
 */
export async function waitForFonts(doc: StudioDocument): Promise<void> {
  await loadDocumentFonts(doc);
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.ready;
  } catch {
    /* Nothing to do — the fallback stack draws. */
  }
}

/** Forget failures so a reconnect can try again. */
export function retryFonts(): void {
  if (failures.size === 0) return;
  failures.clear();
  notify();
}
