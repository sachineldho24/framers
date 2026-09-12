import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DetailTopBar } from "@/components/DetailTopBar";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { UploadArtwork } from "@/components/UploadArtwork";
import { getFrameBySlug } from "@/lib/data/frames";
import { getCurrentUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add Your Artwork — Framers",
};

const TRUST = [
  {
    icon: "local_shipping",
    title: "Fast Shipping",
    body: "Dispatched within 48 hours in protective packaging.",
  },
  {
    icon: "verified",
    title: "Premium Quality",
    body: "Archival-grade 300 GSM paper with 12-color pigment printing.",
  },
  {
    icon: "bolt",
    title: "Made to Order",
    body: "Each frame is printed fresh for your design.",
  },
] as const;

export default async function DesignMethodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/frames/${slug}/design-method`);

  const frame = await getFrameBySlug(slug);
  if (!frame) notFound();

  return (
    <>
      <DetailTopBar />

      <main className="mx-auto w-full max-w-7xl flex-grow px-margin-mobile pb-32 pt-24">
        {/* Header */}
        <div className="mb-12 text-center md:text-left">
          <h1 className="mb-4 text-[28px] uppercase md:text-[32px]">
            Add Your Artwork
          </h1>
          <p className="max-w-2xl text-base text-on-surface-variant">
            Upload your high-resolution file to design your {frame.name}.
          </p>
        </div>

        {/* Upload card */}
        <div className="mb-section max-w-xl">
          <div className="brutalist-shadow card-transition flex h-full flex-col justify-between border-2 border-border-high-contrast bg-surface-muted p-8 hover:bg-surface">
            <UploadArtwork frameId={frame.id} frameSlug={frame.slug} />
          </div>
        </div>

        {/* Trust points */}
        <section className="border-t-2 border-border-high-contrast pt-12">
          <h3 className="label-caps mb-8 text-center uppercase tracking-[0.2em]">
            Why choose Framers?
          </h3>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {TRUST.map((t) => (
              <div
                key={t.title}
                className="flex flex-col items-center border-2 border-border-high-contrast bg-surface-container p-6 text-center"
              >
                <Icon name={t.icon} className="mb-4 text-4xl" />
                <h4 className="label-caps mb-2">{t.title}</h4>
                <p className="text-[14px] text-on-surface-variant">{t.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Visualize */}
        <section className="mt-section grid grid-cols-1 items-center gap-12 border-2 border-border-high-contrast bg-black p-8 text-white md:p-16 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-[28px] uppercase leading-tight">
              Visualize Your Space
            </h2>
            <p className="mb-8 text-on-surface-variant">
              Our high-fidelity mockups show exactly how your design looks in a
              premium frame before you print.
            </p>
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-neon-accent">98%</span>
                <span className="label-caps text-[10px] uppercase">
                  Color Accuracy
                </span>
              </div>
              <div className="h-12 w-px bg-surface-container" />
              <div className="flex flex-col">
                <span className="text-3xl font-black text-neon-accent">48h</span>
                <span className="label-caps text-[10px] uppercase">
                  Dispatch
                </span>
              </div>
            </div>
          </div>
          <div className="brutalist-shadow relative aspect-square overflow-hidden border-4 border-white bg-surface-container-highest">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/work-images/previews/mockups-yamaha-rx100-wall-1.webp"
              alt="Framed poster mockup"
              className="h-full w-full object-cover brightness-90 grayscale transition-all duration-700 hover:grayscale-0"
            />
            <div className="pointer-events-none absolute inset-0 border-[20px] border-border-high-contrast/10" />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
