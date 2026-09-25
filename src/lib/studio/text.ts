/**
 * Text layout — pure, so it can be unit-tested without a canvas.
 *
 * The renderer and the editor must agree on where every line sits, or the
 * on-screen caret drifts away from the printed glyphs. So all of the geometry
 * lives here and both callers use it: the only thing text layout needs from the
 * outside is a `measure` function, which the caller builds from whatever
 * context it has (`ctx.measureText`, at the right font, with letter-spacing
 * already accounted for).
 *
 * Passing `measure` in rather than reaching for a canvas also means the wrap
 * algorithm is testable with a fake metric — a monospace stub where every
 * character is 10 units wide makes the expected line breaks obvious.
 */

export type TextAlign = "left" | "center" | "right";

/** Paragraph markers. Absent / "none" = plain paragraphs. */
export type ListStyle = "none" | "bullet" | "number";

/**
 * Prefix each non-empty paragraph with its marker. Applied before wrapping, in
 * layout, so the canvas, the measurement and the print all agree on it; the
 * stored text stays clean, and typing never has to manage the markers.
 */
export function applyListMarkers(text: string, list: ListStyle | undefined): string {
  if (!list || list === "none") return text;
  let n = 0;
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((p) => {
      if (p.trim() === "") return p;
      n += 1;
      return list === "bullet" ? `\u2022 ${p}` : `${n}. ${p}`;
    })
    .join("\n");
}
export type VerticalAlign = "top" | "middle" | "bottom";

/** Width of a string *as it will be drawn*, including any letter-spacing. */
export type MeasureText = (text: string) => number;

export interface TextLine {
  text: string;
  width: number;
}

export interface TextLayout {
  lines: TextLine[];
  /** Distance between successive line tops, in the same units as `measure`. */
  lineHeightPx: number;
  /** `lines.length * lineHeightPx`. */
  totalHeight: number;
  maxLineWidth: number;
}

/**
 * Font size bounds, in doc px. The lower bound is a print concern as much as a
 * UI one: below ~6 pt nothing survives the press, and at 300 DPI 6 pt is 25 px.
 */
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 4000;

export const DEFAULT_LINE_HEIGHT = 1.2;
export const MIN_LINE_HEIGHT = 0.6;
export const MAX_LINE_HEIGHT = 3;

/** Letter-spacing is stored as a fraction of the font size so it survives scaling. */
export const MIN_LETTER_SPACING = -0.1;
export const MAX_LETTER_SPACING = 1;

/** Stroke width is likewise a fraction of the font size. */
export const MAX_STROKE_WIDTH = 0.25;

/** Uppercasing has to happen before measuring — it changes every width. */
export function transformText(text: string, uppercase: boolean): string {
  return uppercase ? text.toUpperCase() : text;
}

/**
 * Break one paragraph into lines that fit `maxWidth`.
 *
 * Greedy, longest-line-first, which is what every canvas editor does and what
 * users predict. A single word wider than the box is broken by character rather
 * than allowed to overflow, because overflowing text in a print document is
 * silently cropped at the page edge.
 */
function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  measure: MeasureText
): string[] {
  if (paragraph === "") return [""];

  const words = paragraph.split(/[ \t]+/).filter((w) => w !== "");
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current !== "") {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measure(candidate) <= maxWidth || current === "") {
      // Either it fits, or the line is empty and we must place something —
      // an over-wide word is dealt with by the character break below.
      current = candidate;
    } else {
      pushCurrent();
      current = word;
    }

    if (measure(current) > maxWidth) {
      // The line is a single over-wide word (or the box is narrower than one
      // glyph). Break it by code point, keeping at least one per line so this
      // can't loop forever.
      const chars = Array.from(current);
      let chunk = "";
      current = "";
      for (const ch of chars) {
        const next = chunk + ch;
        if (chunk !== "" && measure(next) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      current = chunk;
    }
  }

  pushCurrent();
  return lines.length > 0 ? lines : [""];
}

export interface LayoutTextParams {
  text: string;
  /** Box width in the same units as `measure` returns. */
  maxWidth: number;
  fontSize: number;
  /** Multiplier of `fontSize`. */
  lineHeight: number;
  uppercase: boolean;
  measure: MeasureText;
  list?: ListStyle;
}

/** Lay text out inside a box of `maxWidth`. Honours explicit newlines. */
export function layoutText(params: LayoutTextParams): TextLayout {
  const { measure, uppercase } = params;
  const maxWidth = Math.max(1, params.maxWidth);
  const fontSize = Math.max(1, params.fontSize);
  const lineHeightPx = fontSize * Math.max(MIN_LINE_HEIGHT, params.lineHeight);

  const source = transformText(applyListMarkers(params.text, params.list), uppercase);
  // Normalise line endings first so a document authored on Windows and one
  // authored on macOS lay out identically.
  const paragraphs = source.replace(/\r\n?/g, "\n").split("\n");

  const lines: TextLine[] = [];
  for (const paragraph of paragraphs) {
    for (const text of wrapParagraph(paragraph, maxWidth, measure)) {
      lines.push({ text, width: text === "" ? 0 : measure(text) });
    }
  }

  const maxLineWidth = lines.reduce((max, l) => Math.max(max, l.width), 0);
  return {
    lines,
    lineHeightPx,
    // An empty layer still occupies one line, so its selection box has a height
    // you can grab and its caret has somewhere to sit.
    totalHeight: Math.max(1, lines.length) * lineHeightPx,
    maxLineWidth,
  };
}

/** Left edge of a line within the box. */
export function alignOffsetX(
  lineWidth: number,
  boxWidth: number,
  align: TextAlign
): number {
  switch (align) {
    case "center":
      return (boxWidth - lineWidth) / 2;
    case "right":
      return boxWidth - lineWidth;
    default:
      return 0;
  }
}

/**
 * Top of the text block within the box.
 *
 * Deliberately *not* clamped: a block taller than its box should overhang
 * symmetrically when centred rather than snap to the top, which is what the
 * user sees while they drag a side handle inward.
 */
export function alignOffsetY(
  totalHeight: number,
  boxHeight: number,
  verticalAlign: VerticalAlign
): number {
  switch (verticalAlign) {
    case "middle":
      return (boxHeight - totalHeight) / 2;
    case "bottom":
      return boxHeight - totalHeight;
    default:
      return 0;
  }
}

/**
 * Top of one line's em box, relative to the block top.
 *
 * The extra leading is split above and below the glyphs, so a line-height above
 * 1 doesn't make text sit high in its box. Callers draw with
 * `textBaseline = "top"` at this offset.
 */
export function lineTop(
  index: number,
  lineHeightPx: number,
  fontSize: number
): number {
  return index * lineHeightPx + (lineHeightPx - fontSize) / 2;
}

/** CSS-declaration-worth of the same layout, for the DOM edit overlay. */
export function letterSpacingPx(
  letterSpacing: number,
  fontSize: number
): number {
  return letterSpacing * fontSize;
}
