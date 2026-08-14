/**
 * The studio route. Deliberately does NOT render `DesignerChrome` — the editor
 * is full-screen and owns the mockup's own top bar, so the stepper would be a
 * second, competing navigation.
 *
 * Server work is only what the studio can't do in the browser: resolve the
 * session, its frame (which sets the page's aspect ratio), the other sizes for
 * the Resize menu, and a first signed URL for the upload so the artwork paints
 * without waiting on a round-trip.
 *
 * A frame is *not* required to get in. "Open Studio" on the upload step lands
 * here with a session that has neither a photo nor a size, so a missing frame
 * opens a blank A4 page instead of bouncing back to `/size`. Nothing is lost by
 * that: with no frame there is no physical size, so `printSize` is null and the
 * lip guides and DPI readout stand down rather than quoting a frame nobody
 * picked — and the Resize menu (or Custom size) sets one when the user is ready.
 * Review still redirects to `/size`, which is the right place to insist.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { StudioLoader } from "@/components/studio/StudioLoader";
import { getCurrentUser } from "@/lib/auth-server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { getActiveFrames, getFrameById } from "@/lib/data/frames";
import { createSignedUrl } from "@/lib/storage";
import { docSizeForFrame } from "@/lib/studio/document";
import type { FrameSizeOption } from "@/components/studio/StudioTopBar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit your design — Framers" };

const SIGN_TTL_SECONDS = 3600;

/** Portrait A4: the page to start on when no frame has been chosen yet. */
const BLANK_PAGE_MM = { widthMm: 210, heightMm: 297 };

export default async function StudioPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/design/${sessionId}/edit`);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) notFound();

  const frame = session.frame_id ? await getFrameById(session.frame_id) : null;

  const frames = await getActiveFrames();
  const sizes: FrameSizeOption[] = frames.map((f) => ({
    id: f.id,
    label: `${f.name} · ${f.width_mm} × ${f.height_mm} mm`,
    widthMm: f.width_mm,
    heightMm: f.height_mm,
  }));

  const page = frame
    ? docSizeForFrame(frame.width_mm, frame.height_mm)
    : docSizeForFrame(BLANK_PAGE_MM.widthMm, BLANK_PAGE_MM.heightMm);

  // Best-effort: a failure here just means the client signs it itself.
  let uploadUrl: string | null = null;
  if (session.upload_path) {
    try {
      uploadUrl = await createSignedUrl(session.upload_path, SIGN_TTL_SECONDS);
    } catch {
      uploadUrl = null;
    }
  }

  const email = user.email ?? "";
  const initial = (email.trim()[0] ?? "F").toUpperCase();

  return (
    <StudioLoader
      sessionId={sessionId}
      page={page}
      title={session.title ?? (frame ? `${frame.name} design` : "Untitled design")}
      uploadPath={session.upload_path}
      uploadUrl={uploadUrl}
      userInitial={initial}
      sizes={sizes}
      currentSizeId={frame?.id ?? null}
    />
  );
}
