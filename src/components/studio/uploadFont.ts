"use client";

/**
 * "Upload a font" from the Text panel.
 *
 * Same shape as `uploadImage`: pick, validate *before* storing (the browser
 * must be able to parse the file as a face, so a renamed PDF never becomes a
 * stored "font"), then upload under the user's own folder — the prefix Storage
 * RLS and the sign route both key on. Returns the bytes too, so the face is
 * registered from memory and the first use doesn't wait on a signing trip.
 *
 * Licensing is the uploader's responsibility, as in every editor that accepts
 * font files; the picker says so.
 */

import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET } from "@/lib/storage-shared";
import type { CustomFont } from "@/lib/studio/document";
import { FONT_FILE_EXTENSIONS, validateFontFile } from "@/lib/studio/fontLoader";
import { CUSTOM_FONT_PREFIX } from "@/lib/studio/fonts";

const MAX_BYTES = 10 * 1024 * 1024;

/** Browsers often leave `File.type` empty for fonts, so go by extension. */
const CONTENT_TYPES: Record<(typeof FONT_FILE_EXTENSIONS)[number], string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

export class FontUploadError extends Error {}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = FONT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");
    input.style.display = "none";
    document.body.appendChild(input);
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.oncancel = () => finish(null);
    input.onchange = () => finish(input.files?.[0] ?? null);
    input.click();
  });
}

/** "my-brand_font-Bold.ttf" → "My Brand Font Bold". */
export function fontNameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const spaced = base.replace(/([a-z])([A-Z])/g, "$1 $2");
  const titled = spaced.replace(/\b\w/g, (c) => c.toUpperCase());
  return titled.slice(0, 60) || "Uploaded font";
}

/**
 * Pick, validate, upload. Resolves null when the user cancels; throws
 * `FontUploadError` with a message worth showing when something fails.
 */
export async function pickAndUploadFont(): Promise<{ font: CustomFont; data: ArrayBuffer } | null> {
  const file = await pickFile();
  if (!file) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(FONT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new FontUploadError("Please choose a TTF, OTF, WOFF or WOFF2 font file.");
  }
  if (file.size === 0) throw new FontUploadError("That file is empty.");
  if (file.size > MAX_BYTES) throw new FontUploadError("That font is too large (max 10 MB).");

  const data = await file.arrayBuffer();
  try {
    // A copy: FontFace may detach the buffer it parses.
    await validateFontFile(data.slice(0));
  } catch {
    throw new FontUploadError("That file isn't a font this browser can read.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new FontUploadError("Please sign in again to upload fonts.");

  const uploadId = crypto.randomUUID();
  const path = `${user.id}/fonts/${uploadId}.${ext}`;
  const { error } = await supabase.storage.from(DESIGN_BUCKET).upload(path, file, {
    contentType: CONTENT_TYPES[ext as keyof typeof CONTENT_TYPES],
    upsert: false,
  });
  if (error) throw new FontUploadError(`Upload failed: ${error.message}`);

  return {
    font: { id: `${CUSTOM_FONT_PREFIX}${uploadId}`, name: fontNameFromFile(file.name), src: path },
    data,
  };
}
