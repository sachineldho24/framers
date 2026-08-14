/**
 * Studio document persistence.
 *
 * The interesting behaviour is the migration fallback: if `document` doesn't
 * exist yet (0008 unrun), the write is not an error — it's a `200` saying the
 * server can't hold it, and the browser keeps the work in localStorage. The
 * editor stays fully usable and the UI says exactly where the work lives.
 *
 * Any other database error is a real 500. That distinction matters: silently
 * treating a genuine failure as "local only" would tell the user their work is
 * safe on a device when it isn't.
 */

import { NextResponse } from "next/server";

import {
  getDesignSession,
  saveDesignDocument,
  type DesignSessionPatch,
} from "@/lib/data/design-sessions";
import { migrateDocument } from "@/lib/studio/document";
import { createClient } from "@/lib/supabase/server";

/** Reject documents that could only be an attempt to fill the column. */
const MAX_DOCUMENT_BYTES = 2_000_000;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function requireOwnedSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: err("unauthorized", "Please sign in.", 401) };

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) {
    return { error: err("not_found", "Session not found.", 404) };
  }
  return { user, session };
}

/** GET — the stored document, or `null` when there isn't one yet. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const owned = await requireOwnedSession(sessionId);
  if (owned.error) return owned.error;

  const raw = owned.session.document;
  // The column may not exist yet, and stored JSON is untrusted either way.
  const doc = raw === undefined || raw === null ? null : migrateDocument(raw);

  return NextResponse.json({
    document: doc,
    version: owned.session.document_version ?? 0,
    printPath: owned.session.print_path ?? null,
    thumbnailPath: owned.session.thumbnail_path ?? null,
  });
}

interface PutBody {
  document?: unknown;
  version?: number;
  printPath?: string | null;
  thumbnailPath?: string | null;
}

/** PUT — replace the stored document. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const owned = await requireOwnedSession(sessionId);
  if (owned.error) return owned.error;
  const { user, session } = owned;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  // Validate through the same coercion the client uses, so a malformed document
  // can never be written and then fail to load.
  const doc = migrateDocument(body.document);
  if (!doc) return err("bad_request", "Invalid document.", 400);

  const serialised = JSON.stringify(doc);
  if (serialised.length > MAX_DOCUMENT_BYTES) {
    return err("too_large", "This design is too large to save.", 413);
  }

  const patch: DesignSessionPatch = {
    document: doc,
    document_version: (session.document_version ?? 0) + 1,
    title: doc.title,
  };

  for (const [key, value] of [
    ["print_path", body.printPath],
    ["thumbnail_path", body.thumbnailPath],
  ] as const) {
    if (value === undefined) continue;
    if (value !== null && !value.startsWith(`${user.id}/`)) {
      return err("forbidden", "Invalid file reference.", 403);
    }
    patch[key] = value;
  }

  try {
    const result = await saveDesignDocument(sessionId, patch);
    if (!result.saved) {
      // Not an error: the schema simply isn't there yet.
      return NextResponse.json({
        persisted: "unavailable",
        reason: result.reason,
      });
    }
    return NextResponse.json({
      persisted: "server",
      version: patch.document_version,
    });
  } catch (e) {
    console.error("[design/session document PUT] failed:", e);
    return err("server_error", "Could not save your design.", 500);
  }
}
