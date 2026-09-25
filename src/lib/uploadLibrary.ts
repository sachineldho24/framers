"use client";

/**
 * The signed-in user's photo library (table `user_uploads`, migration 0015).
 *
 * A photo is stored once per user, named by the SHA-256 of its bytes:
 * `{userId}/library/{sha256}.{ext}`. Picking a file that is already in the
 * library — from the upload step or the studio, in this design or any other —
 * skips the upload entirely and hands back the stored path. Each stored photo
 * gets a row, which is what the studio's Uploads panel lists, so a photo
 * uploaded for one design is there in the next.
 *
 * The row is bookkeeping, not the source of truth for the file: if writing it
 * fails (say the migration hasn't been applied yet) the upload still succeeds
 * and the design still works — the photo just won't be listed next time.
 */

import { createClient } from "@/lib/supabase/client";
import type { UserUpload } from "@/lib/supabase/types";
import { DESIGN_BUCKET } from "@/lib/storage-shared";

/** Newest photos the Uploads panel lists. */
export const LIBRARY_LIMIT = 120;

export class LibraryError extends Error {}

/** Hex SHA-256 of a file's bytes. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The storage path a photo gets in the library: content-addressed. */
export function libraryPath(userId: string, sha256: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = (dot > 0 ? fileName.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
  return `${userId}/library/${sha256}.${ext}`;
}

/** A friendlier label than `IMG_2041.jpg`'s extension. */
export function displayName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim().slice(0, 120) || "Image";
}

export interface SavedPhoto {
  /** Storage path — what documents and sessions store. */
  path: string;
  name: string;
  width: number;
  height: number;
  /** True when the file was already in the library and nothing was uploaded. */
  reused: boolean;
}

/**
 * Store a photo in the user's library, or find it there already.
 * `size` is the decoded image size; callers decode first so a corrupt file
 * never becomes a stored asset.
 */
export async function saveToLibrary(
  file: File,
  size: { width: number; height: number }
): Promise<SavedPhoto> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new LibraryError("Please sign in again to add images.");

  const sha256 = await sha256Hex(file);

  // Already in the library: no upload at all.
  const existing = await supabase
    .from("user_uploads")
    .select("path, name, width, height")
    .eq("user_id", user.id)
    .eq("sha256", sha256)
    .maybeSingle();
  if (existing.data) {
    return { ...existing.data, reused: true };
  }

  const path = libraryPath(user.id, sha256, file.name);
  const { error } = await supabase.storage
    .from(DESIGN_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  // Same bytes, same name: a file already there (a row that failed to write
  // last time, another tab racing us) is exactly the file we'd have written.
  const alreadyStored =
    !!error &&
    ((error as { statusCode?: string }).statusCode === "409" || /exist/i.test(error.message));
  if (error && !alreadyStored) throw new LibraryError(`Upload failed: ${error.message}`);

  const name = displayName(file.name);
  const { error: rowError } = await supabase.from("user_uploads").upsert(
    {
      user_id: user.id,
      path,
      sha256,
      name,
      width: size.width,
      height: size.height,
      bytes: file.size,
      content_type: file.type,
    },
    { onConflict: "user_id,sha256", ignoreDuplicates: true }
  );
  if (rowError) console.warn("[uploadLibrary] photo stored but not listed:", rowError.message);

  return { path, name, width: size.width, height: size.height, reused: alreadyStored };
}

/** The user's photos, newest first. Empty (not an error) when unavailable. */
export async function listLibrary(limit = LIBRARY_LIMIT): Promise<UserUpload[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_uploads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[uploadLibrary] could not list photos:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Take a photo out of the library list. The file itself stays: saved designs
 * refer to it by path, and deleting it would blank them.
 */
export async function removeFromLibrary(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_uploads").delete().eq("path", path);
  if (error) throw new LibraryError("Could not remove that photo. Please try again.");
}
