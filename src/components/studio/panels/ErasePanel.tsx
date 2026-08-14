"use client";

/**
 * Eraser / restore brush settings.
 *
 * Brush size and feather are view state, not document state — they describe the
 * tool, not the artwork, so changing them isn't an undoable edit. What *is*
 * undoable is each stroke, which the canvas commits.
 */

import { Icon } from "@/components/Icon";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, PanelSection, Slider, StudioButton, cx } from "../ui";

export function ErasePanel() {
  const { selectedLayer, brush, setBrush, apply } = useStudio();

  if (!selectedLayer || selectedLayer.kind !== "image") {
    return (
      <EmptyState
        icon="ink_eraser"
        title={selectedLayer ? "Not a photo" : "Nothing selected"}
        body="Pick an image on the canvas to rub parts of it out."
      />
    );
  }

  const layer = selectedLayer;
  const strokeCount = layer.strokes.length;

  return (
    <div>
      <PanelSection title="Brush">
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <ModeButton
            icon="ink_eraser"
            label="Erase"
            active={brush.mode === "erase"}
            onSelect={() => setBrush({ mode: "erase" })}
          />
          <ModeButton
            icon="brush"
            label="Restore"
            active={brush.mode === "restore"}
            onSelect={() => setBrush({ mode: "restore" })}
          />
        </div>

        <div className="flex flex-col gap-3.5">
          <Slider
            label="Size"
            value={brush.size * 100}
            min={1}
            max={60}
            suffix="%"
            onChange={(v) => setBrush({ size: v / 100 })}
            onReset={() => setBrush({ size: 0.12 })}
          />
          <Slider
            label="Softness"
            value={brush.feather * 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => setBrush({ feather: v / 100 })}
            onReset={() => setBrush({ feather: 0.5 })}
          />
        </div>

        <BrushPreview size={brush.size} feather={brush.feather} />
      </PanelSection>

      <PanelSection title="Strokes">
        <p className="mb-2 px-1 text-[12px] text-[var(--studio-ink-muted)]">
          {strokeCount === 0
            ? "Drag on the image to rub it out. Nothing is destroyed — Restore paints it back, and undo works stroke by stroke."
            : `${strokeCount} ${strokeCount === 1 ? "stroke" : "strokes"} on this image.`}
        </p>
        <StudioButton
          variant="outline"
          icon="restart_alt"
          disabled={strokeCount === 0}
          onClick={() => apply({ type: "clearStrokes", layerId: layer.id })}
          className="w-full"
        >
          Clear all strokes
        </StudioButton>
      </PanelSection>

      {layer.locked && (
        <p className="flex items-start gap-1.5 px-1 text-[12px] text-[var(--studio-ink-muted)]">
          <Icon name="lock" className="text-[15px]" />
          <span>This image is locked, so painting is ignored. Unlock it first.</span>
        </p>
      )}
    </div>
  );
}

function ModeButton({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      data-r="md"
      className={cx(
        "flex items-center justify-center gap-1.5 border px-2 py-2 text-[12.5px] font-medium transition-colors",
        active
          ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
          : "border-[var(--studio-border)] bg-white text-[var(--studio-ink)] hover:bg-black/[0.03]"
      )}
    >
      <Icon name={icon} className="text-[17px]" />
      {label}
    </button>
  );
}

/**
 * Shows the actual brush shape at the current settings. Cheap to render as a
 * radial gradient, and it answers "how soft is 40%?" better than a number.
 */
function BrushPreview({ size, feather }: { size: number; feather: number }) {
  // The swatch stands in for the layer's shorter edge, so the dot's size here is
  // proportional to what it will cover on the image.
  const diameter = Math.max(6, Math.min(1, size * 2) * 64);
  const solid = Math.round((1 - feather) * 100);

  return (
    <div
      data-r="md"
      className="mt-3 flex h-[76px] items-center justify-center border border-[var(--studio-border)] bg-[var(--studio-canvas-bg)]"
    >
      <span
        aria-hidden="true"
        className="block"
        style={{
          width: diameter,
          height: diameter,
          borderRadius: "9999px",
          background: `radial-gradient(circle, rgba(22,22,26,.85) 0%, rgba(22,22,26,.85) ${solid}%, rgba(22,22,26,0) 100%)`,
        }}
      />
      <span className="sr-only">
        Brush preview at {Math.round(size * 100)} percent size and{" "}
        {Math.round(feather * 100)} percent softness
      </span>
    </div>
  );
}
