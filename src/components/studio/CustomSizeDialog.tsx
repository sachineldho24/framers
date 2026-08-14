"use client";

/**
 * Custom page size.
 *
 * Two numbers, a unit, and an aspect lock — but the interesting part is what the
 * numbers *mean*. A page size here is physical (see `customSize.ts`): pixels are
 * read at 300 DPI and converted to millimetres, so the resulting grid can be
 * capped by `MAX_DOC_EDGE` without the paper size becoming a guess. That is why
 * this shows the grid and the DPI it works out to rather than only echoing back
 * what was typed — a 900 mm page is a legitimate thing to want and a 175 DPI
 * surprise at the print shop is not.
 *
 * "Scale artwork to fit" is on by default. Resizing with it off is the escape
 * hatch for someone who has placed things against the page edges on purpose;
 * with it on, a resize can't strand a layer off-canvas.
 *
 * Mounted only while it is open (the shell renders it conditionally), so the
 * fields are seeded by lazy `useState` initialisers rather than by an effect
 * that writes state on open — that effect is a cascading render, and the lint
 * that forbids it is right: the starting numbers are known at mount.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { useStudio } from "@/lib/studio/StudioContext";
import {
  documentPrintSize,
  formatInUnit,
  fromMm,
  lockedCounterpart,
  loadRecentSizes,
  makeSizePreset,
  mmPerUnit,
  parseSizeValue,
  rememberRecentSize,
  resolveSize,
  SIZE_UNITS,
  unitPrecision,
  type SizePreset,
  type SizeUnit,
} from "@/lib/studio/customSize";
import { POOR_DPI, SOFT_DPI } from "@/lib/studio/print";

import { StudioButton, cx } from "./ui";

/** Trim to the unit's precision for display in an input the user then edits. */
function show(mm: number, unit: SizeUnit): string {
  return formatInUnit(mm, unit);
}

export function CustomSizeDialog({ onClose }: { onClose: () => void }) {
  const { doc, printSize, apply, endGesture } = useStudio();

  // The page's current size, measured once at mount: the starting point for an
  // edit, not a blank form to fill in twice. Re-reading it mid-edit would fight
  // the user, and the document only changes here because of this dialog.
  const [start] = useState(() => documentPrintSize(doc, printSize));

  const [unit, setUnit] = useState<SizeUnit>("mm");
  const [widthText, setWidthText] = useState(() => show(start.widthMm, "mm"));
  const [heightText, setHeightText] = useState(() => show(start.heightMm, "mm"));
  const [locked, setLocked] = useState(false);
  const [reflow, setReflow] = useState(true);
  // Read straight from storage at mount. Safe in render here — this subtree is
  // never server-rendered, so there is no markup for it to disagree with.
  const [recents] = useState<SizePreset[]>(loadRecentSizes);
  const [touched, setTouched] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // The ratio the lock holds: captured when the lock is switched on, so typing
  // in one field can't drift it a rounding step at a time.
  const lockRatio = useRef<number | null>(null);

  // Focus after paint, so the width is one keystroke from being replaced.
  useEffect(() => {
    const t = setTimeout(() => firstFieldRef.current?.select(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = parseSizeValue(widthText);
  const height = parseSizeValue(heightText);
  const ratio = width && height ? width / height : null;

  const result = useMemo(
    () => (width && height ? resolveSize(width, height, unit) : null),
    [width, height, unit]
  );

  /** Convert both fields into a new unit rather than reinterpreting the digits. */
  function changeUnit(next: SizeUnit) {
    if (next === unit) return;
    const w = width ?? 0;
    const h = height ?? 0;
    const p = unitPrecision(next);
    const conv = (value: number) =>
      value > 0
        ? String(Number(fromMm(value * mmPerUnit(unit), next).toFixed(p)))
        : "";
    setWidthText(conv(w));
    setHeightText(conv(h));
    setUnit(next);
  }

  function editWidth(text: string) {
    setTouched(true);
    setWidthText(text);
    const value = parseSizeValue(text);
    if (locked && value && lockRatio.current) {
      const other = lockedCounterpart(value, lockRatio.current, "width");
      setHeightText(String(Number(other.toFixed(unitPrecision(unit)))));
    }
  }

  function editHeight(text: string) {
    setTouched(true);
    setHeightText(text);
    const value = parseSizeValue(text);
    if (locked && value && lockRatio.current) {
      const other = lockedCounterpart(value, lockRatio.current, "height");
      setWidthText(String(Number(other.toFixed(unitPrecision(unit)))));
    }
  }

  function toggleLock() {
    if (locked) {
      lockRatio.current = null;
      setLocked(false);
      return;
    }
    lockRatio.current = ratio;
    setLocked(Boolean(ratio));
  }

  function applyPreset(preset: SizePreset) {
    setTouched(true);
    setUnit(preset.unit);
    setWidthText(String(preset.width));
    setHeightText(String(preset.height));
    if (locked) lockRatio.current = preset.width / preset.height;
  }

  function commit() {
    if (!result?.ok || !width || !height) return;
    const { size } = result;
    // A gesture boundary, so the resize is one undo step and can't merge with
    // whatever was being dragged before the dialog opened.
    endGesture();
    apply({
      type: "resizeDocument",
      width: size.width,
      height: size.height,
      reflow,
      printMm: { widthMm: size.widthMm, heightMm: size.heightMm },
    });
    // The list outlives this dialog; nothing here needs to re-render for it.
    rememberRecentSize(makeSizePreset(width, height, unit));
    onClose();
  }

  const dpi = result?.ok ? Math.round(result.size.dpi) : null;
  const dpiTone =
    dpi === null
      ? "muted"
      : dpi < POOR_DPI
        ? "bad"
        : dpi < SOFT_DPI
          ? "warn"
          : "good";

  return (
    <div
      className="studio-root fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Custom page size"
        data-r="lg"
        className="studio-shadow w-full max-w-[380px] bg-white p-4 text-[var(--studio-ink)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Custom size</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-r="full"
            className="grid h-7 w-7 place-items-center hover:bg-black/[0.055]"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Units first: the numbers below mean nothing without them, and it is
            the field people get wrong. */}
        <div
          role="group"
          aria-label="Units"
          className="mt-3 flex gap-1 border border-[var(--studio-border)] p-1"
          data-r="md"
        >
          {SIZE_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => changeUnit(u)}
              aria-pressed={u === unit}
              data-r="sm"
              className={cx(
                "flex-1 py-1 text-[12px] font-medium transition-colors",
                u === unit
                  ? "bg-[#16161a] text-white"
                  : "text-[var(--studio-ink-muted)] hover:bg-black/[0.04]"
              )}
            >
              {u}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-[11px] font-medium text-[var(--studio-ink-muted)]">
            Width
            <input
              ref={firstFieldRef}
              value={widthText}
              onChange={(e) => editWidth(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              inputMode="decimal"
              data-r="md"
              className="mt-1 block w-full border border-[var(--studio-border)] bg-white px-2 py-1.5 text-[13px] font-semibold text-[var(--studio-ink)] focus:border-[var(--studio-accent)] focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={toggleLock}
            aria-pressed={locked}
            aria-label={
              locked ? "Unlock the aspect ratio" : "Lock the aspect ratio"
            }
            title={locked ? "Aspect ratio locked" : "Lock aspect ratio"}
            data-r="md"
            className={cx(
              "mb-[3px] grid h-8 w-8 shrink-0 place-items-center border transition-colors",
              locked
                ? "border-[var(--studio-accent)] bg-[var(--studio-accent)] text-white"
                : "border-[var(--studio-border)] text-[var(--studio-ink-muted)] hover:bg-black/[0.04]"
            )}
          >
            <Icon
              name={locked ? "link" : "link_off"}
              className="text-[18px]"
            />
          </button>

          <label className="flex-1 text-[11px] font-medium text-[var(--studio-ink-muted)]">
            Height
            <input
              value={heightText}
              onChange={(e) => editHeight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              inputMode="decimal"
              data-r="md"
              className="mt-1 block w-full border border-[var(--studio-border)] bg-white px-2 py-1.5 text-[13px] font-semibold text-[var(--studio-ink)] focus:border-[var(--studio-accent)] focus:outline-none"
            />
          </label>
        </div>

        {/* What it actually becomes. Shown always, not only on an error: the
            pixel grid and the DPI are the two things the numbers above don't
            say, and both matter to a print. */}
        <p className="mt-2 min-h-[32px] text-[11.5px] leading-[1.45] text-[var(--studio-ink-muted)]">
          {result?.ok ? (
            <>
              {result.size.width} × {result.size.height} px ·{" "}
              <span
                className={cx(
                  "font-semibold",
                  dpiTone === "bad" && "text-[#c8322b]",
                  dpiTone === "warn" && "text-[#8a5a12]",
                  dpiTone === "good" && "text-[#1f7a45]"
                )}
              >
                {dpi} DPI
              </span>
              {result.size.capped && " — large pages print below 300 DPI"}
            </>
          ) : touched && (widthText.trim() || heightText.trim()) ? (
            <span className="text-[#c8322b]">
              {result?.ok === false
                ? result.error
                : "Enter a width and a height."}
            </span>
          ) : (
            "Pixels are read at 300 DPI, so 2480 × 3508 px is A4."
          )}
        </p>

        <label className="mt-1 flex items-center gap-2 text-[12px] text-[var(--studio-ink)]">
          <input
            type="checkbox"
            checked={reflow}
            onChange={(e) => setReflow(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--studio-accent)]"
          />
          Scale artwork to fit the new size
        </label>

        {recents.length > 0 && (
          <div className="mt-3 border-t border-[var(--studio-border)] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--studio-ink-muted)]">
              Recent
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {recents.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  data-r="md"
                  className="border border-[var(--studio-border)] px-2 py-1 text-[12px] text-[var(--studio-ink)] hover:bg-black/[0.04]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <StudioButton variant="outline" onClick={onClose}>
            Cancel
          </StudioButton>
          <StudioButton
            variant="solid"
            onClick={commit}
            disabled={!result?.ok}
            className="px-4"
          >
            Resize
          </StudioButton>
        </div>
      </div>
    </div>
  );
}
