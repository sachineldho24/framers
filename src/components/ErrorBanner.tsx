"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/** Human-readable messages for ?error= codes emitted by the Canva flow. */
const MESSAGES: Record<string, string> = {
  canva_denied:
    "Canva access was declined. You need to allow access to design your frame.",
  canva_unconfigured:
    "Designing in Canva isn't available yet. Please use the upload option for now.",
  auth_state_failed:
    "Your sign-in session didn't carry over. Make sure you're using http://127.0.0.1:3000 (not localhost), then try again.",
  auth_token_failed:
    "We couldn't complete the Canva connection. Please try again.",
  design_failed:
    "We couldn't create your design in Canva. Please try again.",
  return_failed:
    "We couldn't verify your design coming back from Canva. Please try again.",
  auth_failed: "Something went wrong connecting to Canva. Please try again.",
};

/** Reads ?error= from the URL and shows a dismissible banner. */
export function ErrorBanner() {
  const params = useSearchParams();
  const code = params.get("error");
  const [dismissed, setDismissed] = useState(false);

  // Reset visibility when the error code changes.
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
