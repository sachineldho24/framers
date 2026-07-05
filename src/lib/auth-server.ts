import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";

/** Get the current authenticated user (or null) from the server client. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** True if the current request's user is an admin. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  return isAdmin(await getCurrentUser());
}
