/**
 * Commit the studio's output.
 *
 * The browser has already rendered the flattened artwork (same renderer as the
 * on-screen canvas) *and* uploaded it: the bytes go straight to Storage under a
 * signed upload token from `sign-upload`, because a full-page print PNG is far
 * larger than a request body may be (the proxy truncates at 10 MB in dev, Vercel
 * at ~4.5 MB in production). So this route stores nothing — it verifies the two
 * files landed and points the session at them.
 *
 * The paths are derived here from the signed-in user and the session, never read
 * off the request, and `statObject` confirms each one exists before it is
 * recorded: `print_path` is what production prints from, so a path with nothing
 * behind it is worse than a failure the user can retry.
 *
 * Document JSON is saved in the same request so the studio and the print file
 * can't disagree about which version was committed.
 */

import { NextResponse } from "next/server";

import {
  getDesignSession,
  saveDesignDocument,
} from "@/lib/data/design-sessions";
import { statObject } from "@/lib/storage";
import { SESSION_FILES, sessionFilePath } from "@/lib/storage-shared";
import { migrateDocument } from "@/lib/studio/document";
import { createClient } from "@/lib/supabase/server";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface Body {
  document?: unknown;
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

  const printPath = sessionFilePath(user.id, sessionId, "print");
  const thumbnailPath = sessionFilePath(user.id, sessionId, "thumb");

  const [printInfo, thumbInfo] = await Promise.all([
    statObject(printPath),
    statObject(thumbnailPath),
  ]);
  if (!printInfo || !thumbInfo) {
    return err("missing_artwork", "Your artwork didn’t finish uploading.", 409);
  }
  if (
    (printInfo.size ?? 0) > SESSION_FILES.print.maxBytes ||
    (thumbInfo.size ?? 0) > SESSION_FILES.thumb.maxBytes
  ) {
    return err("too_large", "That artwork is too large to save.", 413);
  }

  // Storing the paths needs migration 0008. If it hasn't been run the artwork is
  // still safely uploaded, so this is reported as a partial success rather than
  // a failure — the review step falls back to the raw upload.
  const doc = migrateDocument(body.document);

  try {
    const result = await saveDesignDocument(sessionId, {
      print_path: printPath,
      thumbnail_path: thumbnailPath,
      ...(doc ? { document: doc, title: doc.title } : {}),
      document_version: (session.document_version ?? 0) + 1,
    });
    return NextResponse.json({
      ok: true,
      printPath,
      thumbnailPath,
      persisted: result.saved ? "server" : "unavailable",
      reason: result.reason,
    });
  } catch (e) {
    console.error("[design/session flatten] save failed:", e);
    return err("server_error", "Could not record your artwork.", 500);
  }
}
