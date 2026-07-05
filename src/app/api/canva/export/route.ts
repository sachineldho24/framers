import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/data/canva-tokens";
import { exportAndWait } from "@/lib/canva";
import {
  createSignedUrl,
  designPaths,
  downloadToBuffer,
  uploadToStorage,
} from "@/lib/storage";

// Exports can take up to ~60s each (run in parallel). Allow headroom.
// On Vercel this requires a plan that supports extended durations.
export const maxDuration = 300;

function errorResponse(
  code: string,
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { error: { code, message }, ...extra },
    { status }
  );
}

/**
 * POST /api/canva/export  { designId }
 *
 * Exports the design as PNG (preview) + PDF (print), stores both in Supabase
 * Storage, and returns a signed preview URL. See plan/06 Flow 1 (steps 24–29)
 * and Flow 5 (timeout handling).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("unauthorized", "Please sign in.", 401);

  let designId: string;
  try {
    const body = (await request.json()) as { designId?: string };
    if (!body.designId) throw new Error("missing designId");
    designId = body.designId;
  } catch {
    return errorResponse("bad_request", "Missing designId.", 400);
  }

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    return errorResponse(
      "canva_reauth",
      "Your Canva session expired. Please reconnect.",
      401,
      { requiresAuth: true }
    );
  }

  const paths = designPaths(user.id, designId);

  try {
    // Kick off both exports concurrently.
    const [pngUrl, pdfUrl] = await Promise.all([
      exportAndWait({ accessToken, designId, format: "png" }),
      exportAndWait({ accessToken, designId, format: "pdf" }),
    ]);

    // Download from the time-limited Canva URLs and persist immediately.
    const [pngBuf, pdfBuf] = await Promise.all([
      downloadToBuffer(pngUrl),
      downloadToBuffer(pdfUrl),
    ]);

    await Promise.all([
      uploadToStorage({
        path: paths.preview,
        body: pngBuf,
        contentType: "image/png",
      }),
      uploadToStorage({
        path: paths.print,
        body: pdfBuf,
        contentType: "application/pdf",
      }),
    ]);

    const previewUrl = await createSignedUrl(paths.preview, 600);

    return NextResponse.json({
      designId,
      previewUrl,
      previewPath: paths.preview,
      printPath: paths.print,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Export failed. Please try again.";
    const isTimeout = message.toLowerCase().includes("timed out");
    return errorResponse(
      isTimeout ? "export_timeout" : "export_failed",
      message,
      isTimeout ? 504 : 502
    );
  }
}
