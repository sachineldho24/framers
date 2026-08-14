/**
 * The renderer. One function draws the document, and both the live canvas and
 * the export call it — so what you see is provably what you get. Any divergence
 * between preview and print would be a bug in a print product, not a nuance.
 *
 * Per layer, back to front:
 *   1. transform into the layer's rotated frame
 *   2. draw the cropped source, filtered
 *   3. apply the alpha mask (shape + erase strokes) via destination-in
 *   4. composite the result onto the page at the layer's opacity
 */

import type { ImageLayer, StudioDocument, TextLayer } from "./document";
import { borderInsetPx } from "./document";
import { buildFilterString } from "./filters";
import { fontShorthand } from "./fonts";
import { degToRad, type Viewport } from "./geometry";
import {
  alignOffsetX,
  alignOffsetY,
  layoutText,
  lineTop,
  type MeasureText,
} from "./text";
import {
  buildLayerMask,
  maskCacheKey,
  type AnyCanvas,
  type AnyCtx,
} from "./strokes";

/** Anything drawable by `drawImage`. */
export type ImageLike =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas;

/** Resolved sources, keyed by `layer.src`. */
export type ImageMap = Map<string, ImageLike>;

export interface RenderOptions {
  /** Doc → device px, plus the doc origin's device offset. */
  viewport: Viewport;
  /** Device pixel size of the target surface. */
  surfaceWidth: number;
  surfaceHeight: number;
  images: ImageMap;
  createCanvas: (w: number, h: number) => AnyCanvas;
  /** Paint the page rect. Off for transparent PNG export. */
  drawBackground?: boolean;
  /** Skip a layer mid-gesture (it's being drawn by an overlay instead). */
  skipLayerId?: string | null;
  /** Draw only this layer — used by per-layer export. */
  onlyLayerId?: string;
  /** Reused across frames so masks aren't rebuilt every pointermove. */
  maskCache?: Map<string, AnyCanvas>;
  /** Checkerboard behind the page so transparency is legible on screen. */
  showTransparencyGrid?: boolean;
}

function imageNaturalSize(image: ImageLike): { w: number; h: number } {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return { w: image.naturalWidth, h: image.naturalHeight };
  }
  return { w: (image as { width: number }).width, h: (image as { height: number }).height };
}

const GRID_SIZE = 12;
const GRID_LIGHT = "#ffffff";
const GRID_DARK = "#ececed";

function drawTransparencyGrid(
  ctx: AnyCtx,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = GRID_LIGHT;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = GRID_DARK;
  const cols = Math.ceil(w / GRID_SIZE);
  const rows = Math.ceil(h / GRID_SIZE);
  for (let row = 0; row < rows; row += 1) {
    for (let col = row % 2; col < cols; col += 2) {
      ctx.fillRect(x + col * GRID_SIZE, y + row * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    }
  }
  ctx.restore();
}

/**
 * Draw one layer into the current transform, where (0,0) is the layer's
 * top-left and one unit is one doc px scaled by the viewport.
 */
function drawLayerContent(
  ctx: AnyCtx,
  layer: ImageLayer,
  image: ImageLike,
  destW: number,
  destH: number,
  options: RenderOptions
): void {
  const natural = imageNaturalSize(image);
  if (natural.w === 0 || natural.h === 0) return;

  // Crop is normalised, so it survives the source being a different pixel size
  // than when the crop was made (e.g. a signed URL serving a resized variant).
  const sx = layer.crop.x * natural.w;
  const sy = layer.crop.y * natural.h;
  const sw = Math.max(1, layer.crop.w * natural.w);
  const sh = Math.max(1, layer.crop.h * natural.h);

  const filter = buildFilterString(layer.filter, layer.filterStrength, layer.adjust);
  const mask = resolveMask(layer, destW, destH, options);

  if (!mask) {
    // Fast path: straight to the target, no intermediate surface.
    ctx.save();
    if (filter !== "none") ctx.filter = filter;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, destW, destH);
    ctx.restore();
    return;
  }

  // Masked path: compose on a scratch surface, then punch alpha, then blit.
  const scratchW = Math.max(1, Math.ceil(destW));
  const scratchH = Math.max(1, Math.ceil(destH));
  const scratch = options.createCanvas(scratchW, scratchH);
  const sctx = scratch.getContext("2d") as AnyCtx | null;
  if (!sctx) return;

  if (filter !== "none") sctx.filter = filter;
  sctx.drawImage(image, sx, sy, sw, sh, 0, 0, destW, destH);
  sctx.filter = "none";

  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(mask as unknown as ImageLike, 0, 0, scratchW, scratchH);
  sctx.globalCompositeOperation = "source-over";

  ctx.drawImage(scratch as unknown as ImageLike, 0, 0, destW, destH);
}

/** Build (or reuse) the layer's alpha mask at the drawn size. */
function resolveMask(
  layer: ImageLayer,
  destW: number,
  destH: number,
  options: RenderOptions
): AnyCanvas | null {
  if (layer.mask.kind === "none" && layer.strokes.length === 0) return null;

  // Quantise the cache key so sub-pixel zoom changes don't thrash the cache.
  const keyW = Math.max(1, Math.round(destW));
  const keyH = Math.max(1, Math.round(destH));
  const key = maskCacheKey(keyW, keyH, layer.strokes, layer.mask);
  const cached = options.maskCache?.get(key);
  if (cached) return cached;

  const mask = buildLayerMask({
    width: keyW,
    height: keyH,
    strokes: layer.strokes,
    shape: layer.mask,
    createCanvas: options.createCanvas,
  });
  if (mask && options.maskCache) {
    // Bounded so a long erase session can't grow the cache without limit.
    if (options.maskCache.size > 24) options.maskCache.clear();
    options.maskCache.set(key, mask);
  }
  return mask;
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * How letters get spaced.
 *
 * `ctx.letterSpacing` is the only way to space text without drawing glyph by
 * glyph, and drawing glyph by glyph destroys the shaping that Malayalam and
 * Devanagari depend on — a conjunct becomes a row of unrelated marks. So we use
 * the native property wherever it exists and only fall back to per-character
 * drawing where it doesn't, which is the one case where the tradeoff is
 * unavoidable and the user asked for spacing explicitly.
 */
export type SpacingMode = "none" | "native" | "manual";

/**
 * Which spacing strategy this context will use. Exported because the UI has to
 * measure text the same way the renderer will draw it — a text box whose height
 * came from a different measurement than the draw would wrap differently from
 * what the user sees.
 */
export function spacingModeFor(ctx: AnyCtx, spacingPx: number): SpacingMode {
  if (spacingPx === 0) return "none";
  return "letterSpacing" in ctx ? "native" : "manual";
}

/**
 * A measure function matching exactly how `drawLine` will draw.
 *
 * These two must agree or centred text drifts: the layout decides where a line
 * starts from its measured width, and the draw decides where each glyph lands.
 */
export function makeMeasure(
  ctx: AnyCtx,
  spacingPx: number,
  mode: SpacingMode
): MeasureText {
  if (mode !== "manual") return (text) => ctx.measureText(text).width;
  return (text) => {
    let width = 0;
    for (const ch of text) width += ctx.measureText(ch).width + spacingPx;
    return width;
  };
}

function drawLine(
  ctx: AnyCtx,
  text: string,
  x: number,
  y: number,
  spacingPx: number,
  mode: SpacingMode,
  stroke: boolean
): void {
  if (mode !== "manual") {
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  let cursor = x;
  for (const ch of text) {
    if (stroke) ctx.strokeText(ch, cursor, y);
    else ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacingPx;
  }
}

/**
 * Draw a text layer into the current transform, where (0,0) is the layer's
 * top-left and the box is `destW` × `destH` device px.
 *
 * The layout is recomputed here at the drawn scale rather than cached in the
 * document, because that is what makes the preview and the print identical: the
 * export runs the same wrap at its own font size, so a line that broke on
 * screen breaks in the same place on paper.
 */
function drawTextLayer(
  ctx: AnyCtx,
  layer: TextLayer,
  destW: number,
  destH: number,
  scale: number
): void {
  if (layer.text.trim() === "") return;

  const fontSizePx = layer.fontSize * scale;
  if (fontSizePx < 0.5) return;

  ctx.font = fontShorthand({
    fontId: layer.fontId,
    weight: layer.fontWeight,
    italic: layer.italic,
    sizePx: fontSizePx,
  });

  const spacingPx = layer.letterSpacing * fontSizePx;
  const mode = spacingModeFor(ctx, spacingPx);
  if (mode === "native") {
    (ctx as CanvasRenderingContext2D).letterSpacing = `${spacingPx}px`;
  }

  const layout = layoutText({
    text: layer.text,
    maxWidth: destW,
    fontSize: fontSizePx,
    lineHeight: layer.lineHeight,
    uppercase: layer.uppercase,
    measure: makeMeasure(ctx, spacingPx, mode),
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = layer.color;

  const strokePx = layer.strokeWidth * fontSizePx;
  if (strokePx > 0) {
    ctx.strokeStyle = layer.strokeColor;
    // Doubled because canvas centres a stroke on the outline: half of it is
    // hidden under the fill, so an outline of N px reads as N/2.
    ctx.lineWidth = strokePx * 2;
    ctx.lineJoin = "round";
    // Without this, a sharp corner on a heavy display face throws a spike.
    ctx.miterLimit = 2;
  }

  const blockTop = alignOffsetY(layout.totalHeight, destH, layer.verticalAlign);

  layout.lines.forEach((line, index) => {
    if (line.text === "") return;
    const x = alignOffsetX(line.width, destW, layer.align);
    const y = blockTop + lineTop(index, layout.lineHeightPx, fontSizePx);
    // Stroke first so the fill sits on top of it and the glyph keeps its shape.
    if (strokePx > 0) {
      drawLine(ctx, line.text, x, y, spacingPx, mode, true);
    }
    drawLine(ctx, line.text, x, y, spacingPx, mode, false);
  });

  if (mode === "native") {
    // The context is restored by the caller, but `letterSpacing` is not part of
    // the save/restore state in every engine — reset it explicitly.
    (ctx as CanvasRenderingContext2D).letterSpacing = "0px";
  }
}

/**
 * The printed border, painted over the artwork it frames.
 *
 * Four rects rather than a stroked rect: `strokeRect` centres the line on the
 * path, so half of it would fall outside the page and the visible band would be
 * half the width the user asked for.
 */
function drawPageBorder(
  ctx: AnyCtx,
  doc: StudioDocument,
  pageX: number,
  pageY: number,
  pageW: number,
  pageH: number,
  scale: number
): void {
  const inset = borderInsetPx(doc) * scale;
  if (inset <= 0) return;

  ctx.save();
  ctx.fillStyle = doc.border.color;
  ctx.fillRect(pageX, pageY, pageW, inset);
  ctx.fillRect(pageX, pageY + pageH - inset, pageW, inset);
  const middle = Math.max(0, pageH - inset * 2);
  ctx.fillRect(pageX, pageY + inset, inset, middle);
  ctx.fillRect(pageX + pageW - inset, pageY + inset, inset, middle);
  ctx.restore();
}

/** Draw the whole document. */
export function drawDocument(
  ctx: AnyCtx,
  doc: StudioDocument,
  options: RenderOptions
): void {
  const { viewport, surfaceWidth, surfaceHeight } = options;

  ctx.clearRect(0, 0, surfaceWidth, surfaceHeight);

  const pageX = viewport.offsetX;
  const pageY = viewport.offsetY;
  const pageW = doc.width * viewport.scale;
  const pageH = doc.height * viewport.scale;

  if (options.showTransparencyGrid) {
    drawTransparencyGrid(ctx, pageX, pageY, pageW, pageH);
  }

  if (options.drawBackground !== false) {
    ctx.save();
    ctx.fillStyle = doc.background;
    ctx.fillRect(pageX, pageY, pageW, pageH);
    ctx.restore();
  }

  // Everything is clipped to the page, so artwork dragged past the edge is
  // hidden exactly as it will be when printed.
  ctx.save();
  ctx.beginPath();
  ctx.rect(pageX, pageY, pageW, pageH);
  ctx.clip();

  for (const layer of doc.layers) {
    if (options.onlyLayerId !== undefined && layer.id !== options.onlyLayerId) {
      continue;
    }
    // A single-layer export shows that layer even if it's currently hidden —
    // the user asked for it by name.
    if (options.onlyLayerId === undefined && (!layer.visible || layer.opacity <= 0)) {
      continue;
    }
    if (options.skipLayerId && layer.id === options.skipLayerId) continue;

    // Only image layers have a source to wait for; text draws from the document
    // alone (its font may not have arrived yet, which `fontLoader` handles).
    const image = layer.kind === "image" ? options.images.get(layer.src) : null;
    if (layer.kind === "image" && !image) continue;

    const destW = layer.width * viewport.scale;
    const destH = layer.height * viewport.scale;
    if (destW < 0.5 || destH < 0.5) continue;

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    // Rotate about the layer's centre, then work in top-left coordinates.
    ctx.translate(
      pageX + (layer.x + layer.width / 2) * viewport.scale,
      pageY + (layer.y + layer.height / 2) * viewport.scale
    );
    if (layer.rotation !== 0) ctx.rotate(degToRad(layer.rotation));
    ctx.translate(-destW / 2, -destH / 2);

    if ("imageSmoothingQuality" in ctx) {
      ctx.imageSmoothingEnabled = true;
      (ctx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
    }

    if (layer.kind === "text") {
      drawTextLayer(ctx, layer, destW, destH, viewport.scale);
    } else if (image) {
      drawLayerContent(ctx, layer, image, destW, destH, options);
    }
    ctx.restore();
  }

  // Last, so it covers the artwork's edges — that is what a border is. Skipped
  // for a single-layer export, which is one object on transparency and has no
  // page to put a band around.
  if (options.onlyLayerId === undefined) {
    drawPageBorder(ctx, doc, pageX, pageY, pageW, pageH, viewport.scale);
  }

  ctx.restore();
}

/** Viewport that maps the document 1:1 onto its own pixel grid. */
export function identityViewport(scale = 1): Viewport {
  return { scale, offsetX: 0, offsetY: 0 };
}
