"use client";

/**
 * Selection chrome: the purple box, eight resize handles, the rotate grip and
 * the per-object toolbar.
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

import {
  handleCursor,
  ROTATE_GRIP_OFFSET,
  type HandleId,
  type Viewport,
} from "@/lib/studio/geometry";
import type { Layer } from "@/lib/studio/document";
import { useStudio } from "@/lib/studio/StudioContext";

import { ObjectToolbar } from "./ObjectToolbar";

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
  const { selectedId } = useStudio();

  const w = layer.width * viewport.scale;
  const h = layer.height * viewport.scale;
  const left = viewport.offsetX + layer.x * viewport.scale;
  const top = viewport.offsetY + layer.y * viewport.scale;
  const edges = layer.kind === "text" ? TEXT_EDGES : EDGES;

  // Chrome scales with zoom only within reason — handles stay grabbable when
  // zoomed way out and don't become slabs when zoomed in.
  const accent = "var(--studio-accent)";

  /** Every grab handle behaves identically once it knows which one it is. */
  const grip = (target: HandleId | "rotate") => ({
    onPointerDown: (e: React.PointerEvent<Element>) => onHandleDown(target, e),
    onPointerMove: onHandleMove,
    onPointerUp: onHandleUp,
    onPointerCancel: onHandleUp,
  });

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
        {/* Outline. 1px hairline regardless of zoom. */}
        <div
          className="absolute inset-0"
          style={{ outline: `1.5px solid ${accent}`, outlineOffset: 0 }}
        />

        {layer.locked ? (
          <span
            data-r="full"
            className="absolute -top-3 -right-3 inline-flex h-6 w-6 items-center justify-center bg-white text-black text-[13px] shadow"
            style={{ color: accent }}
          >
            <span className="material-symbols-outlined text-[15px]">lock</span>
          </span>
        ) : (
          <>
            {CORNERS.map((id) => {
              const { fx, fy } = handleFraction(id);
              return (
                <span
                  key={id}
                  data-handle={id}
                  data-r="full"
                  {...grip(id)}
                  className="pointer-events-auto absolute h-3 w-3 border-2 bg-white"
                  style={{
                    left: `${fx * 100}%`,
                    top: `${fy * 100}%`,
                    marginLeft: -6,
                    marginTop: -6,
                    borderColor: accent,
                    cursor: handleCursor(id, layer.rotation),
                    boxShadow: "0 1px 3px rgb(16 16 26 / .25)",
                    // Otherwise a drag on a handle is also a touch scroll.
                    touchAction: "none",
                  }}
                />
              );
            })}

            {edges.map((id) => {
              const { fx, fy } = handleFraction(id);
              const horizontal = id === "n" || id === "s";
              // Pill on the long axis, matching the mockup's edge grips.
              const length = 18;
              const thickness = 6;
              return (
                <span
                  key={id}
                  data-handle={id}
                  data-r="full"
                  {...grip(id)}
                  className="pointer-events-auto absolute border-2 bg-white"
                  style={{
                    left: `${fx * 100}%`,
                    top: `${fy * 100}%`,
                    width: horizontal ? length : thickness,
                    height: horizontal ? thickness : length,
                    marginLeft: horizontal ? -length / 2 : -thickness / 2,
                    marginTop: horizontal ? -thickness / 2 : -length / 2,
                    borderColor: accent,
                    cursor: handleCursor(id, layer.rotation),
                    boxShadow: "0 1px 3px rgb(16 16 26 / .25)",
                    touchAction: "none",
                  }}
                />
              );
            })}

            {/* Rotate grip, hanging below the box on the same axis the
                geometry module measures rotation against. */}
            <span
              data-handle="rotate"
              data-r="full"
              {...grip("rotate")}
              className="pointer-events-auto absolute inline-flex items-center justify-center bg-white"
              style={{
                left: "50%",
                top: "100%",
                width: 24,
                height: 24,
                marginLeft: -12,
                marginTop: ROTATE_GRIP_OFFSET - 12,
                border: `1.5px solid ${accent}`,
                cursor: "grab",
                boxShadow: "0 1px 4px rgb(16 16 26 / .25)",
                touchAction: "none",
              }}
            >
              <span
                className="material-symbols-outlined text-[15px]"
                style={{ color: accent }}
              >
                rotate_right
              </span>
            </span>
          </>
        )}
      </div>

      {/* Object toolbar sits in unrotated screen space so it stays readable
          however the layer is turned. */}
      {selectedId === layer.id && (
        <div
          className="studio-floating-object pointer-events-auto absolute"
          style={{
            left: left + w / 2,
            top: top + h + ROTATE_GRIP_OFFSET + 28,
            transform: "translateX(-50%)",
          }}
        >
          <ObjectToolbar layer={layer} />
        </div>
      )}
    </div>
  );
}
