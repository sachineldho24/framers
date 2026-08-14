import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { DESIGN_BUCKET } from "@/lib/storage-shared";

export { DESIGN_BUCKET };

/**
 * Storage path layout for an exported design.
 * Keyed by designId at export time (the order doesn't exist yet — it's created
 * after payment, and stores these same paths). First segment is the userId so
 * the RLS "own folder" policy applies.
 */
export function designPaths(userId: string, designId: string) {
  const base = `${userId}/${designId}`;
  return {
    preview: `${base}/preview.png`,
    print: `${base}/print.pdf`,
  };
}

/** Download a (time-limited) remote URL into a Buffer. */
export async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download export (${res.status}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Upload a buffer to the private design-exports bucket (service role). */
export async function uploadToStorage(params: {
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .upload(params.path, params.body, {
      contentType: params.contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

/** Create a short-lived signed URL for a stored object. */
export async function createSignedUrl(
  path: string,
  expiresInSeconds = 300
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Failed to sign URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

/**
 * A one-shot ticket the browser can use to PUT bytes straight into Storage.
 *
 * This exists so large artwork never travels through a route handler: a
 * full-page print PNG is tens of megabytes, which the proxy truncates at 10 MB
 * in dev and Vercel rejects outright in production (~4.5 MB of request body per
 * function invocation). The bytes go browser → Storage; only the paths come back
 * through us.
 *
 * `upsert` has to be set *here*, at signing time, rather than on the upload:
 * the token carries the permission. It matters because these paths are fixed, so
 * every save after the first is an overwrite — and the client's own key can't do
 * it (Storage RLS grants authenticated users INSERT on their own folder, not
 * UPDATE). Signing with the service role is what makes the second Done work.
 */
export async function signUploadTarget(
  path: string
): Promise<{ path: string; token: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new Error(`Failed to sign upload: ${error?.message ?? "unknown"}`);
  }
  return { path, token: data.token };
}

/**
 * Size of a stored object, or `null` if it isn't there.
 *
 * The point is the `null`: once the browser does the uploading, a route that
 * records `print_path` has to check that something is actually behind it rather
 * than take the client's word for it. `size` is `null` when Storage doesn't
 * report it — absent metadata is not evidence of an oversized file.
 */
export async function statObject(
  path: string
): Promise<{ size: number | null } | null> {
  const supabase = createServiceClient();
  const cut = path.lastIndexOf("/");
  const dir = cut < 0 ? "" : path.slice(0, cut);
  const name = path.slice(cut + 1);
  const { data, error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .list(dir, { search: name, limit: 100 });
  if (error || !data) return null;
  // `search` is a substring match, so the exact name still has to be found.
  const hit = data.find((o) => o.name === name);
  if (!hit) return null;
  const size = (hit.metadata as { size?: unknown } | null)?.size;
  return { size: typeof size === "number" ? size : null };
}
