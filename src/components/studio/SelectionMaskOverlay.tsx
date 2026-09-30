"use client";

/**
 * Object selection's highlight: SAM's mask for the current clicks in
 * translucent red over the photo, and a dot for each click — green where the
 * customer said "this", red where they said "not this".
 *
 * The mask is SAM's low-resolution grid over the *source* image, so it is drawn
 * through the layer's crop and mirror (`objectGeometry.ts`) into a canvas in
 * the layer's rotated frame — the same frame as the selection box.
 */

import { useEffect, useRef } from "react";

import type { ImageLayer } from "@/lib/studio/document";
import type { Viewport } from "@/lib/studio/geometry";
import type { MaskCandidate, SegPrompt } from "@/lib/studio/imageAi/protocol";
import { sourceToBox } from "@/lib/studio/objectGeometry";

export function SelectionMaskOverlay({
  layer,
  viewport,
  candidate,
  prompts,
  busy,
}: {
  layer: ImageLayer;
  viewport: Viewport;
  candidate?: MaskCandidate;
  prompts: SegPrompt[];
  busy: boolean;
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
    if (candidate) {
      // The grid as a tiny red-and-clear image…
      const grid = new OffscreenCanvas(candidate.width, candidate.height);
      const gctx = grid.getContext("2d")!;
      const data = gctx.createImageData(candidate.width, candidate.height);
      for (let i = 0; i < candidate.mask.length; i++) {
        if (!candidate.mask[i]) continue;
        data.data[i * 4] = 255;
        data.data[i * 4 + 1] = 59;
        data.data[i * 4 + 2] = 59;
        data.data[i * 4 + 3] = 255;
      }
      gctx.putImageData(data, 0, 0);
      // …stretched over the source and carried into the box. The mapping is
      // affine (a scale and an offset per axis, negative when mirrored).
      const origin = sourceToBox(layer, { x: 0, y: 0 });
      const far = sourceToBox(layer, { x: 1, y: 1 });
      const W = canvas.width;
      const H = canvas.height;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.setTransform(
        ((far.x - origin.x) * W) / candidate.width,
        0,
        0,
        ((far.y - origin.y) * H) / candidate.height,
        origin.x * W,
        origin.y * H
      );
      ctx.drawImage(grid, 0, 0);
      ctx.restore();
    }
  }, [candidate, layer, w, h]);

  const dots = prompts.map((p) => ({ ...sourceToBox(layer, p), include: p.include }));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0"
      style={{
        width: w,
        height: h,
        transform: `translate(${viewport.offsetX + layer.x * viewport.scale}px, ${
          viewport.offsetY + layer.y * viewport.scale
        }px) rotate(${layer.rotation}deg)`,
        transformOrigin: "center",
      }}
    >
      <canvas
        ref={ref}
        className={busy ? "absolute inset-0 h-full w-full animate-pulse opacity-40" : "absolute inset-0 h-full w-full opacity-45"}
      />
      {dots.map((d, i) =>
        d.x < 0 || d.x > 1 || d.y < 0 || d.y > 1 ? null : (
          <span
            key={i}
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, background: d.include ? "#22c55e" : "#ef4444" }}
          />
        )
      )}
    </div>
  );
}
