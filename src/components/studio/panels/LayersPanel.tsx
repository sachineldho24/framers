"use client";

/**
 * Layers: the stack, bottom-first in the document but rendered top-down here —
 * the top row is the frontmost layer, like every editor.
 *
 * Reordering is a reducer action so it participates in undo. Rename commits on
 * blur; visibility is a single undo step (the "Hide" affordance, not a gesture).
 */

import { Icon } from "@/components/Icon";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, IconButton, PanelSection, cx } from "../ui";

export function LayersPanel() {
  const { doc, selectedId, select, apply } = useStudio();

  if (doc.layers.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No layers yet"
        body="Images you add from Uploads — and text you add from the Text panel — appear here, back to front."
      />
    );
  }

  // Render frontmost first: index 0 is the bottom of the document stack.
  const order = [...doc.layers].reverse();

  return (
    <div>
      <PanelSection title={`${doc.layers.length} ${doc.layers.length === 1 ? "layer" : "layers"}`}>
        <ul className="flex flex-col gap-1">
          {order.map((layer, reversedIndex) => {
            const index = doc.layers.length - 1 - reversedIndex;
            const selected = layer.id === selectedId;
            const canMoveUp = index < doc.layers.length - 1; // toward front
            const canMoveDown = index > 0; // toward back
            return (
              <li
                key={layer.id}
                className={cx(
                  "group flex items-center gap-1 border px-1.5 py-1 transition-colors",
                  selected
                    ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)]"
                    : "border-[var(--studio-border)] bg-white hover:border-black/15"
                )}
                data-r="sm"
              >
                <button
                  type="button"
                  onClick={() => select(layer.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                  aria-pressed={selected}
                >
                  <Icon
                    name={
                      !layer.visible
                        ? "visibility_off"
                        : layer.kind === "text"
                          ? "title"
                          : "image"
                    }
                    className={cx(
                      "shrink-0 text-[17px]",
                      layer.visible
                        ? "text-[var(--studio-ink-muted)]"
                        : "text-[var(--studio-ink-muted)]/50"
                    )}
                  />
                  <span
                    className={cx(
                      "truncate text-[12.5px]",
                      selected
                        ? "font-medium text-[var(--studio-ink)]"
                        : "text-[var(--studio-ink)]",
                      !layer.visible && "opacity-50"
                    )}
                  >
                    {layer.name}
                  </span>
                  {layer.locked && (
                    <Icon
                      name="lock"
                      className="ml-auto shrink-0 text-[13px] text-[var(--studio-ink-muted)]"
                    />
                  )}
                </button>

                <div className="flex shrink-0 items-center">
                  <IconButton
                    icon={layer.visible ? "visibility" : "visibility_off"}
                    label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                    size="sm"
                    active={!layer.visible}
                    onClick={() =>
                      apply({
                        type: "setLayerVisible",
                        layerId: layer.id,
                        visible: !layer.visible,
                      })
                    }
                  />
                  <IconButton
                    icon={layer.locked ? "lock" : "lock_open"}
                    label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                    size="sm"
                    active={layer.locked}
                    onClick={() =>
                      apply({
                        type: "setLayerLocked",
                        layerId: layer.id,
                        locked: !layer.locked,
                      })
                    }
                  />
                </div>

                <div
                  className={cx(
                    "flex shrink-0 items-center",
                    "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  )}
                >
                  <IconButton
                    icon="arrow_upward"
                    label={`Bring ${layer.name} forward`}
                    size="sm"
                    disabled={!canMoveUp}
                    onClick={() =>
                      apply({ type: "moveLayerBy", layerId: layer.id, delta: 1 })
                    }
                  />
                  <IconButton
                    icon="arrow_downward"
                    label={`Send ${layer.name} backward`}
                    size="sm"
                    disabled={!canMoveDown}
                    onClick={() =>
                      apply({ type: "moveLayerBy", layerId: layer.id, delta: -1 })
                    }
                  />
                  <IconButton
                    icon="delete"
                    label={`Delete ${layer.name}`}
                    size="sm"
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
      </PanelSection>

      <p className="px-1 text-[12px] leading-relaxed text-[var(--studio-ink-muted)]">
        The top row is the frontmost layer. Drag order isn&apos;t wired yet — use the
        arrows on hover. Right-click a layer on the canvas for front/back jumps.
      </p>
    </div>
  );
}
