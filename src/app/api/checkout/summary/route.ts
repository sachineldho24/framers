import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFrameById } from "@/lib/data/frames";
import { createSignedUrl } from "@/lib/storage";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/checkout/summary  { frameId, previewPath? }
 * Returns the authoritative frame price + a short-lived signed preview URL for
 * the design the user is about to buy. Used to render the checkout page.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  let body: { frameId?: string; previewPath?: string | null };
  try {
    body = await request.json();
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }
  if (!body.frameId) return err("bad_request", "Missing frameId.", 400);

  const frame = await getFrameById(body.frameId);
  if (!frame || !frame.is_active) return err("not_found", "Frame not found.", 404);

  // Only sign a preview the user owns.
  let previewUrl: string | null = null;
  if (body.previewPath && body.previewPath.startsWith(`${user.id}/`)) {
    try {
      previewUrl = await createSignedUrl(body.previewPath, 600);
    } catch {
      previewUrl = null;
    }
  }

  return NextResponse.json({
    frame: {
      id: frame.id,
      name: frame.name,
      price_paise: frame.price_paise,
      width_mm: frame.width_mm,
      height_mm: frame.height_mm,
    },
    previewUrl,
  });
}
