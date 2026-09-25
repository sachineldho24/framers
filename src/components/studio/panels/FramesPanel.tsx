"use client";

/**
 * Frames: clip a photo to a circle, a rounded rectangle, or any closed element
 * from the shape library (heart, star, arch…) — Canva's Frames. A template's
 * custom outline (`mask.kind === "path"`) shows as its own option so picking
 * something else is reversible with undo, not a one-way loss.
 *
 * Admins also mark a photo as a customer photo slot here: the picture becomes a
 * sample the customer must replace before checkout.
 *
 * The mask is document state — applying one is an undoable edit. The radius
 * slider below the rounded option lives under a transient gesture like the
 * adjust sliders, so dragging it is a single undo step.
 */

import { SHAPE_CATALOG, shapePathD } from "@/lib/studio/shapes";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, PanelSection, Slider, StudioButton, cx } from "../ui";

/** Closed outlines only: a line can't enclose a photo. */
const FRAME_SHAPES = SHAPE_CATALOG.filter(
  (s) => s.mode === "fill" && s.id !== "square" && s.id !== "circle" && s.id !== "table-cell"
);

export function FramesPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const { selectedLayer, apply, endGesture } = useStudio();

  if (!selectedLayer || selectedLayer.kind !== "image") {
    return (
      <EmptyState
        icon="crop_free"
        title={selectedLayer ? "Not a photo" : "Nothing selected"}
        body="Pick an image on the canvas to shape it."
      />
    );
  }

  const layer = selectedLayer;
  const id = layer.id;
  const mask = layer.mask;

  return (
    <div>
      <PanelSection title="Shape">
        <div className="grid grid-cols-3 gap-1.5">
          <ShapeOption
            label="Original"
            active={mask.kind === "none"}
            onSelect={() => apply({ type: "setMask", layerId: id, mask: { kind: "none" } })}
          >
            <span className="block h-12 w-full border border-[var(--studio-border)] bg-white" />
          </ShapeOption>
          <ShapeOption
            label="Circle"
            active={mask.kind === "circle"}
            onSelect={() => apply({ type: "setMask", layerId: id, mask: { kind: "circle" } })}
          >
            <span className="mx-auto block h-12 w-12 border border-[var(--studio-border)] bg-white" style={{ borderRadius: "9999px" }} />
          </ShapeOption>
          <ShapeOption
            label="Rounded"
            active={mask.kind === "rounded"}
            onSelect={() => apply({ type: "setMask", layerId: id, mask: { kind: "rounded" } })}
          >
            <span className="block h-12 w-full border border-[var(--studio-border)] bg-white" data-r="sm" />
          </ShapeOption>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {mask.kind === "path" && (
            <ShapeOption label="Template" active onSelect={() => {}}>
              <FrameThumb d={mask.path?.d ?? ""} viewBox={mask.path?.viewBox.join(" ") ?? "0 0 1 1"} />
            </ShapeOption>
          )}
          {FRAME_SHAPES.map((shape) => (
            <ShapeOption
              key={shape.id}
              label={shape.label}
              active={mask.kind === "shape" && mask.shapeId === shape.id}
              onSelect={() =>
                apply({ type: "setMask", layerId: id, mask: { kind: "shape", shapeId: shape.id } })
              }
            >
              <FrameThumb d={shapePathD(shape, 48, 48)} viewBox="0 0 48 48" />
            </ShapeOption>
          ))}
        </div>

        {mask.kind === "rounded" && (
          <div className="mt-3">
            <Slider
              label="Corner radius"
              value={mask.radius * 100}
              min={4}
              max={50}
              suffix="%"
              onChange={(v) =>
                apply(
                  { type: "setMask", layerId: id, mask: { radius: v / 100 } },
                  { transient: true, label: `mask-radius:${id}` }
                )
              }
              onCommit={endGesture}
              onReset={() =>
                apply({ type: "setMask", layerId: id, mask: { radius: 0.08 } })
              }
            />
          </div>
        )}
      </PanelSection>

      {isAdmin && (
        <PanelSection title="Template">
          <label className="flex cursor-pointer items-start gap-2.5 px-1 text-[13px] text-[var(--studio-ink)]">
            <input
              type="checkbox"
              className="mt-0.5 accent-[var(--studio-accent)]"
              checked={layer.role === "placeholder"}
              onChange={(e) =>
                apply({
                  type: "setLayerRole",
                  layerId: id,
                  role: e.target.checked ? "placeholder" : "decor",
                })
              }
            />
            <span>
              Customer photo slot
              <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--studio-ink-muted)]">
                This picture is a sample. Customers must drop in their own photo
                before checkout; it stays replaceable even when locked.
              </span>
            </span>
          </label>
        </PanelSection>
      )}

      <PanelSection title="Fit the box">
        <p className="mb-2 px-1 text-[12px] leading-relaxed text-[var(--studio-ink-muted)]">
          The shape fills the layer&apos;s box, so a circle on a wide box reads as an
          oval. Square the box for a true circle.
        </p>
        <div className="flex flex-col gap-1.5">
          <StudioButton
            variant="outline"
            icon="square"
            disabled={layer.locked || layer.width === layer.height}
            onClick={() => {
              const side = Math.min(layer.width, layer.height);
              apply({
                type: "setLayerBox",
                layerId: id,
                box: {
                  x: layer.x + (layer.width - side) / 2,
                  y: layer.y + (layer.height - side) / 2,
                  width: side,
                  height: side,
                },
              });
            }}
            className="w-full"
          >
            Make the box square
          </StudioButton>
          <StudioButton
            variant="outline"
            icon="fit_screen"
            disabled={layer.locked}
            onClick={() =>
              apply({ type: "fitLayerToPage", layerId: id, mode: "cover" })
            }
            className="w-full"
          >
            Fill the page
          </StudioButton>
        </div>
      </PanelSection>
    </div>
  );
}

function FrameThumb({ d, viewBox }: { d: string; viewBox: string }) {
  return (
    <svg viewBox={viewBox} preserveAspectRatio="none" aria-hidden className="mx-auto block h-12 w-12">
      <path d={d} fill="var(--studio-ink-muted)" opacity={0.55} />
    </svg>
  );
}

function ShapeOption({
  label,
  active,
  onSelect,
  children,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="block w-full text-left"
    >
      <span
        data-r="sm"
        className={cx(
          "block w-full border p-1 transition-colors",
          active
            ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/35"
            : "border-[var(--studio-border)]"
        )}
      >
        {children}
      </span>
      <span
        className={cx(
          "mt-1 block truncate text-[11px]",
          active
            ? "font-semibold text-[var(--studio-accent)]"
            : "text-[var(--studio-ink-muted)]"
        )}
      >
        {label}
      </span>
    </button>
  );
}
