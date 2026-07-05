import type { User } from "@supabase/supabase-js";

/**
 * Pure, client-safe auth helpers (no server imports).
 *
 * Admin role lives in app_metadata (server-controlled, not user-editable).
 * Always check here, never user_metadata.
 */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = (user.app_metadata as { role?: string } | null)?.role;
  return role === "admin";
}
