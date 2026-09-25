"use client";

/**
 * Bottom bar: print guides and the print readout on the left; the zoom
 * slider, page indicator, full screen and help on the right, as in the mockup.
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

import { useEffect, useState } from "react";

import { MAX_ZOOM, MIN_ZOOM, zoomAt } from "@/lib/studio/geometry";
import { documentQuality } from "@/lib/studio/print";
import { useStudio } from "@/lib/studio/StudioContext";

import { IconButton, Tooltip } from "./ui";

const STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

/**
 * The slider is logarithmic: every notch is the same *ratio*, so 10%→20% takes
 * as much travel as 100%→200%. Its range is narrower than the zoom limits —
 * the ends of those are reachable with the buttons and the wheel.
 */
const SLIDER_MIN = 0.05;
const SLIDER_MAX = 4;
const toSlider = (scale: number) =>
  (Math.log(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, scale)) / SLIDER_MIN) /
    Math.log(SLIDER_MAX / SLIDER_MIN)) *
  100;
const fromSlider = (t: number) =>
  SLIDER_MIN * Math.pow(SLIDER_MAX / SLIDER_MIN, t / 100);

function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return [on, toggle] as const;
}

/** Same three tones as the Info sheet's verdict, so one number reads one way. */
const TONE: Record<"good" | "ok" | "poor", string> = {
  good: "#1f6b32",
  ok: "#8a5a12",
  poor: "#a02a24",
};

export function StudioBottomBar({
  surfaceRef,
  onShowShortcuts,
}: {
  /** The canvas viewport, so zoom keeps its centre fixed. */
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  onShowShortcuts: () => void;
}) {
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const {
    doc,
    viewport,
    setViewport,
    fitTo,
    printSize,
    guides,
    showGuides,
    setShowGuides,
  } = useStudio();

  const percent = Math.round(viewport.scale * 100);
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
    <footer className="studio-bottom-bar flex h-10 shrink-0 items-center gap-1 border-t border-[var(--studio-border)] bg-[var(--studio-chrome)] px-3">
      <div className="flex items-center gap-1">
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
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1">
        <IconButton
          icon="remove"
          label="Zoom out"
          size="sm"
          tooltipSide="top"
          disabled={viewport.scale <= MIN_ZOOM + 1e-6}
          onClick={() => step(-1)}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={toSlider(viewport.scale)}
          onChange={(e) => zoomTo(fromSlider(Number(e.target.value)))}
          aria-label="Zoom"
          aria-valuetext={`${percent}%`}
          className="studio-range studio-zoom-slider w-[150px] min-w-[60px]"
        />
        <IconButton
          icon="add"
          label="Zoom in"
          size="sm"
          tooltipSide="top"
          disabled={viewport.scale >= MAX_ZOOM - 1e-6}
          onClick={() => step(1)}
        />

        {/* Reads as a number and behaves as one: click resets to 100%. */}
        <Tooltip label="Reset zoom to 100%" side="top">
          <button
            type="button"
            onClick={() => zoomTo(1)}
            data-r="md"
            className="min-w-[48px] px-1.5 py-1 text-right text-[12px] font-medium tabular-nums text-[var(--studio-ink)] hover:bg-white/[0.055]"
          >
            {percent}%
          </button>
        </Tooltip>
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

        <IconButton
          icon={fullscreen ? "close_fullscreen" : "open_in_full"}
          label={fullscreen ? "Exit full screen" : "Full screen"}
          size="sm"
          tooltipSide="top"
          onClick={toggleFullscreen}
          tooltipAlign="end"
          className="studio-fullscreen"
        />
        <IconButton
          icon="help"
          label="Keyboard shortcuts"
          size="sm"
          tooltipSide="top"
          tooltipAlign="end"
          onClick={onShowShortcuts}
        />
      </div>
    </footer>
  );
}
