"use client";

/**
 * Chrome for several selected layers: a thin outline on each member, one box
 * around them all, and four corner grips that scale the lot together — plus
 * the rubber band itself while it's being drawn.
 *
 * Like `SelectionOverlay`, DOM rather than canvas, and pointer-transparent
 * except for the grips, so a drag on the artwork still reaches the canvas.
 */

import type { Layer } from "@/lib/studio/document";
import { boundingRect, type HandleId, type Viewport } from "@/lib/studio/geometry";
import { selectionBounds, type Rect } from "@/lib/studio/multiSelect";

const CORNERS: HandleId[] = ["nw", "ne", "se", "sw"];
const CURSORS: Record<string, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize" };

function toScreen(rect: Rect, viewport: Viewport) {
  return {
    left: viewport.offsetX + rect.x * viewport.scale,
    top: viewport.offsetY + rect.y * viewport.scale,
    width: rect.width * viewport.scale,
    height: rect.height * viewport.scale,
  };
}

export function GroupSelectionOverlay({
  layers,
  viewport,
  onHandleDown,
  onHandleMove,
  onHandleUp,
}: {
  layers: Layer[];
  viewport: Viewport;
  onHandleDown: (handle: HandleId, e: React.PointerEvent<Element>) => void;
  onHandleMove: (e: React.PointerEvent<Element>) => void;
  onHandleUp: (e: React.PointerEvent<Element>) => void;
}) {
  const bounds = selectionBounds(layers);
  if (!bounds) return null;
  const box = toScreen(bounds, viewport);
  const locked = layers.some((l) => l.locked);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {layers.map((layer) => {
        const s = toScreen(boundingRect(layer), viewport);
        return (
          <div
            key={layer.id}
            className="absolute"
            style={{ ...s, outline: "1px solid var(--studio-accent)", opacity: 0.55 }}
          />
        );
      })}

      <div
        className="absolute"
        style={{ ...box, outline: `1.5px dashed ${locked ? "#52525b" : "var(--studio-accent)"}`, outlineOffset: 2 }}
      >
        {!locked &&
          CORNERS.map((id) => (
            <span
              key={id}
              data-handle={id}
              onPointerDown={(e) => onHandleDown(id, e)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              className="studio-handle pointer-events-auto absolute h-2.5 w-2.5 bg-white"
              style={{
                left: id.includes("w") ? -2 : "100%",
                top: id.includes("n") ? -2 : "100%",
                marginLeft: id.includes("w") ? -5 : -3,
                marginTop: id.includes("n") ? -5 : -3,
                border: "1.5px solid var(--studio-accent)",
                cursor: CURSORS[id],
                touchAction: "none",
              }}
            />
          ))}
      </div>
    </div>
  );
}

/** The rubber band: a translucent accent box, as in Canva. */
export function MarqueeOverlay({ rect, viewport }: { rect: Rect; viewport: Viewport }) {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        ...toScreen(rect, viewport),
        background: "rgb(206 255 0 / 0.12)",
        border: "1px solid var(--studio-accent)",
      }}
      aria-hidden="true"
    />
  );
}
