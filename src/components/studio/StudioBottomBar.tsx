"use client";

/**
 * Bottom bar: zoom stepper, fit-to-screen, the print readout, page indicator and
 * the panel toggle.
 *
 * Page nav renders 1 / 1 with the arrows disabled — documents are single-page
 * this pass, and a control that lies about being available is worse than one
 * that's visibly inert.
 *
 * The print readout is here rather than in a panel because it is a property of
 * the whole page, like the zoom: it has to be true at a glance, all the time,
 * without anyone going looking for it. It reports the resolution the file will
 * actually have — which is *not* 300 DPI on the larger frames, since the document
 * grid is capped (see `print.ts`).
 */

import { MAX_ZOOM, MIN_ZOOM, zoomAt } from "@/lib/studio/geometry";
import { documentQuality } from "@/lib/studio/print";
import { useStudio } from "@/lib/studio/StudioContext";

import { IconButton, Tooltip, cx } from "./ui";

const STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

/** Same three tones as the Info sheet's verdict, so one number reads one way. */
const TONE: Record<"good" | "ok" | "poor", string> = {
  good: "#1f6b32",
  ok: "#8a5a12",
  poor: "#a02a24",
};

export function StudioBottomBar({
  surfaceRef,
}: {
  /** The canvas viewport, so zoom keeps its centre fixed. */
  surfaceRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    doc,
    viewport,
    setViewport,
    fitTo,
    rail,
    setRail,
    tool,
    setTool,
    printSize,
    guides,
    showGuides,
    setShowGuides,
  } = useStudio();

  const percent = Math.round(viewport.scale * 100);
  const panelOpen = !!rail || tool !== "select";
  const quality = documentQuality(doc, printSize);

  // Which of the two limits is biting matters, because the fixes are opposite:
  // a soft photo is replaced, a capped page is printed at a smaller size.
  const limitedByPhoto =
    quality.softest > 0 && quality.softest < quality.pageDpi - 1;
  const dpiTooltip = `Print file: ${Math.round(quality.dpi)} DPI — ${
    quality.verdict.label.toLowerCase()
  }${limitedByPhoto ? " (a photo on the page is the limit)" : ""}`;

  function zoomTo(next: number) {
    const el = surfaceRef.current;
    const anchor = el
      ? { x: el.clientWidth / 2, y: el.clientHeight / 2 }
      : { x: 0, y: 0 };
    setViewport((v) => zoomAt(v, next, anchor));
  }

  function step(direction: 1 | -1) {
    const current = viewport.scale;
    const next =
      direction === 1
        ? (STEPS.find((s) => s > current * 1.001) ?? MAX_ZOOM)
        : ([...STEPS].reverse().find((s) => s < current * 0.999) ?? MIN_ZOOM);
    zoomTo(next);
  }

  function fit() {
    const el = surfaceRef.current;
    if (el) fitTo(el.clientWidth, el.clientHeight);
  }

  return (
    <footer className="studio-bottom-bar flex h-11 shrink-0 items-center gap-1 border-t border-[var(--studio-border)] bg-[var(--studio-chrome)] px-3">
      <IconButton
        icon="remove"
        label="Zoom out"
        size="sm"
        tooltipSide="top"
        disabled={viewport.scale <= MIN_ZOOM + 1e-6}
        onClick={() => step(-1)}
      />

      {/* Reads as a number and behaves as one: click resets to 100%. */}
      <Tooltip label="Reset zoom to 100%" side="top">
        <button
          type="button"
          onClick={() => zoomTo(1)}
          data-r="md"
          className="min-w-[52px] px-1.5 py-1 text-[12px] font-medium tabular-nums text-[var(--studio-ink)] hover:bg-black/[0.055]"
        >
          {percent}%
        </button>
      </Tooltip>

      <IconButton
        icon="add"
        label="Zoom in"
        size="sm"
        tooltipSide="top"
        disabled={viewport.scale >= MAX_ZOOM - 1e-6}
        onClick={() => step(1)}
      />
      <IconButton
        icon="fit_screen"
        label="Fit to screen"
        size="sm"
        tooltipSide="top"
        onClick={fit}
      />

      <span
        className="mx-1 h-5 w-px bg-[var(--studio-border)]"
        aria-hidden="true"
      />

      <IconButton
        icon="border_outer"
        label={
          !guides
            ? "Print guides need a frame size"
            : showGuides
              ? "Hide print guides"
              : "Show where the frame covers the print"
        }
        size="sm"
        tooltipSide="top"
        disabled={!guides}
        active={showGuides && !!guides}
        onClick={() => setShowGuides(!showGuides)}
      />

      {/* Not a control: the one number a print buyer needs, kept visible so it
          can't be missed, and coloured by the verdict rather than left as a
          figure only a printer would interpret. */}
      <Tooltip label={dpiTooltip} side="top">
        <span
          className="flex items-center gap-1.5 px-1.5 py-1 text-[12px] font-medium tabular-nums"
          style={{ color: TONE[quality.verdict.tone] }}
        >
          <span
            data-r="full"
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: "currentColor" }}
            aria-hidden="true"
          />
          {Math.round(quality.dpi)} DPI
          <span className="sr-only">{`— ${quality.verdict.label}`}</span>
        </span>
      </Tooltip>

      <span
        className="mx-1 h-5 w-px bg-[var(--studio-border)]"
        aria-hidden="true"
      />

      <div className="studio-page-nav flex items-center gap-0.5">
        <IconButton
          icon="chevron_left"
          label="Previous page"
          size="sm"
          tooltipSide="top"
          disabled
        />
        <span className="px-1 text-[12px] tabular-nums text-[var(--studio-ink-muted)]">
          1 / 1
        </span>
        <IconButton
          icon="chevron_right"
          label="Next page"
          size="sm"
          tooltipSide="top"
          disabled
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <IconButton
          icon={panelOpen ? "left_panel_close" : "left_panel_open"}
          label={panelOpen ? "Hide panel" : "Show panel"}
          size="sm"
          tooltipSide="top"
          onClick={() => { setTool("select"); setRail(panelOpen ? null : "tools"); }}
          className={cx(panelOpen && "text-[var(--studio-accent)]")}
        />
      </div>
    </footer>
  );
}
