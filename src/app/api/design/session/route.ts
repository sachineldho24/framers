import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDesignSession } from "@/lib/data/design-sessions";
import { getFrameById } from "@/lib/data/frames";
import type { DesignSource } from "@/lib/supabase/types";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/design/session  { designSource, frameId? }
 * Creates a working design session for the signed-in user. Returns { sessionId }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  let body: { designSource?: DesignSource; frameId?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  const designSource: DesignSource =
    body.designSource === "canva" ? "canva" : "upload";

  let frameId: string | null = null;
  if (body.frameId) {
    const frame = await getFrameById(body.frameId);
    if (frame && frame.is_active) frameId = frame.id;
  }

  try {
    const session = await createDesignSession({
      userId: user.id,
      designSource,
      frameId,
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (e) {
    console.error("[design/session] create failed:", e);
    return err("server_error", "Could not start your design.", 500);
  }
}
