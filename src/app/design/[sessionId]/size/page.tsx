import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DesignerChrome } from "@/components/designer/DesignerChrome";
import { SizeStep } from "@/components/designer/SizeStep";
import { getCurrentUser } from "@/lib/auth-server";
import { getDesignSession } from "@/lib/data/design-sessions";
import { getActiveFrames } from "@/lib/data/frames";
import { getActiveFinishes } from "@/lib/data/finishes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Size — Framers" };

export default async function SizeStepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/design/${sessionId}/size`);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) notFound();

  const [frames, finishes] = await Promise.all([
    getActiveFrames(),
    getActiveFinishes(),
  ]);

  return (
    <>
      <DesignerChrome current="size" sessionId={sessionId} />
      <SizeStep
        sessionId={sessionId}
        designSource={session.design_source}
        frames={frames}
        finishes={finishes}
      />
    </>
  );
}
