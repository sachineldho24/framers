import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DesignerChrome } from "@/components/designer/DesignerChrome";
import { ReviewStep } from "@/components/designer/ReviewStep";
import { getCurrentUser } from "@/lib/auth-server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { getFrameById } from "@/lib/data/frames";
import { getActiveFrameStyles } from "@/lib/data/frame-styles";
import { getActiveFinishes } from "@/lib/data/finishes";
import { createSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review — Framers" };

const SIGN_TTL_SECONDS = 3600;

export default async function ReviewStepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/design/${sessionId}/review`);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) notFound();
  if (!session.frame_id) redirect(`/design/${sessionId}/size`);

  const [frame, styles, finishes] = await Promise.all([
    getFrameById(session.frame_id),
    getActiveFrameStyles(),
    getActiveFinishes(),
  ]);
  if (!frame) redirect(`/design/${sessionId}/size`);

  const style = styles.find((s) => s.id === session.frame_style_id) ?? null;
  const finish = finishes.find((f) => f.id === session.finish_id) ?? null;

  // Once the studio has been used, its flattened export *is* the artwork — the
  // raw upload is only the source layer inside it. Signed here rather than via
  // `useDesignerImage`, which serves `upload_path` and would show the photo the
  // user started from instead of the one they made.
  let printUrl: string | null = null;
  if (session.print_path) {
    try {
      printUrl = await createSignedUrl(session.print_path, SIGN_TTL_SECONDS);
    } catch {
      printUrl = null;
    }
  }

  return (
    <>
      <DesignerChrome current="review" sessionId={sessionId} />
      <ReviewStep
        sessionId={sessionId}
        frame={frame}
        style={style}
        finish={finish}
        uploadPath={session.upload_path}
        printPath={session.print_path ?? null}
        printUrl={printUrl}
      />
    </>
  );
}
