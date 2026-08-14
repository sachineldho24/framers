"use client";

/**
 * Browser → Storage uploads for a design session's own files.
 *
 * Artwork does not travel through a route handler. A full-page print PNG is tens
 * of megabytes; the dev proxy truncates request bodies at 10 MB (which is what
 * turned Done into a 400 that read like a lost connection) and Vercel caps a
 * function body at roughly 4.5 MB, so the same POST could never have worked in
 * production on a large frame. Instead the server signs a one-shot upload token
 * per file and the bytes go straight to Storage.
 *
 * The token is also what makes an *overwrite* possible: these paths are fixed —
 * pressing Done twice must replace the print file, not leave two — and Storage
 * RLS grants the browser INSERT on its own folder but not UPDATE. Uploading with
 * the user's own key works exactly once per path; with a signed target it works
 * every time.
 */

import { createClient } from "@/lib/supabase/client";
import {
  DESIGN_BUCKET,
  SESSION_FILES,
  type SessionFileKind,
} from "@/lib/storage-shared";

export interface UploadTarget {
  path: string;
  token: string;
}

/** Thrown with a message worth showing. `signedOut` needs a different fix. */
export class SessionUploadError extends Error {
  readonly signedOut: boolean;
  constructor(message: string, signedOut = false) {
    super(message);
    this.name = "SessionUploadError";
    this.signedOut = signedOut;
  }
}

/** Ask the server where this session's files go, and for permission to write. */
export async function requestUploadTargets(
  sessionId: string,
  files: SessionFileKind[]
): Promise<Record<SessionFileKind, UploadTarget>> {
  let res: Response;
  try {
    res = await fetch(`/api/design/session/${sessionId}/sign-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    });
  } catch {
    throw new SessionUploadError("Couldn’t reach the server. Check your connection.");
  }
  if (!res.ok) {
    throw new SessionUploadError(
      "Couldn’t prepare the upload. Please try again.",
      res.status === 401
    );
  }
  const body = (await res.json().catch(() => null)) as {
    targets?: Partial<Record<SessionFileKind, UploadTarget>>;
  } | null;
  const targets = body?.targets;
  const missing = files.find((k) => !targets?.[k]?.token);
  if (!targets || missing) {
    throw new SessionUploadError("Couldn’t prepare the upload. Please try again.");
  }
  return targets as Record<SessionFileKind, UploadTarget>;
}

/** Put the bytes in Storage. Content type comes from the file table, not the caller. */
export async function uploadToTarget(
  kind: SessionFileKind,
  target: UploadTarget,
  body: Blob
): Promise<void> {
  const spec = SESSION_FILES[kind];
  if (body.size === 0) {
    throw new SessionUploadError("The artwork came out empty. Please try again.");
  }
  if (body.size > spec.maxBytes) {
    throw new SessionUploadError("That artwork is too large to save.");
  }
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .uploadToSignedUrl(target.path, target.token, body, {
      contentType: spec.contentType,
    });
  if (error) {
    throw new SessionUploadError("Your artwork couldn’t be uploaded. Please try again.");
  }
}

/** Sign and upload in one step, for callers with everything in hand. */
export async function uploadSessionFiles(
  sessionId: string,
  files: Partial<Record<SessionFileKind, Blob>>
): Promise<Partial<Record<SessionFileKind, string>>> {
  const kinds = Object.keys(files) as SessionFileKind[];
  const targets = await requestUploadTargets(sessionId, kinds);
  await Promise.all(
    kinds.map((kind) => uploadToTarget(kind, targets[kind], files[kind] as Blob))
  );
  return Object.fromEntries(kinds.map((kind) => [kind, targets[kind].path]));
}
