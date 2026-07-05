"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Frame, Finish, DesignSource } from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";
import { loadDesignerState, patchDesignerState } from "@/lib/designer-state";
import { useDesignerImage } from "@/lib/useDesignerImage";
import { FramePreview } from "@/components/FramePreview";

const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

/**
 * Step 3 — Size. Slider over the standard-size frame SKUs + quick-picks, live
 * FramePreview on the right with a DPI quality badge and max-print disclosure.
 */
export function SizeStep({
  sessionId,
  designSource,
  frames,
  finishes,
}: {
  sessionId: string;
  designSource: DesignSource;
  frames: Frame[];
  finishes: Finish[];
}) {
  const router = useRouter();
  const { imageSrc } = useDesignerImage(sessionId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saved =
    typeof window !== "undefined" ? loadDesignerState(sessionId) : null;
  const savedIdx = saved?.frameId
    ? frames.findIndex((f) => f.id === saved.frameId)
    : -1;
  const [idx, setIdx] = useState(savedIdx >= 0 ? savedIdx : 0);
  const [imageDims] = useState<{ w: number; h: number } | null>(
    saved?.imageWidth && saved?.imageHeight
      ? { w: saved.imageWidth, h: saved.imageHeight }
      : null
  );

  const frame = frames[idx];

  // Persist size choice as the slider moves (local only).
  useEffect(() => {
    if (frame) patchDesignerState(sessionId, { frameId: frame.id });
  }, [frame, sessionId]);

  // Max printable size at 300 DPI from the uploaded pixels.
  const maxPrint = useMemo(() => {
    if (!imageDims) return null;
    const wIn = imageDims.w / PRINT_DPI;
    const hIn = imageDims.h / PRINT_DPI;
    return { wIn, hIn };
  }, [imageDims]);

  // Effective DPI if this image fills the selected frame.
  const dpi = useMemo(() => {
    if (!imageDims || !frame) return null;
    const wIn = frame.width_mm / MM_PER_INCH;
    const hIn = frame.height_mm / MM_PER_INCH;
    return Math.round(Math.min(imageDims.w / wIn, imageDims.h / hIn));
  }, [imageDims, frame]);

  const dpiTier =
    dpi == null
      ? null
      : dpi >= PRINT_DPI
        ? { label: "Excellent", pip: "#16a34a" }
        : dpi >= 150
          ? { label: "Acceptable", pip: "#ccff00" }
          : { label: "Too low", pip: "#ff0000" };

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
        {maxPrint && (
          <p className="mt-3 text-on-surface-variant">
            Your photo can be printed up to{" "}
            <strong className="text-black">
              {maxPrint.wIn.toFixed(1)}″ × {maxPrint.hIn.toFixed(1)}″
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
          onChange={(e) => setIdx(Number(e.target.value))}
          className="designer-range mt-8 w-full max-w-md"
          aria-label="Frame size"
        />
        <div className="mt-2 flex max-w-md justify-between">
          {frames.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setIdx(i)}
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
                onClick={() => setIdx(i)}
                className={`border-2 border-black px-4 py-2 font-bold uppercase transition-all hover:bg-black hover:text-white ${
                  i === idx ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* DPI badge */}
        {dpiTier && (
          <div className="mt-8 inline-flex w-fit items-center gap-3 bg-black px-4 py-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: dpiTier.pip }}
            />
            <span className="label-caps text-white">
              {dpi} DPI · {dpiTier.label}
            </span>
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
          {designSource === "canva" && !imageSrc && (
            <p className="label-caps mt-4 text-center text-on-surface-variant">
              You&apos;ll design the artwork in Canva next.
            </p>
          )}
          {finishes.length > 0 && null}
        </div>
      </section>
    </main>
  );
}
