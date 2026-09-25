/**
 * Font combinations — Canva's styled text presets ("Seasonal Exclusives",
 * "BOLD moves", "BOO!"…): two or three lines in contrasting faces, sized,
 * coloured and given an effect so they read as one lockup.
 *
 * Inserted as ordinary text layers (the studio has no groups), stacked and
 * centred on the page, so every line stays editable on its own. Sizes are
 * fractions of the page's short edge, like the plain text presets, so a combo
 * is the same proportion on A5 and on A2.
 */

import type { StudioDocument, TextLayer } from "./document";
import { createId, createTextLayer } from "./document";
import { getFont } from "./fonts";
import { DEFAULT_LINE_HEIGHT } from "./text";
import { EFFECT_DEFAULTS, type TextEffect, type TextEffectKind } from "./textEffects";
import { textLayerHeight, textLayerWidth } from "./textMeasure";

export interface ComboLine {
  text: string;
  fontId: string;
  fontWeight?: number;
  /** Font size as a fraction of the page's short edge. */
  scale: number;
  color: string;
  uppercase?: boolean;
  italic?: boolean;
  /** Fraction of the font size. */
  letterSpacing?: number;
  lineHeight?: number;
  strokeColor?: string;
  /** Fraction of the font size. */
  strokeWidth?: number;
  effect?: Partial<TextEffect> & { kind: TextEffectKind };
  rotation?: number;
  /**
   * Space above this line, as a fraction of its font size. Negative overlaps
   * the line above — the tucked-in script over caps that combos are made of.
   */
  gap?: number;
}

export interface TextCombo {
  id: string;
  /** Mood tags, for search. */
  tags: string;
  /** Background for the preview tile, chosen so the combo reads on it. */
  tile: string;
  lines: ComboLine[];
}

const fx = (kind: TextEffectKind, extra: Partial<TextEffect> = {}) => ({ kind, ...extra });

export const TEXT_COMBOS: TextCombo[] = [
  {
    id: "seasonal-exclusives",
    tags: "sale fashion elegant script seasonal",
    tile: "#1b1b22",
    lines: [
      { text: "Seasonal", fontId: "great-vibes", scale: 0.12, color: "#ffffff", effect: fx("shadow", { offset: 20, blur: 40, transparency: 40 }) },
      { text: "Exclusives", fontId: "bebas-neue", scale: 0.1, color: "#ffffff", uppercase: true, letterSpacing: 0.08, strokeColor: "#1c5cff", strokeWidth: 0.03, gap: -0.35 },
    ],
  },
  {
    id: "bold-moves",
    tags: "bold brush sport energetic",
    tile: "#f4f1ea",
    lines: [
      { text: "BOLD", fontId: "permanent-marker", scale: 0.12, color: "#f2541b", rotation: -8 },
      { text: "moves", fontId: "kaushan-script", scale: 0.11, color: "#1d6fa3", rotation: -8, gap: -0.3 },
    ],
  },
  {
    id: "boo",
    tags: "halloween fun party comic",
    tile: "#2b1740",
    lines: [{ text: "BOO!", fontId: "luckiest-guy", scale: 0.2, color: "#ff9800", effect: fx("neon", { intensity: 40 }) }],
  },
  {
    id: "custom-paint",
    tags: "custom paint garage automotive grunge",
    tile: "#f4f1ea",
    lines: [
      { text: "Custom", fontId: "bebas-neue", scale: 0.1, color: "#6b6b6b", uppercase: true, letterSpacing: 0.05 },
      { text: "Paint", fontId: "rock-salt", scale: 0.1, color: "#f2541b", uppercase: true, gap: -0.1 },
    ],
  },
  {
    id: "spooky",
    tags: "spooky halloween retro fun",
    tile: "#1d1d1d",
    lines: [{ text: "spooky", fontId: "shrikhand", scale: 0.14, color: "#c6ff00", effect: fx("echo", { color: "#ff6d00", offset: 40, direction: 45 }) }],
  },
  {
    id: "our-story",
    tags: "story wedding love script",
    tile: "#fdf6f0",
    lines: [
      { text: "our", fontId: "cinzel", scale: 0.05, color: "#9a7b6f", uppercase: true, letterSpacing: 0.4 },
      { text: "story", fontId: "pacifico", scale: 0.13, color: "#e84a5f", effect: fx("lift", { intensity: 40 }), gap: -0.1 },
    ],
  },
  {
    id: "big-sale",
    tags: "sale discount offer promo",
    tile: "#ffffff",
    lines: [
      { text: "Big sale", fontId: "anton", scale: 0.13, color: "#ffffff", uppercase: true, effect: fx("background", { color: "#e53935", spread: 40, roundness: 20 }) },
      { text: "up to 50% off", fontId: "montserrat", fontWeight: 700, scale: 0.04, color: "#111111", uppercase: true, letterSpacing: 0.2, gap: 0.6 },
    ],
  },
  {
    id: "neon-nights",
    tags: "neon night club glow party",
    tile: "#0b0b1a",
    lines: [
      { text: "Neon", fontId: "monoton", scale: 0.13, color: "#ff2bd6", effect: fx("neon", { intensity: 60 }) },
      { text: "Nights", fontId: "monoton", scale: 0.1, color: "#22d3ee", effect: fx("neon", { intensity: 60 }), gap: 0.1 },
    ],
  },
  {
    id: "save-the-date",
    tags: "wedding invitation save the date elegant",
    tile: "#fbf8f3",
    lines: [
      { text: "Save the", fontId: "cinzel", scale: 0.045, color: "#8c7a5b", uppercase: true, letterSpacing: 0.35 },
      { text: "Date", fontId: "allura", scale: 0.16, color: "#3d3d3d", gap: -0.15 },
    ],
  },
  {
    id: "game-on",
    tags: "gaming pixel retro arcade",
    tile: "#111111",
    lines: [
      { text: "Game on", fontId: "press-start-2p", scale: 0.07, color: "#ffffff", uppercase: true, effect: fx("glitch", { offset: 40, direction: 0 }) },
    ],
  },
  {
    id: "racing",
    tags: "racing car speed motorsport automotive",
    tile: "#0d0d0d",
    lines: [
      { text: "Full", fontId: "racing-sans-one", scale: 0.1, color: "#ff1f1f", italic: false, uppercase: true },
      { text: "Throttle", fontId: "orbitron", fontWeight: 900, scale: 0.075, color: "#ffffff", uppercase: true, letterSpacing: 0.1, effect: fx("shadow", { color: "#ff1f1f", offset: 30, direction: 90, blur: 30, transparency: 30 }), gap: 0 },
    ],
  },
  {
    id: "happy-birthday",
    tags: "birthday party celebration fun",
    tile: "#fff4e0",
    lines: [
      { text: "Happy", fontId: "lobster", scale: 0.11, color: "#ff5c8a" },
      { text: "Birthday", fontId: "fredoka", fontWeight: 700, scale: 0.08, color: "#6a2fd0", uppercase: true, letterSpacing: 0.05, gap: -0.05 },
    ],
  },
  {
    id: "hello-there",
    tags: "hello hollow outline modern",
    tile: "#fff7d6",
    lines: [{ text: "Hello", fontId: "abril-fatface", scale: 0.15, color: "#111111", effect: fx("splice", { color: "#ffb300", offset: 40, direction: 45, thickness: 40 }) }],
  },
  {
    id: "original-est",
    tags: "vintage badge classic brand est",
    tile: "#1f2a24",
    lines: [
      { text: "Original", fontId: "playfair-display", fontWeight: 700, scale: 0.1, color: "#e8dcc2", italic: true },
      { text: "Est. 2024", fontId: "bebas-neue", scale: 0.05, color: "#c9a24d", uppercase: true, letterSpacing: 0.5, gap: 0.2 },
    ],
  },
  {
    id: "good-vibes",
    tags: "vibes summer retro groovy",
    tile: "#ffe7c2",
    lines: [
      { text: "Good", fontId: "righteous", scale: 0.1, color: "#ff6f3c", effect: fx("echo", { color: "#2ec4b6", offset: 30, direction: 45 }) },
      { text: "Vibes", fontId: "righteous", scale: 0.1, color: "#ff6f3c", effect: fx("echo", { color: "#2ec4b6", offset: 30, direction: 45 }), gap: -0.1 },
    ],
  },
  {
    id: "hand-lettered",
    tags: "handwritten note quote casual",
    tile: "#fdfbf5",
    lines: [
      { text: "you are", fontId: "amatic-sc", fontWeight: 700, scale: 0.06, color: "#2d3142", uppercase: true, letterSpacing: 0.15 },
      { text: "enough", fontId: "dancing-script", fontWeight: 700, scale: 0.12, color: "#2d3142", gap: -0.15 },
    ],
  },
  {
    id: "street",
    tags: "street urban hollow bold",
    tile: "#e9e9e9",
    lines: [
      { text: "Street", fontId: "bungee", scale: 0.1, color: "#111111", uppercase: true, effect: fx("hollow", { thickness: 45 }) },
      { text: "Culture", fontId: "bungee", scale: 0.1, color: "#111111", uppercase: true, gap: -0.05 },
    ],
  },
  {
    id: "luxe",
    tags: "luxury gold elegant premium",
    tile: "#111111",
    lines: [
      { text: "Luxe", fontId: "bodoni-moda", fontWeight: 700, scale: 0.14, color: "#d4af37", italic: true },
      { text: "Collection", fontId: "montserrat", fontWeight: 400, scale: 0.035, color: "#f5f5f5", uppercase: true, letterSpacing: 0.6, gap: 0.2 },
    ],
  },
];

/**
 * The text layers for one combo, measured and stacked, centred on the page.
 * Measurement needs a canvas; without one (SSR) sizes fall back to estimates
 * that the first edit corrects, exactly as the plain presets do.
 */
export function createComboLayers(doc: StudioDocument, combo: TextCombo): TextLayer[] {
  const shortEdge = Math.min(doc.width, doc.height);
  const maxWidth = doc.width * 0.9;

  const measured = combo.lines.map((line) => {
    const fontSize = Math.round(shortEdge * line.scale);
    const metrics = {
      text: line.text,
      fontId: line.fontId,
      fontWeight: line.fontWeight ?? 400,
      italic: line.italic ?? false,
      fontSize,
      lineHeight: line.lineHeight ?? DEFAULT_LINE_HEIGHT,
      letterSpacing: line.letterSpacing ?? 0,
      uppercase: line.uppercase ?? false,
      width: maxWidth,
    };
    const estimate = Math.min(maxWidth, Math.max(fontSize * 2, line.text.length * fontSize * 0.62));
    // A little slack, so a face that lands slightly wider than measured
    // doesn't wrap its last word.
    const width = Math.min(maxWidth, (textLayerWidth(metrics, maxWidth) ?? estimate) * 1.04);
    const height = textLayerHeight(metrics, { width }) ?? fontSize * metrics.lineHeight;
    return { line, metrics, width, height, gap: (line.gap ?? 0) * fontSize };
  });

  const total = measured.reduce((sum, m, i) => sum + m.height + (i > 0 ? m.gap : 0), 0);
  // One lockup, one group: clicking any line selects them all, as in Canva.
  const groupId = measured.length > 1 ? createId("grp") : undefined;
  let y = (doc.height - total) / 2;

  return measured.map((m, i) => {
    if (i > 0) y += m.gap;
    const base = createTextLayer({
      text: m.line.text,
      x: (doc.width - m.width) / 2,
      y,
      width: m.width,
      height: m.height,
      fontSize: m.metrics.fontSize,
      fontId: m.line.fontId,
      fontWeight: m.metrics.fontWeight,
      align: "center",
      color: m.line.color,
      uppercase: m.metrics.uppercase,
    });
    y += m.height;
    const effect = m.line.effect
      ? { ...EFFECT_DEFAULTS[m.line.effect.kind], ...m.line.effect }
      : undefined;
    return {
      ...base,
      italic: m.metrics.italic && getFont(m.line.fontId).italic,
      letterSpacing: m.metrics.letterSpacing,
      lineHeight: m.metrics.lineHeight,
      rotation: m.line.rotation ?? 0,
      ...(groupId ? { groupId } : {}),
      ...(m.line.strokeWidth ? { strokeWidth: m.line.strokeWidth, strokeColor: m.line.strokeColor ?? "#000000" } : {}),
      ...(effect && effect.kind !== "none" ? { effect } : {}),
    };
  });
}
