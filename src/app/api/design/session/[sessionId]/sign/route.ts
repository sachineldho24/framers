import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { createSignedUrl } from "@/lib/storage";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Enough for a long editing session without re-signing every few minutes. */
const SIGN_TTL_SECONDS = 3600;

/** One document can reference many uploads, but not an unbounded number. */
const MAX_PATHS = 40;

interface Body {
  paths?: unknown;
}

/**
 * POST /api/design/session/[sessionId]/sign
 *
 * The studio document holds storage *paths*, not URLs — paths survive a reload
 * and a signed URL doesn't. The editor asks for a batch of signed URLs on load
 * and whenever a layer references a path it hasn't seen.
 *
 * Every path must sit under the caller's own folder, which is the same rule
 * Storage RLS enforces on writes. Signing happens with the service role, so
 * this check is what keeps one user from reading another's uploads.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) {
    return err("not_found", "Session not found.", 404);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  if (!Array.isArray(body.paths)) {
    return err("bad_request", "Expected a list of paths.", 400);
  }

  const paths = Array.from(
    new Set(body.paths.filter((p): p is string => typeof p === "string" && p.length > 0))
  );
  if (paths.length > MAX_PATHS) {
    return err("bad_request", `Too many paths (max ${MAX_PATHS}).`, 400);
  }

  const prefix = `${user.id}/`;
  const outside = paths.find((p) => !p.startsWith(prefix));
  if (outside) {
    return err("forbidden", "Invalid image reference.", 403);
  }

  // One bad path shouldn't blank the whole document, so failures are reported
  // per path and the rest still come back signed.
  const urls: Record<string, string> = {};
  const failed: string[] = [];
  await Promise.all(
    paths.map(async (path) => {
      try {
        urls[path] = await createSignedUrl(path, SIGN_TTL_SECONDS);
      } catch {
        failed.push(path);
      }
    })
  );

  return NextResponse.json({ urls, failed, expiresIn: SIGN_TTL_SECONDS });
}
