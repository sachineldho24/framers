/**
 * Hand the browser permission to write this session's own artwork files.
 *
 * The studio's print file is a full-page PNG — tens of megabytes — and a route
 * handler is the wrong place for it: the dev proxy truncates request bodies at
 * 10 MB (the flatten POST then failed with a 400 that looked like a network
 * problem) and Vercel caps a function's body at ~4.5 MB, so the same upload
 * would have failed in production on any large frame. The bytes now go straight
 * from the browser to Storage and only paths come back through us.
 *
 * What keeps that safe is that the client asks for a *kind*, not a path: this
 * route derives the path from the signed-in user and the session it owns, so the
 * only thing a caller can influence is which of three fixed files it writes.
 */

import { NextResponse } from "next/server";

import { getDesignSession } from "@/lib/data/design-sessions";
import { signUploadTarget } from "@/lib/storage";
import {
  SESSION_FILES,
  isSessionFileKind,
  sessionFilePath,
  type SessionFileKind,
} from "@/lib/storage-shared";
import { createClient } from "@/lib/supabase/server";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface Body {
  files?: unknown;
}

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

  const requested = Array.isArray(body.files) ? body.files : [];
  const kinds = Array.from(new Set(requested.filter(isSessionFileKind)));
  if (kinds.length === 0 || kinds.length !== requested.length) {
    return err("bad_request", "Unknown file.", 400);
  }

  const targets: Record<string, { path: string; token: string }> = {};
  try {
    await Promise.all(
      kinds.map(async (kind: SessionFileKind) => {
        const path = sessionFilePath(user.id, sessionId, kind);
        targets[kind] = await signUploadTarget(path);
      })
    );
  } catch (e) {
    console.error("[design/session sign-upload] failed:", e);
    return err("server_error", "Could not prepare the upload.", 500);
  }

  return NextResponse.json({
    targets,
    contentTypes: Object.fromEntries(
      kinds.map((kind) => [kind, SESSION_FILES[kind].contentType])
    ),
  });
}
