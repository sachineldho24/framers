/**
 * Canva's text Effects: Shadow, Lift, Hollow, Splice, Echo, Glitch, Neon and
 * Background — the same eight, with the same controls.
 *
 * Every effect is one record with the same fields; each kind reads the subset
 * it needs (`EFFECT_CONTROLS` says which). One shape keeps the document schema,
 * the reducer and the panel simple, and switching effect keeps the colour the
 * user already picked.
 *
 * All sliders are 0–100 and are turned into pixels here, as fractions of the
 * font size — so an effect scales with its text, and the print file (drawn at a
 * different scale from the screen) looks the same as the preview.
 *
 * Pure: the canvas half is `drawTextLayer` in `render.ts`.
 */

export type TextEffectKind =
  | "none"
  | "shadow"
  | "lift"
  | "hollow"
  | "splice"
  | "echo"
  | "glitch"
  | "neon"
  | "background";

export interface TextEffect {
  kind: TextEffectKind;
  /** Effect colour: shadow, splice fill, echo, background. */
  color: string;
  /** 0–100. Distance of a shadow, splice or echo. */
  offset: number;
  /** Degrees, 0 = to the right, 90 = straight down. */
  direction: number;
  /** 0–100. */
  blur: number;
  /** 0–100; 0 is opaque. */
  transparency: number;
  /** 0–100. Outline weight for Hollow and Splice. */
  thickness: number;
  /** 0–100. Lift and Neon strength. */
  intensity: number;
  /** 0–100. Background corner rounding. */
  roundness: number;
  /** 0–100. Background padding around the words. */
  spread: number;
  /** Glitch colour pair. */
  glitchPair: "blue-red" | "cyan-magenta";
}

export type EffectNumberKey =
  | "offset"
  | "direction"
  | "blur"
  | "transparency"
  | "thickness"
  | "intensity"
  | "roundness"
  | "spread";

const BASE: TextEffect = {
  kind: "none",
  color: "#000000",
  offset: 50,
  direction: 45,
  blur: 0,
  transparency: 60,
  thickness: 50,
  intensity: 50,
  roundness: 50,
  spread: 50,
  glitchPair: "blue-red",
};

/** Canva-like starting values for each effect. */
export const EFFECT_DEFAULTS: Record<TextEffectKind, TextEffect> = {
  none: BASE,
  shadow: { ...BASE, kind: "shadow", offset: 50, direction: 45, blur: 0, transparency: 60 },
  lift: { ...BASE, kind: "lift", intensity: 50 },
  hollow: { ...BASE, kind: "hollow", thickness: 50 },
  splice: { ...BASE, kind: "splice", thickness: 50, offset: 50, direction: 45, color: "#808080" },
  echo: { ...BASE, kind: "echo", offset: 50, direction: 45, color: "#808080" },
  glitch: { ...BASE, kind: "glitch", offset: 30, direction: 90, glitchPair: "blue-red" },
  neon: { ...BASE, kind: "neon", intensity: 50 },
  background: { ...BASE, kind: "background", roundness: 50, spread: 50, transparency: 0, color: "#ffeb3b" },
};

export const EFFECT_ORDER: TextEffectKind[] = [
  "none",
  "shadow",
  "lift",
  "hollow",
  "splice",
  "echo",
  "glitch",
  "neon",
  "background",
];

export const EFFECT_LABELS: Record<TextEffectKind, string> = {
  none: "None",
  shadow: "Shadow",
  lift: "Lift",
  hollow: "Hollow",
  splice: "Splice",
  echo: "Echo",
  glitch: "Glitch",
  neon: "Neon",
  background: "Background",
};

export interface EffectControl {
  key: EffectNumberKey;
  label: string;
  min: number;
  max: number;
  suffix?: string;
}

const OFFSET: EffectControl = { key: "offset", label: "Offset", min: 0, max: 100 };
const DIRECTION: EffectControl = { key: "direction", label: "Direction", min: -180, max: 180, suffix: "°" };
const BLUR: EffectControl = { key: "blur", label: "Blur", min: 0, max: 100 };
const TRANSPARENCY: EffectControl = { key: "transparency", label: "Transparency", min: 0, max: 100 };
const THICKNESS: EffectControl = { key: "thickness", label: "Thickness", min: 0, max: 100 };
const INTENSITY: EffectControl = { key: "intensity", label: "Intensity", min: 0, max: 100 };

/** Which sliders each effect shows, in Canva's order. */
export const EFFECT_CONTROLS: Record<TextEffectKind, EffectControl[]> = {
  none: [],
  shadow: [OFFSET, DIRECTION, BLUR, TRANSPARENCY],
  lift: [INTENSITY],
  hollow: [THICKNESS],
  splice: [THICKNESS, OFFSET, DIRECTION],
  echo: [OFFSET, DIRECTION],
  glitch: [OFFSET, DIRECTION],
  neon: [INTENSITY],
  background: [
    { key: "roundness", label: "Roundness", min: 0, max: 100 },
    { key: "spread", label: "Spread", min: 0, max: 100 },
    TRANSPARENCY,
  ],
};

/** Effects with a colour of their own (the rest derive it from the text). */
export const EFFECT_HAS_COLOR: Record<TextEffectKind, boolean> = {
  none: false,
  shadow: true,
  lift: false,
  hollow: false,
  splice: true,
  echo: true,
  glitch: false,
  neon: false,
  background: true,
};

export const GLITCH_PAIRS: Record<TextEffect["glitchPair"], [string, string]> = {
  "blue-red": ["#00a8ff", "#ff1744"],
  "cyan-magenta": ["#00fff0", "#ff00e6"],
};

function clampNum(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Anything from storage → a valid effect, or undefined for none. */
export function coerceTextEffect(value: unknown): TextEffect | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<TextEffect>;
  const kind = EFFECT_ORDER.includes(v.kind as TextEffectKind) ? (v.kind as TextEffectKind) : "none";
  if (kind === "none") return undefined;
  const d = EFFECT_DEFAULTS[kind];
  return {
    kind,
    color: typeof v.color === "string" && HEX.test(v.color) ? v.color : d.color,
    offset: clampNum(v.offset, d.offset, 0, 100),
    direction: clampNum(v.direction, d.direction, -180, 180),
    blur: clampNum(v.blur, d.blur, 0, 100),
    transparency: clampNum(v.transparency, d.transparency, 0, 100),
    thickness: clampNum(v.thickness, d.thickness, 0, 100),
    intensity: clampNum(v.intensity, d.intensity, 0, 100),
    roundness: clampNum(v.roundness, d.roundness, 0, 100),
    spread: clampNum(v.spread, d.spread, 0, 100),
    glitchPair: v.glitchPair === "cyan-magenta" ? "cyan-magenta" : "blue-red",
  };
}

/** Switch effect, keeping the colour the user already chose where it applies. */
export function switchEffect(current: TextEffect | undefined, kind: TextEffectKind): TextEffect | undefined {
  if (kind === "none") return undefined;
  const next = { ...EFFECT_DEFAULTS[kind] };
  if (current && EFFECT_HAS_COLOR[current.kind] && EFFECT_HAS_COLOR[kind]) next.color = current.color;
  return next;
}

/* ------------------------------------------------------------ slider → px */

export function effectOffsetPx(effect: TextEffect, fontSizePx: number): { dx: number; dy: number } {
  const distance = (effect.offset / 100) * fontSizePx * 0.25;
  const rad = (effect.direction * Math.PI) / 180;
  return { dx: Math.cos(rad) * distance, dy: Math.sin(rad) * distance };
}

export function effectBlurPx(effect: TextEffect, fontSizePx: number): number {
  return (effect.blur / 100) * fontSizePx * 0.5;
}

/** Outline weight for Hollow/Splice. Never zero — a zero outline is invisible text. */
export function effectThicknessPx(effect: TextEffect, fontSizePx: number): number {
  return Math.max(1, (effect.thickness / 100) * fontSizePx * 0.08);
}

export function effectAlpha(effect: TextEffect): number {
  return 1 - effect.transparency / 100;
}

/** `#rrggbb` + alpha → `rgba(...)`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  if (!HEX.test(hex) || Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}
