import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Respects RLS using the logged-in user's session from cookies.
 *
 * Note: in a pure Server Component the cookie `set` calls are no-ops (RSCs
 * cannot write cookies) — middleware handles session refresh. The try/catch
 * swallows the expected error there.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. BYPASSES RLS. Server-only.
 * Use exclusively in trusted server contexts: webhook handler, token upserts,
 * admin operations that must read across users. Never expose to the browser.
 */
export function createServiceClient() {
  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No session persistence for the service client.
        },
      },
    }
  );
}
