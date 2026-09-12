import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { OrbitalAnimationWrapper } from "@/components/OrbitalAnimationWrapper";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MarqueeBar } from "@/components/MarqueeBar";
import { Icon } from "@/components/Icon";
import { Testimonials } from "@/components/Testimonials";
import ImageGallery from "@/components/ui/image-gallery";
import { SHOP_CATEGORIES } from "@/lib/storefront-content";

export default function HomePage() {
  return (
    <>
      <MobileTopBar />

      <Suspense fallback={null}>
        <ErrorBanner />
      </Suspense>

      <main className="overflow-x-clip pt-16">
        {/* ── Hero: mobile stack, viewport-led desktop split ── */}
        <section className="relative bg-surface px-margin-mobile py-8 sm:py-10 lg:min-h-[calc(100svh-4rem)] lg:px-[clamp(2rem,6vw,6rem)] lg:py-8">
          <div className="mx-auto grid w-full max-w-[1280px] items-center gap-7 grid-cols-1 lg:min-h-[calc(100svh-8rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.78fr)] lg:gap-[clamp(3rem,7vw,8rem)]">
            <div className="relative z-20 mx-auto h-[380px] w-full max-w-md sm:h-[440px] md:h-[480px] md:max-w-3xl lg:order-2 lg:h-[min(72svh,620px)] lg:max-w-none">
              <OrbitalAnimationWrapper />
            </div>

            <div className="z-30 mx-auto max-w-xl text-center lg:order-1 lg:mx-0 lg:text-left">
              <h2 className="mb-4 text-[clamp(2rem,8vw,3.75rem)] uppercase leading-[0.94] tracking-[-0.03em] text-on-background lg:text-[clamp(3rem,4.2vw,4.5rem)]">
                Frame Anything You Love
              </h2>
              <p className="mx-auto mb-7 max-w-[34rem] text-base leading-relaxed text-on-surface lg:mx-0 lg:text-lg">
                Upload your photo — we print, frame, and ship it to your door.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start"><Link
                href="/design/start"
                className="brutalist-press inline-flex min-h-12 items-center justify-center border-2 border-border-high-contrast bg-primary px-10 py-3.5 font-bold uppercase text-on-primary transition-colors hover:bg-action-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-red"
              >
                Start Framing
              </Link>
              <Link href="/works" className="inline-flex min-h-12 items-center gap-3 px-2 font-label text-xs font-bold uppercase text-neon-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent">Our works <Icon name="arrow_forward" className="text-lg" /></Link></div>
            </div>
          </div>
        </section>

        <MarqueeBar />

        <ImageGallery />

        <section aria-labelledby="gallery-feature-title" className="bg-surface px-margin-mobile py-section">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.3fr_1fr] md:gap-12">
            <Link href="/gallery" prefetch={false} tabIndex={-1} aria-hidden="true" className="relative block aspect-[6/5] overflow-hidden border-2 border-border-high-contrast md:aspect-[3/2]">
              <Image src="/gallery-assets/v07/room-0.webp" alt="" fill sizes="(max-width: 768px) calc(100vw - 40px), 60vw" className="object-cover" />
            </Link>
            <div>
              <p className="label-caps mb-4 text-[11px]">Six spaces. Your inspiration.</p>
              <h2 id="gallery-feature-title" className="mb-5 text-[clamp(2rem,4vw,3.5rem)] uppercase leading-[0.96] tracking-tighter">See what a frame can do.</h2>
              <p className="mb-7 max-w-md text-base leading-relaxed">Walk through rooms made for the things we love. Find a little inspiration for your own walls.</p>
              <Link href="/gallery" prefetch={false} className="inline-flex min-h-12 items-center gap-6 border-2 border-border-high-contrast bg-primary px-6 py-3 font-bold text-on-primary transition-colors hover:bg-action-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-red">Explore the gallery <Icon name="arrow_forward" className="text-xl" /></Link>
            </div>
          </div>
        </section>

        {/* ── Shop by Category ── */}
        <section
          id="shop"
          className="scroll-mt-16 bg-surface-container-low px-margin-mobile py-section"
        >
          <div className="mb-8 text-center">
            <h3 className="mb-3 text-[24px] uppercase leading-none tracking-tighter">
              Explore by Category
            </h3>
            <div className="mx-auto h-1 w-16 bg-action-red" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {SHOP_CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="group flex min-w-0 flex-col border border-outline-variant bg-surface transition-colors hover:border-neon-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent"
              >
                <div className="relative aspect-[5/7] w-full">
                <Image
                  src={cat.image}
                  alt={cat.alt}
                  fill
                  sizes="(max-width: 1023px) 45vw, 25vw"
                  className="object-contain p-2 sm:p-3"
                />
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2 border-t border-outline-variant px-3 py-4 transition-colors group-hover:bg-surface-muted sm:px-4">
                  <span className="font-display text-sm font-extrabold uppercase leading-tight tracking-tight sm:text-base">
                    {cat.label}
                  </span>
                  <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">{cat.count} {cat.count === 1 ? "piece" : "pieces"} <span aria-hidden="true" className="float-right text-neon-accent">↗</span></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <Testimonials />

        {/* ── Newsletter ── */}
        <section className="flex flex-col items-center px-margin-mobile py-section">
          <div className="relative w-full overflow-hidden border-2 border-border-high-contrast bg-primary p-6 text-on-primary md:p-12">
            <div className="absolute -right-10 -top-10 opacity-10">
              <Icon name="speed" fill className="text-[150px]" />
            </div>
            <div className="relative z-10 mx-auto max-w-lg text-center">
              <h3 className="mb-2 text-[22px] uppercase text-neon-accent">
                Get Framing Tips
              </h3>
              <p className="mb-6 text-sm opacity-80">
                Join our list for framing inspiration, print care, and ideas
                for making your walls personal.
              </p>
              <form className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="YOUR EMAIL"
                  className="label-caps border-b-2 border-on-primary-container bg-transparent px-2 py-3 text-white placeholder:text-on-primary-container focus:border-neon-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="mt-2 bg-surface-container py-3 font-bold uppercase text-on-background transition-colors hover:bg-neon-accent hover:text-black"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

    </>
  );
}
