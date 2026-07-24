import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DesignerChrome } from "@/components/designer/DesignerChrome";
import { StartChooser } from "@/components/designer/StartChooser";
import { getCurrentUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Design Your Frame — Framers",
};

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
    <>
      <DesignerChrome current="upload" />
      <main className="mx-auto w-full max-w-5xl px-margin-mobile pb-24 pt-24">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-[32px] uppercase">Design Your Frame</h1>
          <p className="mx-auto max-w-xl text-on-surface-variant">
            Upload your own photo and see it inside the frame. Print-ready,
            made to order.
          </p>
        </div>

        <StartChooser frameId={frameId ?? null} />

        {/* How it works */}
        <section className="mt-section border-t-2 border-black pt-10">
          <h2 className="label-caps mb-8 text-center tracking-[0.2em]">
            How it works
          </h2>
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              ["01", "Upload", "Add your photo — we check it's print-ready."],
              ["02", "Size", "Pick a standard size and see it framed live."],
              ["03", "Frame", "Choose a style + finish, then check out."],
            ].map(([n, t, d]) => (
              <li
                key={n}
                className="border-2 border-black bg-surface-muted p-6"
              >
                <span className="font-display text-[32px] font-black text-action-red">
                  {n}
                </span>
                <h3 className="label-caps mt-2">{t}</h3>
                <p className="mt-2 text-[14px] text-on-surface-variant">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
