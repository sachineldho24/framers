"use client";

/**
 * The Text panel: insert a text box, then style it.
 *
 * Two halves, and the split is deliberate — the insert buttons are always
 * available (the panel is how you add text at all), while the style controls
 * only exist once there is a text layer to style. A panel that hid its own
 * insert buttons whenever a photo happened to be selected would be a dead end.
 *
 * Every control that changes the *shape* of the words — family, weight, size,
 * line height, letter spacing, uppercase — also sends a freshly measured
 * `height`, because the layer's box is what the selection handles and the edit
 * overlay are drawn from. Sliders commit through the transient-gesture path, so
 * a drag is one undo step rather than sixty.
 */

import { useEffect, useMemo, useState } from "react";

import { useStudio, type StudioContextValue } from "@/lib/studio/StudioContext";
import { isTextLayer, type TextLayer } from "@/lib/studio/document";
import { loadFontCatalogue } from "@/lib/studio/fontLoader";
import { documentDpi, printedInches } from "@/lib/studio/print";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_FONT_ID,
  fontStack,
  fontsByCategory,
  getFont,
  nearestWeight,
} from "@/lib/studio/fonts";
import type { TextStylePatch } from "@/lib/studio/reducer";
import {
  DEFAULT_LINE_HEIGHT,
  MAX_FONT_SIZE,
  MAX_LETTER_SPACING,
  MAX_LINE_HEIGHT,
  MAX_STROKE_WIDTH,
  MIN_FONT_SIZE,
  MIN_LETTER_SPACING,
  MIN_LINE_HEIGHT,
} from "@/lib/studio/text";
import { textLayerHeight } from "@/lib/studio/textMeasure";
import { TEXT_PRESETS, TEXT_PRESET_ORDER } from "@/lib/studio/textInsert";

import { Icon } from "@/components/Icon";
import { STUDIO_SWATCHES as SWATCHES } from "../palette";
import {
  EmptyState,
  IconButton,
  PanelSection,
  Slider,
  StudioButton,
  cx,
} from "../ui";
import { useInsertText } from "../useInsertText";

export function TextPanel() {
  const { doc, selectedLayer, apply, endGesture, setEditingId, printSize } =
    useStudio();
  const insertText = useInsertText();

  // The previews are DOM, so the stylesheet is all they need — `loadFontCatalogue`
  // deliberately does not fetch the faces themselves.
  useEffect(() => {
    loadFontCatalogue();
  }, []);

  const layer =
    selectedLayer && isTextLayer(selectedLayer) ? selectedLayer : null;

  // A slider that ran to `MAX_FONT_SIZE` would spend its whole travel on sizes
  // larger than the page. Two fifths of the short edge is already a poster-wide
  // word, and a corner drag on the canvas covers anything past that.
  const maxFontSize = Math.min(
    MAX_FONT_SIZE,
    Math.max(64, Math.round(Math.min(doc.width, doc.height) * 0.4))
  );

  // Printed points, measured against the page's real resolution — the grid is
  // capped on the larger frames, so dividing by 300 would understate the type.
  const dpi = documentDpi(doc, printSize);

  return (
    <div>
      <div className={layer ? "studio-text-presets-selected" : undefined}><PanelSection>
        <div className="flex flex-col gap-1.5">
          {TEXT_PRESET_ORDER.map((preset) => (
            <button
              key={preset}
              type="button"
              data-r="md"
              onClick={() => insertText(preset)}
              className="flex w-full items-center justify-between gap-2 border border-[var(--studio-border)] bg-[var(--studio-chrome)] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span
                className="min-w-0 truncate text-[var(--studio-ink)]"
                style={{
                  fontFamily: fontStack(getFont(DEFAULT_FONT_ID)),
                  fontSize: TEXT_PRESETS[preset].previewPx,
                  fontWeight: TEXT_PRESETS[preset].fontWeight,
                  textTransform: TEXT_PRESETS[preset].uppercase
                    ? "uppercase"
                    : "none",
                }}
              >
                {TEXT_PRESETS[preset].label}
              </span>
              <Icon
                name="add"
                className="shrink-0 text-[18px] text-[var(--studio-ink-muted)]"
              />
            </button>
          ))}
        </div>
      </PanelSection></div>

      {layer ? (
        <TextStyleControls
          layer={layer}
          maxFontSize={maxFontSize}
          dpi={dpi}
          apply={apply}
          endGesture={endGesture}
          onEdit={() => setEditingId(layer.id)}
        />
      ) : (
        <EmptyState
          icon="title"
          title={selectedLayer ? "A photo is selected" : "Pick a text box"}
          body={
            selectedLayer
              ? "Select a text box on the canvas to change its font, size and colour."
              : "Add one above, or select text already on the page — then every typographic control appears here."
          }
        />
      )}
    </div>
  );
}

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

function TextStyleControls({
  layer,
  maxFontSize,
  dpi,
  apply,
  endGesture,
  onEdit,
}: {
  layer: TextLayer;
  maxFontSize: number;
  /** The page's real resolution, for the printed-points readout. */
  dpi: number;
  apply: StudioContextValue["apply"];
  endGesture: () => void;
  onEdit: () => void;
}) {
  const font = getFont(layer.fontId);

  /**
   * The height the words will need once `patch` lands. Resolved through the same
   * `getFont`/`nearestWeight` pair the reducer uses, or the measurement would be
   * of a face that never gets drawn — Anton ships 400 only, so a request for 700
   * must be measured at 400.
   */
  const measuredHeight = (patch: Partial<TextStylePatch>) => {
    const next = getFont(patch.fontId ?? layer.fontId);
    return textLayerHeight(layer, {
      fontId: next.id,
      fontWeight: nearestWeight(next, patch.fontWeight ?? layer.fontWeight),
      italic: (patch.italic ?? layer.italic) && next.italic,
      fontSize: patch.fontSize ?? layer.fontSize,
      lineHeight: patch.lineHeight ?? layer.lineHeight,
      letterSpacing: patch.letterSpacing ?? layer.letterSpacing,
      uppercase: patch.uppercase ?? layer.uppercase,
    });
  };

  const style = (patch: Partial<TextStylePatch>, gesture?: string) => {
    apply(
      {
        type: "setTextStyle",
        layerId: layer.id,
        patch,
        height: measuredHeight(patch),
      },
      gesture ? { transient: true, label: `${gesture}:${layer.id}` } : undefined
    );
  };

  if (layer.locked) {
    return (
      <EmptyState
        icon="lock"
        title="This text is locked"
        body="Unlock it from the layers panel or the right-click menu to edit its type."
      />
    );
  }

  return (
    <>
      <PanelSection title="Size">
        <Slider
          label={`Size · ${(printedInches(layer.fontSize, dpi) * 72).toFixed(
            0
          )} pt printed`}
          value={Math.round(layer.fontSize)}
          min={MIN_FONT_SIZE}
          max={maxFontSize}
          suffix="px"
          onChange={(v) => style({ fontSize: v }, "font-size")}
          onCommit={endGesture}
        />
      </PanelSection>

      <PanelSection title="Words">
        <StudioButton
          variant="outline"
          icon="edit"
          onClick={onEdit}
          className="w-full"
        >
          Edit the text
        </StudioButton>
      </PanelSection>

      <PanelSection title="Font">
        <FontPicker value={layer.fontId} onChange={(fontId) => style({ fontId })} />
      </PanelSection>

      <PanelSection title="Style">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {font.weights.map((weight) => (
            <button
              key={weight}
              type="button"
              data-r="md"
              aria-pressed={layer.fontWeight === weight}
              onClick={() => style({ fontWeight: weight })}
              style={{ fontWeight: weight }}
              className={cx(
                "h-7 border px-2 text-[12px] transition-colors",
                layer.fontWeight === weight
                  ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                  : "border-[var(--studio-border)] bg-[var(--studio-chrome)] text-[var(--studio-ink)] hover:bg-white/[0.03]"
              )}
            >
              {WEIGHT_LABELS[weight] ?? weight}
            </button>
          ))}
        </div>
        {font.note && (
          <p className="mb-2 px-1 text-[11.5px] leading-relaxed text-[var(--studio-ink-muted)]">
            {font.note}
          </p>
        )}
        <div className="flex gap-1.5">
          <Toggle
            label="Italic"
            active={layer.italic}
            disabled={!font.italic}
            title={
              font.italic
                ? undefined
                : `${font.family} has no italic — a slanted fake would print badly.`
            }
            onClick={() => style({ italic: !layer.italic })}
          />
          <Toggle
            label="UPPERCASE"
            active={layer.uppercase}
            onClick={() => style({ uppercase: !layer.uppercase })}
          />
        </div>
      </PanelSection>



      <PanelSection title="Alignment">
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-0.5">
            {(
              [
                ["left", "format_align_left", "Align left"],
                ["center", "format_align_center", "Align centre"],
                ["right", "format_align_right", "Align right"],
              ] as const
            ).map(([value, icon, label]) => (
              <IconButton
                key={value}
                icon={icon}
                label={label}
                size="sm"
                active={layer.align === value}
                onClick={() => style({ align: value })}
              />
            ))}
          </div>
          <div className="flex gap-0.5">
            {(
              [
                ["top", "vertical_align_top", "Top of the box"],
                ["middle", "vertical_align_center", "Middle of the box"],
                ["bottom", "vertical_align_bottom", "Bottom of the box"],
              ] as const
            ).map(([value, icon, label]) => (
              <IconButton
                key={value}
                icon={icon}
                label={label}
                size="sm"
                active={layer.verticalAlign === value}
                onClick={() => style({ verticalAlign: value })}
              />
            ))}
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Spacing">
        <div className="flex flex-col gap-3">
          {/* As a percentage, not the stored multiplier: `Slider` rounds its
              readout, so 1.2× would display as "1×". */}
          <Slider
            label="Line height"
            value={Math.round(layer.lineHeight * 100)}
            min={Math.round(MIN_LINE_HEIGHT * 100)}
            max={Math.round(MAX_LINE_HEIGHT * 100)}
            step={5}
            suffix="%"
            onChange={(v) => style({ lineHeight: v / 100 }, "line-height")}
            onCommit={endGesture}
            onReset={() => style({ lineHeight: DEFAULT_LINE_HEIGHT })}
          />
          <Slider
            label="Letter spacing"
            value={Math.round(layer.letterSpacing * 100)}
            min={Math.round(MIN_LETTER_SPACING * 100)}
            max={Math.round(MAX_LETTER_SPACING * 100)}
            suffix="%"
            onChange={(v) => style({ letterSpacing: v / 100 }, "letter-spacing")}
            onCommit={endGesture}
            onReset={() => style({ letterSpacing: 0 })}
          />
        </div>
      </PanelSection>

      <PanelSection title="Colour">
        <ColorField
          label="Text"
          value={layer.color}
          onChange={(color) => style({ color }, "text-color")}
          onCommit={endGesture}
        />
      </PanelSection>

      <PanelSection title="Outline">
        <p className="mb-2 px-1 text-[11.5px] leading-relaxed text-[var(--studio-ink-muted)]">
          An outline is what keeps light text readable over a busy photo.
        </p>
        <Slider
          label="Thickness"
          value={Math.round(layer.strokeWidth * 100)}
          min={0}
          max={Math.round(MAX_STROKE_WIDTH * 100)}
          suffix="%"
          onChange={(v) => style({ strokeWidth: v / 100 }, "stroke-width")}
          onCommit={endGesture}
          onReset={() => style({ strokeWidth: 0 })}
        />
        {layer.strokeWidth > 0 && (
          <div className="mt-3">
            <ColorField
              label="Outline"
              value={layer.strokeColor}
              onChange={(strokeColor) => style({ strokeColor }, "stroke-color")}
              onCommit={endGesture}
            />
          </div>
        )}
      </PanelSection>
    </>
  );
}

/** A bordered on/off pill. Wider than `IconButton` because the words matter. */
function Toggle({
  label,
  active,
  disabled = false,
  title,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-r="md"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cx(
        "h-8 border px-3 text-[12px] font-medium transition-colors",
        active
          ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
          : "border-[var(--studio-border)] bg-[var(--studio-chrome)] text-[var(--studio-ink)] hover:bg-white/[0.03]",
        "disabled:pointer-events-none disabled:opacity-40"
      )}
    >
      {label}
    </button>
  );
}

/**
 * A native colour input plus the poster palette.
 *
 * The swatches exist because the picker is a modal OS dialog on most platforms —
 * fine for a one-off, miserable for trying five colours against a photo.
 */
function ColorField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label
          data-r="md"
          className="relative flex h-8 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden border border-[var(--studio-border)]"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">{`${label} colour`}</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <span className="text-[12px] font-medium text-[var(--studio-ink)]">
          {label}
        </span>
        <span className="ml-auto text-[11.5px] uppercase tabular-nums text-[var(--studio-ink-muted)]">
          {value}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            data-r="md"
            aria-label={`Use ${swatch}`}
            aria-pressed={value.toLowerCase() === swatch}
            onClick={() => {
              onChange(swatch);
              onCommit();
            }}
            style={{ backgroundColor: swatch }}
            className={cx(
              "h-6 w-6 border transition-transform hover:scale-110",
              value.toLowerCase() === swatch
                ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/40"
                : "border-[var(--studio-border)]"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The family list, grouped as the catalogue groups itself and previewed in the
 * face it names — the only preview of a typeface that tells the truth.
 */
function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (fontId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CATEGORY_ORDER.map((category) => ({
      category,
      fonts: fontsByCategory(category).filter(
        (font) =>
          needle === "" ||
          font.family.toLowerCase().includes(needle) ||
          CATEGORY_LABELS[category].toLowerCase().includes(needle)
      ),
    })).filter((group) => group.fonts.length > 0);
  }, [query]);

  return (
    <div>
      <div className="relative mb-2">
        <Icon
          name="search"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-[var(--studio-ink-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fonts"
          aria-label="Search fonts"
          data-r="md"
          className="h-8 w-full border border-[var(--studio-border)] bg-[var(--studio-chrome)] pl-8 pr-2 text-[12.5px] text-[var(--studio-ink)] outline-none placeholder:text-[var(--studio-ink-muted)] focus:border-[var(--studio-accent)]"
        />
      </div>

      <div
        data-r="md"
        className="max-h-[264px] overflow-y-auto border border-[var(--studio-border)] bg-[var(--studio-chrome)]"
      >
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-[var(--studio-ink-muted)]">
            No family matches “{query.trim()}”.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.category}>
              <p className="sticky top-0 z-10 bg-[var(--studio-surface,#fbfbfd)] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-ink-muted)]">
                {CATEGORY_LABELS[group.category]}
              </p>
              {group.fonts.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  aria-pressed={font.id === value}
                  onClick={() => onChange(font.id)}
                  className={cx(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                    font.id === value
                      ? "bg-[var(--studio-accent-soft)]"
                      : "hover:bg-white/[0.03]"
                  )}
                >
                  <span
                    className="min-w-0 truncate text-[15px] leading-tight text-[var(--studio-ink)]"
                    style={{
                      fontFamily: fontStack(font),
                      fontWeight: font.weights.includes(400)
                        ? 400
                        : font.weights[0],
                    }}
                  >
                    {font.family}
                  </span>
                  {font.id === value && (
                    <Icon
                      name="check"
                      className="shrink-0 text-[17px] text-[var(--studio-accent)]"
                    />
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
