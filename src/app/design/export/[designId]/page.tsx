import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ExportController } from "@/components/ExportController";
import { getCurrentUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * /design/[designId]?frameId=...
 * The page the user lands on after returning from the Canva editor.
 * Auth is enforced by proxy.ts; we re-check here to satisfy types and to
 * require the frameId needed for checkout.
 */
export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ frameId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { designId } = await params;
  const { frameId } = await searchParams;

  if (!frameId) {
    // Without a frame we can't price the order — send the user to start over.
    redirect("/");
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <ExportController designId={designId} frameId={frameId} />
      </main>
    </>
  );
}
