"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Icon } from "@/components/Icon";

/**
 * The admin tree's error boundary. Worth having its own rather than inheriting
 * Next's default: the reads behind these pages use the service-role client, and
 * a thrown Postgres message is exactly the kind of thing not to render raw. The
 * operator gets a retry and the message goes to the server log.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] render failed", error);
  }, [error]);

  return (
    <div className="border-2 border-error bg-surface-lowest p-8">
      <div className="grid h-14 w-14 place-items-center border-2 border-error text-error">
        <Icon name="warning" className="text-[24px]" />
      </div>
      <h1 className="mt-5 text-[24px] uppercase leading-tight">
        That didn&apos;t load
      </h1>
      <p className="mt-3 text-[15px] text-on-surface-variant">
        Something failed while reading orders. Nothing was changed. Try again —
        if it keeps happening, check whether migration 0009 has been run.
      </p>
      {error.digest && (
        <p className="label-caps mt-3 text-[10px] text-on-surface-variant">
          Ref {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="label-caps brutalist-press bg-primary px-5 py-3 text-[11px] text-on-primary"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="label-caps border-2 border-border-high-contrast px-5 py-3 text-[11px] transition-colors hover:bg-surface-muted"
        >
          Back to queue
        </Link>
      </div>
    </div>
  );
}
