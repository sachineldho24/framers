"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initDesignerState } from "@/lib/designer-state";

/**
 * Entry point. There is no choice to make here any more: the upload step is
 * where both paths live - drag a photo in, or open the studio on a blank page -
 * so this mints the session and goes straight there.
 *
 * `replace` rather than `push`. With `push`, Back from the upload step lands
 * here again, which mints a *second* session and bounces forward: a page the
 * browser cannot leave. `replace` puts the buyer back where they came from.
 *
 * The session is created on mount, in the browser, not during the server
 * render: this route is linked from the homepage, the works grid and the mobile
 * drawer, and Next prefetches links in view - a server-side write would leave a
 * trail of orphaned `design_sessions` rows behind every visitor who only looked
 * at the button.
 */

async function createSession(frameId: string | null): Promise<string> {
  const res = await fetch("/api/design/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frameId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.error?.message ?? "Could not start your design."
    );
  }
  const { sessionId } = (await res.json()) as { sessionId: string };
  return sessionId;
}

export function StartDesign({ frameId }: { frameId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the effect below when the buyer asks for another go.
  const [nonce, setNonce] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    // Strict Mode runs effects twice in development. Without this guard that is
    // two sessions and two navigations, which is not what a double render of a
    // redirect page should mean.
    if (started.current) return;
    started.current = true;

    createSession(frameId)
      .then((sessionId) => {
        // Seeded before navigating: this is the store the size step reads for
        // the frame the buyer arrived from, and it is why the seeding stays
        // here rather than moving into the upload step.
        initDesignerState(sessionId, "upload", frameId);
        router.replace(`/design/${sessionId}/upload`);
      })
      .catch((e: unknown) => {
        started.current = false;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      });
  }, [frameId, router, nonce]);

  function retry() {
    setError(null);
    setNonce((n) => n + 1);
  }

  if (error) {
    return (
      <div className="w-full max-w-md text-center">
        <p
          role="alert"
          className="label-caps border-2 border-error px-4 py-3 text-error"
        >
          {error}
        </p>
        <button
          onClick={retry}
          className="brutalist-shadow brutalist-press mt-6 w-full bg-action-red py-4 font-bold uppercase tracking-widest text-white"
        >
          Try again
        </button>
        <p className="mt-4 text-[14px] text-on-surface-variant">
          <Link href="/#shop" className="underline hover:text-action-red">
            Back to the shop
          </Link>
        </p>
      </div>
    );
  }

  return (
    <p className="label-caps text-on-surface-variant" role="status">
      Starting your design&hellip;
    </p>
  );
}
