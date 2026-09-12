"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initDesignerState } from "@/lib/designer-state";
import { Icon } from "@/components/Icon";

/**
 * Step 1 — Entry. Upload Your Photo card.
 * Creates a design_sessions row, then routes into the stepped flow.
 */
export function StartChooser({ frameId }: { frameId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/design/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? "Could not start your design.");
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      initDesignerState(sessionId, "upload", frameId);
      router.push(`/design/${sessionId}/upload`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="label-caps mb-6 border-2 border-error px-4 py-3 text-error">
          {error}
        </p>
      )}
      <div className="mx-auto max-w-xl">
        <button
          onClick={start}
          disabled={busy}
          className="brutalist-press group flex w-full flex-col items-start border-2 border-border-high-contrast bg-surface-muted p-8 text-left transition-all hover:bg-surface disabled:opacity-60"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center bg-action-red">
            <Icon name="cloud_upload" className="text-4xl text-white" />
          </div>
          <h2 className="mb-2 text-[24px] uppercase">Upload Your Photo</h2>
          <p className="mb-6 text-[14px] text-on-surface-variant">
            See it framed instantly. JPG, PNG, or PDF — minimum 150 DPI.
          </p>
          <span className="label-caps mt-auto inline-flex items-center gap-2 text-action-red">
            {busy ? "Starting…" : "Start"}{" "}
            <Icon name="arrow_forward" className="text-base" />
          </span>
        </button>
      </div>
    </div>
  );
}
