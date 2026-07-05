"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editorUrlClient } from "@/lib/canva-client";
import { DesignPreview } from "./DesignPreview";

type State = "idle" | "exporting" | "success" | "error";

interface ExportResult {
  previewUrl: string;
  previewPath: string;
  printPath: string;
}

/**
 * Drives the export flow on /design/[designId].
 * idle → exporting → success | error. See plan/05 + plan/06 Flow 1/5.
 */
export function ExportController({
  designId,
  frameId,
}: {
  designId: string;
  frameId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);

  async function runExport() {
    setState("exporting");
    setError(null);
    setRequiresAuth(false);

    try {
      const res = await fetch("/api/canva/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.requiresAuth) setRequiresAuth(true);
        throw new Error(
          body?.error?.message ?? "Export failed. Please try again."
        );
      }

      const data = (await res.json()) as ExportResult;
      setResult(data);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  function proceedToCheckout() {
    if (!result) return;
    // Carry design selection forward to checkout (Phase 4 reads this).
    sessionStorage.setItem(
      "framers_checkout",
      JSON.stringify({
        designSource: "canva",
        designId,
        frameId,
        previewPath: result.previewPath,
        printPath: result.printPath,
      })
    );
    router.push("/checkout");
  }

  const editUrl = editorUrlClient(designId);

  return (
    <div className="flex flex-col gap-6">
      {state === "idle" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl">Welcome back</h1>
          <p className="text-on-surface-variant">
            Ready to print your design? Export it to continue to checkout.
          </p>
          <button
            onClick={runExport}
            className="label-caps cursor-pointer self-start bg-action-red px-6 py-4 text-on-primary transition-colors hover:bg-primary"
          >
            Export My Design
          </button>
          <a
            href={editUrl}
            className="label-caps text-on-surface-variant underline hover:text-action-red"
          >
            Go back to Canva to edit
          </a>
        </div>
      )}

      {state === "exporting" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl">Exporting…</h1>
          <p className="text-on-surface-variant">
            This usually takes about 15 seconds. Please keep this tab open.
          </p>
          <div className="h-2 w-full overflow-hidden border-2 border-primary">
            <div className="h-full w-1/2 animate-pulse bg-action-red" />
          </div>
        </div>
      )}

      {state === "success" && result && (
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl">Looks good?</h1>
          <DesignPreview url={result.previewUrl} className="max-w-md" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={proceedToCheckout}
              className="label-caps cursor-pointer bg-action-red px-6 py-4 text-on-primary transition-colors hover:bg-primary"
            >
              Proceed to Checkout
            </button>
            <a
              href={editUrl}
              className="label-caps border-2 border-primary px-6 py-4 text-center transition-colors hover:bg-primary hover:text-on-primary"
            >
              Edit in Canva
            </a>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl">Export Problem</h1>
          <p className="label-caps border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
          {requiresAuth ? (
            <button
              onClick={() => router.push(`/frames`)}
              className="label-caps cursor-pointer bg-primary px-6 py-4 text-on-primary"
            >
              Reconnect Canva
            </button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={runExport}
                className="label-caps cursor-pointer bg-action-red px-6 py-4 text-on-primary transition-colors hover:bg-primary"
              >
                Try Again
              </button>
              <a
                href={editUrl}
                className="label-caps border-2 border-primary px-6 py-4 text-center transition-colors hover:bg-primary hover:text-on-primary"
              >
                Re-open in Canva
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
