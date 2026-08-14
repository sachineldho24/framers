"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Frame, Finish } from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";
import { patchDesignerState } from "@/lib/designer-state";
import { useDesignerState } from "@/lib/useDesignerState";
import { useDesignerImage } from "@/lib/useDesignerImage";
import { FramePreview } from "@/components/FramePreview";
import { docSizeForFrame } from "@/lib/studio/document";
import { documentDpi, photoInFrame, POOR_DPI } from "@/lib/studio/print";

/**
 * Step 3 — Size. Slider over the standard-size frame SKUs + quick-picks, live
 * FramePreview on the right with a DPI quality badge and max-print disclosure.
 *
 * The numbers come from `photoInFrame`, the same pure helper the studio's print
 * readout is built on, and from the *decoded* image rather than whatever the
 * store remembers — a session resumed in another tab has no stored dimensions,
 * and a figure that disagrees with the picture beside it is worse than none.
 */
export function SizeStep({
  sessionId,
  frames,
}: {
  sessionId: string;
  frames: Frame[];
  /** Accepted so the route's props stay symmetric with the other steps. */
  finishes?: Finish[];
}) {
  const router = useRouter();
  const { imageSrc } = useDesignerImage(sessionId);
  const stored = useDesignerState(sessionId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // null until the slider is touched, so a resumed session keeps its size
  // without a restore effect racing the first paint.
  const [picked, setPicked] = useState<number | null>(null);
  const restoredIdx = stored?.frameId
    ? frames.findIndex((f) => f.id === stored.frameId)
    : -1;
  const idx = picked ?? (restoredIdx >= 0 ? restoredIdx : 0);

  const frame: Frame | undefined = frames[idx];

  // The pixels live in the store, not in component state: the measure below
  // writes them there and this reads them back, so there is only ever one copy
  // and it is the one the next step will read too.
  const px = stored?.imageWidth ?? 0;
  const py = stored?.imageHeight ?? 0;
  const dims = useMemo(
    () => (px > 0 && py > 0 ? { w: px, h: py } : null),
    [px, py]
  );

  // Written when the size is actually chosen, never from an effect: on the
  // first commit `idx` is still the default (the store's snapshot lands a beat
  // later, by design), so an effect would write frames[0] over the size the
  // session was resumed with before anything had a chance to read it.
  function choose(i: number) {
    setPicked(i);
    const f = frames[i];
    if (f) patchDesignerState(sessionId, { frameId: f.id });
  }

  // Measure the image actually on screen. This is the authority: it's the same
  // decode `FramePreview` draws with, so a rotated JPEG or a lost store can't
  // leave the DPI figures describing a different photo.
  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
      patchDesignerState(sessionId, {
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
      });
    };
    img.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc, sessionId]);

  /** What this photo really prints at in the selected frame. */
  const fit = useMemo(() => {
    if (!dims || !frame) return null;
    const mm = { widthMm: frame.width_mm, heightMm: frame.height_mm };
    const page = docSizeForFrame(frame.width_mm, frame.height_mm);
    return photoInFrame({ width: dims.w, height: dims.h }, mm, documentDpi(page, mm));
  }, [dims, frame]);

  /** The largest size in the catalogue this photo still prints acceptably at. */
  const bestIdx = useMemo(() => {
    if (!dims) return -1;
    let best = -1;
    frames.forEach((f, i) => {
      const mm = { widthMm: f.width_mm, heightMm: f.height_mm };
      const at = photoInFrame(
        { width: dims.w, height: dims.h },
        mm,
        documentDpi(docSizeForFrame(f.width_mm, f.height_mm), mm)
      );
      if (!at || at.dpi < POOR_DPI) return;
      const area = f.width_mm * f.height_mm;
      if (best < 0 || area > frames[best].width_mm * frames[best].height_mm) {
        best = i;
      }
    });
    return best;
  }, [dims, frames]);

  const pip =
    fit == null
      ? "#ebebeb"
      : fit.verdict.tone === "good"
        ? "#16a34a"
        : fit.verdict.tone === "ok"
          ? "#ccff00"
          : "#ff0000";

  if (!frame) {
    return (
      <main className="px-margin-mobile pt-32">
        <p className="label-caps text-on-surface-variant">No sizes available.</p>
      </main>
    );
  }

  async function next() {
    if (!frame) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Persist the chosen frame to the DB so the /frame page server-check passes.
      const res = await fetch(`/api/design/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId: frame.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not save size. Please try again.");
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save size. Please try again.");
      setSaving(false);
      return;
    }
    router.push(`/design/${sessionId}/frame`);
  }

  return (
    <main className="grid min-h-screen grid-cols-1 pt-14 md:grid-cols-2">
      {/* Left — controls */}
      <section className="flex flex-col justify-center px-margin-mobile py-12 md:px-16">
        <h1 className="text-[32px] md:text-[40px]">Find the right size.</h1>
        {fit && (
          <p className="mt-3 max-w-md text-on-surface-variant">
            Gallery-sharp up to{" "}
            <strong className="text-black">
              {fit.sharpIn.width.toFixed(1)}″ × {fit.sharpIn.height.toFixed(1)}″
            </strong>
            , and still good on a wall up to{" "}
            <strong className="text-black">
              {fit.maxIn.width.toFixed(1)}″ × {fit.maxIn.height.toFixed(1)}″
            </strong>
            .
          </p>
        )}

        {/* Selected tier */}
        <div className="mt-10">
          <p className="label-caps text-on-surface-variant">{frame.name}</p>
          <p className="font-display text-[40px] font-black leading-none text-action-red">
            {formatPaise(frame.price_paise)}
          </p>
          <p className="label-caps mt-2 text-on-surface-variant">
            {frame.width_mm} × {frame.height_mm} mm
          </p>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          step={1}
          value={idx}
          onChange={(e) => choose(Number(e.target.value))}
          className="designer-range mt-8 w-full max-w-md"
          aria-label="Frame size"
        />
        <div className="mt-2 flex max-w-md justify-between">
          {frames.map((f, i) => (
            <button
              key={f.id}
              onClick={() => choose(i)}
              className={`label-caps ${
                i === idx ? "text-black" : "text-outline"
              }`}
            >
              {f.name.replace(/\s*frame/i, "")}
            </button>
          ))}
        </div>

        {/* Quick picks */}
        <div className="mt-8">
          <p className="label-caps mb-3 text-on-surface-variant">
            Jump to a size
          </p>
          <div className="flex flex-wrap gap-3">
            {frames.map((f, i) => (
              <button
                key={f.id}
                onClick={() => choose(i)}
                className={`border-2 border-black px-4 py-2 font-bold uppercase transition-all hover:bg-black hover:text-white ${
                  i === idx ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Quality readout */}
        {fit && (
          <div className="mt-8 max-w-md">
            <div className="inline-flex w-fit items-center gap-3 bg-black px-4 py-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: pip }}
              />
              <span className="label-caps text-white">
                {Math.round(fit.dpi)} DPI · {fit.verdict.label}
              </span>
            </div>

            {/* A verdict with no way forward is just a scolding. */}
            {fit.verdict.tone === "poor" && (
              <p className="mt-3 text-[14px] text-on-surface-variant">
                {bestIdx >= 0 ? (
                  <>
                    This photo has the pixels for{" "}
                    <button
                      onClick={() => choose(bestIdx)}
                      className="font-bold text-black underline"
                    >
                      {frames[bestIdx].name}
                    </button>{" "}
                    at this size. Bigger will look soft from close up.
                  </>
                ) : (
                  <>
                    This photo is small for every size we frame.{" "}
                    <button
                      onClick={() => router.push(`/design/${sessionId}/upload`)}
                      className="font-bold text-black underline"
                    >
                      Upload a larger file
                    </button>{" "}
                    if you have one.
                  </>
                )}
              </p>
            )}

            {fit.cropped > 0.15 && (
              <p className="mt-3 text-[14px] text-on-surface-variant">
                This shape trims about {Math.round(fit.cropped * 100)}% off your
                photo — you pick exactly what stays in the editor.
              </p>
            )}
          </div>
        )}

        {saveError && (
          <p className="label-caps mt-6 border-2 border-error px-3 py-2 text-error max-w-md">
            {saveError}
          </p>
        )}

        <button
          onClick={next}
          disabled={saving}
          className="brutalist-shadow brutalist-press mt-10 w-full max-w-md bg-action-red py-5 font-bold uppercase tracking-widest text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Next: Pick a Frame"}
        </button>
      </section>

      {/* Right — live preview */}
      <section className="flex items-center justify-center border-t-2 border-black bg-surface-muted px-margin-mobile py-12 md:border-l-2 md:border-t-0">
        <div className="w-full max-w-sm">
          <FramePreview
            widthMm={frame.width_mm}
            heightMm={frame.height_mm}
            moldingColor="#141414"
            finish="none"
            imageSrc={imageSrc}
            editable={false}
          />
        </div>
      </section>
    </main>
  );
}
