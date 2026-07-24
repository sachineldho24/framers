"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Signs the user out and hard-navigates home. Hard navigation (not router.push)
 * guarantees the server re-renders against the cleared session cookie.
 */
export function SignOutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={`label-caps border-2 border-black px-6 py-3 uppercase transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-60 ${className}`}
    >
      {busy ? "Signing out…" : "Sign Out"}
    </button>
  );
}
