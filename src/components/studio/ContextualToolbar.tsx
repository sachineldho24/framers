"use client";

/**
 * The floating pill above the canvas — the mockup's contextual toolbar.
 *
 * It has two shapes, because a selected photo and a selected sentence have
 * almost nothing in common: cropping, erasing and colour adjustment are
 * operations on pixels, while a text layer wants its font and its alignment.
 * Same slot, same styling, different contents.
 *
 * Two deliberate omissions from the image variant: the four colour swatches and
 * the stroke icon, which were decorative in the mockup. There's no stroke or
 * fill model on an image layer, so those controls would either lie or do
 * nothing. (Text does have both, and gets them in the Text panel.)
 *
 * BG Remover keeps its crown and is *not* silently repurposed: it opens the
 * shared notice explaining that automatic removal isn't built yet and offers
 * the eraser, which does the same job by hand.
 */

import type {
  ImageLayer,
  Layer,
  ShapeLayer,
  TextLayer,
} from "@/lib/studio/document";
import { MAX_SHAPE_STROKE } from "@/lib/studio/document";
import { getShape } from "@/lib/studio/shapes";
import { useStudio } from "@/lib/studio/StudioContext";
import { textLayerHeight } from "@/lib/studio/textMeasure";

import { Icon } from "@/components/Icon";
import { STUDIO_SWATCHES } from "./palette";
import { cx } from "./ui";

function Divider() {
  return (
    <span
      className="mx-1 h-5 w-px shrink-0 bg-[var(--studio-border)]"
      aria-hidden="true"
    />
  );
}

/** The shared shell, so both variants sit identically in the slot. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-r="full"
      className="studio-shadow pointer-events-auto flex items-center gap-0.5 border border-[var(--studio-border)] bg-[var(--studio-chrome)] px-1.5 py-1"
    >
      {children}
    </div>
  );
}

export function ContextualToolbar({
  layer,
  onBgRemover,
}: {
  layer: Layer;
  onBgRemover: () => void;
}) {
  if (layer.kind === "text") return <TextToolbar layer={layer} />;
  if (layer.kind === "shape") return <ShapeToolbar layer={layer} />;
  return <ImageToolbar layer={layer} onBgRemover={onBgRemover} />;
}

function TextToolbar({ layer }: { layer: TextLayer }) {
  const { apply, tool, setTool, setRail, setEditingId } = useStudio();

  /** Alignment doesn't reflow; case does, so it re-measures. */
  const style = (
    patch: { align: TextLayer["align"] } | { uppercase: boolean }
  ) => {
    apply({
      type: "setTextStyle",
      layerId: layer.id,
      patch,
      height: "uppercase" in patch ? textLayerHeight(layer, patch) : undefined,
    });
  };

  return (
    <Pill>
      <button
        type="button"
        onClick={() => setEditingId(layer.id)}
        data-r="full"
        className="flex h-7 items-center gap-1 px-2 text-[12px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-white/[0.055]"
        title="Type on the page"
      >
        <Icon name="edit" className="text-[15px]" />
        Edit text
      </button>

      <Divider />

      <button
        type="button"
        onClick={() => setRail("text")}
        data-r="full"
        className="flex h-7 items-center gap-1 px-2 text-[12px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-white/[0.055]"
        title="Font, size, colour and spacing"
      >
        <Icon name="text_fields" className="text-[15px]" />
        Font
      </button>

      <Divider />

      {(
        [
          ["left", "format_align_left", "Align left"],
          ["center", "format_align_center", "Align centre"],
          ["right", "format_align_right", "Align right"],
        ] as const
      ).map(([value, icon, label]) => (
        <PillButton
          key={value}
          icon={icon}
          label={label}
          active={layer.align === value}
          onClick={() => style({ align: value })}
        />
      ))}
      <PillButton
        icon="format_size"
        label="UPPERCASE"
        active={layer.uppercase}
        onClick={() => style({ uppercase: !layer.uppercase })}
      />

      <Divider />

      <PillButton
        icon="stacks"
        label="Position"
        active={tool === "layers"}
        onClick={() => setTool(tool === "layers" ? "select" : "layers")}
      />
    </Pill>
  );
}

function ImageToolbar({
  layer,
  onBgRemover,
}: {
  layer: ImageLayer;
  onBgRemover: () => void;
}) {
  const { apply, tool, setTool } = useStudio();

  return (
    <Pill>
      <button
        type="button"
        onClick={() => setTool("adjust")}
        data-r="full"
        className="flex h-7 items-center gap-1 px-2 text-[12px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-white/[0.055]"
        title="Adjust colour and exposure"
      >
        <Icon name="edit" className="text-[15px]" />
        Edit
      </button>

      <Divider />

      <button
        type="button"
        onClick={onBgRemover}
        data-r="full"
        aria-label="BG Remover — not available yet"
        title="BG Remover"
        className="relative flex h-7 items-center gap-1 px-2 text-[12px] font-medium text-[var(--studio-ink-muted)] transition-colors hover:bg-white/[0.055] hover:text-[var(--studio-ink)]"
      >
        <Icon name="auto_fix_high" className="text-[15px]" />
        BG Remover
        <Icon
          name="workspace_premium"
          className="text-[13px] text-[#c9a227]"
          aria-hidden
        />
      </button>

      <PillButton
        icon="ink_eraser"
        label="Eraser"
        active={tool === "eraser"}
        onClick={() => setTool(tool === "eraser" ? "select" : "eraser")}
      />

      <Divider />

      <PillButton
        icon="crop"
        label="Crop"
        active={tool === "crop"}
        onClick={() => setTool(tool === "crop" ? "select" : "crop")}
      />
      <PillButton
        icon="flip"
        label="Flip horizontally"
        onClick={() =>
          apply({ type: "flipLayer", layerId: layer.id, axis: "horizontal" })
        }
      />
      <PillButton
        icon="tune"
        label="Filters"
        active={tool === "adjust"}
        onClick={() => setTool(tool === "adjust" ? "select" : "adjust")}
      />
      <PillButton
        icon="stacks"
        label="Position"
        active={tool === "layers"}
        onClick={() => setTool(tool === "layers" ? "select" : "layers")}
      />
    </Pill>
  );
}

/**
 * A selected element.
 *
 * The swatches are the same palette the text tool offers, inline because a
 * shape's colour is the one thing people change on it, and a whole panel for
 * five colours would be a detour. Weight is only meaningful for an open shape -
 * there is no stroke on a filled one to thicken - so those two buttons appear
 * only for lines.
 */
function ShapeToolbar({ layer }: { layer: ShapeLayer }) {
  const { apply, tool, setTool, setRail } = useStudio();
  const def = getShape(layer.shapeId);
  const open = def?.mode === "stroke";
  const current = layer.color.toLowerCase();

  const colour = (color: string) =>
    apply({ type: "setShapeStyle", layerId: layer.id, patch: { color } });

  const weigh = (factor: number) =>
    apply({
      type: "setShapeStyle",
      layerId: layer.id,
      patch: {
        strokeWidth: Math.min(
          MAX_SHAPE_STROKE,
          Math.max(1, layer.strokeWidth * factor)
        ),
      },
    });

  return (
    <Pill>
      <button
        type="button"
        onClick={() => setRail("elements")}
        data-r="full"
        className="flex h-7 items-center gap-1 px-2 text-[12px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-white/[0.055]"
        title="Swap the element"
      >
        <Icon name="category" className="text-[15px]" />
        Elements
      </button>

      <Divider />

      {STUDIO_SWATCHES.slice(0, 5).map((swatch) => (
        <button
          key={swatch}
          type="button"
          data-r="full"
          aria-label={`Use ${swatch}`}
          aria-pressed={current === swatch}
          onClick={() => colour(swatch)}
          className={cx(
            "mx-0.5 h-5 w-5 shrink-0 border transition-transform hover:scale-110",
            current === swatch
              ? "border-[var(--studio-accent)]"
              : "border-[var(--studio-border)]"
          )}
          style={{ backgroundColor: swatch }}
        />
      ))}

      {open && (
        <>
          <Divider />
          <PillButton
            icon="remove"
            label="Thinner line"
            onClick={() => weigh(0.8)}
          />
          <PillButton
            icon="add"
            label="Thicker line"
            onClick={() => weigh(1.25)}
          />
        </>
      )}

      <Divider />

      <PillButton
        icon="stacks"
        label="Position"
        active={tool === "layers"}
        onClick={() => setTool(tool === "layers" ? "select" : "layers")}
      />
    </Pill>
  );
}

function PillButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  /** Omit for a momentary action; pass a boolean for a toggle. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-r="full"
      title={label}
      aria-label={label}
      className={cx(
        "flex h-7 w-7 items-center justify-center transition-colors",
        active
          ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
          : "text-[var(--studio-ink-muted)] hover:bg-white/[0.055] hover:text-[var(--studio-ink)]"
      )}
    >
      <Icon name={icon} className="text-[16px]" />
    </button>
  );
}
