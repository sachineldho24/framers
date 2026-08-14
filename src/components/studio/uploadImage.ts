"use client";

/**
 * "Add image" from the Uploads panel.
 *
 * Uploads straight from the browser to Storage (the same path shape and RLS
 * folder rule as `UploadStep`), then hands back both the stored path — which is
 * what the layer keeps, so it survives a reload — and the in-memory object URL,
 * so the first paint doesn't wait on a signing round-trip.
 *
 * The object URL is deliberately not revoked: it stays alive for the session and
 * `useStudioImages` holds a decoded image from it. It dies with the page.
 */

import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET } from "@/lib/storage-shared";

import type { StudioShellUpload } from "./StudioShell";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 30 * 1024 * 1024;

/** Open the OS file picker once and resolve with the chosen file, or null. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.webp";
    // Fires when the dialog is dismissed without a choice in browsers that
    // support it; the input is dropped either way so nothing leaks.
    input.oncancel = () => resolve(null);
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function measure(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("That file isn't a readable image."));
    img.src = url;
  });
}

export class UploadError extends Error {}

/**
 * Pick, validate, upload. Returns null when the user cancels; throws
 * `UploadError` with a message worth showing when something actually fails.
 */
export async function pickAndUploadImage(
  sessionId: string
): Promise<StudioShellUpload | null> {
  const file = await pickFile();
  if (!file) return null;

  if (!ACCEPTED.includes(file.type)) {
    throw new UploadError("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("That image is too large (max 30 MB).");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UploadError("Please sign in again to add images.");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const uploadId = crypto.randomUUID();
  // First segment must be the user id — that's what the storage RLS policy keys
  // on. Nested under the session so a design's images stay together.
  const path = `${user.id}/sessions/${sessionId}/${uploadId}.${ext}`;

  const { error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new UploadError(`Upload failed: ${error.message}`);

  const url = URL.createObjectURL(file);
  const natural = await measure(url);

  return {
    src: path,
    name: file.name.replace(/\.[^.]+$/, "") || "Image",
    url,
    naturalWidth: natural.width,
    naturalHeight: natural.height,
  };
}
