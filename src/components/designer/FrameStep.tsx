"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Frame,
  FrameStyle,
  Finish,
  FinishOverlay,
} from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";
import { loadDesignerState, patchDesignerState } from "@/lib/designer-state";
import { useDesignerImage } from "@/lib/useDesignerImage";
import { FramePreview } from "@/components/FramePreview";
import { Icon } from "@/components/Icon";

/**
 * Step 4 — Frame. Personalized grid: every style rendered with the user's own
 * photo. Filter bar (colour) + finish sub-control, then → Review.
 */
export function FrameStep({
  sessionId,
  frame,
  styles,
  finishes,
}: {
  sessionId: string;
  frame: Frame;
  styles: FrameStyle[];
  finishes: Finish[];
}) {
  const router = useRouter();
  const { imageSrc } = useDesignerImage(sessionId);

  const saved =
    typeof window !== "undefined" ? loadDesignerState(sessionId) : null;
  const [styleId, setStyleId] = useState<string | null>(
    saved?.frameStyleId ?? styles[0]?.id ?? null
  );
  const [finishId, setFinishId] = useState<string | null>(
    saved?.finishId ?? finishes[0]?.id ?? null
  );
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    patchDesignerState(sessionId, { frameStyleId: styleId, finishId });
  }, [styleId, finishId, sessionId]);

  const colors = useMemo(
    () => ["all", ...Array.from(new Set(styles.map((s) => s.color)))],
    [styles]
  );
  const visibleStyles =
    colorFilter === "all"
      ? styles
      : styles.filter((s) => s.color === colorFilter);

  const style = styles.find((s) => s.id === styleId) ?? styles[0];
  const finish = finishes.find((f) => f.id === finishId) ?? finishes[0];
  const overlay: FinishOverlay = finish?.overlay_kind ?? "none";

  const total =
    frame.price_paise +
    (style?.price_modifier_paise ?? 0) +
    (finish?.price_modifier_paise ?? 0);

  async function persistSession() {
    await fetch(`/api/design/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frameStyleId: styleId,
        finishId,
      }),
    }).catch(() => null);
  }

  async function onNext() {
    setBusy(true);
    setError(null);
    await persistSession();
    router.push(`/design/${sessionId}/review`);
  }

  return (
    <main className="grid min-h-screen grid-cols-1 pt-14 lg:grid-cols-[1fr_380px]">
      {/* Left — grid */}
      <section className="px-margin-mobile py-10 md:px-12">
        <h1 className="text-[28px] md:text-[36px]">Pick Your Frame</h1>
        <p className="mt-2 text-on-surface-variant">
          Your photo, shown in every style.
        </p>

        {/* Filter bar */}
        <div className="mt-6 flex flex-wrap gap-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColorFilter(c)}
              className={`border-2 border-black px-4 py-2 font-bold uppercase transition-all hover:bg-black hover:text-white ${
                colorFilter === c ? "bg-black text-white" : "bg-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {visibleStyles.map((s) => {
            const selected = s.id === styleId;
            return (
              <button
                key={s.id}
                onClick={() => setStyleId(s.id)}
                className={`group flex flex-col border-2 p-2 text-left transition-all ${
                  selected
                    ? "border-black ring-4 ring-neon-accent"
                    : "border-black hover:bg-surface-muted"
                }`}
              >
                <div className="frame-wall flex items-center justify-center overflow-hidden p-2">
                  <div className="w-full transition-transform duration-300 ease-out group-hover:scale-[0.8] group-hover:brutalist-shadow">
                    <FramePreview
                      widthMm={frame.width_mm}
                      heightMm={frame.height_mm}
                      moldingColor={s.molding_color}
                      moldingWidthMm={s.molding_width_mm}
                      finish={overlay}
                      imageSrc={imageSrc}
                      editable={false}
                      maxEdge={360}
                    />
                  </div>
                </div>
                <span className="label-caps mt-2">{s.name}</span>
                <span className="label-caps text-[10px] text-on-surface-variant">
                  {s.material}
                  {s.price_modifier_paise > 0 &&
                    ` · +${formatPaise(s.price_modifier_paise)}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Right — sticky config */}
      <aside className="border-t-2 border-black bg-surface-muted px-margin-mobile py-10 md:px-8 lg:border-l-2 lg:border-t-0">
        <div className="lg:sticky lg:top-24">
          <div className="border-2 border-black bg-white p-3">
            <FramePreview
              widthMm={frame.width_mm}
              heightMm={frame.height_mm}
              moldingColor={style?.molding_color ?? "#141414"}
              moldingWidthMm={style?.molding_width_mm ?? 22}
              finish={overlay}
              imageSrc={imageSrc}
              editable={false}
            />
          </div>

          {/* Finish sub-control */}
          <p className="label-caps mt-6 mb-3">Finish</p>
          <div className="flex flex-wrap gap-2">
            {finishes.map((f) => (
              <button
                key={f.id}
                onClick={() => setFinishId(f.id)}
                className={`border-2 border-black px-3 py-2 font-bold uppercase transition-all hover:bg-black hover:text-white ${
                  f.id === finishId ? "bg-black text-white" : "bg-white"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          {/* Price */}
          <div className="mt-6 flex items-center justify-between border-t-2 border-black pt-4">
            <span className="label-caps">Total</span>
            <span className="font-display text-[24px] font-black">
              {formatPaise(total)}
            </span>
          </div>

          {error && (
            <p className="label-caps mt-4 border-2 border-error px-3 py-2 text-error">
              {error}
            </p>
          )}

          <button
            onClick={onNext}
            disabled={busy}
            className="brutalist-shadow brutalist-press mt-6 flex w-full items-center justify-center gap-2 bg-action-red py-5 font-bold uppercase tracking-widest text-white disabled:opacity-60"
          >
            {busy ? "Working…" : "Next: Review"}
            <Icon name="arrow_forward" className="text-base" />
          </button>
        </div>
      </aside>
    </main>
  );
}
