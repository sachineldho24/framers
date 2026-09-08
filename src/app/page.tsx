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
            <div className="relative z-20 mx-auto h-[320px] w-full max-w-md sm:h-[380px] md:h-[420px] md:max-w-3xl lg:order-2 lg:h-[min(72svh,620px)] lg:max-w-none">
              <OrbitalAnimationWrapper />
            </div>

            <div className="z-30 mx-auto max-w-xl text-center lg:order-1 lg:mx-0 lg:text-left">
              <h2 className="mb-4 text-[clamp(2rem,8vw,3.75rem)] uppercase leading-[0.94] tracking-[-0.03em] text-primary lg:text-[clamp(3rem,4.2vw,4.5rem)]">
                Frame Anything You Love
              </h2>
              <p className="mx-auto mb-7 max-w-[34rem] text-base leading-relaxed text-on-surface lg:mx-0 lg:text-lg">
                Upload your photo — we print, frame, and ship it to your door.
              </p>
              <Link
                href="/design/start"
                className="brutalist-press inline-flex min-h-12 items-center justify-center border-2 border-primary bg-primary px-10 py-3.5 font-bold uppercase text-on-primary transition-colors hover:bg-action-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-red"
              >
                Start Framing
              </Link>
            </div>
          </div>
        </section>

        <MarqueeBar />

        <ImageGallery />

        <section aria-labelledby="gallery-feature-title" className="bg-surface px-margin-mobile py-section">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.3fr_1fr] md:gap-12">
            <Link href="/gallery" prefetch={false} tabIndex={-1} aria-hidden="true" className="relative block aspect-[6/5] overflow-hidden border-2 border-primary md:aspect-[3/2]">
              <Image src="/gallery-assets/v07/room-0.webp" alt="" fill sizes="(max-width: 768px) calc(100vw - 40px), 60vw" className="object-cover" />
            </Link>
            <div>
              <p className="label-caps mb-4 text-[11px]">Six spaces. Your inspiration.</p>
              <h2 id="gallery-feature-title" className="mb-5 text-[clamp(2rem,4vw,3.5rem)] uppercase leading-[0.96] tracking-tighter">See what a frame can do.</h2>
              <p className="mb-7 max-w-md text-base leading-relaxed">Walk through rooms made for the things we love. Find a little inspiration for your own walls.</p>
              <Link href="/gallery" prefetch={false} className="inline-flex min-h-12 items-center gap-6 border-2 border-primary bg-primary px-6 py-3 font-bold text-on-primary transition-colors hover:bg-action-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-red">Explore the gallery <Icon name="arrow_forward" className="text-xl" /></Link>
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
              Shop by Category
            </h3>
            <div className="mx-auto h-1 w-16 bg-action-red" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3">
            {SHOP_CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="brutalist-shadow group relative aspect-[4/3] w-full max-w-[420px] cursor-pointer overflow-hidden border-2 border-border-high-contrast bg-white sm:max-w-none lg:aspect-[6/5]"
              >
                <Image
                  src={cat.image}
                  alt={cat.alt}
                  fill
                  sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 flex min-h-16 items-center justify-center border-t-2 border-border-high-contrast bg-white px-4 py-3 text-center transition-colors group-hover:bg-primary group-hover:text-white">
                  <span className="font-display text-[clamp(1rem,2vw,1.25rem)] uppercase leading-tight tracking-tighter">
                    {cat.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <Testimonials />

        {/* ── Newsletter ── */}
        <section className="flex flex-col items-center px-margin-mobile py-section">
          <div className="relative w-full overflow-hidden border-2 border-primary bg-primary p-6 text-on-primary md:p-12">
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
                  className="mt-2 bg-white py-3 font-bold uppercase text-primary transition-colors hover:bg-neon-accent"
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
