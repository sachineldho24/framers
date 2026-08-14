/** Shared storage constants — safe for both client and server. */
export const DESIGN_BUCKET = "design-exports";

/**
 * The fixed files a design session owns, and what may write them.
 *
 * These are the only paths the browser is ever allowed to write directly, and
 * the table lives here — not at the call sites — because the *server* derives
 * the path from the signed-in user and the session id. The client asks for a
 * file by kind and gets back a path plus a one-shot upload token; it never
 * names a path itself, so there is nothing to tamper with.
 *
 * Fixed names (rather than a uuid per save) are deliberate: pressing Done twice
 * must replace the print file, not accumulate copies the order can't tell apart.
 * That means the upload has to be an upsert — see `signUploadTarget`.
 */
export const SESSION_FILES = {
  /** Studio flatten: the full-page artwork that goes to print. */
  print: {
    name: "print.png",
    contentType: "image/png",
    /** A full-resolution PNG of a 4096px page can legitimately be large. */
    maxBytes: 40 * 1024 * 1024,
  },
  /** Small JPEG of the same artwork, for lists and the order record. */
  thumb: { name: "thumb.jpg", contentType: "image/jpeg", maxBytes: 4 * 1024 * 1024 },
  /** Review's framed composite — what the customer saw when they ordered. */
  mockup: { name: "mockup.png", contentType: "image/png", maxBytes: 8 * 1024 * 1024 },
} as const;

export type SessionFileKind = keyof typeof SESSION_FILES;

export function isSessionFileKind(value: unknown): value is SessionFileKind {
  return typeof value === "string" && value in SESSION_FILES;
}

/**
 * Where a session's file lives. First segment is the user id, which is what the
 * Storage RLS "own folder" policy keys on.
 */
export function sessionFilePath(
  userId: string,
  sessionId: string,
  kind: SessionFileKind
): string {
  return `${userId}/sessions/${sessionId}/${SESSION_FILES[kind].name}`;
}
