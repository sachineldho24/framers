import Link from "next/link";
import { Suspense } from "react";
import { OrbitalAnimationWrapper } from "@/components/OrbitalAnimationWrapper";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MobileTopBar } from "@/components/MobileTopBar";
import { BottomNav } from "@/components/BottomNav";
import { MarqueeBar } from "@/components/MarqueeBar";
import { Icon } from "@/components/Icon";
import { getActiveFrames } from "@/lib/data/frames";
import { formatPaise } from "@/lib/format";

// Reads the session cookie via the Supabase server client → dynamic.
export const dynamic = "force-dynamic";

// Curated, clean poster art (copied into /public/posters) — used as sample
// imagery on the product cards / category tiles. The site frames ANY user image;
// these automotive prints are just examples.
const SAMPLES = [
  "/posters/hilux.jpg",
  "/posters/venue.jpg",
  "/posters/duke.jpg",
  "/posters/polo.jpg",
  "/posters/bmw.jpg",
  "/posters/ferrari.jpg",
];

const CATEGORIES = [
  { label: "Photo Frames", image: "/posters/venue.jpg", grayscale: false },
  { label: "Poster Prints", image: "/posters/hilux.jpg", grayscale: true },
  { label: "Custom Art", image: "/posters/duke.jpg", grayscale: false },
];

export default async function HomePage() {
  const frames = await getActiveFrames();
  const arrivals = frames.slice(0, 6);

  return (
    <>
      <MobileTopBar />

      <Suspense fallback={null}>
        <ErrorBanner />
      </Suspense>

      <main className="overflow-x-clip pb-20 pt-16">
        {/* ── Hero: orbital animation card + headline/CTA ── */}
        <section className="relative flex flex-col items-center bg-surface px-margin-mobile pb-12 pt-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-10">
            <span className="font-display absolute -right-20 top-10 select-none text-[180px] leading-none text-on-surface-variant">
              20%
            </span>
          </div>

          {/* Open 3D orbital — no card/box, floats on the surface.
             Grows with the viewport so the arc spreads on desktop. */}
          <div className="relative z-20 mx-auto mb-2 h-[320px] w-full max-w-md sm:mb-4 sm:h-[380px] md:h-[420px] md:max-w-3xl lg:h-[460px] lg:max-w-5xl">
            <OrbitalAnimationWrapper />
          </div>

          <div className="z-30 text-center">
            <p className="label-caps mb-1 text-on-surface-variant">Custom Framing</p>
            <h2 className="mb-2 text-[28px] uppercase leading-none text-primary">
              Frame Anything You Love
            </h2>
            <p className="mb-6 text-base text-on-surface">
              Upload your photo — we print, frame, and ship it to your door.
            </p>
            <Link
              href="/design/start"
              className="brutalist-press inline-block border-2 border-primary bg-primary px-12 py-4 font-bold uppercase text-on-primary"
            >
              Start Framing
            </Link>
          </div>
        </section>

        <MarqueeBar />

        {/* ── New Arrivals: horizontal scroll of real frames ── */}
        <section id="frames" className="py-section">
          <div className="mb-6 px-margin-mobile text-center">
            <h3 className="mb-1 text-[28px] uppercase">New Arrivals</h3>
            <p className="text-sm text-on-surface-variant">
              New frame sizes and styles, added regularly.
            </p>
          </div>

          {arrivals.length === 0 ? (
            <p className="px-margin-mobile text-center text-on-surface-variant">
              No frames available yet. Check back soon.
            </p>
          ) : (
            <div className="no-scrollbar flex gap-6 overflow-x-auto px-margin-mobile pb-4">
              {arrivals.map((frame, i) => (
                <Link
                  key={frame.id}
                  href={`/frames/${frame.slug}`}
                  className="group flex w-[260px] flex-none flex-col items-center"
                >
                  <div className="relative aspect-3/4 w-full overflow-hidden">
                    {i === 0 && (
                      <span className="label-caps absolute left-2 top-2 z-10 bg-primary px-2 py-0.5 text-[9px] text-surface">
                        New
                      </span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={SAMPLES[i % SAMPLES.length]}
                      alt={`${frame.name} sample`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <h4 className="mb-1 text-xs font-bold uppercase">
                      {frame.name}
                    </h4>
                    <p className="label-caps text-[10px] text-on-surface-variant">
                      {formatPaise(frame.price_paise)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Shop by Category ── */}
        <section className="border-y-2 border-border-high-contrast bg-surface-container-low px-margin-mobile py-section">
          <div className="mb-8 text-center">
            <h3 className="mb-3 text-[24px] uppercase leading-none tracking-tighter">
              Shop by Category
            </h3>
            <div className="mx-auto h-1 w-16 bg-action-red" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href="/design/start"
                className="brutalist-shadow group relative aspect-[4/3] cursor-pointer overflow-hidden border-2 border-border-high-contrast bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cat.image}
                  alt={`${cat.label} examples`}
                  className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                    cat.grayscale ? "grayscale group-hover:grayscale-0" : ""
                  }`}
                />
                <div className="absolute inset-x-0 bottom-0 border-t-2 border-border-high-contrast bg-white py-4 text-center transition-colors group-hover:bg-primary group-hover:text-white">
                  <span className="font-display text-[20px] uppercase tracking-tighter">
                    {cat.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Newsletter ── */}
        <section className="flex flex-col items-center px-margin-mobile py-section">
          <div className="relative w-full overflow-hidden border-2 border-primary bg-primary p-6 text-on-primary md:p-12">
            <div className="absolute -right-10 -top-10 opacity-10">
              <Icon name="speed" fill className="text-[150px]" />
            </div>
            <div className="relative z-10 mx-auto max-w-lg text-center">
              <h3 className="mb-2 text-[22px] uppercase text-neon-accent">
                Get Framing Tips &amp; Offers
              </h3>
              <p className="mb-6 text-sm opacity-80">
                Join our list for framing inspiration, new drops, and
                subscriber-only discounts.
              </p>
              <form className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="YOUR EMAIL"
                  className="label-caps border-b-2 border-on-primary-container bg-transparent px-2 py-3 text-white placeholder:text-on-primary-container focus:border-neon-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="mt-2 bg-white py-3 font-bold uppercase text-primary transition-colors hover:bg-neon-accent"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
