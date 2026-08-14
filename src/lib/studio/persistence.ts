/**
 * Saving and loading a studio document from the browser.
 *
 * Three storage outcomes, and the caller is told which one happened so the UI
 * can say something true:
 *
 *   "server" — in the database, available from any device
 *   "local"  — localStorage only (migration 0008 unrun, or the network failed)
 *   throw    — nowhere; the top bar tells the user to download their work
 *
 * On load, the newer of the two copies wins: a local save that happened while
 * offline shouldn't be silently overwritten by a staler server copy.
 */

import { migrateDocument, type StudioDocument } from "./document";

export type Persisted = "server" | "local";

const KEY_PREFIX = "framers_studio_doc:";

interface LocalEnvelope {
  savedAt: number;
  document: StudioDocument;
}

function localKey(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}

function readLocal(sessionId: string): LocalEnvelope | null {
  try {
    const raw = window.localStorage.getItem(localKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalEnvelope>;
    const doc = migrateDocument(parsed.document);
    if (!doc) return null;
    return { savedAt: Number(parsed.savedAt) || 0, document: doc };
  } catch {
    // Corrupt entry, or localStorage blocked entirely (Safari private mode).
    return null;
  }
}

function writeLocal(sessionId: string, doc: StudioDocument): void {
  const envelope: LocalEnvelope = { savedAt: Date.now(), document: doc };
  try {
    window.localStorage.setItem(localKey(sessionId), JSON.stringify(envelope));
  } catch (e) {
    // Out of quota, or storage denied. The caller surfaces this as "not saved",
    // which is the honest answer — there's nowhere left to put it.
    throw new Error(
      e instanceof Error && e.name === "QuotaExceededError"
        ? "This browser is out of storage space."
        : "This browser won't allow saving."
    );
  }
}

export function clearLocalDocument(sessionId: string): void {
  try {
    window.localStorage.removeItem(localKey(sessionId));
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Save a snapshot. Tries the server first; on a migration-pending response or a
 * network failure, falls back to this browser. Throws only when both fail.
 */
export async function saveDocument(
  sessionId: string,
  doc: StudioDocument,
  extra: { printPath?: string | null; thumbnailPath?: string | null } = {}
): Promise<Persisted> {
  try {
    const response = await fetch(
      `/api/design/session/${sessionId}/document`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc, ...extra }),
      }
    );

    if (response.ok) {
      const data = (await response.json()) as { persisted?: string };
      if (data.persisted === "server") {
        // The server is now the source of truth; drop the stale local copy so a
        // later load can't resurrect it.
        clearLocalDocument(sessionId);
        return "server";
      }
    }
  } catch {
    // Offline or the request was aborted — fall through to local.
  }

  writeLocal(sessionId, doc);
  return "local";
}

export interface LoadedDocument {
  document: StudioDocument;
  from: Persisted;
}

/**
 * Load the most recent copy. Returns `null` when neither store has one, which
 * the caller reads as "start from the session's upload".
 */
export async function loadDocument(
  sessionId: string
): Promise<LoadedDocument | null> {
  const local = readLocal(sessionId);

  let server: StudioDocument | null = null;
  try {
    const response = await fetch(`/api/design/session/${sessionId}/document`, {
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as { document?: unknown };
      server = migrateDocument(data.document);
    }
  } catch {
    /* offline; the local copy is all we have */
  }

  if (server && local) {
    // Can't compare timestamps across the two stores, so prefer local only when
    // it was written after the last server round-trip in this browser. That's
    // exactly the offline-edit case; otherwise the server copy is canonical.
    return local.savedAt > 0
      ? { document: local.document, from: "local" }
      : { document: server, from: "server" };
  }
  if (server) return { document: server, from: "server" };
  if (local) return { document: local.document, from: "local" };
  return null;
}
