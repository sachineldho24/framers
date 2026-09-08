'use client';

import { useEffect, useRef, useState } from 'react';
import { HERO_ORBIT_FRAMES } from '@/lib/storefront-content';

/* "The Stamp" — the hero's one job is to show the transformation the product
 * performs: a bare photo wipes in, black moulding slams in from all four edges,
 * and a neon flash locks it. Then it cuts to the next photo.
 *
 * All motion lives in CSS (`stamp-*` classes in globals.css) so it runs off the
 * main thread and holds its frame rate while the rest of the page is still
 * fetching images. React only advances an index every CYCLE_MS; remounting the
 * stage under a new `key` is what restarts the animations. */

const CYCLE_MS = 2200;

export function HeroStamp() {
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useRef(true);
  const [cycle, setCycle] = useState(0);

  // Decode every frame up front so a keyed swap never paints an empty box.
  useEffect(() => {
    for (const frame of HERO_ORBIT_FRAMES) {
      const img = new window.Image();
      img.src = frame.image;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Skipping ticks while off-screen or in a hidden tab is safe because the
  // stage's exit wipe has no forwards fill — a paused cycle rests on a fully
  // visible frame instead of a blank box.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!onScreen.current || document.hidden) return;
      setCycle((c) => c + 1);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  const frame = HERO_ORBIT_FRAMES[cycle % HERO_ORBIT_FRAMES.length];

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <div
        key={cycle}
        className="stamp-stage relative aspect-3/4 h-full shrink-0 [--stamp-m:10px] sm:[--stamp-m:13px] md:[--stamp-m:16px] lg:[--stamp-m:18px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image}
          alt={frame.alt}
          draggable={false}
          className="stamp-photo absolute inset-0 block h-full w-full object-cover"
        />

        {/* The moulding lands ON the print's edge — deliberately no white liner,
            because the rabbet lip covers the artwork edge on the real product. */}
        <div className="stamp-bar stamp-bar-t absolute left-0 top-0 h-[var(--stamp-m)] w-full bg-border-high-contrast" />
        <div className="stamp-bar stamp-bar-r absolute right-0 top-0 h-full w-[var(--stamp-m)] bg-border-high-contrast" />
        <div className="stamp-bar stamp-bar-b absolute bottom-0 left-0 h-[var(--stamp-m)] w-full bg-border-high-contrast" />
        <div className="stamp-bar stamp-bar-l absolute left-0 top-0 h-full w-[var(--stamp-m)] bg-border-high-contrast" />

        <div
          aria-hidden
          className="stamp-flash pointer-events-none absolute inset-[var(--stamp-m)] border-2 border-neon-accent"
        />
      </div>
    </div>
  );
}
