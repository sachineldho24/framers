/** Admin-only: delete a template and its stored thumbnail. */

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";
import { sameOrigin } from "@/lib/sameOrigin";
import { createServiceClient } from "@/lib/supabase/server";
import { TEMPLATE_ASSETS_BUCKET } from "@/lib/studio/templateStorage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    sameOrigin(request);
  } catch {
    return err("forbidden", "This request is not allowed.", 403);
  }

  const user = await getCurrentUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);
  if (!isAdmin(user)) return err("forbidden", "Admins only.", 403);

  const { templateId } = await params;
  if (!UUID.test(templateId)) return err("bad_request", "Invalid reference.", 400);

  const db = createServiceClient();

  const assets = await db.storage.from(TEMPLATE_ASSETS_BUCKET).list(templateId);
  if (assets.data?.length) {
    await db.storage.from(TEMPLATE_ASSETS_BUCKET).remove(assets.data.map((f) => `${templateId}/${f.name}`));
  }

  const { data, error } = await db.from("templates").delete().eq("id", templateId).select("id").maybeSingle();
  if (error) {
    console.error("[admin/templates DELETE] failed:", error);
    return err("server_error", "Could not delete this template.", 500);
  }
  if (!data) return err("not_found", "Template not found.", 404);

  return NextResponse.json({ ok: true });
}
