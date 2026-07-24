import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { createSignedUrl } from "@/lib/storage";

/**
 * GET /api/design/session/[sessionId]/image
 * Returns a short-lived signed URL for the session's working preview image, so
 * the size/frame/review steps can rebuild the preview after a page refresh
 * (the client objectURL is lost on reload).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Resolve which stored object represents this session's preview image.
  const path = session.upload_path;
  if (!path) {
    return NextResponse.json({ url: null });
  }

  try {
    const url = await createSignedUrl(path, 600);
    return NextResponse.json({ url });
  } catch {
    // Not found yet — not an error.
    return NextResponse.json({ url: null });
  }
}
