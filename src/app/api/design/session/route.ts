import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDesignSession } from "@/lib/data/design-sessions";
import { getActiveFrameStyles } from "@/lib/data/frame-styles";
import { getActiveFinishes } from "@/lib/data/finishes";
import { getFrameById } from "@/lib/data/frames";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/design/session  { frameId? }
 * Creates a working design session for the signed-in user. Returns { sessionId }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  let body: { frameId?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  let frameId: string | null = null;
  if (body.frameId) {
    const frame = await getFrameById(body.frameId);
    if (frame && frame.is_active) frameId = frame.id;
  }

  try {
    // The house moulding and glazing, in catalogue order. Nothing asks the
    // buyer for them - the style step is gone and 0011 made every style the
    // same price - so they are decided here, once, and recorded on the session
    // where Review and the framing bench both read them.
    const [styles, finishes] = await Promise.all([
      getActiveFrameStyles(),
      getActiveFinishes(),
    ]);

    const session = await createDesignSession({
      userId: user.id,
      designSource: "upload",
      frameId,
      frameStyleId: styles[0]?.id ?? null,
      finishId: finishes[0]?.id ?? null,
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (e) {
    console.error("[design/session] create failed:", e);
    return err("server_error", "Could not start your design.", 500);
  }
}
