"use client";

/**
 * The Border panel: a printed band around the artwork.
 *
 * This is the studio's answer to a mat, and the copy is careful about the
 * difference — the band is *printed on the paper*, so it costs nothing extra and
 * appears in the preview and the print identically. A physical mat board is a
 * different product and is not what this does.
 *
 * The readout is in millimetres rather than pixels because that is the only unit
 * a buyer can picture, and it subtracts the frame's lip: a 3 mm border on a frame
 * whose rabbet covers 4 mm is a border nobody will ever see.
 */

import { useStudio } from "@/lib/studio/StudioContext";
import { borderInsetPx, MAX_BORDER } from "@/lib/studio/document";
import { documentDpi, printedMm, RABBET_MM } from "@/lib/studio/print";

import { Icon } from "@/components/Icon";
import { PanelSection, Slider, cx } from "../ui";

/**
 * Widths people actually order, as fractions of the short edge. "Gallery" is the
 * wide-margin look sold as a print-with-border; "Classic" is the everyday one.
 */
const PRESETS = [
  { label: "None", width: 0 },
  { label: "Thin", width: 0.02 },
  { label: "Classic", width: 0.05 },
  { label: "Gallery", width: 0.1 },
];

/** Paper whites plus the two colours that read as deliberate rather than as a mistake. */
const COLOURS = ["#ffffff", "#f7f4ec", "#e6e0cf", "#111111"];

export function BorderPanel() {
  const { doc, apply, endGesture, printSize } = useStudio();

  const width = doc.border.width;
  const dpi = documentDpi(doc, printSize);
  const mm = printedMm(borderInsetPx(doc), dpi);
  // What survives the moulding. The lip covers the outer few millimetres of
  // every edge, and it covers the border first.
  const visibleMm = mm - RABBET_MM;

  const setBorder = (patch: { width?: number; color?: string }, gesture?: string) =>
    apply(
      { type: "setPageBorder", patch },
      gesture ? { transient: true, label: gesture } : undefined
    );

  return (
    <div>
      <PanelSection>
        <p className="px-1 text-[12px] leading-relaxed text-[var(--studio-ink-muted)]">
          A border printed as part of the artwork — no extra material, no extra
          cost. It gives the photo room to breathe inside the moulding.
        </p>
      </PanelSection>

      <PanelSection title="Width">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              data-r="md"
              aria-pressed={Math.abs(width - preset.width) < 0.0005}
              onClick={() => {
                setBorder({ width: preset.width });
                endGesture();
              }}
              className={cx(
                "h-8 border px-3 text-[12px] font-medium transition-colors",
                Math.abs(width - preset.width) < 0.0005
                  ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                  : "border-[var(--studio-border)] bg-white text-[var(--studio-ink)] hover:bg-black/[0.03]"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Slider
          label={
            printSize
              ? `Border · ${mm.toFixed(0)} mm printed`
              : "Border · share of the short edge"
          }
          value={Math.round(width * 1000) / 10}
          min={0}
          max={MAX_BORDER * 100}
          step={0.5}
          suffix="%"
          onChange={(v) => setBorder({ width: v / 100 }, "page-border")}
          onCommit={endGesture}
          onReset={() => {
            setBorder({ width: 0 });
            endGesture();
          }}
        />
        {printSize && width > 0 && (
          <p
            className={cx(
              "mt-2 flex items-start gap-2 px-1 text-[11.5px] leading-relaxed",
              visibleMm < 2
                ? "text-[#8a5a12]"
                : "text-[var(--studio-ink-muted)]"
            )}
          >
            {visibleMm < 2 && (
              <Icon name="warning" className="mt-[1px] shrink-0 text-[14px]" />
            )}
            <span>
              {visibleMm < 2
                ? `The frame's lip covers about ${RABBET_MM} mm of every edge, so almost none of this border will show. Go wider, or leave it off.`
                : `About ${visibleMm.toFixed(0)} mm shows once the frame's lip covers the outer ${RABBET_MM} mm.`}
            </span>
          </p>
        )}
      </PanelSection>

      <PanelSection title="Colour">
        <div className="flex flex-wrap gap-1.5">
          {COLOURS.map((colour) => (
            <button
              key={colour}
              type="button"
              data-r="md"
              aria-label={`Border colour ${colour}`}
              aria-pressed={doc.border.color.toLowerCase() === colour}
              onClick={() => {
                setBorder({ color: colour });
                endGesture();
              }}
              style={{ backgroundColor: colour }}
              className={cx(
                "h-7 w-7 border transition-transform hover:scale-110",
                doc.border.color.toLowerCase() === colour
                  ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/40"
                  : "border-[var(--studio-border)]"
              )}
            />
          ))}
          <label
            data-r="md"
            className="relative flex h-7 w-12 cursor-pointer items-center justify-center overflow-hidden border border-[var(--studio-border)]"
            style={{ backgroundColor: doc.border.color }}
          >
            <span className="sr-only">Pick a border colour</span>
            <input
              type="color"
              value={doc.border.color}
              onChange={(e) => setBorder({ color: e.target.value }, "border-colour")}
              onBlur={endGesture}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </PanelSection>
    </div>
  );
}
