"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Design This Frame" button. If the user isn't signed in, routes to /login
 * with a `next` back to the frame page. Otherwise navigates to the frame detail
 * page where the Canva flow begins (Phase 3 wires the actual create-design call).
 */
export function FrameCardCTA({
  frameSlug,
  variant = "primary",
}: {
  frameSlug: string;
  variant?: "primary" | "block";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const target = `/frames/${frameSlug}`;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  }

  const base =
    "label-caps cursor-pointer bg-primary px-4 py-3 text-on-primary transition-colors hover:bg-action-red disabled:opacity-60";
  const width = variant === "block" ? "w-full" : "";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${base} ${width}`}
    >
      {loading ? "Loading…" : "Design This Frame"}
    </button>
  );
}
