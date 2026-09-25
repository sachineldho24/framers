"use client";

/**
 * "Add image" from the Uploads panel.
 *
 * Saves into the user's photo library (`uploadLibrary.ts`): a file already
 * there is not uploaded again, and anything new is listed in every later
 * design. Hands back both the stored path — which is what the layer keeps, so
 * it survives a reload — and the in-memory object URL, so the first paint
 * doesn't wait on a signing round-trip.
 *
 * The object URL is deliberately not revoked: it stays alive for the session and
 * `useStudioImages` holds a decoded image from it. It dies with the page.
 */

import { LibraryError, saveToLibrary } from "@/lib/uploadLibrary";

import type { StudioShellUpload } from "./StudioShell";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 30 * 1024 * 1024;

/** Open the OS file picker once and resolve with the chosen file, or null. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.webp";
    input.style.display = "none";
    document.body.appendChild(input);
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    // Fires when the dialog is dismissed without a choice in browsers that
    // support it; the input is dropped either way so nothing leaks.
    input.oncancel = () => finish(null);
    input.onchange = () => finish(input.files?.[0] ?? null);
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
export async function pickAndUploadImage(): Promise<StudioShellUpload | null> {
  const file = await pickFile();
  if (!file) return null;

  if (!ACCEPTED.includes(file.type)) {
    throw new UploadError("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("That image is too large (max 30 MB).");
  }
  if (file.size === 0) throw new UploadError("That file is empty. Please choose another image.");

  // Decode before uploading: corrupt files must never become stored assets.
  const url = URL.createObjectURL(file);
  let natural: { width: number; height: number };
  try {
    natural = await measure(url);
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadError("That file isn't a readable image. Please choose another image.");
  }

  try {
    const saved = await saveToLibrary(file, natural);
    return {
      src: saved.path,
      name: saved.name,
      url,
      naturalWidth: saved.width,
      naturalHeight: saved.height,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof LibraryError ? new UploadError(error.message) : error;
  }
}
