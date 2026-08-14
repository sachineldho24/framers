"use client";

/**
 * Frames: circle and rounded-rectangle masks.
 *
 * The mask is document state — applying one is an undoable edit. The radius
 * slider below the rounded option lives under a transient gesture like the
 * adjust sliders, so dragging it is a single undo step.
 */

import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, PanelSection, Slider, StudioButton, cx } from "../ui";

export function FramesPanel() {
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
