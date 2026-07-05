import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDesignSession,
  updateDesignSession,
  type DesignSessionPatch,
} from "@/lib/data/design-sessions";
import { getFrameById } from "@/lib/data/frames";
import { getFrameStyleById } from "@/lib/data/frame-styles";
import { getFinishById } from "@/lib/data/finishes";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface PatchBody {
  frameId?: string | null;
  frameStyleId?: string | null;
  finishId?: string | null;
  uploadPath?: string | null;
  mockupPath?: string | null;
  cropX?: number;
  cropY?: number;
  cropScale?: number;
}

/**
 * PATCH /api/design/session/[sessionId]
 * Updates the user's working session. Validates FK ids and that any path
 * belongs to the user. RLS guarantees ownership of the session row itself.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) {
    return err("not_found", "Session not found.", 404);
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  const patch: DesignSessionPatch = {};

  if (body.frameId !== undefined) {
    if (body.frameId) {
      const frame = await getFrameById(body.frameId);
      if (!frame || !frame.is_active) return err("bad_request", "Invalid frame.", 400);
      patch.frame_id = frame.id;
    } else {
      patch.frame_id = null;
    }
  }
  if (body.frameStyleId !== undefined) {
    if (body.frameStyleId) {
      const style = await getFrameStyleById(body.frameStyleId);
      if (!style) return err("bad_request", "Invalid frame style.", 400);
      patch.frame_style_id = style.id;
    } else {
      patch.frame_style_id = null;
    }
  }
  if (body.finishId !== undefined) {
    if (body.finishId) {
      const finish = await getFinishById(body.finishId);
      if (!finish) return err("bad_request", "Invalid finish.", 400);
      patch.finish_id = finish.id;
    } else {
      patch.finish_id = null;
    }
  }
  if (body.uploadPath !== undefined) {
    if (body.uploadPath && !body.uploadPath.startsWith(`${user.id}/`)) {
      return err("forbidden", "Invalid upload reference.", 403);
    }
    patch.upload_path = body.uploadPath;
  }
  if (body.mockupPath !== undefined) {
    if (body.mockupPath && !body.mockupPath.startsWith(`${user.id}/`)) {
      return err("forbidden", "Invalid mockup reference.", 403);
    }
    patch.mockup_path = body.mockupPath;
  }
  if (typeof body.cropX === "number") patch.crop_x = body.cropX;
  if (typeof body.cropY === "number") patch.crop_y = body.cropY;
  if (typeof body.cropScale === "number") patch.crop_scale = body.cropScale;

  try {
    const updated = await updateDesignSession(sessionId, patch);
    return NextResponse.json({ ok: true, session: updated });
  } catch (e) {
    console.error("[design/session PATCH] failed:", e);
    return err("server_error", "Could not save your changes.", 500);
  }
}
