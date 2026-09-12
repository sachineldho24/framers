"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LATEST_CREATIONS } from "@/lib/storefront-content";
import {
  nearestCreationIndex,
  nextCreationIndex,
} from "@/components/ui/image-gallery-state";

export default function ImageGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileAutoplay, setMobileAutoplay] = useState(false);
  const [mobilePaused, setMobilePaused] = useState(false);
  const mobileTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1023px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMobileAutoplay(mobile.matches && !reducedMotion.matches);

    sync();
    mobile.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!mobileAutoplay || mobilePaused) return;

    const timer = window.setTimeout(() => {
      const next = nextCreationIndex(activeIndex, LATEST_CREATIONS.length);
      scrollToMobileCreation(next);
      setActiveIndex(next);
    }, 3600);

    return () => window.clearTimeout(timer);
  }, [activeIndex, mobileAutoplay, mobilePaused]);

  function scrollToMobileCreation(index: number) {
    const track = mobileTrackRef.current;
    const item = track?.children.item(index);
    if (!(track && item instanceof HTMLElement)) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const centered = item.offsetLeft - (track.clientWidth - item.clientWidth) / 2;
    track.scrollTo({
      left: Math.min(maxScroll, Math.max(0, centered)),
      behavior: "smooth",
    });
  }

  function syncMobileCreation() {
    const track = mobileTrackRef.current;
    if (!track) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const offsets = Array.from(track.children).map((item) => {
      const card = item as HTMLElement;
      return Math.min(
        maxScroll,
        Math.max(0, card.offsetLeft - (track.clientWidth - card.clientWidth) / 2)
      );
    });
    const nearest = nearestCreationIndex(track.scrollLeft, offsets);
    setActiveIndex((current) => (current === nearest ? current : nearest));
  }

  return (
    <section aria-labelledby="latest-creations-title" className="w-full bg-surface py-section">
      <div className="mx-auto max-w-3xl px-margin-mobile text-center">
        <p className="label-caps mb-3 text-action-red">Made by Framers</p>
        <h2 id="latest-creations-title" className="text-[clamp(1.75rem,5vw,3.5rem)] uppercase leading-none tracking-tighter">
          Our Works
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-on-surface-variant sm:text-base">
          Custom artwork for the rides, people, and moments that mean something. A few favourites from our collection.
        </p>
        <Link href="/works" className="label-caps mt-5 inline-flex min-h-11 items-center gap-4 border-b border-neon-accent py-2 text-neon-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent">
          View all works <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <div
        ref={mobileTrackRef}
        onScroll={syncMobileCreation}
        onPointerDown={() => setMobilePaused(true)}
        onPointerUp={() => setMobilePaused(false)}
        onPointerCancel={() => setMobilePaused(false)}
        onMouseEnter={() => setMobilePaused(true)}
        onMouseLeave={() => setMobilePaused(false)}
        onFocusCapture={() => setMobilePaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setMobilePaused(false);
          }
        }}
        aria-label="Latest creations carousel"
        aria-roledescription="carousel"
        className="no-scrollbar mt-9 flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-margin-mobile pb-3 lg:hidden"
      >
        {LATEST_CREATIONS.map((item, index) => (
          <button
            key={item.image}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              scrollToMobileCreation(index);
            }}
            aria-label={`View creation ${index + 1} of ${LATEST_CREATIONS.length}`}
            aria-pressed={activeIndex === index}
            className="relative aspect-square w-[82vw] max-w-[380px] flex-none snap-center overflow-hidden bg-surface-container-low transition-transform duration-500 ease-out motion-reduce:transition-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-action-red sm:w-[46vw]"
          >
            <Image
              src={item.image}
              alt={item.alt}
              fill
              sizes="(max-width: 640px) 82vw, (max-width: 1024px) 46vw, 0px"
              className="object-contain"
            />
            <span className="label-caps absolute bottom-0 left-0 bg-surface px-3 py-2 text-[10px] text-on-background">
              {String(index + 1).padStart(2, "0")} / {LATEST_CREATIONS.length}
            </span>
          </button>
        ))}
      </div>

      <div className="group/works mx-auto mt-10 hidden h-[430px] w-full max-w-[1440px] gap-1 px-margin-mobile lg:flex">
        {LATEST_CREATIONS.map((item, index) => {
          const active = activeIndex === index;

          return (
            <button
              key={item.image}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              aria-label={`View creation ${index + 1} of ${LATEST_CREATIONS.length}`}
              aria-pressed={active}
              style={{ flexGrow: active ? 8 : 1 }}
              className="group relative min-w-0 basis-0 overflow-hidden bg-surface-container-low transition-[flex-grow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none focus-visible:z-20 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-action-red"
            >
              <Image
                src={item.image}
                alt={item.alt}
                fill
                sizes={active ? "55vw" : "8vw"}
                className={`transition-[filter] duration-300 ease-out motion-reduce:transition-none ${
                  active
                    ? "object-contain blur-none brightness-100"
                    : "object-cover group-hover/works:blur-[4px] group-hover/works:brightness-[0.6] group-has-[:focus-visible]/works:blur-[4px] group-has-[:focus-visible]/works:brightness-[0.6]"
                }`}
              />
              <span className={`label-caps absolute bottom-0 left-0 bg-surface px-3 py-2 text-[10px] text-on-background transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}>
                Creation {String(index + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
