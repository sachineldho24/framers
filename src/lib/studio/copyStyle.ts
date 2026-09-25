/**
 * Canva's "Copy style": what carries over from one layer to another.
 *
 * Only like-for-like styles move — typography onto text, fill onto a shape,
 * colour work onto a photo — plus transparency, which every layer has. Content
 * (the words, the picture, the shape) and geometry never do.
 */

import type { Layer } from "./document";
import type { StudioAction, TextStylePatch } from "./reducer";

/**
 * The actions that paste `source`'s style onto `target`. `measureTextHeight`
 * re-measures a text target under the new style (only the UI can measure), so
 * its box grows or shrinks with the pasted font.
 */
export function pasteStyleActions(
  source: Layer,
  target: Layer,
  measureTextHeight?: (patch: Partial<TextStylePatch>) => number | undefined
): StudioAction[] {
  const actions: StudioAction[] = [];
  if (source.id === target.id) return actions;

  if (source.kind === "text" && target.kind === "text") {
    const patch: Partial<TextStylePatch> = {
      fontId: source.fontId,
      fontWeight: source.fontWeight,
      italic: source.italic,
      fontSize: source.fontSize,
      color: source.color,
      align: source.align,
      lineHeight: source.lineHeight,
      letterSpacing: source.letterSpacing,
      uppercase: source.uppercase,
      strokeColor: source.strokeColor,
      strokeWidth: source.strokeWidth,
      underline: source.underline ?? false,
      strike: source.strike ?? false,
      list: source.list ?? "none",
      effect: source.effect ?? null,
    };
    actions.push({
      type: "setTextStyle",
      layerId: target.id,
      patch,
      height: measureTextHeight?.(patch),
    });
  } else if (source.kind === "shape" && target.kind === "shape") {
    actions.push({
      type: "setShapeStyle",
      layerId: target.id,
      patch: { color: source.color, strokeWidth: source.strokeWidth },
    });
  } else if (source.kind === "draw" && target.kind === "draw") {
    actions.push({
      type: "setDrawStyle",
      layerId: target.id,
      patch: { color: source.color, strokeWidth: source.strokeWidth },
    });
  } else if (source.kind === "image" && target.kind === "image") {
    actions.push(
      { type: "setAdjust", layerId: target.id, adjust: { ...source.adjust } },
      { type: "setFilter", layerId: target.id, filter: source.filter, strength: source.filterStrength },
      { type: "setMask", layerId: target.id, mask: { ...source.mask } }
    );
    if (source.outline) {
      actions.push({ type: "setImageOutline", layerId: target.id, outline: { ...source.outline } });
    }
  }

  actions.push({ type: "setLayerOpacity", layerId: target.id, opacity: source.opacity });
  return actions;
}
