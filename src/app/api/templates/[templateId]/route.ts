/**
 * Customer-facing: one published template's full document, for the studio to
 * load when a customer picks it from the Templates tab.
 *
 * Same RLS-is-the-boundary shape as `GET /api/templates`.
 */

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { studioFlags } from "@/lib/studio/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  if (!studioFlags().templates) return err("not_found", "Templates are not available yet.", 404);
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  const { templateId } = await params;
  if (!UUID.test(templateId)) return err("bad_request", "Invalid reference.", 400);

  const supabase = await createClient();
  const { data, error } = await supabase.from("templates").select("id, name, document").eq("id", templateId).maybeSingle();
  if (error) return err("server_error", "Could not load this template.", 500);
  if (!data) return err("not_found", "Template not found.", 404);

  return NextResponse.json({ id: data.id, name: data.name, document: data.document }, { headers: { "Cache-Control": "no-store" } });
}
