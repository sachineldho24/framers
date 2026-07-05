import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DesignerChrome } from "@/components/designer/DesignerChrome";
import { FrameStep } from "@/components/designer/FrameStep";
import { getCurrentUser } from "@/lib/auth-server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { getFrameById } from "@/lib/data/frames";
import { getActiveFrameStyles } from "@/lib/data/frame-styles";
import { getActiveFinishes } from "@/lib/data/finishes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Frame — Framers" };

export default async function FrameStepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/design/${sessionId}/frame`);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) notFound();
  if (!session.frame_id) redirect(`/design/${sessionId}/size`);

  const [frame, styles, finishes] = await Promise.all([
    getFrameById(session.frame_id),
    getActiveFrameStyles(),
    getActiveFinishes(),
  ]);
  if (!frame) redirect(`/design/${sessionId}/size`);

  return (
    <>
      <DesignerChrome current="frame" sessionId={sessionId} />
      <FrameStep
        sessionId={sessionId}
        designSource={session.design_source}
        frame={frame}
        styles={styles}
        finishes={finishes}
      />
    </>
  );
}
