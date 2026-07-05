"use client";

import { useEffect, useState } from "react";
import { loadDesignerState } from "@/lib/designer-state";

/**
 * Resolve the working image for a designer session: prefer the in-memory
 * objectURL (set at upload), else fetch a signed URL from the server (after a
 * page refresh, when the objectURL is gone). Returns null for the Canva path
 * before an export exists.
 */
export function useDesignerImage(sessionId: string): {
  imageSrc: string | null;
  loading: boolean;
} {
  // Lazy init from the synchronous sessionStorage store (external state).
  const localUrl =
    typeof window !== "undefined"
      ? (loadDesignerState(sessionId)?.previewObjectUrl ?? null)
      : null;
  const [imageSrc, setImageSrc] = useState<string | null>(localUrl);
  const [loading, setLoading] = useState(localUrl === null);

  useEffect(() => {
    if (localUrl) return; // already have the in-memory objectURL
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/design/session/${sessionId}/image`);
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { url } = (await res.json()) as { url: string | null };
        if (!cancelled) {
          setImageSrc(url);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { imageSrc, loading };
}
