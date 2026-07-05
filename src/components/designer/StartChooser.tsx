"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initDesignerState } from "@/lib/designer-state";
import { Icon } from "@/components/Icon";

/**
 * Step 1 — Entry. Two bordered cards: Upload Your Photo / Design in Canva.
 * Creates a design_sessions row, then routes into the stepped flow.
 */
export function StartChooser({
  frameId,
  canvaEnabled,
}: {
  frameId: string | null;
  canvaEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"upload" | "canva" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(designSource: "upload" | "canva") {
    setBusy(designSource);
    setError(null);
    try {
      const res = await fetch("/api/design/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designSource, frameId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? "Could not start your design.");
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      initDesignerState(sessionId, designSource, frameId);
      // Upload path → upload step. Canva path needs a size first → size step.
      router.push(
        designSource === "upload"
          ? `/design/${sessionId}/upload`
          : `/design/${sessionId}/size`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="label-caps mb-6 border-2 border-error px-4 py-3 text-error">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Upload */}
        <button
          onClick={() => start("upload")}
          disabled={busy !== null}
          className="brutalist-press group flex flex-col items-start border-2 border-black bg-surface-muted p-8 text-left transition-all hover:bg-white disabled:opacity-60"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center bg-action-red">
            <Icon name="cloud_upload" className="text-4xl text-white" />
          </div>
          <h2 className="mb-2 text-[24px] uppercase">Upload Your Photo</h2>
          <p className="mb-6 text-[14px] text-on-surface-variant">
            See it framed instantly. JPG, PNG, or PDF — minimum 150 DPI.
          </p>
          <span className="label-caps mt-auto inline-flex items-center gap-2 text-action-red">
            {busy === "upload" ? "Starting…" : "Start"}{" "}
            <Icon name="arrow_forward" className="text-base" />
          </span>
        </button>

        {/* Canva */}
        <button
          onClick={() => start("canva")}
          disabled={busy !== null || !canvaEnabled}
          className="brutalist-press group flex flex-col items-start border-2 border-black bg-surface-muted p-8 text-left transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center bg-black">
            <Icon name="brush" className="text-4xl text-white" />
          </div>
          <h2 className="mb-2 text-[24px] uppercase">Design in Canva</h2>
          <p className="mb-6 text-[14px] text-on-surface-variant">
            {canvaEnabled
              ? "Create from scratch with Canva's templates, sized for your frame."
              : "Coming soon — Canva design isn't available yet. Use upload for now."}
          </p>
          <span className="label-caps mt-auto inline-flex items-center gap-2 text-black">
            {busy === "canva" ? "Starting…" : canvaEnabled ? "Start" : "Unavailable"}{" "}
            {canvaEnabled && <Icon name="arrow_forward" className="text-base" />}
          </span>
        </button>
      </div>
    </div>
  );
}
