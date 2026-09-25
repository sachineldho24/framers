"use client";

/**
 * Position — Canva's panel of the same name, in two tabs.
 *
 * Arrange: layer order, align to page, and the exact box — width, height, X, Y
 * and rotation in document pixels, typed rather than dragged.
 *
 * Layers: the stack, frontmost first like every editor, with thumbnails and
 * drag-to-reorder. The document stores it bottom-first; the list reverses it.
 *
 * Every change is a reducer action, so it participates in undo.
 */

import { useState } from "react";

import { Icon } from "@/components/Icon";
import type { Layer, TextLayer } from "@/lib/studio/document";
import type { AlignMode } from "@/lib/studio/geometry";
import { commandsToD, mapNode, pathCommands } from "@/lib/studio/penPath";
import { useStudio } from "@/lib/studio/StudioContext";
import { textLayerHeight } from "@/lib/studio/textMeasure";

import { useStudioAssets } from "../StudioAssets";
import { EmptyState, IconButton, PanelSection, cx } from "../ui";

type Tab = "arrange" | "layers";

export function LayersPanel() {
  const { selectedLayer } = useStudio();
  const [tab, setTab] = useState<Tab>(selectedLayer ? "arrange" : "layers");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Position"
        data-r="sm"
        className="mb-4 grid grid-cols-2 gap-1 bg-[#1a1a1a] p-1"
      >
        {(
          [
            ["arrange", "Arrange"],
            ["layers", "Layers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            data-r="sm"
            className={cx(
              "h-8 text-[13px] font-medium transition-colors",
              tab === id
                ? "bg-[#2a2a2a] text-[var(--studio-ink)]"
                : "text-[var(--studio-ink-muted)] hover:text-[var(--studio-ink)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "arrange" ? (
        selectedLayer ? (
          <ArrangeTab key={selectedLayer.id} layer={selectedLayer} />
        ) : (
          <EmptyState
            icon="open_with"
            title="Nothing selected"
            body="Select something on the page to arrange, align or size it exactly."
          />
        )
      ) : (
        <LayersTab />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Arrange                                                                    */
/* -------------------------------------------------------------------------- */

const ALIGNMENTS: { mode: AlignMode; label: string; icon: string }[] = [
  { mode: "top", label: "Top", icon: "align_vertical_top" },
  { mode: "left", label: "Left", icon: "align_horizontal_left" },
  { mode: "middle", label: "Middle", icon: "align_vertical_center" },
  { mode: "centre", label: "Centre", icon: "align_horizontal_center" },
  { mode: "bottom", label: "Bottom", icon: "align_vertical_bottom" },
  { mode: "right", label: "Right", icon: "align_horizontal_right" },
];

function ArrangeTab({ layer }: { layer: Layer }) {
  const { doc, apply } = useStudio();
  const [ratioLocked, setRatioLocked] = useState(true);
  const index = doc.layers.findIndex((l) => l.id === layer.id);
  const isFront = index === doc.layers.length - 1;
  const isBack = index === 0;
  const text: TextLayer | null = layer.kind === "text" ? layer : null;
  const locked = layer.locked;

  const setBox = (box: Partial<Pick<Layer, "x" | "y" | "width" | "height" | "rotation">>) =>
    apply({ type: "setLayerBox", layerId: layer.id, box });

  const setWidth = (width: number) => {
    if (text) {
      // Text wraps to its width and its height follows the words.
      const height = textLayerHeight(text, { width });
      setBox({ width, ...(height ? { height } : {}) });
      return;
    }
    setBox(ratioLocked ? { width, height: (width * layer.height) / layer.width } : { width });
  };
  const setHeight = (height: number) =>
    setBox(ratioLocked ? { height, width: (height * layer.width) / layer.height } : { height });

  return (
    <div>
      {locked && (
        <p
          data-r="sm"
          className="mb-4 flex items-center gap-2 bg-[#1a1a1a] px-3 py-2 text-[12px] text-[var(--studio-ink-muted)]"
        >
          <Icon name="lock" className="text-[16px]" />
          Unlock this layer to move or resize it.
        </p>
      )}

      <PanelSection title="Layer order">
        <div className="grid grid-cols-2 gap-1.5">
          <ArrangeButton icon="arrow_upward" disabled={isFront} onClick={() => apply({ type: "moveLayerBy", layerId: layer.id, delta: 1 })}>
            Forward
          </ArrangeButton>
          <ArrangeButton icon="arrow_downward" disabled={isBack} onClick={() => apply({ type: "moveLayerBy", layerId: layer.id, delta: -1 })}>
            Backward
          </ArrangeButton>
          <ArrangeButton icon="flip_to_front" disabled={isFront} onClick={() => apply({ type: "bringToFront", layerId: layer.id })}>
            To front
          </ArrangeButton>
          <ArrangeButton icon="flip_to_back" disabled={isBack} onClick={() => apply({ type: "sendToBack", layerId: layer.id })}>
            To back
          </ArrangeButton>
        </div>
      </PanelSection>

      <PanelSection title="Align to page">
        <div className="grid grid-cols-2 gap-1.5">
          {ALIGNMENTS.map((a) => (
            <ArrangeButton
              key={a.mode}
              icon={a.icon}
              disabled={locked}
              onClick={() => apply({ type: "alignLayer", layerId: layer.id, mode: a.mode })}
            >
              {a.label}
            </ArrangeButton>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Advanced">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <NumberField label="Width" suffix="px" value={layer.width} min={1} disabled={locked} onCommit={setWidth} />
          {text ? (
            <span className="w-8" aria-hidden="true" />
          ) : (
            <IconButton
              icon={ratioLocked ? "link" : "link_off"}
              label={ratioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
              size="sm"
              active={ratioLocked}
              onClick={() => setRatioLocked((v) => !v)}
              className="mb-0.5"
            />
          )}
          <NumberField
            label="Height"
            suffix="px"
            value={layer.height}
            min={1}
            // A text box's height is its words'; typing one would be undone by
            // the next keystroke.
            disabled={locked || !!text}
            onCommit={setHeight}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField label="X" suffix="px" value={layer.x} disabled={locked} onCommit={(x) => setBox({ x })} />
          <NumberField label="Y" suffix="px" value={layer.y} disabled={locked} onCommit={(y) => setBox({ y })} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="Rotate"
            suffix="°"
            // Signed, so a small turn left reads -5, not 355.
            value={((((layer.rotation % 360) + 540) % 360) - 180) || 0}
            disabled={locked}
            onCommit={(rotation) => setBox({ rotation })}
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--studio-ink-muted)]">
          Measured in page pixels from the top-left corner. The page is{" "}
          {doc.width} × {doc.height} px.
        </p>
      </PanelSection>
    </div>
  );
}

function ArrangeButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-r="sm"
      className="flex h-9 items-center gap-2 border border-[#2e2e2e] px-2.5 text-left text-[12.5px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-[#282828] disabled:pointer-events-none disabled:opacity-35"
    >
      <Icon name={icon} className="text-[18px] text-[var(--studio-ink-muted)]" />
      {children}
    </button>
  );
}

/**
 * A number typed and committed on Enter or blur; Escape puts it back. Keyed on
 * the value, so a drag on the canvas refreshes the field without any syncing.
 */
function NumberField({
  label,
  value,
  suffix,
  min,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  suffix: string;
  min?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const shown = Math.round(value);
  const commit = (input: HTMLInputElement) => {
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed) || input.value.trim() === "") {
      input.value = String(shown);
      return;
    }
    const next = min !== undefined ? Math.max(min, parsed) : parsed;
    if (Math.round(next) !== shown) onCommit(next);
    else input.value = String(shown);
  };

  return (
    <label className={cx("block", disabled && "opacity-50")}>
      <span className="mb-1 block text-[11px] font-medium text-[var(--studio-ink-muted)]">
        {label}
      </span>
      <span
        data-r="sm"
        className="flex h-9 items-center border border-[#2e2e2e] bg-[#181818] pr-2 focus-within:border-[var(--studio-accent)]"
      >
        <input
          key={shown}
          type="number"
          inputMode="decimal"
          defaultValue={shown}
          disabled={disabled}
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = String(shown);
              e.currentTarget.blur();
            }
          }}
          className="h-full w-full min-w-0 bg-transparent px-2.5 text-[13px] tabular-nums text-[var(--studio-ink)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-[12px] text-[var(--studio-ink-muted)]">{suffix}</span>
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Layers                                                                     */
/* -------------------------------------------------------------------------- */

function LayersTab() {
  const { doc, selectedId, select, apply } = useStudio();
  const { urlFor } = useStudioAssets();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (doc.layers.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No layers yet"
        body="Photos, text and elements you add appear here, front to back."
      />
    );
  }

  // Render frontmost first: index 0 is the bottom of the document stack.
  const order = [...doc.layers].reverse();
  const last = doc.layers.length - 1;

  const drop = () => {
    if (dragId !== null && dropIndex !== null) {
      apply({ type: "reorderLayer", layerId: dragId, to: dropIndex });
    }
    setDragId(null);
    setDropIndex(null);
  };

  return (
    <div>
      <ul className="flex flex-col gap-1" onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null);
      }}>
        {order.map((layer, row) => {
          const index = last - row;
          const selected = layer.id === selectedId;
          const dragging = dragId === layer.id;
          const url = layer.kind === "image" ? urlFor(layer.src) : null;
          return (
            <li
              key={layer.id}
              draggable
              onDragStart={(e) => {
                setDragId(layer.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", layer.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop();
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
              data-r="sm"
              className={cx(
                "group flex cursor-grab items-center gap-2 border p-1.5 transition-colors active:cursor-grabbing",
                selected
                  ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)]"
                  : "border-[#2a2a2a] bg-[#181818] hover:border-white/25",
                dragging && "opacity-40",
                dragId && dropIndex === index && !dragging && "outline outline-2 outline-[var(--studio-accent)]"
              )}
            >
              <Icon name="drag_indicator" className="shrink-0 text-[16px] text-[var(--studio-ink-muted)]" />
              <button
                type="button"
                onClick={() => select(layer.id)}
                aria-pressed={selected}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <LayerThumb layer={layer} url={url} />
                <span className={cx("min-w-0 flex-1", !layer.visible && "opacity-50")}>
                  <span className="block truncate text-[12.5px] font-medium text-[var(--studio-ink)]">
                    {layer.kind === "text" ? layer.text.split("\n")[0] || layer.name : layer.name}
                  </span>
                  <span className="block text-[11px] capitalize text-[var(--studio-ink-muted)]">
                    {layer.kind === "image" ? "Photo" : layer.kind === "path" ? "Pen path" : layer.kind}
                    {layer.locked && " · locked"}
                    {!layer.visible && " · hidden"}
                  </span>
                </span>
              </button>

              <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <IconButton
                  icon={layer.visible ? "visibility" : "visibility_off"}
                  label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                  size="sm"
                  active={!layer.visible}
                  onClick={() => apply({ type: "setLayerVisible", layerId: layer.id, visible: !layer.visible })}
                />
                <IconButton
                  icon={layer.locked ? "lock" : "lock_open"}
                  label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  size="sm"
                  active={layer.locked}
                  onClick={() => apply({ type: "setLayerLocked", layerId: layer.id, locked: !layer.locked })}
                />
                <IconButton
                  icon="delete"
                  label={`Delete ${layer.name}`}
                  size="sm"
                  disabled={layer.locked}
                  onClick={() => {
                    apply({ type: "removeLayer", layerId: layer.id });
                    if (layer.id === selectedId) select(null);
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-[var(--studio-ink-muted)]">
        The top row is the frontmost layer. Drag a row to change the order.
      </p>
    </div>
  );
}

function LayerThumb({ layer, url }: { layer: Layer; url: string | null }) {
  const box = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-[#2e2e2e] bg-[#111]";
  if (layer.kind === "image") {
    return (
      <span data-r="sm" className={box}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a decoded blob/signed URL, not a routable asset
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            style={{ transform: `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` }}
          />
        ) : (
          <Icon name="image" className="text-[18px] text-[var(--studio-ink-muted)]" />
        )}
      </span>
    );
  }
  if (layer.kind === "text") {
    return (
      <span data-r="sm" className={cx(box, "bg-white")}>
        <span className="text-[15px] font-bold" style={{ color: layer.color }}>
          T
        </span>
      </span>
    );
  }
  if (layer.kind === "path") {
    // The curve itself, fitted into the thumbnail with its aspect kept.
    const k = 28 / Math.max(layer.width, layer.height);
    const w = layer.width * k;
    const h = layer.height * k;
    const d = commandsToD(pathCommands(layer.nodes.map((n) => mapNode(n, (x, y) => [x * w, y * h])), layer.closed));
    return (
      <span data-r="sm" className={box}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
          <path
            d={d}
            fill={layer.closed && layer.fill ? layer.fill : "none"}
            stroke={layer.stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={layer.glow ? { filter: `drop-shadow(0 0 2px ${layer.glow.color})` } : undefined}
          />
        </svg>
      </span>
    );
  }
  return (
    <span data-r="sm" className={box}>
      <span data-r="sm" className="h-5 w-5" style={{ backgroundColor: layer.color }} />
    </span>
  );
}
