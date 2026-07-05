"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client for use in Client Components.
 * Reads/writes the auth session from browser cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey
  );
}
