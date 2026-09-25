"use client";

/**
 * Selection chrome: the outline, eight resize handles, the rotate grip and the
 * small lock/duplicate row above the box. The quick-actions pill below the
 * selection is the shell's, so it is not repeated here.
 *
 * DOM rather than canvas-drawn, so cursors, hover states, tooltips and keyboard
 * focus are the browser's job rather than ours. It's `pointer-events-none` as a
 * whole with the handles opting back in, so a drag that starts on the artwork
 * still reaches the canvas underneath.
 *
 * Because the handles do take pointer events — and are siblings of the canvas,
 * not children — their pointerdown never reaches it. They therefore drive the
 * gesture directly through the callbacks below, which the canvas supplies, and
 * capture the pointer so the rest of the drag is delivered to the handle rather
 * than to whatever it happens to be over.
 *
 * Positioned by CSS transform in the layer's rotated frame, which means the
 * handles sit correctly on a rotated layer without any per-handle trigonometry.
 */

import { useState } from "react";

import {
  boundingRect,
  handleCursor,
  ROTATE_GRIP_OFFSET,
  type HandleId,
  type Viewport,
} from "@/lib/studio/geometry";
import type { Layer } from "@/lib/studio/document";
import { keepsObjectToolbars, useStudio } from "@/lib/studio/StudioContext";

import { IconButton } from "./ui";

const CORNERS: HandleId[] = ["nw", "ne", "se", "sw"];
const EDGES: HandleId[] = ["n", "e", "s", "w"];
/**
 * Text gets four corners and two side grips, not eight handles.
 *
 * A corner scales the type; a side rewraps the words and the height follows
 * them. There is nothing left for top and bottom to mean — a box height the
 * words don't fill would be overwritten by the next keystroke, so offering the
 * grip would be offering a lie.
 */
const TEXT_EDGES: HandleId[] = ["e", "w"];

/** Handle centre in the layer's own unrotated space, 0–1 along each axis. */
function handleFraction(id: HandleId): { fx: number; fy: number } {
  const fx = id.includes("w") ? 0 : id.includes("e") ? 1 : 0.5;
  const fy = id.includes("n") ? 0 : id.includes("s") ? 1 : 0.5;
  return { fx, fy };
}

export function SelectionOverlay({
  layer,
  viewport,
  onHandleDown,
  onHandleMove,
  onHandleUp,
}: {
  layer: Layer;
  viewport: Viewport;
  /** Open a resize or rotate. The canvas owns the gesture; this only starts it. */
  onHandleDown: (
    target: HandleId | "rotate",
    e: React.PointerEvent<Element>
  ) => void;
  onHandleMove: (e: React.PointerEvent<Element>) => void;
  onHandleUp: (e: React.PointerEvent<Element>) => void;
}) {
  const { selectedId, apply, duplicate, tool } = useStudio();
  // Whether the rotate grip is being dragged — the grip captures the pointer,
  // so its own down/up bracket the whole gesture.
  const [rotating, setRotating] = useState(false);

  const w = layer.width * viewport.scale;
  const h = layer.height * viewport.scale;
  const left = viewport.offsetX + layer.x * viewport.scale;
  const top = viewport.offsetY + layer.y * viewport.scale;
  const edges = layer.kind === "text" ? TEXT_EDGES : EDGES;
  // The quick row sits above the rotated shape's bounds, not its unrotated top.
  const bounds = boundingRect(layer);
  const boundsTop = viewport.offsetY + bounds.y * viewport.scale;

  // A locked layer keeps a quiet outline: it is selected, but not editable.
  const accent = layer.locked ? "#52525b" : "var(--studio-accent)";

  /** Every grab handle behaves identically once it knows which one it is. */
  const grip = (target: HandleId | "rotate") => ({
    onPointerDown: (e: React.PointerEvent<Element>) => {
      if (target === "rotate") setRotating(true);
      onHandleDown(target, e);
    },
    onPointerMove: onHandleMove,
    onPointerUp: (e: React.PointerEvent<Element>) => {
      setRotating(false);
      onHandleUp(e);
    },
    onPointerCancel: (e: React.PointerEvent<Element>) => {
      setRotating(false);
      onHandleUp(e);
    },
  });

  // The angle readout, signed so a small turn left reads -5°, not 355°. It
  // sits just past the grip, which orbits the centre as the layer turns.
  const signed = ((((layer.rotation % 360) + 540) % 360) - 180);
  const degrees = Math.round(signed) === -180 ? 180 : Math.round(signed);
  const rad = (layer.rotation * Math.PI) / 180;
  const reach = w / 2 + ROTATE_GRIP_OFFSET + 34;
  const badgeX = left + w / 2 + Math.cos(rad) * reach;
  const badgeY = top + h / 2 + Math.sin(rad) * reach;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute"
        aria-hidden="true"
        style={{
          left,
          top,
          width: w,
          height: h,
          transform: `rotate(${layer.rotation}deg)`,
          transformOrigin: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ outline: `1.5px solid ${accent}`, outlineOffset: 0 }}
        />

        {!layer.locked &&
          [...CORNERS, ...edges].map((id) => {
            const { fx, fy } = handleFraction(id);
            return (
              <span
                key={id}
                data-handle={id}
                {...grip(id)}
                className="studio-handle pointer-events-auto absolute h-2 w-2 bg-white"
                style={{
                  left: `${fx * 100}%`,
                  top: `${fy * 100}%`,
                  marginLeft: -4,
                  marginTop: -4,
                  border: `1.5px solid ${accent}`,
                  cursor: handleCursor(id, layer.rotation),
                  boxShadow: "0 1px 3px rgb(0 0 0 / .35)",
                  // Otherwise a drag on a handle is also a touch scroll.
                  touchAction: "none",
                }}
              />
            );
          })}

        {/* Rotate grip, beside the box on the same axis the geometry module
            measures rotation against. */}
        {!layer.locked && (
          <span
            data-handle="rotate"
            data-r="full"
            {...grip("rotate")}
            className="pointer-events-auto absolute inline-flex items-center justify-center border border-[#2e2e2e] bg-[var(--studio-elevated)] text-white"
            style={{
              left: "100%",
              top: "50%",
              width: 24,
              height: 24,
              marginLeft: ROTATE_GRIP_OFFSET - 12,
              marginTop: -12,
              cursor: "grab",
              boxShadow: "0 2px 8px rgb(0 0 0 / .5)",
              touchAction: "none",
            }}
          >
            <span className="material-symbols-outlined text-[14px]">sync</span>
          </span>
        )}
      </div>

      {rotating && (
        <div
          role="status"
          aria-live="polite"
          data-r="sm"
          className="studio-shadow-sm absolute bg-[#1e1e22] px-2 py-1 text-[12px] font-semibold tabular-nums text-white"
          style={{ left: badgeX, top: badgeY, transform: "translate(-50%, -50%)" }}
        >
          {degrees}°
        </div>
      )}

      {/* Lock and duplicate, above the selection in unrotated screen space so
          they stay readable however the layer is turned. */}
      {selectedId === layer.id && keepsObjectToolbars(tool) && (
        <div
          className="studio-floating-object pointer-events-auto absolute flex gap-1"
          style={{
            left: left + w / 2,
            top: boundsTop - 32,
            transform: "translateX(-50%)",
          }}
        >
          <IconButton
            icon={layer.locked ? "lock" : "lock_open"}
            label={layer.locked ? "Unlock" : "Lock"}
            size="sm"
            tooltipSide="top"
            className={layer.locked ? "!h-6 !w-6 text-[var(--studio-accent)]" : "!h-6 !w-6 text-[var(--studio-ink-muted)]"}
            onClick={() =>
              apply({ type: "setLayerLocked", layerId: layer.id, locked: !layer.locked })
            }
          />
          <IconButton
            icon="library_add"
            label="Duplicate"
            size="sm"
            tooltipSide="top"
            className="!h-6 !w-6 text-[var(--studio-ink-muted)]"
            onClick={() => duplicate(layer.id)}
          />
        </div>
      )}
    </div>
  );
}
