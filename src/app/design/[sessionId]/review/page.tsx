import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DesignerChrome } from "@/components/designer/DesignerChrome";
import { ReviewStep } from "@/components/designer/ReviewStep";
import { getCurrentUser } from "@/lib/auth-server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { getFrameById } from "@/lib/data/frames";
import { getActiveFrameStyles } from "@/lib/data/frame-styles";
import { getActiveFinishes } from "@/lib/data/finishes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review — Framers" };

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

  return (
    <>
      <DesignerChrome current="review" sessionId={sessionId} />
      <ReviewStep
        sessionId={sessionId}
        designSource={session.design_source}
        frame={frame}
        style={style}
        finish={finish}
        canvaDesignId={session.canva_design_id}
        uploadPath={session.upload_path}
      />
    </>
  );
}
