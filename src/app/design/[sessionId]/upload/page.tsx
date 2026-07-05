import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DesignerChrome } from "@/components/designer/DesignerChrome";
import { UploadStep } from "@/components/designer/UploadStep";
import { getCurrentUser } from "@/lib/auth-server";
import { getDesignSession } from "@/lib/data/design-sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upload — Framers" };

export default async function UploadStepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/design/${sessionId}/upload`);

  const session = await getDesignSession(sessionId);
  if (!session || session.user_id !== user.id) notFound();

  return (
    <>
      <DesignerChrome current="upload" sessionId={sessionId} />
      <UploadStep sessionId={sessionId} />
    </>
  );
}
