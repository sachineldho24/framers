"use client";

/**
 * Erase object's highlight: the strokes painted so far, in translucent red over
 * the photo, so the customer can see exactly what will be removed.
 *
 * A canvas in the layer's own rotated frame (the same CSS transform as the
 * selection box), drawn with the eraser's brush. The strokes are painted opaque
 * and the canvas is made translucent as a whole — painting them translucent
 * would darken wherever two strokes overlap.
 */

import { useEffect, useRef } from "react";

import type { ImageLayer, Stroke } from "@/lib/studio/document";
import type { Viewport } from "@/lib/studio/geometry";
import { paintStrokes } from "@/lib/studio/strokes";

export function ObjectMaskOverlay({
  layer,
  viewport,
  strokes,
}: {
  layer: ImageLayer;
  viewport: Viewport;
  strokes: Stroke[];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const w = layer.width * viewport.scale;
  const h = layer.height * viewport.scale;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStrokes(ctx, strokes, canvas.width, canvas.height);
    // Recolour what was painted: keep its shape, make it red.
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }, [strokes, w, h]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 opacity-50"
      style={{
        width: w,
        height: h,
        transform: `translate(${viewport.offsetX + layer.x * viewport.scale}px, ${
          viewport.offsetY + layer.y * viewport.scale
        }px) rotate(${layer.rotation}deg)`,
        transformOrigin: "center",
      }}
    />
  );
}
