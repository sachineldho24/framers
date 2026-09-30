import "server-only";

import type { User } from "@supabase/supabase-js";

import { isAdmin } from "@/lib/auth";

import { generationMode } from "./providers";

/** Whether `user` may use generation right now, and if not, why. */
export function generationAccess(user: User | null): { ok: true; admin: boolean } | { ok: false; reason: string; status: number } {
  if (!user) return { ok: false, reason: "Please sign in to use AI tools.", status: 401 };
  const admin = isAdmin(user);
  const mode = generationMode();
  if (mode === "off") return { ok: false, reason: "AI generation is switched off.", status: 403 };
  if (mode === "admin" && !admin) return { ok: false, reason: "AI generation is coming soon.", status: 403 };
  return { ok: true, admin };
}
