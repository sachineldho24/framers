"use client";

/**
 * The floating pill above the canvas — the mockup's contextual toolbar.
 *
 * It has two shapes, because a selected photo and a selected sentence have
 * almost nothing in common: cropping, erasing and colour adjustment are
 * operations on pixels, while a text layer wants its font and its alignment.
 * Same slot, same styling, different contents.
 *
 * It is docked to the top of the workspace, as in the mockup, rather than
 * floating over the selection — so it never covers the thing being edited.
 *
 * Deliberate omissions from the image variant: the colour swatches and the
 * border icon, which were decorative in the mockup — there's no fill or stroke
 * model on an image layer, so those controls would either lie or do nothing.
 * Likewise no Animate or Style: there's no animation or effect-preset system to
 * open. Corner rounding, Flip and Transparency *do* have real work behind them
 * (mask.kind, `flipLayer`, `setLayerOpacity`).
 *
 * BG Remover keeps its lightning-bolt badge and is *not* silently
 * repurposed: it opens the shared notice explaining that automatic removal
 * isn't built yet and offers the eraser, which does the same job by hand.
 */

import type {
  DrawLayer,
  ImageLayer,
  ImageOutline,
  Layer,
  OutlineStyle,
  ShapeLayer,
  TextLayer,
} from "@/lib/studio/document";
import { createId, MAX_OUTLINE, MAX_SHAPE_STROKE, NO_OUTLINE } from "@/lib/studio/document";
import type { AlignMode } from "@/lib/studio/geometry";
import { alignLayersTo, isWholeGroup } from "@/lib/studio/multiSelect";
import { fontDisplayName, fontStack, getFont, nearestWeight } from "@/lib/studio/fonts";
import { documentDpi, printedInches } from "@/lib/studio/print";
import type { TextStylePatch } from "@/lib/studio/reducer";
import { getShape } from "@/lib/studio/shapes";
import { DEFAULT_LINE_HEIGHT, MIN_FONT_SIZE } from "@/lib/studio/text";
import { useStudio } from "@/lib/studio/StudioContext";
import { textLayerHeight } from "@/lib/studio/textMeasure";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { STUDIO_SWATCHES } from "./palette";
import { PhotoColourSwatches, useStudioAssets } from "./StudioAssets";
import { ColorField, FontPicker } from "./panels/TextPanel";
import { Slider, cx } from "./ui";

function Divider() {
  return (
    <span
      className="mx-0.5 h-[18px] w-px shrink-0 bg-[#2e2e2e]"
      aria-hidden="true"
    />
  );
}

type PopoverId =
  | "opacity"
  | "flip"
  | "colours"
  | "border"
  | "corners"
  | "font"
  | "color"
  | "spacing"
  | "align"
  | "background";

interface PopoverState {
  id: PopoverId;
  /**
   * Horizontal anchor, relative to the pill: the button's left edge, or — for a
   * button in the pill's right half — its right edge, so the popover opens
   * inward instead of running off the screen.
   */
  left?: number;
  right?: number;
}

/**
 * Popovers render outside the pill's scroll row — inside it they would be
 * clipped by the overflow that lets a long toolbar scroll on a narrow screen.
 */
const PopoverContext = createContext<{
  open: PopoverState | null;
  toggle: (id: PopoverId, anchor: HTMLElement) => void;
} | null>(null);

/** The shared shell, so every variant sits identically in the slot. */
function Pill({
  children,
  popover,
}: {
  children: React.ReactNode;
  /** Content for whichever popover is open. */
  popover?: (id: PopoverId, close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState<PopoverState | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (id: PopoverId, anchor: HTMLElement) => {
    const root = rootRef.current?.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    setOpen((current) => {
      if (current?.id === id) return null;
      if (!root) return { id, left: 0 };
      return box.left - root.left > root.width / 2
        ? { id, right: root.right - box.right }
        : { id, left: box.left - root.left };
    });
  };

  return (
    <PopoverContext.Provider value={{ open, toggle }}>
      <div ref={rootRef} className="pointer-events-auto relative max-w-full">
        <div
          data-r="md"
          className="studio-shadow flex max-w-full items-center gap-0.5 overflow-x-auto whitespace-nowrap border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1 [scrollbar-width:none]"
        >
          {children}
        </div>
        {open && popover && (
          <div
            data-r="md"
            className="studio-shadow absolute top-full z-30 mt-2 border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1"
            style={{ left: open.left, right: open.right }}
          >
            {popover(open.id, () => setOpen(null))}
          </div>
        )}
      </div>
    </PopoverContext.Provider>
  );
}

/** A toolbar button that opens one of the pill's popovers. */
function PopoverButton({
  id,
  icon,
  label,
  children,
}: {
  id: PopoverId;
  icon?: string;
  label: string;
  /** Text label; omit for an icon-only button. */
  children?: React.ReactNode;
}) {
  const ctx = useContext(PopoverContext);
  const active = ctx?.open?.id === id;
  return (
    <button
      type="button"
      onClick={(e) => ctx?.toggle(id, e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-label={children ? undefined : label}
      title={label}
      data-r="sm"
      className={cx(
        "flex h-8 shrink-0 items-center justify-center transition-colors",
        children ? "px-2.5 text-[13px] font-medium" : "w-8",
        active
          ? "bg-[#282828] text-[var(--studio-ink)]"
          : children
            ? "text-[var(--studio-ink)] hover:bg-[#282828]"
            : "text-[var(--studio-ink-muted)] hover:bg-[#282828] hover:text-[var(--studio-ink)]"
      )}
    >
      {icon && <Icon name={icon} className="text-[20px]" />}
      {children}
    </button>
  );
}

/** Transparency, for any kind of layer. One undo step per drag. */
function OpacityPopover({ layer }: { layer: Layer }) {
  const { apply, endGesture } = useStudio();
  return (
    <div className="w-[220px] px-2 py-2">
      <Slider
        label="Transparency"
        value={layer.opacity * 100}
        min={0}
        max={100}
        suffix="%"
        onChange={(v) =>
          apply(
            { type: "setLayerOpacity", layerId: layer.id, opacity: v / 100 },
            { transient: true, label: `opacity:${layer.id}` }
          )
        }
        onCommit={endGesture}
        onReset={() =>
          apply({ type: "setLayerOpacity", layerId: layer.id, opacity: 1 })
        }
      />
    </div>
  );
}

/**
 * A labelled action — icon plus text, the toolbar's "primary" buttons (Edit,
 * Replace, Font…). One place for their size and spacing so the row reads as
 * one deliberate system instead of several buttons that happen to sit next to
 * each other.
 */
function LabelButton({
  icon,
  children,
  onClick,
  title,
  ariaLabel,
  muted,
  trailingIcon,
  trailingClassName,
  active,
}: {
  icon?: string;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  /** BG Remover's not-quite-a-button-yet treatment. */
  muted?: boolean;
  trailingIcon?: string;
  trailingClassName?: string;
  /** Pass a boolean for a toggle. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-r="sm"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cx(
        active && "!bg-[var(--studio-accent-soft)] !text-[var(--studio-accent)]",
        "relative flex h-8 shrink-0 items-center gap-1 px-2.5 text-[13px] font-medium transition-colors hover:bg-[#282828]",
        muted
          ? "text-[var(--studio-ink-muted)] hover:text-[var(--studio-ink)]"
          : "text-[var(--studio-ink)]"
      )}
    >
      {icon && <Icon name={icon} className="text-[18px]" />}
      {children}
      {trailingIcon && (
        <Icon
          name={trailingIcon}
          className={cx("text-[14px]", trailingClassName)}
          aria-hidden
        />
      )}
    </button>
  );
}

export function ContextualToolbar({
  layer,
  onBgRemover,
  onReplace,
}: {
  layer: Layer;
  onBgRemover: () => void;
  /** Swap the picture in place, keeping the box, mask and filters. Image layers only. */
  onReplace?: () => void;
}) {
  if (layer.kind === "text") return <TextToolbar layer={layer} />;
  if (layer.kind === "shape") return <ShapeToolbar layer={layer} />;
  if (layer.kind === "draw") return <DrawToolbar layer={layer} />;
  return <ImageToolbar layer={layer} onBgRemover={onBgRemover} onReplace={onReplace} />;
}

/**
 * The mockup's swatches: this photo's own main colours. The popover lists them
 * all with their hex, and each one can go straight onto the page background —
 * the quickest way to make a page match its picture.
 */
function PhotoColourButtons({ layer }: { layer: ImageLayer }) {
  const { paletteFor } = useStudioAssets();
  const ctx = useContext(PopoverContext);
  const colours = paletteFor(layer.src).slice(0, 3);
  if (colours.length === 0) return null;
  const active = ctx?.open?.id === "colours";
  return (
    <button
      type="button"
      onClick={(e) => ctx?.toggle("colours", e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-label="Colours in this photo"
      title="Colours in this photo"
      data-r="sm"
      className={cx(
        "flex h-8 shrink-0 items-center gap-1.5 px-1.5 transition-colors hover:bg-[#282828]",
        active && "bg-[#282828]"
      )}
    >
      {colours.map((colour) => (
        <span
          key={colour}
          data-r="full"
          className="h-[22px] w-[22px] border border-[#353534]"
          style={{ backgroundColor: colour }}
        />
      ))}
    </button>
  );
}

function PhotoColoursPopover({ layer, close }: { layer: ImageLayer; close: () => void }) {
  const { apply, doc } = useStudio();
  const { paletteFor } = useStudioAssets();
  const [copied, setCopied] = useState<string | null>(null);
  const colours = paletteFor(layer.src);
  const background = doc.background.toLowerCase();

  return (
    <div className="w-[248px] p-1.5">
      <p className="px-1 pb-2 text-[12px] font-semibold text-[var(--studio-ink)]">
        Colours in this photo
      </p>
      <ul className="flex flex-col gap-0.5">
        {colours.map((colour) => (
          <li key={colour} className="flex items-center gap-2 px-1 py-1">
            <span
              data-r="full"
              className="h-6 w-6 shrink-0 border border-[#353534]"
              style={{ backgroundColor: colour }}
            />
            <button
              type="button"
              title="Copy hex"
              onClick={() => {
                void navigator.clipboard?.writeText(colour.toUpperCase()).catch(() => {});
                setCopied(colour);
              }}
              className="flex-1 text-left text-[12px] uppercase tabular-nums text-[var(--studio-ink)] hover:text-[var(--studio-accent)]"
            >
              {copied === colour ? "Copied" : colour}
            </button>
            <button
              type="button"
              data-r="sm"
              aria-pressed={background === colour}
              onClick={() => {
                apply({ type: "setBackground", color: colour });
                close();
              }}
              className={cx(
                "h-7 shrink-0 px-2 text-[11.5px] font-medium transition-colors",
                background === colour
                  ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                  : "text-[var(--studio-ink-muted)] hover:bg-[#282828] hover:text-[var(--studio-ink)]"
              )}
            >
              {background === colour ? "Page colour" : "Use for page"}
            </button>
          </li>
        ))}
      </ul>
      <p className="px-1 pt-2 text-[11px] leading-relaxed text-[var(--studio-ink-muted)]">
        These also appear under Photo colours in every colour picker.
      </p>
    </div>
  );
}

const OUTLINE_STYLES: { style: OutlineStyle | "none"; label: string; dash: string }[] = [
  { style: "none", label: "No border", dash: "" },
  { style: "solid", label: "Solid", dash: "none" },
  { style: "dashed", label: "Dashed", dash: "6 3" },
  { style: "dotted", label: "Dotted", dash: "1.5 3" },
];

/** Canva's "Border style": none/solid/dashed/dotted, weight and colour. */
function BorderPopover({ layer }: { layer: ImageLayer }) {
  const { apply, endGesture } = useStudio();
  const outline = layer.outline ?? NO_OUTLINE;
  const on = outline.width > 0;
  // A useful range whatever the photo's size: up to a quarter of its short edge.
  const max = Math.max(4, Math.min(MAX_OUTLINE, Math.round(Math.min(layer.width, layer.height) / 4)));
  const set = (patch: Partial<ImageOutline>, label?: string) =>
    apply(
      { type: "setImageOutline", layerId: layer.id, outline: patch },
      label ? { transient: true, label: `${label}:${layer.id}` } : undefined
    );
  const pickColour = (color: string) => set({ color, width: on ? outline.width : Math.max(1, Math.round(max / 8)) });

  return (
    <div className="flex w-[260px] flex-col gap-3 p-2">
      <div>
        <p className="mb-1.5 text-[12px] font-semibold text-[var(--studio-ink)]">Border style</p>
        <div className="grid grid-cols-4 gap-1">
          {OUTLINE_STYLES.map(({ style, label, dash }) => {
            const active = style === "none" ? !on : on && outline.style === style;
            return (
              <button
                key={style}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                data-r="sm"
                onClick={() =>
                  style === "none"
                    ? set({ width: 0 })
                    : set({ style, width: on ? outline.width : Math.max(1, Math.round(max / 8)) })
                }
                className={cx(
                  "flex h-9 items-center justify-center border transition-colors",
                  active
                    ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                    : "border-[#2e2e2e] text-[var(--studio-ink)] hover:bg-[#282828]"
                )}
              >
                {style === "none" ? (
                  <Icon name="block" className="text-[18px]" />
                ) : (
                  <svg width="28" height="4" aria-hidden="true">
                    <line
                      x1="1"
                      y1="2"
                      x2="27"
                      y2="2"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap={style === "dotted" ? "round" : "butt"}
                      strokeDasharray={dash}
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Slider
        label="Border weight"
        value={outline.width}
        min={0}
        max={max}
        suffix="px"
        onChange={(v) => set({ width: v }, "outline-width")}
        onCommit={endGesture}
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[var(--studio-ink)]">Border colour</p>
          <label
            data-r="sm"
            className="relative flex h-6 w-10 cursor-pointer overflow-hidden border border-[#353534]"
            style={{ backgroundColor: outline.color }}
          >
            <span className="sr-only">Pick a border colour</span>
            <input
              type="color"
              value={outline.color}
              onChange={(e) => set({ color: e.target.value, width: on ? outline.width : Math.max(1, Math.round(max / 8)) }, "outline-colour")}
              onBlur={endGesture}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              data-r="full"
              aria-label={`Border ${swatch}`}
              aria-pressed={on && outline.color.toLowerCase() === swatch}
              onClick={() => pickColour(swatch)}
              style={{ backgroundColor: swatch }}
              className={cx(
                "h-6 w-6 border transition-transform hover:scale-110",
                on && outline.color.toLowerCase() === swatch
                  ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/40"
                  : "border-[#353534]"
              )}
            />
          ))}
        </div>
        <PhotoColourSwatches className="mt-2.5" value={on ? outline.color : undefined} onPick={pickColour} />
      </div>
    </div>
  );
}

/**
 * Corner rounding as one slider, the way Canva does it. 0 is square; anything
 * above is the "rounded" frame at that radius. A circle frame is left alone
 * until the slider is touched, which turns it into a rounded rectangle.
 */
function CornersPopover({ layer }: { layer: ImageLayer }) {
  const { apply, endGesture } = useStudio();
  const value =
    layer.mask.kind === "rounded" ? Math.round(layer.mask.radius * 200) : layer.mask.kind === "circle" ? 100 : 0;
  return (
    <div className="w-[240px] p-2">
      <Slider
        label="Corner rounding"
        value={value}
        min={0}
        max={100}
        onChange={(v) =>
          apply(
            {
              type: "setMask",
              layerId: layer.id,
              mask: v === 0 ? { kind: "none" } : { kind: "rounded", radius: v / 200 },
            },
            { transient: true, label: `corners:${layer.id}` }
          )
        }
        onCommit={endGesture}
        onReset={() => apply({ type: "setMask", layerId: layer.id, mask: { kind: "none" } })}
      />
    </div>
  );
}

/** A drawn stroke: its ink, its weight, how see-through it is. */
function DrawToolbar({ layer }: { layer: DrawLayer }) {
  const { apply, tool, setTool } = useStudio();
  const weigh = (factor: number) =>
    apply({ type: "setDrawStyle", layerId: layer.id, patch: { strokeWidth: layer.strokeWidth * factor } });
  const current = layer.color.toLowerCase();
  return (
    <Pill popover={(id) => id === "opacity" && <OpacityPopover layer={layer} />}>
      <span className="flex h-8 shrink-0 items-center px-2.5 text-[13px] font-medium capitalize text-[var(--studio-ink)]">
        {layer.pen === "pen" ? "Drawing" : layer.pen}
      </span>
      <Divider />
      <div className="flex items-center gap-1.5 px-1.5">
        {STUDIO_SWATCHES.slice(0, 6).map((swatch) => (
          <button
            key={swatch}
            type="button"
            data-r="full"
            aria-label={`Use ${swatch}`}
            aria-pressed={current === swatch}
            onClick={() => apply({ type: "setDrawStyle", layerId: layer.id, patch: { color: swatch } })}
            className={cx(
              "h-[22px] w-[22px] shrink-0 border transition-colors",
              current === swatch ? "border-[var(--studio-accent)]" : "border-[#353534] hover:border-[var(--studio-accent)]"
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
        <label
          data-r="full"
          title="Custom colour"
          className="relative h-[22px] w-[22px] shrink-0 cursor-pointer overflow-hidden border border-[#353534]"
          style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        >
          <span className="sr-only">Custom colour</span>
          <input
            type="color"
            value={layer.color}
            onChange={(e) => apply({ type: "setDrawStyle", layerId: layer.id, patch: { color: e.target.value } })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      <Divider />
      <PillButton icon="remove" label="Thinner" onClick={() => weigh(0.8)} />
      <PillButton icon="add" label="Thicker" onClick={() => weigh(1.25)} />
      <PopoverButton id="opacity" icon="opacity" label="Transparency" />
      <Divider />
      <LabelButton active={tool === "layers"} onClick={() => setTool(tool === "layers" ? "select" : "layers")} title="Layer order">
        Position
      </LabelButton>
    </Pill>
  );
}

/** Flip menu: both axes. */
function FlipMenu({ layer, close }: { layer: ImageLayer; close: () => void }) {
  const { apply } = useStudio();
  const flip = (axis: "horizontal" | "vertical") => {
    apply({ type: "flipLayer", layerId: layer.id, axis });
    close();
  };
  return (
    <div className="flex w-[180px] flex-col">
      {(
        [
          ["horizontal", "Flip horizontal"],
          ["vertical", "Flip vertical"],
        ] as const
      ).map(([axis, label]) => (
        <button
          key={axis}
          type="button"
          onClick={() => flip(axis)}
          data-r="sm"
          className="flex h-8 items-center gap-2.5 px-2 text-left text-[13px] text-[var(--studio-ink)] hover:bg-[#262626]"
        >
          <Icon
            name="flip"
            className={cx(
              "text-[18px] text-[var(--studio-ink-muted)]",
              axis === "vertical" && "rotate-90"
            )}
          />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The text toolbar, in Canva's order: font, size stepper, colour, bold,
 * italic, underline, strike-through, case, alignment, list, spacing,
 * transparency, Effects, Position and copy style.
 *
 * Every edit that can change how the words wrap re-measures the box in the
 * same commit, so the selection outline never lags the glyphs.
 */
function TextToolbar({ layer }: { layer: TextLayer }) {
  const { apply, endGesture, tool, setTool, doc, printSize, styleSource, setStyleSource } = useStudio();
  const font = getFont(layer.fontId);
  const dpi = documentDpi(doc, printSize);

  /** Apply a style patch, re-measuring the height the words will need. */
  const style = (patch: Partial<TextStylePatch>, gesture?: string) => {
    const next = getFont(patch.fontId ?? layer.fontId);
    const height = textLayerHeight(layer, {
      fontId: next.id,
      fontWeight: nearestWeight(next, patch.fontWeight ?? layer.fontWeight),
      italic: (patch.italic ?? layer.italic) && next.italic,
      fontSize: patch.fontSize ?? layer.fontSize,
      lineHeight: patch.lineHeight ?? layer.lineHeight,
      letterSpacing: patch.letterSpacing ?? layer.letterSpacing,
      uppercase: patch.uppercase ?? layer.uppercase,
      list: patch.list ?? layer.list,
    });
    apply(
      { type: "setTextStyle", layerId: layer.id, patch, height },
      gesture ? { transient: true, label: `${gesture}:${layer.id}` } : undefined
    );
  };

  const canBold = font.weights.some((w) => w >= 600);
  const bold = layer.fontWeight >= 600;
  const aligns = ["left", "center", "right"] as const;
  const alignIcon = { left: "format_align_left", center: "format_align_center", right: "format_align_right" };
  const list = layer.list ?? "none";
  const lists = ["none", "bullet", "number"] as const;

  return (
    <Pill
      popover={(id, close) =>
        id === "opacity" ? (
          <OpacityPopover layer={layer} />
        ) : id === "font" ? (
          <div className="w-[300px] p-2">
            <FontPicker
              value={layer.fontId}
              layer={layer}
              onChange={(fontId) => {
                style({ fontId });
                close();
              }}
            />
          </div>
        ) : id === "color" ? (
          <div className="w-[260px] p-2.5">
            <ColorField
              label="Text colour"
              value={layer.color}
              onChange={(color) => style({ color }, "text-colour")}
              onCommit={endGesture}
            />
          </div>
        ) : id !== "spacing" ? null : (
          <div className="flex w-[260px] flex-col gap-3 p-2.5">
            <Slider
              label="Letter spacing"
              value={Math.round(layer.letterSpacing * 1000)}
              min={-100}
              max={800}
              onChange={(v) => style({ letterSpacing: v / 1000 }, "letter-spacing")}
              onCommit={endGesture}
              onReset={() => style({ letterSpacing: 0 })}
            />
            <Slider
              label="Line spacing"
              value={Math.round(layer.lineHeight * 100) / 100}
              min={0.6}
              max={3}
              step={0.05}
              onChange={(v) => style({ lineHeight: v }, "line-height")}
              onCommit={endGesture}
              onReset={() => style({ lineHeight: DEFAULT_LINE_HEIGHT })}
            />
          </div>
        )
      }
    >
      <FontButton layer={layer} />
      <SizeStepper
        pt={(printedInches(layer.fontSize, dpi) * 72)}
        onChange={(pt) => style({ fontSize: Math.max(MIN_FONT_SIZE, (pt / 72) * dpi) })}
      />
      <ColourButton color={layer.color} />
      <PillButton
        icon="format_bold"
        label={canBold ? "Bold" : "Bold — this font has no bold weight"}
        active={bold}
        disabled={!canBold}
        onClick={() => style({ fontWeight: bold ? 400 : 700 })}
      />
      <PillButton
        icon="format_italic"
        label={font.italic ? "Italic" : "Italic — this font has no italic"}
        active={layer.italic}
        disabled={!font.italic}
        onClick={() => style({ italic: !layer.italic })}
      />
      <PillButton
        icon="format_underlined"
        label="Underline"
        active={!!layer.underline}
        onClick={() => style({ underline: !layer.underline })}
      />
      <PillButton
        icon="strikethrough_s"
        label="Strikethrough"
        active={!!layer.strike}
        onClick={() => style({ strike: !layer.strike })}
      />
      <PillButton
        icon="match_case"
        label={layer.uppercase ? "Normal case" : "Uppercase"}
        active={layer.uppercase}
        onClick={() => style({ uppercase: !layer.uppercase })}
      />
      <PillButton
        icon={alignIcon[layer.align]}
        label={`Alignment: ${layer.align === "center" ? "centre" : layer.align}`}
        onClick={() => style({ align: aligns[(aligns.indexOf(layer.align) + 1) % aligns.length] })}
      />
      <PillButton
        icon={list === "number" ? "format_list_numbered" : "format_list_bulleted"}
        label={list === "none" ? "Bulleted list" : list === "bullet" ? "Numbered list" : "No list"}
        active={list !== "none"}
        onClick={() => style({ list: lists[(lists.indexOf(list) + 1) % lists.length] })}
      />
      <PopoverButton id="spacing" icon="format_line_spacing" label="Spacing" />
      <PopoverButton id="opacity" icon="opacity" label="Transparency" />

      <Divider />

      <LabelButton
        active={tool === "effects"}
        onClick={() => setTool(tool === "effects" ? "select" : "effects")}
        title="Shadow, neon, hollow and more"
      >
        Effects
      </LabelButton>
      <LabelButton
        active={tool === "layers"}
        onClick={() => setTool(tool === "layers" ? "select" : "layers")}
        title="Layer order"
      >
        Position
      </LabelButton>

      <Divider />

      <PillButton
        icon="format_paint"
        label={styleSource?.id === layer.id ? "Copying style — click another text" : "Copy style"}
        active={styleSource?.id === layer.id}
        onClick={() => setStyleSource(styleSource?.id === layer.id ? null : layer)}
      />
    </Pill>
  );
}

/** Canva's font box: the family's name, set in the family, opening the list. */
function FontButton({ layer }: { layer: TextLayer }) {
  const ctx = useContext(PopoverContext);
  const font = getFont(layer.fontId);
  const active = ctx?.open?.id === "font";
  return (
    <button
      type="button"
      onClick={(e) => ctx?.toggle("font", e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={active}
      title="Font"
      data-r="sm"
      className={cx(
        "mr-1 flex h-8 w-[132px] shrink-0 items-center justify-between gap-1 border px-2 text-left text-[13px] text-[var(--studio-ink)] transition-colors",
        active ? "border-[var(--studio-accent)]" : "border-[#2e2e2e] hover:bg-[#282828]"
      )}
    >
      <span className="truncate" style={{ fontFamily: fontStack(font) }}>
        {fontDisplayName(font)}
      </span>
      <Icon name="expand_more" className="shrink-0 text-[16px] text-[var(--studio-ink-muted)]" />
    </button>
  );
}

/**
 * − size + in printed points, like Canva's box. Typed values commit on Enter or
 * blur; the buttons step by one point.
 */
function SizeStepper({ pt, onChange }: { pt: number; onChange: (pt: number) => void }) {
  const shown = Math.round(pt * 10) / 10;
  const commit = (input: HTMLInputElement) => {
    const next = Number(input.value);
    if (Number.isFinite(next) && next > 0 && next !== shown) onChange(next);
    else input.value = String(shown);
  };
  return (
    <div data-r="sm" className="mr-1 flex h-8 shrink-0 items-center border border-[#2e2e2e]">
      <button
        type="button"
        aria-label="Decrease font size"
        title="Decrease font size"
        onClick={() => onChange(Math.max(1, Math.round(shown) - 1))}
        className="flex h-full w-7 items-center justify-center text-[var(--studio-ink)] hover:bg-[#282828]"
      >
        <Icon name="remove" className="text-[16px]" />
      </button>
      <input
        key={shown}
        defaultValue={shown}
        inputMode="decimal"
        aria-label="Font size in points"
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(shown);
            e.currentTarget.blur();
          }
        }}
        className="h-full w-11 bg-transparent text-center text-[13px] tabular-nums text-[var(--studio-ink)] outline-none"
      />
      <button
        type="button"
        aria-label="Increase font size"
        title="Increase font size"
        onClick={() => onChange(Math.round(shown) + 1)}
        className="flex h-full w-7 items-center justify-center text-[var(--studio-ink)] hover:bg-[#282828]"
      >
        <Icon name="add" className="text-[16px]" />
      </button>
    </div>
  );
}

/** The "A" with a colour bar under it — the text colour, opening the picker. */
function ColourButton({ color }: { color: string }) {
  const ctx = useContext(PopoverContext);
  const active = ctx?.open?.id === "color";
  return (
    <button
      type="button"
      onClick={(e) => ctx?.toggle("color", e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-label="Text colour"
      title="Text colour"
      data-r="sm"
      className={cx(
        "flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[1px] transition-colors hover:bg-[#282828]",
        active && "bg-[#282828]"
      )}
    >
      <span className="text-[15px] font-bold leading-none text-[var(--studio-ink)]">A</span>
      <span className="h-[3px] w-4 border border-black/30" style={{ backgroundColor: color }} />
    </button>
  );
}

function ImageToolbar({
  layer,
  onBgRemover,
  onReplace,
}: {
  layer: ImageLayer;
  onBgRemover: () => void;
  onReplace?: () => void;
}) {
  const { tool, setTool } = useStudio();
  const toggle = (next: typeof tool) => setTool(tool === next ? "select" : next);

  return (
    <Pill
      popover={(id, close) =>
        id === "opacity" ? (
          <OpacityPopover layer={layer} />
        ) : id === "colours" ? (
          <PhotoColoursPopover layer={layer} close={close} />
        ) : id === "border" ? (
          <BorderPopover layer={layer} />
        ) : id === "corners" ? (
          <CornersPopover layer={layer} />
        ) : (
          <FlipMenu layer={layer} close={close} />
        )
      }
    >
      <LabelButton active={tool === "adjust"} onClick={() => toggle("adjust")} title="Adjust colour, exposure and filters">
        Edit
      </LabelButton>

      <Divider />

      {onReplace && (
        <LabelButton onClick={onReplace} title="Swap the picture, keeping its size and effects">
          Replace
        </LabelButton>
      )}

      <LabelButton
        onClick={onBgRemover}
        title="BG Remover"
        ariaLabel="BG Remover — not available yet"
        trailingIcon="bolt"
        trailingClassName="text-[var(--studio-accent)]"
      >
        BG Remover
      </LabelButton>

      <LabelButton active={tool === "eraser"} onClick={() => toggle("eraser")} title="Rub out part of the image">
        Eraser
      </LabelButton>

      <PhotoColourButtons layer={layer} />
      <PopoverButton id="border" icon="line_weight" label="Border" />
      <PopoverButton id="corners" icon="rounded_corner" label="Corner rounding" />
      <PillButton
        icon="crop"
        label="Crop"
        active={tool === "crop"}
        onClick={() => toggle("crop")}
      />
      <PillButton
        icon="interests"
        label="Frame shape"
        active={tool === "frames"}
        onClick={() => toggle("frames")}
      />
      <PopoverButton id="flip" label="Flip">
        Flip
      </PopoverButton>
      <PopoverButton id="opacity" icon="opacity" label="Transparency" />

      <LabelButton
        active={tool === "layers"}
        onClick={() => toggle("layers")}
        title="Layer order"
      >
        Position
      </LabelButton>
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
    <Pill popover={(id) => id === "opacity" && <OpacityPopover layer={layer} />}>
      <LabelButton onClick={() => setRail("elements")} title="Swap the element">
        Elements
      </LabelButton>

      <Divider />

      <div className="flex items-center gap-1.5 px-1.5">
        {STUDIO_SWATCHES.slice(0, 5).map((swatch) => (
          <button
            key={swatch}
            type="button"
            data-r="full"
            aria-label={`Use ${swatch}`}
            aria-pressed={current === swatch}
            onClick={() => colour(swatch)}
            className={cx(
              "h-[22px] w-[22px] shrink-0 border transition-colors",
              current === swatch
                ? "border-[var(--studio-accent)]"
                : "border-[#353534] hover:border-[var(--studio-accent)]"
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>

      {open && (
        <>
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

      <PopoverButton id="opacity" icon="opacity" label="Transparency" />

      <Divider />

      <LabelButton
        active={tool === "layers"}
        onClick={() => setTool(tool === "layers" ? "select" : "layers")}
        title="Layer order"
      >
        Position
      </LabelButton>
    </Pill>
  );
}

function PillButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  /** Omit for a momentary action; pass a boolean for a toggle. */
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      data-r="sm"
      title={label}
      aria-label={label}
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center transition-colors",
        active
          ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
          : "text-[var(--studio-ink-muted)] hover:bg-[#282828] hover:text-[var(--studio-ink)]",
        "disabled:pointer-events-none disabled:opacity-30"
      )}
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Several layers                                                              */
/* -------------------------------------------------------------------------- */

const SELECTION_ALIGN: { mode: AlignMode; label: string; icon: string }[] = [
  { mode: "left", label: "Left", icon: "align_horizontal_left" },
  { mode: "centre", label: "Centre", icon: "align_horizontal_center" },
  { mode: "right", label: "Right", icon: "align_horizontal_right" },
  { mode: "top", label: "Top", icon: "align_vertical_top" },
  { mode: "middle", label: "Middle", icon: "align_vertical_center" },
  { mode: "bottom", label: "Bottom", icon: "align_vertical_bottom" },
];

/**
 * The toolbar for a multi-selection — a marquee, shift-clicks or a group.
 *
 * Typography applies to every text layer in it at once (the reason to select a
 * font combination whole), alignment lines the members up with each other, and
 * Group / Ungroup make the selection stick together or come apart.
 */
export function MultiToolbar({ layers }: { layers: Layer[] }) {
  const { apply, endGesture, doc, select } = useStudio();
  const texts = layers.filter((l): l is TextLayer => l.kind === "text");
  const unlocked = layers.filter((l) => !l.locked);
  const grouped = isWholeGroup(doc.layers, layers);
  const firstText = texts[0];

  /** One style change across every text layer, as one undo step. */
  const styleAll = (patch: Partial<TextStylePatch>, gesture = "multi-style") => {
    for (const text of texts) {
      if (text.locked) continue;
      const next = getFont(patch.fontId ?? text.fontId);
      const height = textLayerHeight(text, {
        fontId: next.id,
        fontWeight: nearestWeight(next, text.fontWeight),
      });
      apply(
        { type: "setTextStyle", layerId: text.id, patch, height },
        { transient: true, label: gesture }
      );
    }
  };

  return (
    <Pill
      popover={(id, close) =>
        id === "font" && firstText ? (
          <div className="w-[300px] p-2">
            <FontPicker
              value={texts.every((t) => t.fontId === firstText.fontId) ? firstText.fontId : ""}
              layer={firstText}
              onChange={(fontId) => {
                styleAll({ fontId }, "multi-font");
                endGesture();
                close();
              }}
            />
          </div>
        ) : id === "color" && firstText ? (
          <div className="w-[260px] p-2.5">
            <ColorField
              label="Text colour"
              value={firstText.color}
              onChange={(color) => styleAll({ color }, "multi-colour")}
              onCommit={endGesture}
            />
          </div>
        ) : (
          <div className="grid w-[240px] grid-cols-3 gap-1 p-1.5">
            {SELECTION_ALIGN.map((a) => (
              <button
                key={a.mode}
                type="button"
                onClick={() => {
                  for (const move of alignLayersTo(unlocked, a.mode)) {
                    apply(
                      { type: "nudgeLayer", layerId: move.id, dx: move.dx, dy: move.dy },
                      { transient: true, label: "align-many" }
                    );
                  }
                  endGesture();
                  close();
                }}
                data-r="sm"
                className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-[var(--studio-ink-muted)] hover:bg-[#282828] hover:text-[var(--studio-ink)]"
              >
                <Icon name={a.icon} className="text-[20px]" />
                {a.label}
              </button>
            ))}
          </div>
        )
      }
    >
      <span className="flex h-8 shrink-0 items-center px-2.5 text-[13px] font-medium text-[var(--studio-ink)]">
        {layers.length} selected
      </span>

      {firstText && (
        <>
          <Divider />
          <FontButton layer={firstText} />
          <ColourButton color={firstText.color} />
        </>
      )}

      <Divider />
      <PopoverButton id="align" icon="align_horizontal_center" label="Align elements" />
      <LabelButton
        onClick={() => {
          apply({
            type: "setGroup",
            layerIds: layers.map((l) => l.id),
            groupId: grouped ? null : createId("grp"),
          });
        }}
        title={grouped ? "Ungroup (Ctrl+Shift+G)" : "Group (Ctrl+G)"}
        icon={grouped ? "ungroup" : "group_work"}
      >
        {grouped ? "Ungroup" : "Group"}
      </LabelButton>

      <Divider />
      <PillButton
        icon="delete"
        label="Delete selection"
        disabled={unlocked.length === 0}
        onClick={() => {
          for (const layer of unlocked) {
            apply({ type: "removeLayer", layerId: layer.id }, { transient: true, label: "delete-many" });
          }
          endGesture();
          select(null);
        }}
      />
    </Pill>
  );
}

/* -------------------------------------------------------------------------- */
/* The page                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Nothing selected: the page itself, as in Canva — its background colour, and
 * the printed border.
 */
export function PageToolbar() {
  const { doc, apply, endGesture, tool, setTool } = useStudio();
  return (
    <Pill
      popover={() => (
        <div className="w-[260px] p-2.5">
          <ColorField
            label="Background colour"
            value={doc.background}
            onChange={(color) =>
              apply({ type: "setBackground", color }, { transient: true, label: "page-background" })
            }
            onCommit={endGesture}
          />
        </div>
      )}
    >
      <BackgroundButton color={doc.background} />
      <Divider />
      <LabelButton
        icon="border_outer"
        active={tool === "border"}
        onClick={() => setTool(tool === "border" ? "select" : "border")}
        title="A printed band around the artwork"
      >
        Page border
      </LabelButton>
    </Pill>
  );
}

function BackgroundButton({ color }: { color: string }) {
  const ctx = useContext(PopoverContext);
  const active = ctx?.open?.id === "background";
  return (
    <button
      type="button"
      onClick={(e) => ctx?.toggle("background", e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={active}
      title="Background colour"
      data-r="sm"
      className={cx(
        "flex h-8 shrink-0 items-center gap-2 px-2 text-[13px] font-medium text-[var(--studio-ink)] transition-colors hover:bg-[#282828]",
        active && "bg-[#282828]"
      )}
    >
      <span
        data-r="sm"
        className="h-6 w-6 border border-[#4a4a4a]"
        style={{
          background: color,
          // Show "white" and "near-white" as a colour, not as a hole.
          boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
        }}
      />
      Background colour
    </button>
  );
}
