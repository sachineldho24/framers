"use client";

/**
 * Adjust: opacity, brightness/contrast/saturation, and the filter presets.
 *
 * Slider drags commit transiently under a per-property label, so dragging
 * brightness is one undo step rather than forty — and releasing the slider
 * closes the gesture so the next drag starts a new one.
 */

import { FILTER_PRESETS, type FilterId } from "@/lib/studio/filters";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, PanelSection, Slider, StudioButton, cx } from "../ui";

export function AdjustPanel() {
  const { selectedLayer, apply, endGesture } = useStudio();

  if (!selectedLayer) {
    return (
      <EmptyState
        icon="tune"
        title="Nothing selected"
        body="Pick an image on the canvas to adjust it."
      />
    );
  }

  const layer = selectedLayer;
  const id = layer.id;
  // Brightness, contrast, saturation and the filter presets all act on pixels,
  // so for a text layer there is nothing to adjust but its opacity.
  const image = layer.kind === "image" ? layer : null;

  return (
    <div>
      <PanelSection title="Layer">
        <Slider
          label="Opacity"
          value={layer.opacity * 100}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) =>
            apply(
              { type: "setLayerOpacity", layerId: id, opacity: v / 100 },
              { transient: true, label: `opacity:${id}` }
            )
          }
          onCommit={endGesture}
          onReset={() =>
            apply({ type: "setLayerOpacity", layerId: id, opacity: 1 })
          }
        />
      </PanelSection>

      {!image && (
        <PanelSection title="Adjustments">
          <p className="text-[11px] leading-relaxed text-[var(--studio-ink-muted)]">
            Filters and colour adjustments apply to photos. Use the Text panel to
            change this layer&rsquo;s colour and outline.
          </p>
        </PanelSection>
      )}

      {image && (
        <>
      <PanelSection title="Adjustments">
        <div className="flex flex-col gap-3.5">
          {(
            [
              ["Brightness", "brightness"],
              ["Contrast", "contrast"],
              ["Saturation", "saturation"],
            ] as const
          ).map(([label, key]) => (
            <Slider
              key={key}
              label={label}
              value={image.adjust[key]}
              min={-100}
              max={100}
              onChange={(v) =>
                apply(
                  { type: "setAdjust", layerId: id, adjust: { [key]: v } },
                  { transient: true, label: `${key}:${id}` }
                )
              }
              onCommit={endGesture}
              onReset={() =>
                apply({ type: "setAdjust", layerId: id, adjust: { [key]: 0 } })
              }
            />
          ))}
        </div>

        <StudioButton
          variant="outline"
          icon="restart_alt"
          onClick={() => apply({ type: "resetAdjust", layerId: id })}
          className="mt-3 w-full"
        >
          Reset adjustments and filter
        </StudioButton>
      </PanelSection>

      <PanelSection title="Filters">
        <ul className="grid grid-cols-3 gap-1.5">
          {FILTER_PRESETS.map((preset) => (
            <li key={preset.id}>
              <FilterSwatch
                id={preset.id}
                label={preset.label}
                active={image.filter === preset.id}
                onSelect={() =>
                  apply({ type: "setFilter", layerId: id, filter: preset.id })
                }
              />
            </li>
          ))}
        </ul>

        {image.filter !== "none" && (
          <div className="mt-3">
            <Slider
              label="Filter strength"
              value={image.filterStrength * 100}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                apply(
                  {
                    type: "setFilterStrength",
                    layerId: id,
                    strength: v / 100,
                  },
                  { transient: true, label: `strength:${id}` }
                )
              }
              onCommit={endGesture}
              onReset={() =>
                apply({ type: "setFilterStrength", layerId: id, strength: 1 })
              }
            />
          </div>
        )}
      </PanelSection>
        </>
      )}
    </div>
  );
}

/**
 * Filter swatch. The preview is a CSS-filtered gradient rather than a thumbnail
 * of the artwork: it costs no draw calls, and the presets are distinguishable
 * from each other on a gradient, which is what the swatch is for.
 */
function FilterSwatch({
  id,
  label,
  active,
  onSelect,
}: {
  id: FilterId;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const preset = FILTER_PRESETS.find((p) => p.id === id)!;
  const filter = [
    `brightness(${preset.brightness})`,
    `contrast(${preset.contrast})`,
    `saturate(${preset.saturate})`,
    preset.sepia > 0 && `sepia(${preset.sepia})`,
    preset.grayscale > 0 && `grayscale(${preset.grayscale})`,
    preset.hueRotate !== 0 && `hue-rotate(${preset.hueRotate}deg)`,
  ]
    .filter(Boolean)
    .join(" ");

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
          "block h-14 w-full border transition-colors",
          active
            ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/35"
            : "border-[var(--studio-border)]"
        )}
        style={{
          filter,
          background:
            "linear-gradient(135deg, #f3c98b 0%, #d97b6c 38%, #6d6ea8 72%, #2f3550 100%)",
        }}
      />
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
