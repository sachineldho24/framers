"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Shared client logic to begin the Canva design flow for a frame.
 * - Not signed in → /login?next=/frames/[slug]
 * - Signed in     → POST /api/canva/create-design → redirect to editUrl/authUrl
 * See plan/06-user-flows.md Flows 1 & 2.
 */
export function useStartDesign(frameId: string, frameSlug: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/frames/${frameSlug}`)}`);
      return;
    }

    try {
      const res = await fetch("/api/canva/create-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not start your design.");
      }
      const data = (await res.json()) as {
        editUrl?: string;
        authUrl?: string;
      };
      if (data.authUrl) window.location.href = data.authUrl;
      else if (data.editUrl) window.location.href = data.editUrl;
      else throw new Error("Unexpected response. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return { start, loading, error };
}
