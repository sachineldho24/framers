import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 "proxy" convention (formerly middleware).
 * Runs on every matched request to refresh the Supabase session and enforce
 * route guards. See src/lib/supabase/middleware.ts for the logic.
 *
 * NOTE: the dev-only "localhost → 127.0.0.1" correction is done CLIENT-SIDE in
 * the root layout, not here. A server redirect can't work: Next normalizes the
 * Location header back to a relative path, which loses the host change and loops.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image optimisation files.
     * Auth refresh + route guards are applied in updateSession().
     */
    "/((?!_next/static|_next/image|gallery-assets/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
