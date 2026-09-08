'use client';

import { useEffect, useRef, useState } from 'react';
import { HERO_ORBIT_FRAMES } from '@/lib/storefront-content';

/* "The Stamp" — the hero cycles through room photographs with a clean wipe.
 * The supplied assets already contain the real frame, so the hero must not draw
 * another synthetic molding around them.
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
        className="stamp-stage relative aspect-3/4 h-full shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image}
          alt={frame.alt}
          draggable={false}
          className="stamp-photo absolute inset-0 block h-full w-full object-cover"
        />

      </div>
    </div>
  );
}
