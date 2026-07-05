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
