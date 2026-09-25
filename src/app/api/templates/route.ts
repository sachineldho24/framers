/**
 * Customer-facing: published templates for the studio's Templates tab.
 *
 * Uses the request's own (RLS-respecting) client rather than the service
 * role — the `templates_active` policy (`is_active = true`) is the real
 * boundary here, this route is just a thin proxy over it.
 */

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { studioFlags } from "@/lib/studio/config";
import { TEMPLATE_ASSETS_BUCKET } from "@/lib/studio/templateStorage";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  if (!studioFlags().templates) return err("not_found", "Templates are not available yet.", 404);
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, thumbnail_path")
    .order("created_at", { ascending: false });
  if (error) return err("server_error", "Could not load templates.", 500);

  const templates = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    thumbnailUrl: supabase.storage.from(TEMPLATE_ASSETS_BUCKET).getPublicUrl(row.thumbnail_path).data.publicUrl,
  }));
  return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
}
