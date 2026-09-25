"use client";

/**
 * Crop chrome: the bright crop window, its eight handles, the rule-of-thirds
 * guides, the aspect-ratio buttons and a Done/Reset bar.
 *
 * What "crop" means here is worth stating, because it isn't what the selection
 * box does. The renderer draws the cropped *source* rect into the whole layer
 * box (`drawImage(img, sx, sy, sw, sh, 0, 0, w, h)`), so shrinking the crop
 * zooms the content in and the layer's footprint on the page never moves. The
 * window below therefore lives in the layer's own local space and shows which
 * part of the source survives — the dimmed area is what gets discarded.
 *
 * Like `SelectionOverlay` this is DOM, rotated by one transform on the wrapper,
 * so the handles land correctly on a rotated layer with no per-handle maths and
 * cursors come free.
 */

import {
  handleCursor,
  type HandleId,
  type Viewport,
} from "@/lib/studio/geometry";
import { aspectMatches, aspectPresets } from "@/lib/studio/crop";
import type { ImageLayer } from "@/lib/studio/document";
import { useStudio } from "@/lib/studio/StudioContext";
import { useCompactStudio } from "./useCompactStudio";

const CORNERS: HandleId[] = ["nw", "ne", "se", "sw"];
const EDGES: HandleId[] = ["n", "e", "s", "w"];

function handleFraction(id: HandleId): { fx: number; fy: number } {
  const fx = id.includes("w") ? 0 : id.includes("e") ? 1 : 0.5;
  const fy = id.includes("n") ? 0 : id.includes("s") ? 1 : 0.5;
  return { fx, fy };
}

/** The four bands around the crop window, as percentage CSS rects. */
function dimRects(crop: {
  x: number;
  y: number;
  w: number;
  h: number;
}): React.CSSProperties[] {
  const pct = (n: number) => `${n * 100}%`;
  return [
    { left: 0, top: 0, width: "100%", height: pct(crop.y) },
    { left: 0, top: pct(crop.y + crop.h), width: "100%", bottom: 0 },
    { left: 0, top: pct(crop.y), width: pct(crop.x), height: pct(crop.h) },
    {
      left: pct(crop.x + crop.w),
      top: pct(crop.y),
      right: 0,
      height: pct(crop.h),
    },
  ];
}

export function CropOverlay({
  layer,
  viewport,
  onHandleDown,
  onHandleMove,
  onHandleUp,
}: {
  layer: ImageLayer;
  viewport: Viewport;
  /**
   * Open a crop resize. Like the selection handles, these are real elements and
   * so swallow the pointerdown the canvas would otherwise hit-test — the canvas
   * hands down the gesture entry point instead.
   */
  onHandleDown: (handle: HandleId, e: React.PointerEvent<Element>) => void;
  onHandleMove: (e: React.PointerEvent<Element>) => void;
  onHandleUp: (e: React.PointerEvent<Element>) => void;
}) {
  const compact = useCompactStudio();

  const w = layer.width * viewport.scale;
  const h = layer.height * viewport.scale;
  const left = viewport.offsetX + layer.x * viewport.scale;
  const top = viewport.offsetY + layer.y * viewport.scale;

  const { crop } = layer;

  const grip = (handle: HandleId) => ({
    onPointerDown: (e: React.PointerEvent<Element>) => onHandleDown(handle, e),
    onPointerMove: onHandleMove,
    onPointerUp: onHandleUp,
    onPointerCancel: onHandleUp,
  });

  // The crop window in the layer's local box, as percentages so it survives
  // zoom without recomputing.
  const win = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.w * 100}%`,
    height: `${crop.h * 100}%`,
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute"
        style={{
          left,
          top,
          width: w,
          height: h,
          transform: `rotate(${layer.rotation}deg)`,
          transformOrigin: "center",
        }}
      >
        {/* Everything outside the window is what will be cut. Dimming it is
            what tells the user that, so it isn't decoration.
            Four rects rather than a clip-path donut — winding rules on
            self-intersecting polygons are the kind of thing that renders
            differently per engine. */}
        {dimRects(crop).map((r, i) => (
          <div
            key={i}
            className="absolute bg-black/45"
            style={r}
            aria-hidden="true"
          />
        ))}

        <div className="absolute" style={win}>
          <div
            className="absolute inset-0 border border-white/90"
            aria-hidden="true"
          />

          {/* Rule-of-thirds guides — the standard cue for what a crop is
              doing to the composition. */}
          <div className="absolute inset-0" aria-hidden="true">
            {[33.333, 66.666].map((pct) => (
              <span
                key={`v${pct}`}
                className="absolute top-0 bottom-0 w-px bg-white/30"
                style={{ left: `${pct}%` }}
              />
            ))}
            {[33.333, 66.666].map((pct) => (
              <span
                key={`h${pct}`}
                className="absolute right-0 left-0 h-px bg-white/30"
                style={{ top: `${pct}%` }}
              />
            ))}
          </div>

          {CORNERS.map((id) => {
            const { fx, fy } = handleFraction(id);
            return (
              <span
                key={id}
                data-crop-handle={id}
                {...grip(id)}
                className="pointer-events-auto absolute h-5 w-5 bg-white"
                style={{
                  left: `${fx * 100}%`,
                  top: `${fy * 100}%`,
                  marginLeft: -10,
                  marginTop: -10,
                  // L-shaped corner brackets, as in the mockup: a solid block
                  // clipped to two arms.
                  clipPath:
                    id === "nw"
                      ? "polygon(0 0,100% 0,100% 22%,22% 22%,22% 100%,0 100%)"
                      : id === "ne"
                        ? "polygon(0 0,100% 0,100% 100%,78% 100%,78% 22%,0 22%)"
                        : id === "se"
                          ? "polygon(100% 0,100% 100%,0 100%,0 78%,78% 78%,78% 0)"
                          : "polygon(0 0,22% 0,22% 78%,100% 78%,100% 100%,0 100%)",
                  cursor: handleCursor(id, layer.rotation),
                  filter: "drop-shadow(0 1px 2px rgb(0 0 0 / .45))",
                  // Otherwise a drag on a handle is also a touch scroll.
                  touchAction: "none",
                }}
              />
            );
          })}

          {EDGES.map((id) => {
            const { fx, fy } = handleFraction(id);
            const horizontal = id === "n" || id === "s";
            const length = 22;
            const thickness = 4;
            return (
              <span
                key={id}
                data-crop-handle={id}
                {...grip(id)}
                className="pointer-events-auto absolute bg-white"
                style={{
                  left: `${fx * 100}%`,
                  top: `${fy * 100}%`,
                  width: horizontal ? length : thickness,
                  height: horizontal ? thickness : length,
                  marginLeft: horizontal ? -length / 2 : -thickness / 2,
                  marginTop: horizontal ? -thickness / 2 : -length / 2,
                  cursor: handleCursor(id, layer.rotation),
                  filter: "drop-shadow(0 1px 2px rgb(0 0 0 / .45))",
                  touchAction: "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Unrotated screen space, so the bar stays readable however the layer
          is turned. */}
      {!compact && <div
        data-r="md"
        className="studio-shadow pointer-events-auto absolute flex w-[264px] flex-col gap-1 border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1"
        style={{
          left: left + w / 2,
          top: top + h + 20,
          transform: "translateX(-50%)",
        }}
      >
        <CropControls layer={layer} />
      </div>}
    </div>
  );
}

export function CropControls({ layer }: { layer: ImageLayer }) {
  const { apply, setTool, doc } = useStudio();
  const isFull = layer.crop.w > 0.999 && layer.crop.h > 0.999;
  return <div className="flex flex-col gap-2">
        {/* Ratios. Each one reshapes the layer *and* its crop together, so the
            photo can't come out stretched; the lit button is read back from the
            layer rather than remembered, so freely dragging a handle afterwards
            simply un-lights it instead of lying about a mode. */}
        <div className="flex flex-wrap gap-1">
          {aspectPresets(doc.width, doc.height).map((preset) => {
            const on = aspectMatches(layer.width, layer.height, preset.aspect);
            return (
              <button
                key={preset.id}
                type="button"
                data-r="sm"
                title={preset.hint}
                aria-pressed={on}
                onClick={() =>
                  apply({
                    type: "setLayerAspect",
                    layerId: layer.id,
                    aspect: preset.aspect,
                  })
                }
                className={
                  on
                    ? "border border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] px-2 py-1 text-[11.5px] font-semibold text-[var(--studio-accent)]"
                    : "border border-[var(--studio-border)] px-2 py-1 text-[11.5px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-white/[0.04] motion-reduce:transition-none"
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-1 border-t border-[var(--studio-border)] pt-1">
          <button
            type="button"
            data-r="sm"
            disabled={isFull}
            onClick={() => apply({ type: "resetCrop", layerId: layer.id })}
            className="px-2.5 py-1.5 text-[12px] font-medium text-[var(--studio-ink-muted)] transition-colors hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-ink)] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
          >
            Reset
          </button>
          <button
            type="button"
            data-r="sm"
            onClick={() => setTool("select")}
            className="bg-[var(--studio-accent)] px-3 py-1.5 text-[12px] font-semibold text-black"
          >
            Done
          </button>
        </div>
  </div>;
}
