/**
 * How far to enlarge a photo with Enhance.
 *
 * The goal is a print, not a bigger number: enough pixels that the photo, at
 * the size it sits on the page, reaches the page's own resolution (300 DPI, or
 * less on a big frame whose grid is capped — see `print.ts`). Going past that
 * adds file size and processing time and nothing anyone can see.
 *
 * Two ceilings apply on top. The model itself is ×4. And the result has to be
 * something a phone can decode and upload: Safari refuses canvases much past
 * 16 megapixels, so that is the cap on the output.
 */

import { PRINT_DPI } from "../document";
import type { ImageLayer } from "../document";
import { imagePrintDpi } from "../print";

/** The model's native factor, and so the most one pass can give. */
export const MODEL_SCALE = 4;
/** Largest result, in pixels. Safari's canvas limit, with a little headroom. */
export const MAX_ENHANCED_PIXELS = 16_000_000;
/** Below this, the enlargement is too small to be worth the wait. */
export const MIN_USEFUL_SCALE = 1.25;

export type EnhancePlan =
  | {
      ok: true;
      /** Final enlargement, 1.25–4. */
      scale: number;
      width: number;
      height: number;
      /** What the photo prints at now, and after. */
      dpiNow: number;
      dpiAfter: number;
    }
  | {
      ok: false;
      reason: "sharp" | "large";
      dpiNow: number;
    };

export function planEnhance(layer: ImageLayer, pageDpi: number): EnhancePlan {
  const dpiNow = imagePrintDpi(layer, pageDpi);
  // A photo can't print sharper than the page grid it is rendered into.
  const target = Math.min(PRINT_DPI, pageDpi);

  if (dpiNow > 0 && dpiNow >= target * 0.95) return { ok: false, reason: "sharp", dpiNow };

  const wanted = dpiNow > 0 ? target / dpiNow : MODEL_SCALE;
  const pixels = layer.naturalWidth * layer.naturalHeight;
  const room = pixels > 0 ? Math.sqrt(MAX_ENHANCED_PIXELS / pixels) : 0;
  const scale = Math.min(MODEL_SCALE, wanted, room);

  if (scale < MIN_USEFUL_SCALE) return { ok: false, reason: "large", dpiNow };

  return {
    ok: true,
    scale,
    width: Math.round(layer.naturalWidth * scale),
    height: Math.round(layer.naturalHeight * scale),
    dpiNow,
    dpiAfter: Math.min(target, dpiNow * scale),
  };
}
