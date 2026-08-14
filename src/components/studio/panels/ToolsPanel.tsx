"use client";

/**
 * The Tools list from the mockup. Each entry sets the active tool; tools that
 * need a layer are disabled with nothing selected rather than silently doing
 * nothing when clicked.
 *
 * "Needs a layer" means needs an *image* layer for most of them — erasing,
 * cropping, framing and colour adjustment are all operations on pixels, and a
 * text layer has none. Offering them for words would be offering a no-op.
 */

import { Icon } from "@/components/Icon";
import { useStudio, type ToolId } from "@/lib/studio/StudioContext";

import { cx } from "../ui";
import { useInsertText } from "../useInsertText";

interface ToolEntry {
  id: ToolId;
  icon: string;
  label: string;
  hint: string;
  /** Needs an image selected to do anything. */
  needsImage?: boolean;
}

const TOOLS: ToolEntry[] = [
  { id: "select", icon: "near_me", label: "Select", hint: "Move and resize" },
  {
    id: "draw",
    icon: "brush",
    label: "Restore",
    hint: "Paint erased areas back",
    needsImage: true,
  },
  {
    id: "eraser",
    icon: "ink_eraser",
    label: "Eraser",
    hint: "Rub out part of an image",
    needsImage: true,
  },
  {
    id: "crop",
    icon: "crop",
    label: "Crop",
    hint: "Trim to what matters",
    needsImage: true,
  },
  {
    id: "frames",
    icon: "crop_free",
    label: "Frames",
    hint: "Circle and rounded shapes",
    needsImage: true,
  },
  {
    id: "adjust",
    icon: "tune",
    label: "Adjust",
    hint: "Brightness, contrast, filters",
    needsImage: true,
  },
  // Not `needsImage`: the border belongs to the page, so it is worth setting
  // before a photo is even placed.
  {
    id: "border",
    icon: "border_outer",
    label: "Border",
    hint: "A printed edge around the art",
  },
  { id: "layers", icon: "layers", label: "Layers", hint: "Order and lock" },
];

export function ToolsPanel() {
  const { tool, setTool, selectedLayer } = useStudio();
  const insertText = useInsertText();
  const hasImage = selectedLayer?.kind === "image";

  return (
    <div className="flex flex-col gap-0.5">
      {TOOLS.map((entry) => {
        const disabled = entry.needsImage && !hasImage;
        const active = tool === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => setTool(entry.id)}
            data-r="md"
            className={cx(
              "flex items-center gap-3 px-2.5 py-2 text-left transition-colors",
              active
                ? "bg-[var(--studio-accent-soft)]"
                : "hover:bg-black/[0.045]",
              "disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            <Icon
              name={entry.icon}
              fill={active}
              className={cx(
                "text-[21px]",
                active
                  ? "text-[var(--studio-accent)]"
                  : "text-[var(--studio-ink-muted)]"
              )}
            />
            <span className="min-w-0">
              <span
                className={cx(
                  "block text-[13.5px] font-medium",
                  active
                    ? "text-[var(--studio-accent)]"
                    : "text-[var(--studio-ink)]"
                )}
              >
                {entry.label}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--studio-ink-muted)]">
                {entry.hint}
              </span>
            </span>
          </button>
        );
      })}

      {/* Not a tool: it adds a layer and hands over to the Text panel. It sits
          with the tools anyway because this is the list people scan. */}
      <button
        type="button"
        onClick={() => insertText("heading")}
        data-r="md"
        className="mt-1 flex items-center gap-3 border-t border-[var(--studio-border)] px-2.5 pb-2 pt-3 text-left transition-colors hover:bg-black/[0.045]"
      >
        <Icon name="title" className="text-[21px] text-[var(--studio-ink-muted)]" />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-[var(--studio-ink)]">
            Add text
          </span>
          <span className="block truncate text-[11.5px] text-[var(--studio-ink-muted)]">
            A heading you can restyle
          </span>
        </span>
      </button>

      {!hasImage && (
        <p className="mt-3 px-2 text-[12px] leading-relaxed text-[var(--studio-ink-muted)]">
          Select an image on the canvas to use the greyed-out tools.
        </p>
      )}
    </div>
  );
}
