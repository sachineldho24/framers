/**
 * Document reducer — pure `(doc, action) => doc`.
 *
 * Never mutates its input: every action returns a new document (with untouched
 * layers shared by reference) so history can snapshot by holding the old one.
 * Locked layers reject geometry edits here rather than in the UI, so a stray
 * keyboard shortcut can't move something the user pinned down.
 */

import {
  clampFontSize,
  cloneDocument,
  cloneLayer,
  createId,
  FULL_CROP,
  isImageLayer,
  layerIndex,
  MAX_BORDER,
  NO_ADJUSTMENTS,
  textLayerName,
  type Adjustments,
  type CropRect,
  type ImageLayer,
  type Layer,
  type Mask,
  type MaskKind,
  type PageBorder,
  type Stroke,
  type StudioDocument,
  type TextLayer,
} from "./document";
import type { FilterId } from "./filters";
import { DEFAULT_FILTER } from "./filters";
import { fitToAspect } from "./crop";
import { getFont, nearestWeight } from "./fonts";
import {
  MAX_LETTER_SPACING,
  MAX_LINE_HEIGHT,
  MAX_STROKE_WIDTH,
  MIN_LETTER_SPACING,
  MIN_LINE_HEIGHT,
  type TextAlign,
  type VerticalAlign,
} from "./text";
import {
  alignToPage,
  clamp,
  containBox,
  MIN_LAYER_SIZE,
  normaliseAngle,
  type AlignMode,
  type Box,
} from "./geometry";

/** Everything about a text layer's look that the Text panel can change. */
export interface TextStylePatch {
  fontId: string;
  fontWeight: number;
  italic: boolean;
  fontSize: number;
  color: string;
  align: TextAlign;
  verticalAlign: VerticalAlign;
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  strokeColor: string;
  strokeWidth: number;
}

export type StudioAction =
  | { type: "replaceDocument"; doc: StudioDocument }
  | { type: "setTitle"; title: string }
  | { type: "setBackground"; color: string }
  | { type: "setPageBorder"; patch: Partial<PageBorder> }
  | {
      type: "resizeDocument";
      width: number;
      height: number;
      reflow?: boolean;
      /**
       * The new paper size, for a page sized by hand. `null` clears it (back to
       * the frame being the authority); omitted leaves whatever is there.
       */
      printMm?: { widthMm: number; heightMm: number } | null;
    }
  | { type: "addLayer"; layer: Layer; at?: number }
  | { type: "removeLayer"; layerId: string }
  | { type: "duplicateLayer"; layerId: string; offset?: number }
  | { type: "renameLayer"; layerId: string; name: string }
  | {
      type: "setLayerBox";
      layerId: string;
      box: Partial<Box>;
      /**
       * Text only, and in the same commit as the box on purpose: scaling a text
       * layer by its corner changes the size *and* the font, and undo should
       * step over both together.
       */
      fontSize?: number;
    }
  | { type: "nudgeLayer"; layerId: string; dx: number; dy: number }
  | { type: "setLayerOpacity"; layerId: string; opacity: number }
  | { type: "setLayerLocked"; layerId: string; locked: boolean }
  | { type: "setLayerVisible"; layerId: string; visible: boolean }
  | { type: "reorderLayer"; layerId: string; to: number }
  | { type: "moveLayerBy"; layerId: string; delta: number }
  | { type: "bringToFront"; layerId: string }
  | { type: "sendToBack"; layerId: string }
  | { type: "setCrop"; layerId: string; crop: Partial<CropRect> }
  | { type: "resetCrop"; layerId: string }
  /**
   * Reshape an image to a ratio. Box *and* crop, in one action: they have to
   * agree or the photo is stretched, and undo should step over the pair.
   */
  | { type: "setLayerAspect"; layerId: string; aspect: number }
  | { type: "setAdjust"; layerId: string; adjust: Partial<Adjustments> }
  | { type: "resetAdjust"; layerId: string }
  | { type: "setFilter"; layerId: string; filter: FilterId; strength?: number }
  | { type: "setFilterStrength"; layerId: string; strength: number }
  | { type: "setMask"; layerId: string; mask: Partial<Mask> }
  | { type: "addStroke"; layerId: string; stroke: Stroke }
  | { type: "updateStroke"; layerId: string; stroke: Stroke }
  | { type: "removeStroke"; layerId: string; strokeId: string }
  | { type: "clearStrokes"; layerId: string }
  | { type: "flipLayer"; layerId: string; axis: "horizontal" | "vertical" }
  | { type: "alignLayer"; layerId: string; mode: AlignMode }
  | { type: "fitLayerToPage"; layerId: string; mode: "contain" | "cover" }
  | { type: "setLayerAsBackground"; layerId: string }
  /** `height` comes from the caller because only the UI can measure text. */
  | { type: "setText"; layerId: string; text: string; height?: number }
  | {
      type: "setTextStyle";
      layerId: string;
      patch: Partial<TextStylePatch>;
      height?: number;
    };

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

/** Replace one layer, returning the same document when nothing changed. */
function mapLayer(
  doc: StudioDocument,
  layerId: string,
  fn: (layer: Layer) => Layer | null
): StudioDocument {
  const index = layerIndex(doc, layerId);
  if (index < 0) return doc;
  const next = fn(doc.layers[index]);
  if (!next || next === doc.layers[index]) return doc;
  const layers = doc.layers.slice();
  layers[index] = next;
  return { ...doc, layers };
}

/** Geometry edits are refused on locked layers. */
function mapUnlockedLayer(
  doc: StudioDocument,
  layerId: string,
  fn: (layer: Layer) => Layer | null
): StudioDocument {
  return mapLayer(doc, layerId, (layer) => (layer.locked ? null : fn(layer)));
}

/**
 * Pixel edits — crop, filters, masks, erase strokes — simply don't apply to
 * text. Ignoring them here rather than in the UI means a shortcut or a stale
 * panel can't produce a nonsensical layer.
 */
function mapImageLayer(
  doc: StudioDocument,
  layerId: string,
  fn: (layer: ImageLayer) => Layer | null,
  requireUnlocked = false
): StudioDocument {
  return mapLayer(doc, layerId, (layer) => {
    if (!isImageLayer(layer)) return null;
    if (requireUnlocked && layer.locked) return null;
    return fn(layer);
  });
}

function mapTextLayer(
  doc: StudioDocument,
  layerId: string,
  fn: (layer: TextLayer) => Layer | null
): StudioDocument {
  return mapLayer(doc, layerId, (layer) =>
    layer.kind === "text" && !layer.locked ? fn(layer) : null
  );
}

function normaliseCrop(crop: CropRect): CropRect {
  // Keep the rect inside the source and never let it collapse to nothing.
  const w = clamp(crop.w, 0.02, 1);
  const h = clamp(crop.h, 0.02, 1);
  return {
    w,
    h,
    x: clamp(crop.x, 0, 1 - w),
    y: clamp(crop.y, 0, 1 - h),
  };
}

export function studioReducer(
  doc: StudioDocument,
  action: StudioAction
): StudioDocument {
  switch (action.type) {
    case "replaceDocument":
      return action.doc;

    case "setTitle":
      return doc.title === action.title ? doc : { ...doc, title: action.title };

    case "setBackground":
      return doc.background === action.color
        ? doc
        : { ...doc, background: action.color };

    case "setPageBorder": {
      const next: PageBorder = {
        width: clamp(action.patch.width ?? doc.border.width, 0, MAX_BORDER),
        color: action.patch.color ?? doc.border.color,
      };
      // Identity on a no-op: the slider fires on every pointermove, and an
      // unchanged document costs no render.
      if (next.width === doc.border.width && next.color === doc.border.color) {
        return doc;
      }
      return { ...doc, border: next };
    }

    case "resizeDocument": {
      const width = Math.max(1, Math.round(action.width));
      const height = Math.max(1, Math.round(action.height));
      // The paper size is part of the resize: a page can keep its grid and
      // still change what paper it is (typing 4096 px on an A2 page), so this
      // can't short-circuit on the pixels alone.
      const paper =
        action.printMm === undefined
          ? doc.printMm
            ? { printMm: doc.printMm }
            : {}
          : action.printMm
            ? { printMm: { ...action.printMm } }
            : {};
      const sameMm =
        (paper.printMm?.widthMm ?? 0) === (doc.printMm?.widthMm ?? 0) &&
        (paper.printMm?.heightMm ?? 0) === (doc.printMm?.heightMm ?? 0);
      if (width === doc.width && height === doc.height && sameMm) return doc;

      const base = { ...doc, width, height };
      delete base.printMm;
      if (action.reflow === false) return { ...base, ...paper };
      // Scale layers proportionally so a resize doesn't strand artwork
      // off-canvas. Uses the smaller axis ratio to keep everything visible.
      const ratio = Math.min(width / doc.width, height / doc.height);
      const dx = (width - doc.width * ratio) / 2;
      const dy = (height - doc.height * ratio) / 2;
      return {
        ...base,
        ...paper,
        layers: doc.layers.map((l) => ({
          ...l,
          x: l.x * ratio + dx,
          y: l.y * ratio + dy,
          width: Math.max(MIN_LAYER_SIZE, l.width * ratio),
          height: Math.max(MIN_LAYER_SIZE, l.height * ratio),
        })),
      };
    }

    case "addLayer": {
      const layers = doc.layers.slice();
      const at = action.at ?? layers.length;
      layers.splice(clamp(at, 0, layers.length), 0, action.layer);
      return { ...doc, layers };
    }

    case "removeLayer": {
      const layers = doc.layers.filter((l) => l.id !== action.layerId);
      return layers.length === doc.layers.length ? doc : { ...doc, layers };
    }

    case "duplicateLayer": {
      const index = layerIndex(doc, action.layerId);
      if (index < 0) return doc;
      const source = doc.layers[index];
      const offset = action.offset ?? Math.round(Math.min(doc.width, doc.height) * 0.03);
      const copy: Layer = {
        ...cloneLayer(source),
        id: createId(source.kind === "text" ? "txt" : "img"),
        name: `${source.name} copy`,
        x: source.x + offset,
        y: source.y + offset,
      };
      // Strokes carry ids of their own, and two layers sharing them would make
      // "remove this stroke" ambiguous.
      if (copy.kind === "image") {
        copy.strokes = copy.strokes.map((s) => ({ ...s, id: createId("s") }));
      }
      const layers = doc.layers.slice();
      layers.splice(index + 1, 0, copy);
      return { ...doc, layers };
    }

    case "renameLayer":
      return mapLayer(doc, action.layerId, (l) => ({
        ...l,
        name: action.name.trim() || l.name,
      }));

    case "setLayerBox":
      return mapUnlockedLayer(doc, action.layerId, (l) => {
        const b = action.box;
        const next: Layer = {
          ...l,
          x: b.x ?? l.x,
          y: b.y ?? l.y,
          width: b.width !== undefined ? Math.max(MIN_LAYER_SIZE, b.width) : l.width,
          height:
            b.height !== undefined ? Math.max(MIN_LAYER_SIZE, b.height) : l.height,
          rotation: b.rotation !== undefined ? normaliseAngle(b.rotation) : l.rotation,
        };
        if (next.kind === "text" && action.fontSize !== undefined) {
          next.fontSize = clampFontSize(action.fontSize);
        }
        return next;
      });

    case "nudgeLayer":
      return mapUnlockedLayer(doc, action.layerId, (l) => ({
        ...l,
        x: l.x + action.dx,
        y: l.y + action.dy,
      }));

    case "setLayerOpacity":
      return mapLayer(doc, action.layerId, (l) => ({
        ...l,
        opacity: clamp01(action.opacity),
      }));

    case "setLayerLocked":
      return mapLayer(doc, action.layerId, (l) => ({
        ...l,
        locked: action.locked,
      }));

    case "setLayerVisible":
      return mapLayer(doc, action.layerId, (l) => ({
        ...l,
        visible: action.visible,
      }));

    case "reorderLayer": {
      const from = layerIndex(doc, action.layerId);
      if (from < 0) return doc;
      const to = clamp(action.to, 0, doc.layers.length - 1);
      if (from === to) return doc;
      const layers = doc.layers.slice();
      const [moved] = layers.splice(from, 1);
      layers.splice(to, 0, moved);
      return { ...doc, layers };
    }

    case "moveLayerBy": {
      const from = layerIndex(doc, action.layerId);
      if (from < 0) return doc;
      return studioReducer(doc, {
        type: "reorderLayer",
        layerId: action.layerId,
        to: from + action.delta,
      });
    }

    case "bringToFront":
      return studioReducer(doc, {
        type: "reorderLayer",
        layerId: action.layerId,
        to: doc.layers.length - 1,
      });

    case "sendToBack":
      return studioReducer(doc, {
        type: "reorderLayer",
        layerId: action.layerId,
        to: 0,
      });

    case "setCrop":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => ({ ...l, crop: normaliseCrop({ ...l.crop, ...action.crop }) }),
        true
      );

    case "resetCrop":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => ({ ...l, crop: { ...FULL_CROP } }),
        true
      );

    case "setLayerAspect":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => {
          const fit = fitToAspect(l, action.aspect, {
            width: doc.width,
            height: doc.height,
          });
          const crop = normaliseCrop(fit.crop);
          // Identity when the shape is already right, so tapping the lit-up
          // button twice doesn't add an undo step that changes nothing.
          if (
            fit.x === l.x &&
            fit.y === l.y &&
            fit.width === l.width &&
            fit.height === l.height &&
            crop.x === l.crop.x &&
            crop.y === l.crop.y &&
            crop.w === l.crop.w &&
            crop.h === l.crop.h
          ) {
            return null;
          }
          return {
            ...l,
            x: fit.x,
            y: fit.y,
            width: Math.max(MIN_LAYER_SIZE, fit.width),
            height: Math.max(MIN_LAYER_SIZE, fit.height),
            crop,
          };
        },
        true
      );

    case "setAdjust":
      return mapImageLayer(doc, action.layerId, (l) => ({
        ...l,
        adjust: {
          brightness: clamp(
            action.adjust.brightness ?? l.adjust.brightness,
            -100,
            100
          ),
          contrast: clamp(action.adjust.contrast ?? l.adjust.contrast, -100, 100),
          saturation: clamp(
            action.adjust.saturation ?? l.adjust.saturation,
            -100,
            100
          ),
        },
      }));

    case "resetAdjust":
      return mapImageLayer(doc, action.layerId, (l) => ({
        ...l,
        adjust: { ...NO_ADJUSTMENTS },
        filter: DEFAULT_FILTER,
        filterStrength: 1,
      }));

    case "setFilter":
      return mapImageLayer(doc, action.layerId, (l) => ({
        ...l,
        filter: action.filter,
        filterStrength: clamp01(action.strength ?? l.filterStrength),
      }));

    case "setFilterStrength":
      return mapImageLayer(doc, action.layerId, (l) => ({
        ...l,
        filterStrength: clamp01(action.strength),
      }));

    case "setMask":
      return mapImageLayer(doc, action.layerId, (l) => ({
        ...l,
        mask: {
          kind: (action.mask.kind ?? l.mask.kind) as MaskKind,
          radius: clamp(action.mask.radius ?? l.mask.radius, 0, 0.5),
        },
      }));

    case "addStroke":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => ({ ...l, strokes: [...l.strokes, action.stroke] }),
        true
      );

    case "updateStroke":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => {
          const index = l.strokes.findIndex((s) => s.id === action.stroke.id);
          if (index < 0) return { ...l, strokes: [...l.strokes, action.stroke] };
          const strokes = l.strokes.slice();
          strokes[index] = action.stroke;
          return { ...l, strokes };
        },
        true
      );

    case "removeStroke":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => ({
          ...l,
          strokes: l.strokes.filter((s) => s.id !== action.strokeId),
        }),
        true
      );

    case "clearStrokes":
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => (l.strokes.length === 0 ? null : { ...l, strokes: [] }),
        true
      );

    case "flipLayer":
      // Flip is expressed as a crop inversion so it composes with cropping and
      // needs no extra state on the layer. Text has no crop, so it has no flip.
      return mapImageLayer(
        doc,
        action.layerId,
        (l) => ({
          ...l,
          crop:
            action.axis === "horizontal"
              ? { ...l.crop, x: 1 - l.crop.x - l.crop.w, w: l.crop.w }
              : { ...l.crop, y: 1 - l.crop.y - l.crop.h, h: l.crop.h },
        }),
        true
      );

    case "alignLayer":
      return mapUnlockedLayer(doc, action.layerId, (l) => {
        const box = alignToPage(l, doc.width, doc.height, action.mode);
        return { ...l, x: box.x, y: box.y };
      });

    case "fitLayerToPage":
      return mapUnlockedLayer(doc, action.layerId, (l) => {
        const box =
          action.mode === "contain"
            ? containBox(doc.width, doc.height, l.width, l.height)
            : coverToPage(doc, l);
        return { ...l, x: box.x, y: box.y, width: box.width, height: box.height };
      });

    case "setLayerAsBackground":
      // "Set image as background" = cover the page, drop to the bottom, lock it.
      return (() => {
        const index = layerIndex(doc, action.layerId);
        if (index < 0) return doc;
        const layer = doc.layers[index];
        if (!isImageLayer(layer)) return doc;
        const box = coverToPage(doc, layer);
        const updated: Layer = {
          ...layer,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rotation: 0,
          locked: true,
        };
        const layers = doc.layers.slice();
        layers.splice(index, 1);
        layers.unshift(updated);
        return { ...doc, layers };
      })();

    case "setText":
      return mapTextLayer(doc, action.layerId, (l) => {
        if (l.text === action.text && action.height === undefined) return null;
        return {
          ...l,
          text: action.text,
          // Keep the layer-list label following the words unless the user has
          // renamed the layer by hand, which we detect by the name still
          // matching what the old text would have generated.
          name:
            l.name === textLayerName(l.text) ? textLayerName(action.text) : l.name,
          height:
            action.height !== undefined
              ? Math.max(MIN_LAYER_SIZE, action.height)
              : l.height,
        };
      });

    case "setTextStyle":
      return mapTextLayer(doc, action.layerId, (l) => {
        const p = action.patch;
        // Changing the family can strand the weight (Anton ships 400 only), so
        // resolve the weight against whichever family ends up selected.
        const font = getFont(p.fontId ?? l.fontId);
        const next: TextLayer = {
          ...l,
          fontId: font.id,
          fontWeight: nearestWeight(font, p.fontWeight ?? l.fontWeight),
          italic: (p.italic ?? l.italic) && font.italic,
          fontSize: clampFontSize(p.fontSize ?? l.fontSize),
          color: p.color ?? l.color,
          align: p.align ?? l.align,
          verticalAlign: p.verticalAlign ?? l.verticalAlign,
          lineHeight: clamp(
            p.lineHeight ?? l.lineHeight,
            MIN_LINE_HEIGHT,
            MAX_LINE_HEIGHT
          ),
          letterSpacing: clamp(
            p.letterSpacing ?? l.letterSpacing,
            MIN_LETTER_SPACING,
            MAX_LETTER_SPACING
          ),
          uppercase: p.uppercase ?? l.uppercase,
          strokeColor: p.strokeColor ?? l.strokeColor,
          strokeWidth: clamp(p.strokeWidth ?? l.strokeWidth, 0, MAX_STROKE_WIDTH),
          height:
            action.height !== undefined
              ? Math.max(MIN_LAYER_SIZE, action.height)
              : l.height,
        };
        return next;
      });

    default:
      return doc;
  }
}

/** Cover the page while preserving the layer's current aspect ratio. */
function coverToPage(doc: StudioDocument, layer: Layer): Box {
  const aspect = layer.width / layer.height;
  let width = doc.width;
  let height = width / aspect;
  if (height < doc.height) {
    height = doc.height;
    width = height * aspect;
  }
  return {
    x: (doc.width - width) / 2,
    y: (doc.height - height) / 2,
    width,
    height,
    rotation: 0,
  };
}

/** Convenience for tests and for seeding a fresh session. */
export function applyActions(
  doc: StudioDocument,
  actions: StudioAction[]
): StudioDocument {
  return actions.reduce(studioReducer, doc);
}

export { cloneDocument };
