import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DetailTopBar } from "@/components/DetailTopBar";
import { ProductDetail } from "@/components/ProductDetail";
import { getActiveFrames, getFrameBySlug } from "@/lib/data/frames";
import { HERO_ORBIT_FRAMES } from "@/lib/storefront-content";

export const dynamic = "force-dynamic";

const SAMPLES = HERO_ORBIT_FRAMES.map(frame => frame.image);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const frame = await getFrameBySlug(slug);
  if (!frame) return { title: "Frame not found — Framers" };
  return {
    title: `${frame.name} — Framers`,
    description: frame.description ?? undefined,
  };
}

export default async function FrameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [frame, siblings] = await Promise.all([
    getFrameBySlug(slug),
    getActiveFrames(),
  ]);
  if (!frame) notFound();

  // Pick a stable sample image based on the frame's position.
  const idx = Math.max(
    0,
    siblings.findIndex((s) => s.id === frame.id)
  );
  const sampleImage = SAMPLES[idx % SAMPLES.length];

  return (
    <>
      <DetailTopBar />
      <ProductDetail
        frame={frame}
        siblings={siblings}
        sampleImage={sampleImage}
      />
    </>
  );
}
