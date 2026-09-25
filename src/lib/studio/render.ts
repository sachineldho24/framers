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

import type { DrawLayer, ImageLayer, PathLayer, ShapeLayer, StudioDocument, TextLayer } from "./document";
import { mapNode, pathCommands } from "./penPath";
import { HIGHLIGHTER_ALPHA } from "./drawing";
import { borderInsetPx } from "./document";
import { buildFilterString } from "./filters";
import { fontShorthand } from "./fonts";
import { degToRad, type Viewport } from "./geometry";
import { getShape, type ShapeCommand } from "./shapes";
import {
  effectAlpha,
  effectBlurPx,
  effectOffsetPx,
  effectThicknessPx,
  GLITCH_PAIRS,
  withAlpha,
} from "./textEffects";
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
  traceMaskPath,
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
  // The crop is in display space; under a mirror, the source rect is its
  // reflection.
  const cropX = layer.flipX ? 1 - layer.crop.x - layer.crop.w : layer.crop.x;
  const cropY = layer.flipY ? 1 - layer.crop.y - layer.crop.h : layer.crop.y;
  const sx = cropX * natural.w;
  const sy = cropY * natural.h;
  const sw = Math.max(1, layer.crop.w * natural.w);
  const sh = Math.max(1, layer.crop.h * natural.h);
  /** Draw the source into `target`, mirrored as the layer asks. */
  const drawSource = (target: AnyCtx) => {
    target.save();
    if (layer.flipX || layer.flipY) {
      target.translate(layer.flipX ? destW : 0, layer.flipY ? destH : 0);
      target.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    }
    target.drawImage(image, sx, sy, sw, sh, 0, 0, destW, destH);
    target.restore();
  };

  const filter = buildFilterString(layer.filter, layer.filterStrength, layer.adjust);
  const mask = resolveMask(layer, destW, destH, options);

  if (!mask) {
    // Fast path: straight to the target, no intermediate surface.
    ctx.save();
    if (filter !== "none") ctx.filter = filter;
    drawSource(ctx);
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
  drawSource(sctx);
  sctx.filter = "none";

  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(mask as unknown as ImageLike, 0, 0, scratchW, scratchH);
  sctx.globalCompositeOperation = "source-over";

  ctx.drawImage(scratch as unknown as ImageLike, 0, 0, destW, destH);
}

/**
 * The photo's border, inside its edge and following the frame shape. Stroked at
 * twice the weight and clipped to the shape, which puts the whole line inside
 * — the photo's footprint on the page doesn't grow when a border is added.
 */
function drawImageOutline(
  ctx: AnyCtx,
  layer: ImageLayer,
  destW: number,
  destH: number,
  scale: number
): void {
  const outline = layer.outline;
  if (!outline || outline.width <= 0) return;
  const w = outline.width * scale;
  ctx.save();
  traceMaskPath(ctx, layer.mask, destW, destH);
  ctx.clip();
  traceMaskPath(ctx, layer.mask, destW, destH);
  ctx.lineWidth = w * 2;
  ctx.strokeStyle = outline.color;
  if (outline.style === "dashed") {
    ctx.setLineDash([w * 3, w * 2]);
  } else if (outline.style === "dotted") {
    // Round caps on a zero-length dash draw dots one weight across.
    ctx.lineCap = "round";
    ctx.setLineDash([0, w * 2.5]);
    ctx.lineWidth = w * 2;
  }
  ctx.stroke();
  ctx.restore();
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
 * screen breaks in the same place on paper. Effects are sized from the font
 * size for the same reason (see `textEffects.ts`).
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
    list: layer.list,
    measure: makeMeasure(ctx, spacingPx, mode),
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  // Without this, a sharp corner on a heavy display face throws a spike.
  ctx.miterLimit = 2;

  const blockTop = alignOffsetY(layout.totalHeight, destH, layer.verticalAlign);
  const placed = layout.lines
    .map((line, index) => ({
      text: line.text,
      width: line.width,
      x: alignOffsetX(line.width, destW, layer.align),
      y: blockTop + lineTop(index, layout.lineHeightPx, fontSizePx),
    }))
    .filter((line) => line.text !== "");

  /** Paint every line once: fill, or stroke at `strokePx` (centred, so doubled). */
  const paint = (
    fill: string | null,
    stroke: { color: string; px: number } | null,
    dx = 0,
    dy = 0
  ) => {
    if (stroke) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.px * 2;
    }
    if (fill) ctx.fillStyle = fill;
    for (const line of placed) {
      if (stroke) drawLine(ctx, line.text, line.x + dx, line.y + dy, spacingPx, mode, true);
      if (fill) drawLine(ctx, line.text, line.x + dx, line.y + dy, spacingPx, mode, false);
    }
  };

  const outlinePx = layer.strokeWidth * fontSizePx;
  const outline = outlinePx > 0 ? { color: layer.strokeColor, px: outlinePx } : null;
  const effect = layer.effect;

  /**
   * Canvas shadows are specified in *device* space and ignore the transform, so
   * a rotated layer's shadow would point the wrong way. Map the layer-space
   * offset through the current matrix instead.
   */
  const setShadow = (color: string, blurPx: number, dx: number, dy: number) => {
    const m = ctx.getTransform();
    const unit = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = blurPx * unit;
    ctx.shadowOffsetX = m.a * dx + m.c * dy;
    ctx.shadowOffsetY = m.b * dx + m.d * dy;
  };
  const clearShadow = () => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  // Main pass by default: outline first, so the fill sits on top of it.
  let mainFill: string | null = layer.color;
  let mainStroke = outline;

  if (effect && effect.kind !== "none") {
    const { dx, dy } = effectOffsetPx(effect, fontSizePx);
    ctx.save();
    switch (effect.kind) {
      case "shadow":
        setShadow(withAlpha(effect.color, effectAlpha(effect)), effectBlurPx(effect, fontSizePx), dx, dy);
        paint(layer.color, outline);
        break;
      case "lift": {
        // A soft shadow straight down, darker and wider with intensity.
        const k = effect.intensity / 100;
        setShadow(`rgba(0, 0, 0, ${0.15 + 0.45 * k})`, fontSizePx * (0.1 + 0.4 * k), 0, fontSizePx * (0.02 + 0.08 * k));
        paint(layer.color, outline);
        break;
      }
      case "hollow":
        mainFill = null;
        mainStroke = { color: layer.color, px: effectThicknessPx(effect, fontSizePx) / 2 };
        break;
      case "splice":
        paint(effect.color, null, dx, dy);
        mainFill = null;
        mainStroke = { color: layer.color, px: effectThicknessPx(effect, fontSizePx) / 2 };
        break;
      case "echo":
        // Two trailing copies, fading, behind the words.
        ctx.globalAlpha *= 0.25;
        paint(effect.color, null, dx * 2, dy * 2);
        ctx.globalAlpha /= 0.25;
        ctx.globalAlpha *= 0.5;
        paint(effect.color, null, dx, dy);
        break;
      case "glitch": {
        const [a, b] = GLITCH_PAIRS[effect.glitchPair];
        const gx = dy === 0 && dx === 0 ? fontSizePx * 0.03 : dx * 0.5;
        const gy = dy * 0.5;
        paint(a, null, -gx, -gy);
        paint(b, null, gx, gy);
        break;
      }
      case "neon": {
        // Glow in the text's own colour, built from a few blurred passes; the
        // core is lightened so it reads as a tube, not as coloured type.
        const k = effect.intensity / 100;
        for (const blur of [0.5, 0.25, 0.1]) {
          setShadow(layer.color, fontSizePx * blur * (0.3 + k), 0, 0);
          paint(layer.color, null);
        }
        mainFill = mixWithWhite(layer.color, 0.55 + 0.25 * k);
        break;
      }
      case "background": {
        // One rounded plate behind the whole block, padded by Spread.
        const pad = (effect.spread / 100) * fontSizePx * 0.6;
        const left = Math.min(...placed.map((l) => l.x)) - pad;
        const right = Math.max(...placed.map((l) => l.x + l.width)) + pad;
        const top = blockTop - pad;
        const bottom = blockTop + layout.totalHeight + pad;
        const w = right - left;
        const h = bottom - top;
        const r = (effect.roundness / 100) * Math.min(w, h) / 2;
        ctx.fillStyle = withAlpha(effect.color, effectAlpha(effect));
        ctx.beginPath();
        if (typeof (ctx as CanvasRenderingContext2D).roundRect === "function") {
          (ctx as CanvasRenderingContext2D).roundRect(left, top, w, h, r);
        } else {
          ctx.rect(left, top, w, h);
        }
        ctx.fill();
        break;
      }
    }
    clearShadow();
    ctx.restore();
  }

  paint(mainFill, mainStroke);

  // Underline and strike-through, in the text colour, under/through each line.
  if (layer.underline || layer.strike) {
    const thickness = Math.max(1, fontSizePx * 0.055);
    ctx.fillStyle = layer.color;
    for (const line of placed) {
      const metrics = ctx.measureText(line.text);
      const ascent = metrics.fontBoundingBoxAscent || fontSizePx * 0.8;
      const baseline = line.y + ascent;
      if (layer.underline) ctx.fillRect(line.x, baseline + fontSizePx * 0.08, line.width, thickness);
      if (layer.strike) ctx.fillRect(line.x, baseline - fontSizePx * 0.3, line.width, thickness);
    }
  }

  if (mode === "native") {
    // The context is restored by the caller, but `letterSpacing` is not part of
    // the save/restore state in every engine — reset it explicitly.
    (ctx as CanvasRenderingContext2D).letterSpacing = "0px";
  }
}

/** Blend a hex colour toward white by `amount` (0–1). */
function mixWithWhite(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  if (!/^#[0-9a-f]{6}$/i.test(hex) || Number.isNaN(n)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
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

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Trace a shape's commands onto a context.
 *
 * Deliberately not `Path2D`: the print path runs the same commands through the
 * same tracer, and `Path2D` doesn't exist in every canvas implementation the
 * export code has to survive.
 */
function traceShapeCommands(
  ctx: AnyCtx,
  commands: readonly ShapeCommand[]
): void {
  ctx.beginPath();
  for (const c of commands) {
    if (c.c === "M") ctx.moveTo(c.x, c.y);
    else if (c.c === "L") ctx.lineTo(c.x, c.y);
    else if (c.c === "Q") ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
    else if (c.c === "C") ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else ctx.closePath();
  }
}

/**
 * Draw a vector element into the layer's box.
 *
 * Filled and stroked shapes are different jobs, and only the *shape* knows
 * which one it is: filling a polyline would paint a region the user never
 * drew. Stroke width is stored in doc px, so it is scaled here rather than in
 * the model - a line keeps its weight in the print at whatever size it is
 * displayed.
 */
function drawShapeLayer(
  ctx: AnyCtx,
  layer: ShapeLayer,
  destW: number,
  destH: number,
  scale: number
): void {
  const def = getShape(layer.shapeId);
  if (!def) return;

  const commands = def.path(destW, destH);
  if (commands.length === 0) return;

  ctx.save();

  if (def.mode === "fill") {
    ctx.fillStyle = layer.color;
    traceShapeCommands(ctx, commands);
    ctx.fill();
    ctx.restore();
    return;
  }

  const width = Math.max(0.25, layer.strokeWidth * scale);
  ctx.strokeStyle = layer.color;
  ctx.lineWidth = width;
  ctx.lineCap = def.lineCap ?? "round";
  ctx.lineJoin = "round";
  if (def.dash && def.dash.length > 0) {
    // The pattern is in multiples of the stroke width, so it thickens with the
    // line instead of turning into a solid stroke when the width grows.
    ctx.setLineDash(def.dash.map((d) => d * width));
  }
  traceShapeCommands(ctx, commands);
  ctx.stroke();
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
    } else if (layer.kind === "shape") {
      drawShapeLayer(ctx, layer, destW, destH, viewport.scale);
    } else if (layer.kind === "draw") {
      drawDrawLayer(ctx, layer, destW, destH, viewport.scale);
    } else if (layer.kind === "path") {
      drawPathLayer(ctx, layer, destW, destH, viewport.scale);
    } else if (image) {
      drawLayerContent(ctx, layer, image, destW, destH, options);
      drawImageOutline(ctx, layer, destW, destH, viewport.scale);
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

/**
 * A freehand stroke, smoothed through the midpoints of its samples so a quick
 * scribble reads as a pen line rather than a polyline. The highlighter is
 * see-through and square-ended, like a real one.
 */
function drawDrawLayer(
  ctx: AnyCtx,
  layer: DrawLayer,
  destW: number,
  destH: number,
  scale: number
): void {
  const pts = layer.points.map(([x, y]) => [x * destW, y * destH] as const);
  if (pts.length === 0) return;
  const highlighter = layer.pen === "highlighter";
  ctx.save();
  if (highlighter) ctx.globalAlpha *= HIGHLIGHTER_ALPHA;
  ctx.strokeStyle = layer.color;
  ctx.fillStyle = layer.color;
  ctx.lineWidth = Math.max(0.5, layer.strokeWidth * scale);
  ctx.lineCap = highlighter ? "square" : "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    // A tap is a dot.
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
  ctx.restore();
}

/**
 * A pen path: optional fill, then the glow, then the line on top.
 *
 * The glow is the line stroked again in the glow colour with a canvas shadow —
 * three passes from wide and faint to tight and bright, which is what gives a
 * neon tube its soft falloff instead of one flat blur. Blur is in doc px scaled
 * by the viewport, so the halo is the same size on screen and in the print.
 */
function drawPathLayer(
  ctx: AnyCtx,
  layer: PathLayer,
  destW: number,
  destH: number,
  scale: number
): void {
  const nodes = layer.nodes.map((n) => mapNode(n, (x, y) => [x * destW, y * destH]));
  const commands = pathCommands(nodes, layer.closed, scale);
  if (commands.length < 2) return;
  const trace = () => traceShapeCommands(ctx, commands);
  const width = layer.strokeWidth * scale;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (layer.closed && layer.fill) {
    ctx.fillStyle = layer.fill;
    trace();
    ctx.fill();
  }

  const glow = layer.glow;
  if (glow && glow.strength > 0 && glow.size > 0) {
    const k = glow.strength / 100;
    const base = ctx.globalAlpha;
    ctx.strokeStyle = glow.color;
    ctx.shadowColor = glow.color;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    // A glow needs a body to cast from even on a hairline or a fill-only path.
    ctx.lineWidth = Math.max(width, 1.5 * scale);
    for (const [spread, alpha] of [
      [1, 0.55],
      [0.5, 0.75],
      [0.2, 1],
    ] as const) {
      ctx.shadowBlur = glow.size * scale * spread;
      ctx.globalAlpha = base * alpha * (0.25 + 0.75 * k);
      trace();
      ctx.stroke();
    }
    ctx.globalAlpha = base;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  if (width > 0) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = width;
    trace();
    ctx.stroke();
  }
  ctx.restore();
}

/** Viewport that maps the document 1:1 onto its own pixel grid. */
export function identityViewport(scale = 1): Viewport {
  return { scale, offsetX: 0, offsetY: 0 };
}
