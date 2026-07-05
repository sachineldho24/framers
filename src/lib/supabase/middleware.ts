import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { publicEnv } from "@/lib/env";

/**
 * Route protection rules. See plan/04-routes-and-pages.md for auth requirements.
 */
const USER_PROTECTED_PREFIXES = ["/checkout", "/orders", "/design"];
const ADMIN_PREFIXES = ["/admin"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Refreshes the Supabase session on every request and enforces route guards.
 * Returns the (possibly redirecting) response that middleware.ts must return.
 */
export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() refreshes the session. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isUserProtected = matchesPrefix(pathname, USER_PROTECTED_PREFIXES);
  const isAdminRoute = matchesPrefix(pathname, ADMIN_PREFIXES);

  // Unauthenticated user hitting a protected route → /login?next=...
  if (!user && (isUserProtected || isAdminRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Non-admin hitting an admin route → home.
  // Role lives in app_metadata (server-controlled), never user_metadata.
  if (user && isAdminRoute) {
    const role = (user.app_metadata as { role?: string } | null)?.role;
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
