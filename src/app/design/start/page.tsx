import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { StartDesign } from "@/components/designer/StartDesign";
import { getCurrentUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Design Your Frame - Framers",
};

/**
 * The designer's front door, and nothing else.
 *
 * This used to be a landing page with a heading, a card to click and a "how it
 * works" strip. The click bought nothing: the upload step it led to is where
 * both ways in actually live - drag a photo onto the drop zone, or open the
 * studio on a blank page. So the URL stays (it is linked from the homepage, the
 * works grid, the product page and the mobile drawer) and the page now just
 * starts the design and hands over.
 *
 * The auth check stays here rather than moving into the client component, so a
 * signed-out visitor is sent to sign in with the frame they came for intact,
 * instead of the starter failing on a 401.
 */
export default async function DesignStartPage({
  searchParams,
}: {
  searchParams: Promise<{ frameId?: string }>;
}) {
  const { frameId } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    const next = `/design/start${frameId ? `?frameId=${frameId}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-margin-mobile">
      <StartDesign frameId={frameId ?? null} />
    </main>
  );
}
