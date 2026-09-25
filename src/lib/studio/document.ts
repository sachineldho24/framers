/**
 * Studio document model.
 *
 * The document is plain JSON: it round-trips through `JSON.stringify` with no
 * loss, which is what lets undo snapshot it cheaply and lets it live in a jsonb
 * column (or localStorage) untouched. Notably, destructive-looking edits are
 * *not* stored as pixels — an erase is a list of points replayed at draw time
 * (see `strokes.ts`), so it stays reversible and small.
 */

import type { FilterId } from "./filters";
import { DEFAULT_FILTER } from "./filters";
import { DEFAULT_FONT_ID, getFont, isCustomFontId, nearestWeight } from "./fonts";
import { containBox, coverBox } from "./geometry";
import { getShape } from "./shapes";
import { parseSvgPath } from "./svgPath";
import { coerceTextEffect, type TextEffect } from "./textEffects";
import type { ListStyle } from "./text";
import {
  DEFAULT_LINE_HEIGHT,
  MAX_FONT_SIZE,
  MAX_LETTER_SPACING,
  MAX_LINE_HEIGHT,
  MAX_STROKE_WIDTH,
  MIN_FONT_SIZE,
  MIN_LETTER_SPACING,
  MIN_LINE_HEIGHT,
  type TextAlign,
  type VerticalAlign,
} from "./text";

/**
 * 2 added text layers; 3 added the printed border. Nothing was renamed, so an
 * older document loads unchanged — `migrateDocument` fills in what's missing and
 * stamps the current version on the way in.
 *
 * 4 is not a shape change: it is the one-shot marker for
 * `repairSeededLetterbox`, which un-letterboxes a session's own upload if it was
 * seeded before the studio started seeding with `coverBox`.
 *
 * 5 added optional `printMm` — the paper size for a page the user sized by hand,
 * which the pixel grid can't imply on its own.
 */
export const DOCUMENT_VERSION = 5;

/** Print resolution used to convert physical frame size into document pixels. */
export const PRINT_DPI = 300;
export const MM_PER_INCH = 25.4;
/** Hard ceiling on either edge — beyond this, browsers start failing canvases. */
export const MAX_DOC_EDGE = 4096;

/**
 * `shape` clips to a closed element from the `shapes.ts` catalogue (Canva's
 * Frames: heart, star, arch…); `path` clips to an arbitrary SVG outline, which
 * is how an imported template's photo slot keeps its exact polygon.
 */
export type MaskKind = "none" | "circle" | "rounded" | "shape" | "path";
export type StrokeMode = "erase" | "restore";

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  mode: StrokeMode;
  /** Brush diameter in doc px. */
  size: number;
  /** 0–1; fraction of the radius that fades out. */
  feather: number;
  /** Polyline in the layer's local (unrotated, pre-scale) space, normalised 0–1. */
  points: Point[];
}

export interface Adjustments {
  /** All −100…100, 0 = untouched. */
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface CropRect {
  /** Normalised source rect, 0–1 of the natural image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MaskPath {
  /** SVG path data, in `viewBox` space; stretched to the layer box when drawn. */
  d: string;
  viewBox: [number, number, number, number];
}

export interface Mask {
  kind: MaskKind;
  /** Corner radius as a fraction (0–0.5) of the shorter edge, for "rounded". */
  radius: number;
  /** A closed `shapes.ts` id, for "shape". */
  shapeId?: string;
  /** For "path". */
  path?: MaskPath;
}

/**
 * What a template expects the customer to do with a layer.
 *
 * - `decor`: part of the design; left alone. The default, so absent = decor.
 * - `editable`: expected to change (a caption, a name).
 * - `placeholder`: MUST be filled before checkout — a photo slot. On an image
 *   layer the picture is a sample (`ImageLayer.sample`) until it is replaced.
 */
export type LayerRole = "decor" | "editable" | "placeholder";

interface LayerBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the layer centre. */
  rotation: number;
  /** 0–1. */
  opacity: number;
  locked: boolean;
  visible: boolean;
  /**
   * Layers sharing a group id select, move and scale together — Canva's Group.
   * A font combination is inserted as one. Absent = not grouped.
   */
  groupId?: string;
  /** Template intent. Absent = "decor". */
  role?: LayerRole;
}

export interface ImageLayer extends LayerBase {
  kind: "image";
  /** Storage path (signed at load time), a blob: URL, or a data: URL. */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  crop: CropRect;
  adjust: Adjustments;
  filter: FilterId;
  /** 0–1 blend of the filter against the unfiltered image. */
  filterStrength: number;
  mask: Mask;
  strokes: Stroke[];
  /**
   * Mirrored on that axis. `crop` stays in display space — the rect as seen
   * after the mirror — so the crop window and the pixels under it agree.
   */
  flipX?: boolean;
  flipY?: boolean;
  /**
   * Canva's "Border style" on a photo: a line drawn *inside* the edge, following
   * the frame shape (so a circle frame gets a round border). Not the page's
   * printed border, which is `StudioDocument.border`.
   */
  outline?: ImageOutline;
  /**
   * The picture is a template's stand-in, not the customer's photo. Set when a
   * layer becomes a photo slot; cleared the moment a real photo replaces it.
   */
  sample?: boolean;
}

export type OutlineStyle = "solid" | "dashed" | "dotted";

export interface ImageOutline {
  /** Doc px. 0 = no border. Kept in px so resizing the photo keeps the weight. */
  width: number;
  color: string;
  style: OutlineStyle;
}

export const NO_OUTLINE: ImageOutline = { width: 0, color: "#111111", style: "solid" };
export const MAX_OUTLINE = 200;

export type Layer = ImageLayer | TextLayer | ShapeLayer | DrawLayer;

/**
 * A freehand stroke — Canva's Draw tool, and the signature pad. See
 * `drawing.ts`. Points are normalised to the box, so resizing reshapes the
 * stroke; its weight is doc px and does not scale.
 */
export interface DrawLayer extends LayerBase {
  kind: "draw";
  /** [x, y] pairs, 0–1 of the box. */
  points: [number, number][];
  color: string;
  /** Doc px. */
  strokeWidth: number;
  pen: "pen" | "marker" | "highlighter";
}

/**
 * A text layer.
 *
 * The box's `width` drives the wrap; `height` is derived from the layout and is
 * kept in sync by whoever edits the layer (only the UI can measure text), so it
 * is authoritative for hit-testing and the selection box but never for layout.
 *
 * Sizes that should survive scaling the layer are stored as *fractions of
 * `fontSize`* rather than px: `letterSpacing` and `strokeWidth`. That way
 * dragging a corner scales the whole look, not just the glyphs.
 */
export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  /** A `fonts.ts` catalogue id, not a CSS family name. */
  fontId: string;
  fontWeight: number;
  italic: boolean;
  /** Doc px. */
  fontSize: number;
  color: string;
  align: TextAlign;
  verticalAlign: VerticalAlign;
  /** Multiplier of `fontSize`. */
  lineHeight: number;
  /** Fraction of `fontSize`. */
  letterSpacing: number;
  uppercase: boolean;
  /** Outline colour; only drawn when `strokeWidth > 0`. */
  strokeColor: string;
  /** Fraction of `fontSize`. 0 = no outline. */
  strokeWidth: number;
  /** Absent = off. Optional so older documents need no migration. */
  underline?: boolean;
  strike?: boolean;
  /** Bullet or numbered paragraphs. */
  list?: ListStyle;
  /** Canva-style effect (shadow, neon, …). Absent = none. */
  effect?: TextEffect;
}

/**
 * A vector element.
 *
 * The layer stores a catalogue id, not a path. Keeping the geometry in
 * `shapes.ts` is what lets the canvas, the panel's thumbnails and the flattened
 * print trace the same commands, and it keeps the document small JSON that
 * survives a round trip.
 *
 * `width`/`height` are the drawn box: every shape is generated to fill it.
 */
export interface ShapeLayer extends LayerBase {
  kind: "shape";
  /** A `shapes.ts` catalogue id. */
  shapeId: string;
  /** Fill for a closed shape, stroke colour for an open one. */
  color: string;
  /** Doc px. Ignored by filled shapes. */
  strokeWidth: number;
}

/**
 * A printed border — the studio's answer to a mat.
 *
 * Deliberately part of the artwork rather than a physical mount: the band is
 * printed on the paper, so it needs no extra material, costs nothing extra, and
 * shows in the preview and the print identically. A real mat board sits *on top*
 * of the print behind the glass, which is a different product; the UI must not
 * imply one.
 *
 * `width` is a fraction of the page's **shorter** edge, so the band is the same
 * thickness on all four sides and survives a resize between frame sizes.
 */
export interface PageBorder {
  /** 0 = no border. Fraction of the shorter page edge. */
  width: number;
  color: string;
}

/** A quarter of the short edge on each side would leave nothing for the photo. */
export const MAX_BORDER = 0.2;
export const NO_BORDER: PageBorder = { width: 0, color: "#ffffff" };

export interface StudioDocument {
  version: number;
  /** Document pixel grid. */
  width: number;
  height: number;
  background: string;
  title: string;
  /** Printed band around the artwork. `width: 0` for none. */
  border: PageBorder;
  /**
   * Physical size of the page in millimetres, when the user set it by hand.
   *
   * Absent for a document sized from the frame catalogue: there the frame row is
   * the authority and the studio is handed its mm as a prop. Present, it wins —
   * the grid alone can't say what paper it is, because `docSizeForFrame` caps
   * the long edge, so a 4096 px page is A2 at 175 DPI *or* A4 at 300 depending
   * on a fact that lives here and nowhere else.
   */
  printMm?: { widthMm: number; heightMm: number };
  /** Index 0 is the bottom of the stack. */
  layers: Layer[];
  /**
   * Fonts the user uploaded into this design. Stored with the document — not
   * only in the user's library — so the design renders the same after a reload,
   * on another device, and in the print file.
   */
  fonts?: CustomFont[];
}

export interface CustomFont {
  /** `custom-…`; what text layers store in `fontId`. */
  id: string;
  /** Shown in the picker — the file's name, tidied. */
  name: string;
  /** Storage path of the font file (or a blob:/data: URL before upload). */
  src: string;
}

/** Most uploaded fonts one design keeps. */
export const MAX_CUSTOM_FONTS = 20;

function coerceFonts(value: unknown): { fonts?: CustomFont[] } {
  if (!Array.isArray(value)) return {};
  const seen = new Set<string>();
  const fonts: CustomFont[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const f = entry as Partial<CustomFont>;
    if (typeof f.id !== "string" || !isCustomFontId(f.id) || seen.has(f.id)) continue;
    if (typeof f.src !== "string" || f.src.length === 0) continue;
    seen.add(f.id);
    fonts.push({ id: f.id, name: str(f.name, "Uploaded font").slice(0, 80), src: f.src });
    if (fonts.length >= MAX_CUSTOM_FONTS) break;
  }
  return fonts.length ? { fonts } : {};
}

/**
 * Border thickness in document pixels.
 *
 * Clamped so the band can never meet in the middle — at that point the page is
 * a solid rectangle and the artwork has silently vanished, which no slider
 * should be able to do.
 */
export function borderInsetPx(doc: StudioDocument): number {
  const short = Math.min(doc.width, doc.height);
  return Math.min(
    Math.max(0, doc.border.width) * short,
    doc.width / 2 - 1,
    doc.height / 2 - 1
  );
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
export const NO_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
};
export const NO_MASK: Mask = { kind: "none", radius: 0.08 };

/**
 * Narrowing helpers. Used everywhere in the UI, because most tools (crop,
 * eraser, filters) act on pixels and simply have nothing to do with text.
 */
export function isImageLayer(layer: Layer): layer is ImageLayer {
  return layer.kind === "image";
}

export function isTextLayer(layer: Layer): layer is TextLayer {
  return layer.kind === "text";
}

export function isShapeLayer(layer: Layer): layer is ShapeLayer {
  return layer.kind === "shape";
}

/** Only image layers have a `src` to resolve, so loaders filter through this. */
export function imageLayers(doc: StudioDocument): ImageLayer[] {
  return doc.layers.filter(isImageLayer);
}

/**
 * Id generator. Deliberately not `crypto.randomUUID` — this runs in the render
 * path on older mobile Safari, and the ids only need to be unique per document.
 */
let idCounter = 0;
export function createId(prefix = "l"): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${idCounter.toString(36)}${rand}`;
}

/** Physical frame size → document pixel grid at print resolution, capped. */
export function docSizeForFrame(
  widthMm: number,
  heightMm: number
): { width: number; height: number } {
  const rawW = (widthMm / MM_PER_INCH) * PRINT_DPI;
  const rawH = (heightMm / MM_PER_INCH) * PRINT_DPI;
  const scale = Math.min(1, MAX_DOC_EDGE / Math.max(rawW, rawH));
  return {
    width: Math.max(1, Math.round(rawW * scale)),
    height: Math.max(1, Math.round(rawH * scale)),
  };
}

export function createDocument(params: {
  width: number;
  height: number;
  title?: string;
  background?: string;
  /** Only for a page sized by hand; a frame-sized page leaves this out. */
  printMm?: { widthMm: number; heightMm: number };
}): StudioDocument {
  return {
    version: DOCUMENT_VERSION,
    width: params.width,
    height: params.height,
    background: params.background ?? "#ffffff",
    title: params.title ?? "Untitled design",
    border: { ...NO_BORDER },
    ...(params.printMm ? { printMm: { ...params.printMm } } : {}),
    layers: [],
  };
}

export function createImageLayer(params: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}): ImageLayer {
  return {
    id: createId("img"),
    kind: "image",
    name: params.name ?? "Image",
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src: params.src,
    naturalWidth: params.naturalWidth,
    naturalHeight: params.naturalHeight,
    crop: { ...FULL_CROP },
    adjust: { ...NO_ADJUSTMENTS },
    filter: DEFAULT_FILTER,
    filterStrength: 1,
    mask: { ...NO_MASK },
    strokes: [],
  };
}

export const TEXT_DEFAULTS = {
  fontId: DEFAULT_FONT_ID,
  fontWeight: 400,
  italic: false,
  color: "#111111",
  align: "center" as TextAlign,
  verticalAlign: "middle" as VerticalAlign,
  lineHeight: DEFAULT_LINE_HEIGHT,
  letterSpacing: 0,
  uppercase: false,
  strokeColor: "#ffffff",
  strokeWidth: 0,
};

export function createTextLayer(params: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  name?: string;
  fontId?: string;
  fontWeight?: number;
  align?: TextAlign;
  color?: string;
  uppercase?: boolean;
}): TextLayer {
  const fontId = params.fontId ?? TEXT_DEFAULTS.fontId;
  return {
    id: createId("txt"),
    kind: "text",
    // The layer list is far more readable with the words in it than with
    // twenty rows all called "Text".
    name: params.name ?? textLayerName(params.text),
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: params.text,
    fontId,
    fontWeight: nearestWeight(
      getFont(fontId),
      params.fontWeight ?? TEXT_DEFAULTS.fontWeight
    ),
    italic: TEXT_DEFAULTS.italic,
    fontSize: clampFontSize(params.fontSize),
    color: params.color ?? TEXT_DEFAULTS.color,
    align: params.align ?? TEXT_DEFAULTS.align,
    verticalAlign: TEXT_DEFAULTS.verticalAlign,
    lineHeight: TEXT_DEFAULTS.lineHeight,
    letterSpacing: TEXT_DEFAULTS.letterSpacing,
    uppercase: params.uppercase ?? TEXT_DEFAULTS.uppercase,
    strokeColor: TEXT_DEFAULTS.strokeColor,
    strokeWidth: TEXT_DEFAULTS.strokeWidth,
  };
}

export const SHAPE_DEFAULTS = {
  color: "#111111",
  /** Doc px. Only open shapes read it. */
  strokeWidth: 12,
};

/** A stroke thicker than this stops being a line and becomes a blob. */
export const MAX_SHAPE_STROKE = 400;

export function createShapeLayer(params: {
  shapeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  color?: string;
  strokeWidth?: number;
}): ShapeLayer {
  return {
    id: createId("shp"),
    kind: "shape",
    // Named after the element, so the layer list reads "Heart", not "Shape".
    name: params.name ?? getShape(params.shapeId)?.label ?? "Shape",
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    shapeId: params.shapeId,
    color: colour(params.color, SHAPE_DEFAULTS.color),
    strokeWidth: clamp(
      num(params.strokeWidth, SHAPE_DEFAULTS.strokeWidth),
      0,
      MAX_SHAPE_STROKE
    ),
  };
}

export function clampFontSize(size: number): number {
  return clamp(num(size, MIN_FONT_SIZE), MIN_FONT_SIZE, MAX_FONT_SIZE);
}

/** First line of the text, trimmed to something that fits the layer list. */
export function textLayerName(text: string): string {
  const first = text.split(/\r?\n/)[0]?.trim() ?? "";
  if (first === "") return "Text";
  return first.length > 28 ? `${first.slice(0, 27)}…` : first;
}

export function findLayer(
  doc: StudioDocument,
  layerId: string | null
): Layer | null {
  if (!layerId) return null;
  return doc.layers.find((l) => l.id === layerId) ?? null;
}

export function layerIndex(doc: StudioDocument, layerId: string): number {
  return doc.layers.findIndex((l) => l.id === layerId);
}

/** Aspect ratio of the visible (cropped) image content. */
export function layerContentAspect(layer: ImageLayer): number {
  const w = layer.naturalWidth * layer.crop.w;
  const h = layer.naturalHeight * layer.crop.h;
  return h > 0 ? w / h : 1;
}

/* -------------------------------------------------------------------------- */
/* Loading untrusted documents                                                 */
/* -------------------------------------------------------------------------- */

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceCrop(value: unknown): CropRect {
  const v = (value ?? {}) as Partial<CropRect>;
  return {
    x: clamp01(num(v.x, 0)),
    y: clamp01(num(v.y, 0)),
    w: clamp01(num(v.w, 1)) || 1,
    h: clamp01(num(v.h, 1)) || 1,
  };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function coerceStroke(value: unknown): Stroke | null {
  const v = (value ?? {}) as Partial<Stroke>;
  if (!Array.isArray(v.points) || v.points.length === 0) return null;
  const points = v.points
    .filter((p): p is Point => !!p && typeof p === "object")
    .map((p) => ({ x: num(p.x, 0), y: num(p.y, 0) }));
  if (points.length === 0) return null;
  return {
    id: str(v.id, createId("s")),
    mode: v.mode === "restore" ? "restore" : "erase",
    size: Math.max(1, num(v.size, 40)),
    feather: clamp01(num(v.feather, 0.5)),
    points,
  };
}

/** A colour we are willing to hand to `ctx.fillStyle` unvalidated. */
function colour(value: unknown, fallback: string): string {
  // Canvas silently ignores an unparseable fillStyle and keeps the previous
  // one, which would paint text in whatever colour happened to be set last.
  // Only accept the two forms we ever write.
  return typeof value === "string" &&
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

function coerceTextLayer(v: Partial<TextLayer>): TextLayer | null {
  if (typeof v.text !== "string") return null;
  const fontId = str(v.fontId, DEFAULT_FONT_ID);
  const font = getFont(fontId);
  return {
    id: str(v.id, createId("txt")),
    kind: "text",
    name: str(v.name, textLayerName(v.text)),
    x: num(v.x, 0),
    y: num(v.y, 0),
    width: Math.max(1, num(v.width, 100)),
    height: Math.max(1, num(v.height, 100)),
    rotation: num(v.rotation, 0),
    opacity: clamp01(num(v.opacity, 1)),
    locked: bool(v.locked, false),
    visible: bool(v.visible, true),
    text: v.text,
    // Resolve through the catalogue, so a document naming a font we have since
    // dropped renders in the default rather than in the browser's fallback.
    fontId: font.id,
    fontWeight: nearestWeight(font, num(v.fontWeight, TEXT_DEFAULTS.fontWeight)),
    italic: bool(v.italic, false) && font.italic,
    fontSize: clampFontSize(num(v.fontSize, 64)),
    color: colour(v.color, TEXT_DEFAULTS.color),
    align:
      v.align === "left" || v.align === "right" || v.align === "center"
        ? v.align
        : TEXT_DEFAULTS.align,
    verticalAlign:
      v.verticalAlign === "top" ||
      v.verticalAlign === "bottom" ||
      v.verticalAlign === "middle"
        ? v.verticalAlign
        : TEXT_DEFAULTS.verticalAlign,
    lineHeight: clamp(
      num(v.lineHeight, DEFAULT_LINE_HEIGHT),
      MIN_LINE_HEIGHT,
      MAX_LINE_HEIGHT
    ),
    letterSpacing: clamp(
      num(v.letterSpacing, 0),
      MIN_LETTER_SPACING,
      MAX_LETTER_SPACING
    ),
    uppercase: bool(v.uppercase, false),
    strokeColor: colour(v.strokeColor, TEXT_DEFAULTS.strokeColor),
    strokeWidth: clamp(num(v.strokeWidth, 0), 0, MAX_STROKE_WIDTH),
    ...(v.underline === true ? { underline: true } : {}),
    ...(v.strike === true ? { strike: true } : {}),
    ...(v.list === "bullet" || v.list === "number" ? { list: v.list } : {}),
    ...(coerceTextEffect(v.effect) ? { effect: coerceTextEffect(v.effect) } : {}),
  };
}

function coerceImageLayer(v: Partial<ImageLayer>): Layer | null {
  if (typeof v.src !== "string") return null;
  return {
    id: str(v.id, createId("img")),
    kind: "image",
    name: str(v.name, "Image"),
    x: num(v.x, 0),
    y: num(v.y, 0),
    width: Math.max(1, num(v.width, 100)),
    height: Math.max(1, num(v.height, 100)),
    rotation: num(v.rotation, 0),
    opacity: clamp01(num(v.opacity, 1)),
    locked: bool(v.locked, false),
    visible: bool(v.visible, true),
    src: v.src,
    naturalWidth: Math.max(1, num(v.naturalWidth, 1)),
    naturalHeight: Math.max(1, num(v.naturalHeight, 1)),
    crop: coerceCrop(v.crop),
    adjust: {
      brightness: num(v.adjust?.brightness, 0),
      contrast: num(v.adjust?.contrast, 0),
      saturation: num(v.adjust?.saturation, 0),
    },
    filter: str(v.filter, DEFAULT_FILTER) as FilterId,
    filterStrength: clamp01(num(v.filterStrength, 1)),
    mask: coerceMask(v.mask),
    strokes: Array.isArray(v.strokes)
      ? v.strokes.map(coerceStroke).filter((s): s is Stroke => s !== null)
      : [],
    flipX: bool(v.flipX, false),
    flipY: bool(v.flipY, false),
    ...(v.sample === true ? { sample: true } : {}),
    outline: {
      width: Math.min(MAX_OUTLINE, Math.max(0, num(v.outline?.width, 0))),
      color: str(v.outline?.color, NO_OUTLINE.color),
      style:
        v.outline?.style === "dashed" || v.outline?.style === "dotted"
          ? v.outline.style
          : "solid",
    },
  };
}

function coerceDrawLayer(v: Partial<DrawLayer>): Layer | null {
  if (!Array.isArray(v.points)) return null;
  const points = v.points
    .filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([x, y]) => [clamp01(x), clamp01(y)] as [number, number]);
  if (points.length === 0) return null;
  return {
    id: str(v.id, createId("drw")),
    kind: "draw",
    name: str(v.name, "Drawing"),
    x: num(v.x, 0),
    y: num(v.y, 0),
    width: Math.max(1, num(v.width, 1)),
    height: Math.max(1, num(v.height, 1)),
    rotation: num(v.rotation, 0),
    opacity: clamp01(num(v.opacity, 1)),
    locked: bool(v.locked, false),
    visible: bool(v.visible, true),
    points,
    color: colour(v.color, "#111111"),
    strokeWidth: Math.max(0.5, num(v.strokeWidth, 4)),
    pen: v.pen === "marker" || v.pen === "highlighter" ? v.pen : "pen",
  };
}

/** Id prefix per layer kind, for fresh copies. */
export function idPrefixFor(kind: Layer["kind"]): string {
  return kind === "text" ? "txt" : kind === "shape" ? "shp" : kind === "draw" ? "drw" : "img";
}

function coerceShapeLayer(v: Partial<ShapeLayer>): Layer | null {
  // An id the catalogue no longer ships has no geometry left to draw, so the
  // layer is dropped rather than left on the page as an invisible box that
  // still answers to clicks.
  const shapeId = str(v.shapeId, "");
  const def = getShape(shapeId);
  if (!def) return null;
  return {
    id: str(v.id, createId("shp")),
    kind: "shape",
    name: str(v.name, def.label),
    x: num(v.x, 0),
    y: num(v.y, 0),
    width: Math.max(1, num(v.width, 100)),
    height: Math.max(1, num(v.height, 100)),
    rotation: num(v.rotation, 0),
    opacity: clamp01(num(v.opacity, 1)),
    locked: bool(v.locked, false),
    visible: bool(v.visible, true),
    shapeId,
    color: colour(v.color, SHAPE_DEFAULTS.color),
    strokeWidth: clamp(
      num(v.strokeWidth, SHAPE_DEFAULTS.strokeWidth),
      0,
      MAX_SHAPE_STROKE
    ),
  };
}

/**
 * A mask we can trace. A shape id the catalogue no longer ships, or a path the
 * parser can't read, degrades to the plain box — the photo stays, unclipped.
 */
export function coerceMask(value: unknown): Mask {
  const v = (value ?? {}) as Partial<Mask>;
  const radius = clamp01(num(v.radius, NO_MASK.radius));
  if (v.kind === "circle" || v.kind === "rounded") return { kind: v.kind, radius };
  if (v.kind === "shape" && typeof v.shapeId === "string") {
    const def = getShape(v.shapeId);
    if (def && def.mode === "fill") return { kind: "shape", radius, shapeId: def.id };
  }
  if (v.kind === "path" && v.path && typeof v.path === "object") {
    const d = str(v.path.d, "");
    const vb = v.path.viewBox;
    if (
      parseSvgPath(d) &&
      Array.isArray(vb) &&
      vb.length === 4 &&
      vb.every((n) => typeof n === "number" && Number.isFinite(n)) &&
      vb[2] > 0 &&
      vb[3] > 0
    ) {
      return { kind: "path", radius, path: { d, viewBox: [vb[0], vb[1], vb[2], vb[3]] } };
    }
  }
  return { kind: "none", radius };
}

function coerceRole(value: unknown): { role?: LayerRole } {
  return value === "editable" || value === "placeholder" ? { role: value } : {};
}

/**
 * What a duplicate or a paste becomes: a new thing the user just made, so it is
 * theirs to move and delete. It drops the source's lock, its group, and any
 * template role — a copy of a locked photo slot must not arrive locked (it
 * could never be deleted) nor as a second required slot (it would block
 * checkout until filled). Ids are the caller's business.
 */
export function asFreshCopy(layer: Layer): Layer {
  const copy = { ...cloneLayer(layer), locked: false } as Layer & { sample?: boolean };
  delete copy.groupId;
  delete copy.role;
  delete copy.sample;
  if (copy.kind === "image") {
    // Strokes carry ids of their own, and two layers sharing them would make
    // "remove this stroke" ambiguous.
    copy.strokes = copy.strokes.map((s) => ({ ...s, id: createId("s") }));
  }
  return copy;
}

/** Photo slots a customer still has to fill, bottom to top. */
export function unfilledSlots(doc: StudioDocument): ImageLayer[] {
  return doc.layers.filter(
    (l): l is ImageLayer =>
      isImageLayer(l) && l.role === "placeholder" && l.sample === true && l.visible
  );
}

function coerceLayer(value: unknown): Layer | null {
  const v = (value ?? {}) as Partial<Layer>;
  const layer =
    v.kind === "text"
      ? coerceTextLayer(v as Partial<TextLayer>)
      : v.kind === "image"
        ? coerceImageLayer(v as Partial<ImageLayer>)
        : v.kind === "shape"
          ? coerceShapeLayer(v as Partial<ShapeLayer>)
          : v.kind === "draw"
            ? coerceDrawLayer(v as Partial<DrawLayer>)
            : null;
  if (!layer) return null;
  const withRole = { ...layer, ...coerceRole(v.role) } as Layer;
  if (typeof v.groupId === "string" && v.groupId.length > 0) {
    return { ...withRole, groupId: v.groupId.slice(0, 64) };
  }
  return withRole;
}

/** Tolerance in document px when comparing a stored box against a computed one. */
const BOX_EPS = 0.5;

/**
 * Un-letterbox a document that was seeded with `containBox`.
 *
 * The studio now seeds a session's upload to *cover* the page, because every
 * screen before the editor — size, frame, review — shows the photo filling the
 * frame's opening. Documents saved before that fix hold a contained box, so the
 * flattened `print.png` carries a white band above and below the photo, inside
 * the moulding, which is a margin the customer never asked for and can't see in
 * any preview until it is printed.
 *
 * Deliberately narrow, because rewriting someone's artwork is the worse failure:
 * it only fires on a document whose single layer is an unrotated, full-source
 * image — the shape the seeder produces and nothing else — and only when that
 * box is exactly the contained one. Aspect is preserved by both helpers and the
 * crop is untouched, so the swap cannot distort the photo; it can only reveal
 * paper that was blank.
 *
 * Version-gated by the caller so it runs at most once per document. Ungated, it
 * would fight `fitLayerToPage({ mode: "contain" })` — a real user action —
 * every time the file was opened.
 */
export function repairSeededLetterbox(doc: StudioDocument): StudioDocument {
  if (doc.layers.length !== 1) return doc;
  const layer = doc.layers[0];
  if (!isImageLayer(layer)) return doc;
  if (layer.rotation !== 0) return doc;
  if (layer.naturalWidth <= 0 || layer.naturalHeight <= 0) return doc;
  const { x, y, w, h } = layer.crop;
  if (x !== 0 || y !== 0 || w !== 1 || h !== 1) return doc;

  const args = [doc.width, doc.height, layer.naturalWidth, layer.naturalHeight] as const;
  const contained = containBox(...args);
  const near = (a: number, b: number) => Math.abs(a - b) <= BOX_EPS;
  const isContained =
    near(layer.x, contained.x) &&
    near(layer.y, contained.y) &&
    near(layer.width, contained.width) &&
    near(layer.height, contained.height);
  if (!isContained) return doc;

  // A photo already the page's shape contains *and* covers — nothing to repair,
  // and rewriting it would only churn the autosave.
  const cover = coverBox(...args);
  if (near(cover.width, layer.width) && near(cover.height, layer.height)) return doc;

  return {
    ...doc,
    layers: [
      {
        ...layer,
        x: cover.x,
        y: cover.y,
        width: cover.width,
        height: cover.height,
      },
    ],
  };
}

/**
 * Turn anything that came back from the network or localStorage into a valid
 * document, or `null` if it can't be salvaged. Unknown/corrupt layers are
 * dropped rather than failing the whole document — losing one layer beats
 * losing the design.
 */
export function migrateDocument(input: unknown): StudioDocument | null {
  if (!input || typeof input !== "object") return null;
  const v = input as Partial<StudioDocument>;
  const width = num(v.width, 0);
  const height = num(v.height, 0);
  if (width <= 0 || height <= 0) return null;
  const layers = Array.isArray(v.layers)
    ? v.layers.map(coerceLayer).filter((l): l is Layer => l !== null)
    : [];
  // Read before the stamp below discards it: the repair below is one-shot and
  // this is the only record of where the document came from.
  const from = num(v.version, 1);
  const doc: StudioDocument = {
    version: DOCUMENT_VERSION,
    width: Math.round(width),
    height: Math.round(height),
    background: str(v.background, "#ffffff"),
    title: str(v.title, "Untitled design"),
    border: coerceBorder(v.border),
    ...coercePrintMm(v.printMm),
    ...coerceFonts(v.fonts),
    layers,
  };
  return from < 4 ? repairSeededLetterbox(doc) : doc;
}

/**
 * A hand-set paper size, or nothing. Spread into the document so the key is
 * genuinely absent rather than `undefined` — the JSON that goes to the server
 * should not carry a null paper size for the frame-sized case.
 */
function coercePrintMm(value: unknown): { printMm?: { widthMm: number; heightMm: number } } {
  if (!value || typeof value !== "object") return {};
  const v = value as { widthMm?: unknown; heightMm?: unknown };
  const widthMm = num(v.widthMm, 0);
  const heightMm = num(v.heightMm, 0);
  if (widthMm <= 0 || heightMm <= 0) return {};
  return { printMm: { widthMm, heightMm } };
}

/** A version-2 document has no border at all, which reads as `width: 0`. */
function coerceBorder(value: unknown): PageBorder {
  const v = (value ?? {}) as Partial<PageBorder>;
  return {
    width: clamp(num(v.width, 0), 0, MAX_BORDER),
    color: colour(v.color, NO_BORDER.color),
  };
}

/** Structural clone that keeps the document plain-JSON. */
export function cloneDocument(doc: StudioDocument): StudioDocument {
  return {
    ...doc,
    border: { ...doc.border },
    ...(doc.printMm ? { printMm: { ...doc.printMm } } : {}),
    ...(doc.fonts ? { fonts: doc.fonts.map((f) => ({ ...f })) } : {}),
    layers: doc.layers.map(cloneLayer),
  };
}

/** Deep enough that editing the copy can never reach the original's nested state. */
export function cloneLayer(layer: Layer): Layer {
  if (layer.kind === "draw") return { ...layer, points: layer.points.map((p) => [p[0], p[1]]) };
  // Only an image layer owns nested objects; everything else is flat.
  if (layer.kind !== "image") return { ...layer };
  return {
    ...layer,
    crop: { ...layer.crop },
    adjust: { ...layer.adjust },
    mask: {
      ...layer.mask,
      ...(layer.mask.path
        ? { path: { d: layer.mask.path.d, viewBox: [...layer.mask.path.viewBox] as MaskPath["viewBox"] } }
        : {}),
    },
    strokes: layer.strokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    })),
  };
}
