"use client";

/**
 * Elements - the shape library, laid out the way Canva's Elements tab is: a
 * search box, a row of categories, and one click to drop the element on the
 * page.
 *
 * Vector elements only. Canva's tab also sells graphics, photos, video and
 * charts; none of those exist here, and tiles that did nothing would be the
 * same lie the other unbuilt shelves avoid by saying so plainly.
 *
 * A thumbnail is not a second drawing of the shape: it is the same
 * `ShapeCommand` list the renderer traces and the flatten step prints, turned
 * into an SVG path. A tile that disagreed with the page would be lying about
 * what the click is about to insert.
 */

import { useMemo, useState } from "react";

import { createShapeLayer } from "@/lib/studio/document";
import type { ShapeStylePatch } from "@/lib/studio/reducer";
import { MAX_SHAPE_STROKE, type ShapeLayer } from "@/lib/studio/document";
import {
  getShape,
  SHAPE_CATALOG,
  SHAPE_CATEGORIES,
  shapePathD,
  type ShapeCategoryId,
  type ShapeDef,
} from "@/lib/studio/shapes";
import { useStudio } from "@/lib/studio/StudioContext";

import { Icon } from "@/components/Icon";
import { STUDIO_SWATCHES } from "../palette";
import { PhotoColourSwatches } from "../StudioAssets";
import { EmptyState, PanelSection, Slider, cx } from "../ui";

type Filter = ShapeCategoryId | "all";

/** Viewbox for a thumbnail, in arbitrary units: only the ratio matters. */
const PREVIEW = 100;

/**
 * How much of the page a freshly inserted element takes.
 *
 * Big enough to see and grab, small enough to look like an element rather than
 * a new background - which is what a shape inserted at page size would be.
 */
const INSERT_FRACTION = 0.32;

export function ElementsPanel() {
  const { doc, selectedLayer, apply, select } = useStudio();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SHAPE_CATALOG.filter((def) => {
      if (filter !== "all" && def.category !== filter) return false;
      if (q.length === 0) return true;
      return def.label.toLowerCase().includes(q) || def.id.includes(q);
    });
  }, [query, filter]);

  const shape = selectedLayer?.kind === "shape" ? selectedLayer : null;

  function insert(def: ShapeDef) {
    const box = Math.min(doc.width, doc.height) * INSERT_FRACTION;
    const layer = createShapeLayer({
      shapeId: def.id,
      x: (doc.width - box) / 2,
      y: (doc.height - box) / 2,
      width: box,
      height: box,
      // Only open shapes read a weight, and it is proportional to the box so a
      // line is not a hairline on a poster and a slab on a postcard.
      strokeWidth: (def.strokeRatio ?? 0) * box,
    });
    apply({ type: "addLayer", layer });
    // Selected, so the colour controls below are already pointed at what the
    // user just added.
    select(layer.id);
  }

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search elements</span>
        <Icon
          name="search"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[var(--studio-ink-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search elements"
          className="h-9 w-full border border-[var(--studio-border)] bg-[var(--studio-chrome)] pl-9 pr-2.5 text-[13px] text-[var(--studio-ink)] outline-none placeholder:text-[var(--studio-ink-muted)] focus:border-[var(--studio-accent)]"
        />
      </label>

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: "all" as const, label: "All" }, ...SHAPE_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            data-r="full"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cx(
              "shrink-0 border px-3 py-1 text-[12px] font-medium transition-colors",
              filter === c.id
                ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                : "border-[var(--studio-border)] text-[var(--studio-ink-muted)] hover:bg-white/[0.055] hover:text-[var(--studio-ink)]"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {matches.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="No element matches"
          body={`Nothing here is called "${query.trim()}". Try a shape, a category or a line: "star", "arrow", "wave".`}
        />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {matches.map((def) => (
            <button
              key={def.id}
              type="button"
              data-r="sm"
              title={def.label}
              aria-label={`Add ${def.label}`}
              onClick={() => insert(def)}
              className="flex aspect-square items-center justify-center border border-[var(--studio-border)] bg-[var(--studio-canvas-bg)] p-2 text-[var(--studio-ink)] transition-colors hover:border-white/35 hover:bg-white/[0.045]"
            >
              <ShapeThumb def={def} />
            </button>
          ))}
        </div>
      )}

      {shape && <ShapeStyleControls layer={shape} />}
    </div>
  );
}

function ShapeThumb({ def }: { def: ShapeDef }) {
  const stroke = Math.max(2, (def.strokeRatio ?? 0) * PREVIEW);
  const open = def.mode === "stroke";
  return (
    <svg
      viewBox={`0 0 ${PREVIEW} ${PREVIEW}`}
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={shapePathD(def, PREVIEW, PREVIEW)}
        fill={open ? "none" : "currentColor"}
        stroke={open ? "currentColor" : "none"}
        strokeWidth={open ? stroke : undefined}
        strokeLinecap={def.lineCap ?? "round"}
        strokeLinejoin="round"
        strokeDasharray={
          def.dash && def.dash.length > 0
            ? def.dash.map((n) => n * stroke).join(" ")
            : undefined
        }
      />
    </svg>
  );
}

/**
 * The colour and weight of the selected element.
 *
 * Canva puts these in the toolbar above the page; here they live under the
 * library that inserted it, which is where the user's attention already is. A
 * filled shape has one colour and no weight; a line is the other way round, so
 * the weight slider only appears for the shapes that use it.
 */
function ShapeStyleControls({ layer }: { layer: ShapeLayer }) {
  const { apply, endGesture } = useStudio();
  const def = getShape(layer.shapeId);
  const open = def?.mode === "stroke";
  const current = layer.color.toLowerCase();

  const set = (patch: Partial<ShapeStylePatch>) =>
    apply({ type: "setShapeStyle", layerId: layer.id, patch });

  return (
    <>
      <PanelSection title={open ? "Line colour" : "Fill"}>
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              data-r="md"
              aria-label={`Use ${swatch}`}
              aria-pressed={current === swatch}
              onClick={() => set({ color: swatch })}
              className={cx(
                "h-7 w-7 border transition-transform hover:scale-105",
                current === swatch
                  ? "border-[var(--studio-accent)]"
                  : "border-[var(--studio-border)]"
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--studio-ink-muted)]">
          <input
            type="color"
            value={layer.color}
            aria-label="Custom colour"
            onChange={(e) => set({ color: e.target.value })}
            className="h-7 w-9 shrink-0 cursor-pointer border border-[var(--studio-border)] bg-transparent"
          />
          {layer.color.toUpperCase()}
        </label>
        <PhotoColourSwatches
          className="mt-3"
          value={layer.color}
          onPick={(colour) => set({ color: colour })}
        />
      </PanelSection>

      {open && (
        <PanelSection title="Thickness">
          <Slider
            label="Weight"
            value={Math.round(layer.strokeWidth)}
            min={1}
            max={MAX_SHAPE_STROKE}
            suffix="px"
            onChange={(v) =>
              apply(
                {
                  type: "setShapeStyle",
                  layerId: layer.id,
                  patch: { strokeWidth: v },
                },
                { transient: true, label: `shape-stroke:${layer.id}` }
              )
            }
            onCommit={endGesture}
          />
        </PanelSection>
      )}
    </>
  );
}
