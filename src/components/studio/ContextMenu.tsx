"use client";

/**
 * Right-click menu. The item list follows the mockup; each one is wired to a
 * real action, and the two the model can't back are handled honestly:
 *
 * - Paste is disabled with an empty clipboard rather than silently doing
 *   nothing, which is the point of showing it at all.
 * - "Alternative text" is omitted — layers carry no alt text, and a control
 *   that discards what you type into it is worse than an absent one.
 */

import { useEffect, useRef, useState } from "react";

import type { ImageLayer, Layer } from "@/lib/studio/document";
import type { AlignMode } from "@/lib/studio/geometry";
import { useStudio } from "@/lib/studio/StudioContext";

import { Icon } from "@/components/Icon";
import { useStudioAssets } from "./StudioAssets";
import { MenuItem, MenuSeparator, cx } from "./ui";

export interface ContextMenuState {
  /** Viewport coordinates of the click. */
  x: number;
  y: number;
  layerId: string | null;
}

const ALIGNMENTS: { mode: AlignMode; label: string; icon: string }[] = [
  { mode: "left", label: "Left", icon: "align_horizontal_left" },
  { mode: "centre", label: "Centre", icon: "align_horizontal_center" },
  { mode: "right", label: "Right", icon: "align_horizontal_right" },
  { mode: "top", label: "Top", icon: "align_vertical_top" },
  { mode: "middle", label: "Middle", icon: "align_vertical_center" },
  { mode: "bottom", label: "Bottom", icon: "align_vertical_bottom" },
];

const MENU_WIDTH = 268;
const MENU_MAX_HEIGHT = 460;

export function ContextMenu({
  state,
  onClose,
  onCopy,
  onPaste,
  canPaste,
  onDownloadSelection,
  onShowInfo,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onCopy: (layer: Layer) => void;
  onPaste: () => void;
  canPaste: boolean;
  /** Staff only; omitted for customers. */
  onDownloadSelection?: (layer: Layer) => void;
  onShowInfo: (layer: Layer) => void;
}) {
  const { doc, apply, select, duplicate, setEditingId } = useStudio();
  const { paletteFor } = useStudioAssets();
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<"align" | "layer" | null>(null);
  const alignOpen = open === "align";
  const layerOpen = open === "layer";

  // Narrowed, not cast: the stack holds text as well as images now, and the two
  // image-only items below have to be able to tell which is under the pointer.
  const layer: Layer | null =
    (state.layerId
      ? doc.layers.find((l) => l.id === state.layerId)
      : undefined) ?? null;
  const image: ImageLayer | null = layer?.kind === "image" ? layer : null;
  const text = layer?.kind === "text" ? layer : null;

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Flip about the pointer near the viewport edges so the menu is never clipped.
  const left =
    typeof window !== "undefined" && state.x + MENU_WIDTH > window.innerWidth - 8
      ? Math.max(8, state.x - MENU_WIDTH)
      : state.x;
  const top =
    typeof window !== "undefined" &&
    state.y + MENU_MAX_HEIGHT > window.innerHeight - 8
      ? Math.max(8, window.innerHeight - MENU_MAX_HEIGHT - 8)
      : state.y;

  function run(fn: () => void) {
    fn();
    onClose();
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Canvas actions"
      data-r="md"
      className="studio-shadow fixed z-[60] border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1"
      // Expanding Align or Layer can outgrow a short window; scroll, don't clip.
      style={{ left, top, width: MENU_WIDTH, maxHeight: `calc(100vh - ${top}px - 8px)`, overflowY: "auto" }}
    >
      {text && !text.locked && (
        <MenuItem
          icon="edit"
          onSelect={() =>
            run(() => {
              select(text.id);
              setEditingId(text.id);
            })
          }
        >
          Edit text
        </MenuItem>
      )}
      <MenuItem
        icon="content_copy"
        shortcut="Ctrl+C"
        disabled={!layer}
        onSelect={() => layer && run(() => onCopy(layer))}
      >
        Copy
      </MenuItem>
      <MenuItem
        icon="content_paste"
        shortcut="Ctrl+V"
        disabled={!canPaste}
        onSelect={() => run(onPaste)}
      >
        Paste
      </MenuItem>
      <MenuItem
        icon="library_add"
        shortcut="Ctrl+D"
        disabled={!layer}
        onSelect={() =>
          layer &&
          run(() => duplicate(layer.id))
        }
      >
        Duplicate
      </MenuItem>
      <MenuItem
        icon="delete"
        shortcut="Delete"
        danger
        disabled={!layer || layer.locked}
        onSelect={() =>
          layer &&
          run(() => {
            apply({ type: "removeLayer", layerId: layer.id });
            select(null);
          })
        }
      >
        Delete
      </MenuItem>

      <MenuSeparator />

      {/* Align opens in place rather than as a hover-out flyout: a submenu that
          appears on hover is hard to hit on touch and with a trackpad. */}
      <button
        type="button"
        role="menuitem"
        aria-expanded={alignOpen}
        disabled={!layer}
        onClick={() => setOpen(alignOpen ? null : "align")}
        data-r="sm"
        className={cx(
          "flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left text-[13px] text-[var(--studio-ink)] transition-colors",
          "hover:bg-white/[0.055] disabled:pointer-events-none disabled:opacity-35"
        )}
      >
        <Icon name="align_horizontal_center" className="text-[18px] opacity-80" />
        <span className="flex-1">Align to page</span>
        <Icon
          name={alignOpen ? "expand_more" : "chevron_right"}
          className="text-[17px] opacity-60"
        />
      </button>

      {alignOpen && layer && (
        <div className="mb-1 grid grid-cols-3 gap-0.5 px-1">
          {ALIGNMENTS.map((a) => (
            <button
              key={a.mode}
              type="button"
              role="menuitem"
              title={a.label}
              onClick={() =>
                run(() =>
                  apply({ type: "alignLayer", layerId: layer.id, mode: a.mode })
                )
              }
              data-r="sm"
              className="flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] text-[var(--studio-ink-muted)] transition-colors hover:bg-white/[0.055]"
            >
              <Icon name={a.icon} className="text-[18px]" />
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Layer order, opened in place like Align. */}
      <button
        type="button"
        role="menuitem"
        aria-expanded={layerOpen}
        disabled={!layer}
        onClick={() => setOpen(layerOpen ? null : "layer")}
        data-r="sm"
        className={cx(
          "flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left text-[13px] text-[var(--studio-ink)] transition-colors",
          "hover:bg-white/[0.055] disabled:pointer-events-none disabled:opacity-35"
        )}
      >
        <Icon name="layers" className="text-[18px] opacity-80" />
        <span className="flex-1">Layer</span>
        <Icon
          name={layerOpen ? "expand_more" : "chevron_right"}
          className="text-[17px] opacity-60"
        />
      </button>

      {layerOpen && layer && (() => {
        const index = doc.layers.findIndex((l) => l.id === layer.id);
        const top = index === doc.layers.length - 1;
        const bottom = index === 0;
        return (
          <div className="mb-1 pl-4">
            <MenuItem icon="flip_to_front" shortcut="Ctrl+]" disabled={top}
              onSelect={() => run(() => apply({ type: "bringToFront", layerId: layer.id }))}>
              Bring to front
            </MenuItem>
            <MenuItem icon="arrow_upward" disabled={top}
              onSelect={() => run(() => apply({ type: "moveLayerBy", layerId: layer.id, delta: 1 }))}>
              Bring forward
            </MenuItem>
            <MenuItem icon="arrow_downward" disabled={bottom}
              onSelect={() => run(() => apply({ type: "moveLayerBy", layerId: layer.id, delta: -1 }))}>
              Send backward
            </MenuItem>
            <MenuItem icon="flip_to_back" shortcut="Ctrl+[" disabled={bottom}
              onSelect={() => run(() => apply({ type: "sendToBack", layerId: layer.id }))}>
              Send to back
            </MenuItem>
          </div>
        );
      })()}

      <MenuSeparator />

      <MenuItem
        icon={layer?.locked ? "lock_open" : "lock"}
        shortcut="Alt+Shift+L"
        disabled={!layer}
        onSelect={() =>
          layer &&
          run(() =>
            apply({
              type: "setLayerLocked",
              layerId: layer.id,
              locked: !layer.locked,
            })
          )
        }
      >
        {layer?.locked ? "Unlock" : "Lock"}
      </MenuItem>
      {/* Background means "fill the page with these pixels" — there is nothing
          for it to do to a text layer, so it isn't offered for one. */}
      {image && (
        <MenuItem
          icon="wallpaper"
          onSelect={() =>
            run(() => apply({ type: "setLayerAsBackground", layerId: image.id }))
          }
        >
          Set image as background
        </MenuItem>
      )}
      {/* The photo's most dominant colour becomes the page colour — the quick
          way to make the page match its picture. */}
      {image && paletteFor(image.src).length > 0 && (
        <MenuItem
          icon="palette"
          onSelect={() =>
            run(() => apply({ type: "setBackground", color: paletteFor(image.src)[0] }))
          }
        >
          Apply colours to page
        </MenuItem>
      )}

      <MenuSeparator />

      {onDownloadSelection && (
        <MenuItem
          icon="download"
          disabled={!layer}
          onSelect={() => layer && run(() => onDownloadSelection(layer))}
        >
          Download selection
        </MenuItem>
      )}
      <MenuItem
        icon="info"
        disabled={!layer}
        onSelect={() => layer && run(() => onShowInfo(layer))}
      >
        Info
      </MenuItem>
    </div>
  );
}
