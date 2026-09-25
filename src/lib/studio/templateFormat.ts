/**
 * The Framers template interchange format (`framers-template` 1.0) ⇄ the
 * studio's working document.
 *
 * The studio document is tuned for editing: flat layers, a catalogue font id,
 * erase strokes replayed at draw time. The template format is tuned for
 * exchange: an asset registry referenced by key, frames with an SVG clip path
 * and a replaceable fill, photo grids, granular locks and a `role` that says
 * which slots a customer must fill. It is also the shape a Canva design maps
 * onto once its minified keys are decoded (see Doc/canva-editor-findings), so
 * this is the one door templates come in and go out through.
 *
 * Mapping, both ways:
 *
 * | template            | studio                                           |
 * |---------------------|--------------------------------------------------|
 * | background.color    | `doc.background`                                 |
 * | background.image    | bottom image layer, locked                       |
 * | image               | image layer                                      |
 * | frame               | image layer + `path`/`shape` mask; an `overlay`  |
 * |                     | becomes a locked decor layer grouped with it     |
 * | grid                | one framed image layer per area, grouped         |
 * | group               | children flattened, sharing a `groupId`          |
 * | text                | text layer; runs collapse to one style           |
 * | shape               | shape layer, when its outline is a catalogue one |
 * | role / locks        | `role`, `sample`, `locked`                       |
 *
 * Import is lossy where the studio is simpler (per-run styles, blend modes,
 * raster masks) and says so in `warnings` rather than failing: a template that
 * opens with one caveat is worth more than one that does not open. Everything
 * built here still goes through `migrateDocument`, the same gate every other
 * document source passes, so nothing unvalidated reaches the canvas.
 */

import {
  DOCUMENT_VERSION,
  createId,
  migrateDocument,
  type CustomFont,
  type ImageLayer,
  type Layer,
  type LayerRole,
  type Mask,
  type StudioDocument,
  type TextLayer,
} from "./document";
import { FONT_CATALOGUE, getFont, isCustomFontId } from "./fonts";
import { SHAPE_CATALOG, getShape, shapePathD } from "./shapes";
import { commandsToD, mapNode, pathCommands } from "./penPath";
import { parseSvgPath } from "./svgPath";

export const TEMPLATE_SCHEMA_VERSION = "1.0";

/* -------------------------------------------------------------------------- */
/* Format types (the subset of the JSON Schema this module reads and writes)   */
/* -------------------------------------------------------------------------- */

export interface TplAsset {
  kind: "image" | "font" | "svg" | "mask";
  version: number;
  width?: number;
  height?: number;
  mime?: string;
  family?: string;
  weight?: number;
  style?: "normal" | "italic";
  renditions?: Record<string, string>;
  license?: string;
}

export interface TplTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export interface TplLocks {
  all?: boolean;
  position?: boolean;
  size?: boolean;
  rotation?: boolean;
  content?: boolean;
  style?: boolean;
  delete?: boolean;
  zOrder?: boolean;
}

export interface TplImageFill {
  asset: string;
  fit?: "cover" | "contain" | "stretch" | "crop";
  crop?: { x: number; y: number; width: number; height: number };
  focalPoint?: { x: number; y: number };
  filters?: { brightness?: number; contrast?: number; saturation?: number; grayscale?: boolean };
}

export interface TplPath {
  d: string;
  viewBox: [number, number, number, number];
}

interface TplLayerBase {
  id: string;
  name?: string;
  transform: TplTransform;
  opacity?: number;
  visible?: boolean;
  blendMode?: string;
  role?: LayerRole;
  locks?: TplLocks;
  binding?: string;
  semantic?: string;
}

export interface TplTextRun {
  text: string;
  font?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type TplLayer =
  | (TplLayerBase & {
      type: "text";
      text: {
        paragraphs: { runs: TplTextRun[]; align?: string; list?: string }[];
        style: {
          font: string;
          fontSize: number;
          color: string;
          lineHeight?: number;
          letterSpacing?: number;
          align?: string;
          verticalAlign?: string;
          transform?: string;
        };
        fit?: string;
        constraints?: Record<string, unknown>;
      };
    })
  | (TplLayerBase & { type: "image"; fill: TplImageFill })
  | (TplLayerBase & {
      type: "shape";
      shape: {
        kind: "rect" | "ellipse" | "line" | "path";
        path?: TplPath;
        cornerRadius?: number;
        fill?: string;
        stroke?: { color?: string; width?: number; dash?: number[] };
      };
    })
  | (TplLayerBase & {
      type: "frame";
      mask: { path: TplPath } | { asset: string };
      fill: TplImageFill;
      overlay?: { asset: string; placement?: "above" | "below" };
    })
  | (TplLayerBase & { type: "group"; children: TplLayer[] })
  | (TplLayerBase & {
      type: "grid";
      grid: {
        areas: string[][];
        columns: string[];
        rows: string[];
        columnGap?: number;
        rowGap?: number;
      };
      cells: Record<string, { fill?: TplImageFill; role?: "decor" | "placeholder" }>;
    });

export interface FramersTemplate {
  schemaVersion: "1.0";
  id: string;
  revision?: number;
  name: string;
  category?: string;
  tags?: string[];
  canvas: {
    width: number;
    height: number;
    physical?: { widthMm: number; heightMm: number; bleedMm?: number; safeMarginMm?: number; minPrintDpi?: number };
  };
  assets: Record<string, TplAsset>;
  pages: {
    id: string;
    name?: string;
    background: {
      color?: string;
      image?: TplImageFill;
      locks?: TplLocks;
      opacity?: number;
      imageRotation?: 0 | 90 | 180 | 270;
    };
    layers: TplLayer[];
  }[];
  meta?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** An id the schema accepts: 4–64 of `[A-Za-z0-9_-]`. */
export function templateId(raw: string, fallbackPrefix = "id"): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return ID_RE.test(cleaned) ? cleaned : `${fallbackPrefix}_${createId("x").replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 64);
}

function hex6or8(color: string): string {
  const c = color.trim();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  return /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(c) ? c : "#000000";
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Four cubics per quarter — the standard circle approximation (κ ≈ 0.5523). */
const K = 0.5522847498;

function ellipseD(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  const f = (n: number) => round(n);
  return [
    `M${f(w)} ${f(ry)}`,
    `C${f(w)} ${f(ry + ry * K)} ${f(rx + rx * K)} ${f(h)} ${f(rx)} ${f(h)}`,
    `C${f(rx - rx * K)} ${f(h)} 0 ${f(ry + ry * K)} 0 ${f(ry)}`,
    `C0 ${f(ry - ry * K)} ${f(rx - rx * K)} 0 ${f(rx)} 0`,
    `C${f(rx + rx * K)} 0 ${f(w)} ${f(ry - ry * K)} ${f(w)} ${f(ry)}`,
    "Z",
  ].join(" ");
}

function roundedRectD(w: number, h: number, r: number): string {
  const f = (n: number) => round(n);
  const k = r * (1 - K);
  return [
    `M${f(r)} 0`,
    `L${f(w - r)} 0`,
    `C${f(w - k)} 0 ${f(w)} ${f(k)} ${f(w)} ${f(r)}`,
    `L${f(w)} ${f(h - r)}`,
    `C${f(w)} ${f(h - k)} ${f(w - k)} ${f(h)} ${f(w - r)} ${f(h)}`,
    `L${f(r)} ${f(h)}`,
    `C${f(k)} ${f(h)} 0 ${f(h - k)} 0 ${f(h - r)}`,
    `L0 ${f(r)}`,
    `C0 ${f(k)} ${f(k)} 0 ${f(r)} 0`,
    "Z",
  ].join(" ");
}

/** A mask as an SVG outline in its own `w` × `h` viewBox, or null for "none". */
export function maskToPath(mask: Mask, w: number, h: number): TplPath | null {
  switch (mask.kind) {
    case "circle":
      return { d: ellipseD(w, h), viewBox: [0, 0, round(w), round(h)] };
    case "rounded":
      return {
        d: roundedRectD(w, h, Math.min(w, h) * clamp(mask.radius, 0, 0.5)),
        viewBox: [0, 0, round(w), round(h)],
      };
    case "shape": {
      const def = mask.shapeId ? getShape(mask.shapeId) : null;
      return def ? { d: shapePathD(def, w, h), viewBox: [0, 0, round(w), round(h)] } : null;
    }
    case "path":
      return mask.path ? { d: mask.path.d, viewBox: [...mask.path.viewBox] } : null;
    default:
      return null;
  }
}

/**
 * The catalogue shape whose outline this is, if any. `shapePathD` is
 * deterministic, so a path we exported ourselves comes back as the same shape.
 */
function catalogueShapeFor(path: TplPath, mode?: "fill" | "stroke"): string | null {
  const [, , w, h] = path.viewBox;
  const d = path.d.trim();
  for (const def of SHAPE_CATALOG) {
    if (mode && def.mode !== mode) continue;
    if (shapePathD(def, w, h) === d) return def.id;
  }
  return null;
}

/**
 * The centred crop that makes a `natW` × `natH` picture cover a box of
 * `boxAspect`, nudged toward `focal` (0–1 of the source) without leaving it.
 */
export function coverCrop(
  boxAspect: number,
  natW: number,
  natH: number,
  focal: { x: number; y: number } = { x: 0.5, y: 0.5 }
): { x: number; y: number; w: number; h: number } {
  const srcAspect = natW / natH;
  let w = 1;
  let h = 1;
  if (srcAspect > boxAspect) w = boxAspect / srcAspect;
  else h = srcAspect / boxAspect;
  return {
    x: clamp(focal.x - w / 2, 0, 1 - w),
    y: clamp(focal.y - h / 2, 0, 1 - h),
    w,
    h,
  };
}

/* -------------------------------------------------------------------------- */
/* Export: studio → template                                                   */
/* -------------------------------------------------------------------------- */

export interface ExportOptions {
  id?: string;
  name?: string;
  category?: string;
  tags?: string[];
  /** Author, stamped into `meta`. */
  author?: string;
  /** Clock, for deterministic tests. */
  now?: () => Date;
}

export interface ExportResult {
  template: FramersTemplate;
  /** Studio features the format has no field for, which the export dropped. */
  warnings: string[];
}

export function toFramersTemplate(doc: StudioDocument, options: ExportOptions = {}): ExportResult {
  const warnings = new Set<string>();
  const assets: Record<string, TplAsset> = {};
  const imageKeys = new Map<string, string>();

  function imageAsset(layer: ImageLayer): string {
    const known = imageKeys.get(layer.src);
    if (known) return known;
    const key = `img_${imageKeys.size + 1}`;
    imageKeys.set(layer.src, key);
    assets[key] = {
      kind: "image",
      version: 1,
      width: layer.naturalWidth,
      height: layer.naturalHeight,
      // The studio stores a storage path (or a data:/blob: URL). The format
      // wants renditions resolved by the asset service; `original` is the one
      // rendition we can name without inventing a CDN.
      renditions: { original: layer.src },
    };
    return key;
  }

  function fontAsset(layer: TextLayer): string {
    const key = `font_${layer.fontId}`.replace(/[^A-Za-z0-9_-]/g, "-");
    if (!assets[key]) {
      const custom = isCustomFontId(layer.fontId) ? doc.fonts?.find((f) => f.id === layer.fontId) : undefined;
      assets[key] = custom
        ? { kind: "font", version: 1, family: custom.name, renditions: { original: custom.src } }
        : { kind: "font", version: 1, family: getFont(layer.fontId).family };
    }
    return key;
  }

  const usedIds = new Set<string>();
  function layerId(raw: string): string {
    let id = templateId(raw, "layer");
    while (usedIds.has(id)) id = templateId(`${raw}-${usedIds.size}`, "layer");
    usedIds.add(id);
    return id;
  }

  function base(layer: Layer): TplLayerBase {
    const transform: TplTransform = {
      x: round(layer.x),
      y: round(layer.y),
      width: round(layer.width),
      height: round(layer.height),
    };
    if (layer.rotation) transform.rotation = round(layer.rotation);
    if (layer.kind === "image") {
      if (layer.flipX) transform.flipX = true;
      if (layer.flipY) transform.flipY = true;
    }
    return {
      id: layerId(layer.id),
      name: layer.name,
      transform,
      ...(layer.opacity !== 1 ? { opacity: round(layer.opacity) } : {}),
      ...(layer.visible ? {} : { visible: false }),
      ...(layer.role && layer.role !== "decor" ? { role: layer.role } : {}),
      ...(layer.locked ? { locks: { all: true } } : {}),
    };
  }

  function imageFill(layer: ImageLayer): TplImageFill {
    const fill: TplImageFill = {
      asset: imageAsset(layer),
      fit: "crop",
      crop: {
        x: round(layer.crop.x),
        y: round(layer.crop.y),
        width: round(layer.crop.w),
        height: round(layer.crop.h),
      },
    };
    const { brightness, contrast, saturation } = layer.adjust;
    if (brightness || contrast || saturation) {
      fill.filters = {
        ...(brightness ? { brightness: round(clamp(brightness / 100, -1, 1)) } : {}),
        ...(contrast ? { contrast: round(clamp(contrast / 100, -1, 1)) } : {}),
        ...(saturation ? { saturation: round(clamp(saturation / 100, -1, 1)) } : {}),
      };
    }
    if (layer.filter !== "none" && layer.filterStrength > 0) warnings.add("Photo filter presets are not part of the template format and were left out.");
    if (layer.strokes.length > 0) warnings.add("Erased areas are not part of the template format and were left out.");
    if (layer.outline && layer.outline.width > 0) warnings.add("Photo borders are not part of the template format and were left out.");
    return fill;
  }

  const layers: TplLayer[] = [];
  for (const layer of doc.layers) {
    if (layer.groupId) warnings.add("Groups were exported as separate layers.");
    switch (layer.kind) {
      case "image": {
        const path = maskToPath(layer.mask, layer.width, layer.height);
        layers.push(
          path
            ? { ...base(layer), type: "frame", mask: { path }, fill: imageFill(layer) }
            : { ...base(layer), type: "image", fill: imageFill(layer) }
        );
        break;
      }
      case "text": {
        const font = fontAsset(layer);
        const bold = layer.fontWeight >= 600;
        layers.push({
          ...base(layer),
          type: "text",
          text: {
            paragraphs: layer.text.split("\n").map((line) => ({
              runs: [
                {
                  text: line,
                  ...(bold ? { bold: true } : {}),
                  ...(layer.italic ? { italic: true } : {}),
                  ...(layer.underline ? { underline: true } : {}),
                  ...(layer.strike ? { strike: true } : {}),
                },
              ],
              ...(layer.list && layer.list !== "none" ? { list: layer.list } : {}),
            })),
            style: {
              font,
              fontSize: round(layer.fontSize),
              color: hex6or8(layer.color),
              lineHeight: round(layer.lineHeight),
              letterSpacing: round(layer.letterSpacing),
              align: layer.align,
              verticalAlign: layer.verticalAlign,
              transform: layer.uppercase ? "uppercase" : "none",
            },
          },
        });
        if (layer.effect || layer.strokeWidth > 0) warnings.add("Text effects and outlines are not part of the template format and were left out.");
        break;
      }
      case "shape": {
        const def = getShape(layer.shapeId);
        if (!def) break;
        const path = { d: shapePathD(def, layer.width, layer.height), viewBox: [0, 0, round(layer.width), round(layer.height)] as TplPath["viewBox"] };
        layers.push({
          ...base(layer),
          type: "shape",
          shape:
            def.mode === "fill"
              ? { kind: "path", path, fill: hex6or8(layer.color) }
              : { kind: "path", path, stroke: { color: hex6or8(layer.color), width: round(layer.strokeWidth) } },
        });
        break;
      }
      case "path": {
        const scaled = layer.nodes.map((n) => mapNode(n, (x, y) => [x * layer.width, y * layer.height]));
        const d = commandsToD(pathCommands(scaled, layer.closed));
        layers.push({
          ...base(layer),
          type: "shape",
          shape: {
            kind: "path",
            path: { d, viewBox: [0, 0, round(layer.width), round(layer.height)] },
            ...(layer.closed && layer.fill ? { fill: hex6or8(layer.fill) } : {}),
            ...(layer.strokeWidth > 0 ? { stroke: { color: hex6or8(layer.stroke), width: round(layer.strokeWidth) } } : {}),
          },
        });
        if (layer.glow) warnings.add("Glow on pen paths is not part of the template format and was left out.");
        break;
      }
      case "draw": {
        // A freehand stroke is a polyline in 0–1 box space: exactly an SVG path
        // in a unit viewBox, stroked.
        const d = layer.points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${round(px * layer.width)} ${round(py * layer.height)}`).join(" ");
        layers.push({
          ...base(layer),
          type: "shape",
          shape: {
            kind: "path",
            path: { d, viewBox: [0, 0, round(layer.width), round(layer.height)] },
            stroke: { color: hex6or8(layer.color), width: round(layer.strokeWidth) },
          },
        });
        warnings.add("Drawings were exported as plain vector paths.");
        break;
      }
    }
  }

  if (doc.border.width > 0) warnings.add("The printed page border is not part of the template format and was left out.");

  const now = (options.now ?? (() => new Date()))().toISOString();
  const template: FramersTemplate = {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    id: templateId(options.id ?? doc.title, "tpl"),
    name: (options.name ?? doc.title).trim() || "Untitled template",
    ...(options.category ? { category: options.category } : {}),
    ...(options.tags?.length ? { tags: options.tags } : {}),
    canvas: {
      width: doc.width,
      height: doc.height,
      ...(doc.printMm ? { physical: { widthMm: doc.printMm.widthMm, heightMm: doc.printMm.heightMm } } : {}),
    },
    assets,
    pages: [
      {
        id: "page_1",
        background: { color: hex6or8(doc.background) },
        layers,
      },
    ],
    meta: {
      ...(options.author ? { author: options.author } : {}),
      createdAt: now,
      updatedAt: now,
    },
  };
  return { template, warnings: [...warnings] };
}

/* -------------------------------------------------------------------------- */
/* Import: template → studio                                                   */
/* -------------------------------------------------------------------------- */

export interface ImportOptions {
  /**
   * Turn an asset into something the studio can load: a storage path, an https
   * URL, or a data: URL. Defaults to the first rendition, preferring print.
   * Return null to drop the layer.
   */
  resolveAsset?: (key: string, asset: TplAsset) => string | null;
}

export interface ImportResult {
  doc: StudioDocument;
  warnings: string[];
}

function defaultResolve(_key: string, asset: TplAsset): string | null {
  const r = asset.renditions;
  if (!r) return null;
  return r.print ?? r.original ?? r.screen ?? r.thumb ?? Object.values(r)[0] ?? null;
}

/** Where a child lands once its parent's box and rotation are applied. */
interface Frame {
  dx: number;
  dy: number;
  /** Parent centre, in document space, for rotating children about it. */
  cx: number;
  cy: number;
  rotation: number;
}

const ROOT: Frame = { dx: 0, dy: 0, cx: 0, cy: 0, rotation: 0 };

function place(t: TplTransform, frame: Frame) {
  const x = t.x + frame.dx;
  const y = t.y + frame.dy;
  const rotation = finite(t.rotation, 0) + frame.rotation;
  if (!frame.rotation) return { x, y, width: t.width, height: t.height, rotation };
  // Rotate the child's centre about the parent's centre; the child keeps its
  // own unrotated top-left convention around its new centre.
  const rad = (frame.rotation * Math.PI) / 180;
  const ccx = x + t.width / 2 - frame.cx;
  const ccy = y + t.height / 2 - frame.cy;
  const nx = frame.cx + ccx * Math.cos(rad) - ccy * Math.sin(rad);
  const ny = frame.cy + ccx * Math.sin(rad) + ccy * Math.cos(rad);
  return { x: nx - t.width / 2, y: ny - t.height / 2, width: t.width, height: t.height, rotation };
}

/** Resolve CSS-grid-like tracks (`1fr`, `240px`) to px offsets. */
function tracks(defs: string[], total: number, gap: number): { start: number; size: number }[] {
  const parsed = defs.map((d) => {
    const m = /^([0-9.]+)(fr|px)$/.exec(d);
    return m ? { n: Number(m[1]), unit: m[2] } : { n: 1, unit: "fr" };
  });
  const fixed = parsed.reduce((s, t) => s + (t.unit === "px" ? t.n : 0), 0);
  const frs = parsed.reduce((s, t) => s + (t.unit === "fr" ? t.n : 0), 0);
  const free = Math.max(0, total - fixed - gap * Math.max(0, defs.length - 1));
  let at = 0;
  return parsed.map((t) => {
    const size = t.unit === "px" ? t.n : frs > 0 ? (free * t.n) / frs : 0;
    const out = { start: at, size };
    at += size + gap;
    return out;
  });
}

export function fromFramersTemplate(input: unknown, options: ImportOptions = {}): ImportResult | null {
  if (!isObj(input) || input.schemaVersion !== TEMPLATE_SCHEMA_VERSION) return null;
  const canvas = input.canvas;
  if (!isObj(canvas)) return null;
  const width = finite(canvas.width, 0);
  const height = finite(canvas.height, 0);
  if (width <= 0 || height <= 0) return null;
  const pages = input.pages;
  if (!Array.isArray(pages) || pages.length === 0 || !isObj(pages[0])) return null;

  const warnings = new Set<string>();
  if (pages.length > 1) warnings.add(`Only the first of ${pages.length} pages was opened.`);

  const assets: Record<string, TplAsset> = isObj(input.assets) ? (input.assets as Record<string, TplAsset>) : {};
  const resolve = options.resolveAsset ?? defaultResolve;
  const fonts: CustomFont[] = [];

  function asset(key: unknown): { key: string; asset: TplAsset; src: string } | null {
    if (typeof key !== "string") return null;
    const a = assets[key];
    if (!isObj(a)) return null;
    const src = resolve(key, a);
    return typeof src === "string" && src.length > 0 ? { key, asset: a, src } : null;
  }

  function fontIdFor(key: unknown): string | null {
    if (typeof key !== "string" || !isObj(assets[key])) return null;
    const a = assets[key];
    const family = typeof a.family === "string" ? a.family.trim().toLowerCase() : "";
    const known = FONT_CATALOGUE.find((f) => f.family.toLowerCase() === family);
    if (known) return known.id;
    const src = resolve(key, a);
    if (!src) return null;
    const id = `custom-${key.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`;
    if (!fonts.some((f) => f.id === id)) fonts.push({ id, name: a.family ?? key, src });
    return id;
  }

  const page = pages[0] as FramersTemplate["pages"][number];
  const out: Record<string, unknown>[] = [];

  function common(l: TplLayerBase, box: ReturnType<typeof place>, id?: string) {
    const locks = l.locks ?? {};
    const locked = locks.all === true || (locks.position === true && locks.size === true && locks.rotation === true);
    if (l.blendMode && l.blendMode !== "normal") warnings.add("Blend modes are not supported yet and were drawn as normal.");
    return {
      id: id ?? (typeof l.id === "string" ? l.id : createId("l")),
      name: typeof l.name === "string" ? l.name : undefined,
      ...box,
      opacity: clamp(finite(l.opacity, 1), 0, 1),
      visible: l.visible !== false,
      locked,
      ...(l.role === "editable" || l.role === "placeholder" ? { role: l.role } : {}),
    };
  }

  function image(
    base: ReturnType<typeof common>,
    fill: TplImageFill | undefined,
    mask: Mask | null,
    flip: { flipX?: boolean; flipY?: boolean },
    placeholder: boolean
  ): Record<string, unknown> | null {
    const a = fill ? asset(fill.asset) : null;
    if (!a || !fill) {
      warnings.add("A picture whose file could not be found was left out.");
      return null;
    }
    const natW = finite(a.asset.width, base.width);
    const natH = finite(a.asset.height, base.height);
    const crop =
      fill.crop && fill.fit !== "stretch"
        ? { x: fill.crop.x, y: fill.crop.y, w: fill.crop.width, h: fill.crop.height }
        : fill.fit === "stretch" || fill.fit === "contain"
          ? { x: 0, y: 0, w: 1, h: 1 }
          : coverCrop(base.width / base.height, natW, natH, fill.focalPoint);
    if (fill.fit === "contain") warnings.add("A 'contain' picture was stretched to fill its box.");
    const f = fill.filters ?? {};
    return {
      ...base,
      kind: "image",
      src: a.src,
      naturalWidth: natW,
      naturalHeight: natH,
      crop,
      adjust: {
        brightness: Math.round(finite(f.brightness, 0) * 100),
        contrast: Math.round(finite(f.contrast, 0) * 100),
        saturation: f.grayscale ? -100 : Math.round(finite(f.saturation, 0) * 100),
      },
      mask: mask ?? { kind: "none", radius: 0.08 },
      strokes: [],
      ...(flip.flipX ? { flipX: true } : {}),
      ...(flip.flipY ? { flipY: true } : {}),
      // The template's picture in a slot is the stand-in the customer replaces.
      ...(placeholder ? { sample: true } : {}),
    };
  }

  function maskFromPath(path: TplPath): Mask | null {
    if (!isObj(path) || typeof path.d !== "string" || !Array.isArray(path.viewBox)) return null;
    const shapeId = catalogueShapeFor(path, "fill");
    if (shapeId) return { kind: "shape", radius: 0.08, shapeId };
    if (!parseSvgPath(path.d)) {
      warnings.add("A frame outline used curves the studio cannot read yet; the photo was left unclipped.");
      return null;
    }
    return { kind: "path", radius: 0.08, path: { d: path.d, viewBox: path.viewBox } };
  }

  function walk(l: TplLayer, frame: Frame, groupId?: string) {
    if (!isObj(l) || !isObj(l.transform)) return;
    const box = place(l.transform, frame);
    const tag = (o: Record<string, unknown> | null) => {
      if (o) out.push(groupId ? { ...o, groupId } : o);
    };

    switch (l.type) {
      case "image":
        tag(image(common(l, box), l.fill, null, l.transform, l.role === "placeholder"));
        return;

      case "frame": {
        const mask = "path" in l.mask ? maskFromPath(l.mask.path) : null;
        if (!("path" in l.mask)) warnings.add("Raster frame masks are not supported yet; the photo was left unclipped.");
        const photo = image(common(l, box), l.fill, mask, l.transform, l.role === "placeholder");
        const art = l.overlay ? asset(l.overlay.asset) : null;
        if (l.overlay && !art) warnings.add("A frame's decoration could not be found and was left out.");
        // The overlay (a polaroid's border, a tape strip) travels with the
        // photo: same box, grouped, locked so a drag on it moves the pair.
        const group = art && photo ? groupId ?? createId("grp") : groupId;
        const overlay = art
          ? {
              ...common({ ...l, role: "decor", locks: { all: true } }, box, createId("img")),
              name: `${l.name ?? "Frame"} art`,
              kind: "image",
              src: art.src,
              naturalWidth: finite(art.asset.width, box.width),
              naturalHeight: finite(art.asset.height, box.height),
              crop: { x: 0, y: 0, w: 1, h: 1 },
              adjust: { brightness: 0, contrast: 0, saturation: 0 },
              mask: { kind: "none", radius: 0.08 },
              strokes: [],
            }
          : null;
        const withGroup = (o: Record<string, unknown> | null) => (o && group ? { ...o, groupId: group } : o);
        const ordered = l.overlay?.placement === "above" ? [photo, overlay] : [overlay, photo];
        for (const o of ordered) if (o) out.push(withGroup(o)!);
        return;
      }

      case "grid": {
        const g = l.grid;
        if (!isObj(g) || !Array.isArray(g.areas) || !Array.isArray(g.columns) || !Array.isArray(g.rows)) return;
        const cols = tracks(g.columns, box.width, finite(g.columnGap, 0));
        const rows = tracks(g.rows, box.height, finite(g.rowGap, 0));
        const spans = new Map<string, { r0: number; r1: number; c0: number; c1: number }>();
        g.areas.forEach((row, r) =>
          row.forEach((name, c) => {
            if (name === "." || !cols[c] || !rows[r]) return;
            const s = spans.get(name);
            spans.set(
              name,
              s ? { r0: Math.min(s.r0, r), r1: Math.max(s.r1, r), c0: Math.min(s.c0, c), c1: Math.max(s.c1, c) } : { r0: r, r1: r, c0: c, c1: c }
            );
          })
        );
        const group = groupId ?? createId("grp");
        const inner: Frame = {
          dx: box.x,
          dy: box.y,
          cx: box.x + box.width / 2,
          cy: box.y + box.height / 2,
          rotation: box.rotation,
        };
        for (const [name, s] of spans) {
          const cell = l.cells?.[name];
          const t: TplTransform = {
            x: cols[s.c0].start,
            y: rows[s.r0].start,
            width: cols[s.c1].start + cols[s.c1].size - cols[s.c0].start,
            height: rows[s.r1].start + rows[s.r1].size - rows[s.r0].start,
          };
          if (t.width <= 0 || t.height <= 0) continue;
          const role = cell?.role ?? l.role;
          const placed = place(t, inner);
          const photo = image(
            common({ ...l, role, name: `${l.name ?? "Grid"} ${name}` }, placed, createId("img")),
            cell?.fill,
            null,
            {},
            role === "placeholder"
          );
          if (photo) out.push({ ...photo, groupId: group });
        }
        return;
      }

      case "group": {
        if (!Array.isArray(l.children)) return;
        const group = groupId ?? createId("grp");
        const inner: Frame = {
          dx: box.x,
          dy: box.y,
          cx: box.x + box.width / 2,
          cy: box.y + box.height / 2,
          rotation: box.rotation,
        };
        for (const child of l.children) walk(child, inner, group);
        return;
      }

      case "text": {
        const t = l.text;
        if (!isObj(t) || !Array.isArray(t.paragraphs) || !isObj(t.style)) return;
        const runs = t.paragraphs.flatMap((p) => (Array.isArray(p.runs) ? p.runs : []));
        const first = runs[0] ?? { text: "" };
        const text = t.paragraphs.map((p) => (Array.isArray(p.runs) ? p.runs.map((r) => (typeof r.text === "string" ? r.text : "")).join("") : "")).join("\n");
        const styled = runs.some((r) => r.color || r.font || r.bold !== first.bold || r.italic !== first.italic);
        if (styled) warnings.add("Mixed styles inside one text box were merged into one style.");
        const fontId = fontIdFor(first.font ?? t.style.font);
        if (!fontId) warnings.add("A font could not be found; the default was used.");
        const a = typeof t.style.font === "string" ? assets[t.style.font] : undefined;
        const align = t.paragraphs[0]?.align ?? t.style.align;
        const list = t.paragraphs[0]?.list;
        tag({
          ...common(l, box),
          kind: "text",
          text,
          ...(fontId ? { fontId } : {}),
          fontWeight: first.bold ? 700 : finite(a?.weight, 400),
          italic: first.italic === true || a?.style === "italic",
          fontSize: finite(t.style.fontSize, 64),
          color: first.color ?? t.style.color,
          align: align === "left" || align === "right" ? align : "center",
          verticalAlign: t.style.verticalAlign,
          lineHeight: finite(t.style.lineHeight, 1.4),
          letterSpacing: finite(t.style.letterSpacing, 0),
          uppercase: t.style.transform === "uppercase",
          strokeColor: "#ffffff",
          strokeWidth: 0,
          ...(first.underline ? { underline: true } : {}),
          ...(first.strike ? { strike: true } : {}),
          ...(list === "bullet" || list === "number" ? { list } : {}),
        });
        if (align === "justify") warnings.add("Justified text was set to centred.");
        return;
      }

      case "shape": {
        const s = l.shape;
        if (!isObj(s)) return;
        const shapeId =
          s.kind === "rect"
            ? s.cornerRadius
              ? "rounded-square"
              : "square"
            : s.kind === "ellipse"
              ? "circle"
              : s.kind === "line"
                ? "line"
                : s.path
                  ? catalogueShapeFor(s.path)
                  : null;
        if (!shapeId) {
          warnings.add("A custom vector shape is not in the studio's shape library and was left out.");
          return;
        }
        const def = getShape(shapeId);
        tag({
          ...common(l, box),
          kind: "shape",
          shapeId,
          color: def?.mode === "stroke" ? s.stroke?.color ?? s.fill : s.fill ?? s.stroke?.color,
          strokeWidth: finite(s.stroke?.width, 12),
        });
        return;
      }
    }
  }

  // Background: colour on the page, picture as the bottom layer — which is how
  // the studio's own "Set as background" represents it.
  const bg = isObj(page.background) ? page.background : {};
  if (bg.image) {
    const layer = image(
      {
        id: createId("img"),
        name: "Background",
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        opacity: clamp(finite(bg.opacity, 1), 0, 1),
        visible: true,
        locked: true,
      },
      bg.image,
      null,
      {},
      false
    );
    if (layer) out.push(layer);
    if (bg.imageRotation) warnings.add("A rotated background picture was drawn upright.");
  }

  for (const l of Array.isArray(page.layers) ? page.layers : []) walk(l, ROOT);

  // Ids must be unique in the studio (selection and undo key on them).
  const seen = new Set<string>();
  for (const l of out) {
    if (typeof l.id !== "string" || seen.has(l.id)) l.id = createId("l");
    seen.add(l.id as string);
  }

  const physical = isObj(canvas.physical) ? canvas.physical : null;
  const doc = migrateDocument({
    version: DOCUMENT_VERSION,
    width,
    height,
    background: typeof bg.color === "string" ? bg.color.slice(0, 7) : "#ffffff",
    title: typeof input.name === "string" ? input.name : "Untitled design",
    border: { width: 0, color: "#ffffff" },
    ...(physical ? { printMm: { widthMm: physical.widthMm, heightMm: physical.heightMm } } : {}),
    ...(fonts.length ? { fonts } : {}),
    layers: out,
  });
  if (!doc) return null;
  if (doc.layers.length < out.length) warnings.add("Some layers could not be read and were left out.");
  return { doc, warnings: [...warnings] };
}
