"use client";

/**
 * The small floating toolbar under a selected object: duplicate, lock, delete
 * and an overflow menu, mirroring the mockup.
 *
 * Every action here also exists in the context menu and (mostly) on the
 * keyboard. This is the discoverable surface, not the only one.
 */

import { useStudio } from "@/lib/studio/StudioContext";
import type { Layer } from "@/lib/studio/document";

import { IconButton, Menu, MenuItem, MenuSeparator } from "./ui";

export function ObjectToolbar({ layer }: { layer: Layer }) {
  const { apply, select, setEditingId, doc } = useStudio();
  const index = doc.layers.findIndex((l) => l.id === layer.id);
  const isFront = index === doc.layers.length - 1;
  const isBack = index === 0;
  // Flipping and page-fitting are geometry on pixels. A flipped text layer would
  // be mirror writing, and a text box stretched to the page keeps its font size,
  // so neither item is offered for words.
  const isImage = layer.kind === "image";

  return (
    <div
      data-r="md"
      className="studio-shadow flex items-center gap-0.5 border border-[var(--studio-border)] bg-white p-1"
    >
      {layer.kind === "text" && !layer.locked && (
        <IconButton
          icon="edit"
          label="Edit text"
          size="sm"
          tooltipSide="top"
          onClick={() => setEditingId(layer.id)}
        />
      )}
      <IconButton
        icon="content_copy"
        label="Duplicate"
        size="sm"
        tooltipSide="top"
        onClick={() => apply({ type: "duplicateLayer", layerId: layer.id })}
      />
      <IconButton
        icon={layer.locked ? "lock" : "lock_open"}
        label={layer.locked ? "Unlock" : "Lock"}
        size="sm"
        tooltipSide="top"
        onClick={() =>
          apply({
            type: "setLayerLocked",
            layerId: layer.id,
            locked: !layer.locked,
          })
        }
      />
      <IconButton
        icon="delete"
        label="Delete"
        size="sm"
        tooltipSide="top"
        onClick={() => {
          apply({ type: "removeLayer", layerId: layer.id });
          select(null);
        }}
      />

      <span
        className="mx-0.5 h-5 w-px bg-[var(--studio-border)]"
        aria-hidden="true"
      />

      <Menu ariaLabel="More object options" icon="more_horiz" align="end">
        {(close) => (
          <>
            <MenuItem
              icon="flip_to_front"
              shortcut="Ctrl+]"
              disabled={isFront}
              onSelect={() => {
                apply({ type: "bringToFront", layerId: layer.id });
                close();
              }}
            >
              Bring to front
            </MenuItem>
            <MenuItem
              icon="flip_to_back"
              shortcut="Ctrl+["
              disabled={isBack}
              onSelect={() => {
                apply({ type: "sendToBack", layerId: layer.id });
                close();
              }}
            >
              Send to back
            </MenuItem>
            {isImage && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon="flip"
                  onSelect={() => {
                    apply({
                      type: "flipLayer",
                      layerId: layer.id,
                      axis: "horizontal",
                    });
                    close();
                  }}
                >
                  Flip horizontal
                </MenuItem>
                <MenuItem
                  icon="flip"
                  onSelect={() => {
                    apply({
                      type: "flipLayer",
                      layerId: layer.id,
                      axis: "vertical",
                    });
                    close();
                  }}
                >
                  Flip vertical
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon="fit_screen"
                  onSelect={() => {
                    apply({
                      type: "fitLayerToPage",
                      layerId: layer.id,
                      mode: "contain",
                    });
                    close();
                  }}
                >
                  Fit to page
                </MenuItem>
                <MenuItem
                  icon="crop_free"
                  onSelect={() => {
                    apply({
                      type: "fitLayerToPage",
                      layerId: layer.id,
                      mode: "cover",
                    });
                    close();
                  }}
                >
                  Fill page
                </MenuItem>
              </>
            )}
            <MenuSeparator />
            <MenuItem
              icon={layer.visible ? "visibility_off" : "visibility"}
              onSelect={() => {
                apply({
                  type: "setLayerVisible",
                  layerId: layer.id,
                  visible: !layer.visible,
                });
                close();
              }}
            >
              {layer.visible ? "Hide" : "Show"}
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}
