"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  auth_failed: "Something went wrong. Please try again.",
};

/** Reads ?error= from the URL and shows a dismissible banner. */
export function ErrorBanner() {
  const params = useSearchParams();
  const code = params.get("error");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [code]);

  if (!code || dismissed) return null;
  const message = MESSAGES[code] ?? MESSAGES.auth_failed;

  return (
    <div className="border-b-2 border-error bg-error-container px-margin-mobile py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="label-caps text-on-error-container">{message}</p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="label-caps shrink-0 cursor-pointer text-on-error-container hover:opacity-70"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
