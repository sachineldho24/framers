/**
 * Admin-only: save the studio's current document as a template.
 *
 * There is no conversion step and no draft/publish gate — the document is
 * already exactly what the studio renders (real, independent layers), so
 * what an admin sees on screen is pixel-for-pixel what a customer will load.
 * Saving makes it live immediately.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";
import { sameOrigin } from "@/lib/sameOrigin";
import { createServiceClient } from "@/lib/supabase/server";
import { migrateDocument } from "@/lib/studio/document";
import { TEMPLATE_ASSETS_BUCKET } from "@/lib/studio/templateStorage";

const MAX_NAME = 120;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
  } catch {
    return err("forbidden", "This request is not allowed.", 403);
  }

  const user = await getCurrentUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);
  if (!isAdmin(user)) return err("forbidden", "Admins only.", 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  const rawName = form.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return err("bad_request", "Name this template.", 400);
  if (name.length > MAX_NAME) return err("bad_request", "That name is too long.", 400);

  const rawDocument = form.get("document");
  if (typeof rawDocument !== "string") return err("bad_request", "Missing document.", 400);
  let parsedDocument: unknown;
  try {
    parsedDocument = JSON.parse(rawDocument);
  } catch {
    return err("bad_request", "Invalid document.", 400);
  }
  const document = migrateDocument(parsedDocument);
  if (!document) return err("bad_request", "This design can't be saved as a template.", 400);

  const thumbnail = form.get("thumbnail");
  if (!(thumbnail instanceof File) || thumbnail.size === 0) return err("bad_request", "Missing thumbnail.", 400);
  if (thumbnail.size > MAX_THUMBNAIL_BYTES) return err("too_large", "Thumbnail is too large.", 413);

  const templateId = randomUUID();
  const thumbnailPath = `${templateId}/thumbnail.jpg`;
  const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer());

  const db = createServiceClient();
  const upload = await db.storage
    .from(TEMPLATE_ASSETS_BUCKET)
    .upload(thumbnailPath, thumbnailBuffer, { contentType: "image/jpeg", upsert: false });
  if (upload.error) {
    console.error("[admin/templates POST] thumbnail upload failed:", upload.error);
    return err("storage_error", "Could not store the thumbnail.", 502);
  }

  const { data: row, error: insertError } = await db
    .from("templates")
    .insert({ id: templateId, name, document, thumbnail_path: thumbnailPath, created_by: user.id })
    .select("id")
    .single();
  if (insertError || !row) {
    console.error("[admin/templates POST] insert failed:", insertError);
    return err("server_error", "Could not save this template.", 500);
  }

  return NextResponse.json({
    templateId: row.id,
    thumbnailUrl: db.storage.from(TEMPLATE_ASSETS_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl,
  });
}
