'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { HERO_ORBIT_FRAMES } from '@/lib/storefront-content';

/* "The Stamp" cycles through six real artworks with a clean wipe.
 * The entire artwork stays visible, including lettering along the edges.
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
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const playing = !paused && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

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
    if (!playing) return;
    const id = window.setInterval(() => {
      if (!onScreen.current || document.hidden) return;
      setCycle((c) => c + 1);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const frame = HERO_ORBIT_FRAMES[cycle % HERO_ORBIT_FRAMES.length];

  return (
    <div ref={ref} aria-label="Featured Framers artwork" aria-roledescription="carousel" className="flex h-full w-full flex-col gap-3">
      <div
        key={cycle}
        className={`${playing ? 'stamp-stage' : ''} relative min-h-0 w-full flex-1`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image}
          alt={frame.alt}
          draggable={false}
          className={`${playing ? 'stamp-photo' : ''} absolute inset-0 block h-full w-full object-contain`}
        />
      </div>
      <div className="flex min-h-11 items-center justify-between gap-2 border-t border-outline-variant pt-2">
        <Link href={frame.href} className="min-w-0 truncate py-2 font-label text-[10px] font-bold uppercase text-on-surface-variant hover:text-neon-accent focus-visible:outline-2 focus-visible:outline-neon-accent">{frame.title} <span aria-hidden="true">↗</span></Link>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 font-label text-[10px] tabular-nums text-outline">{String(cycle % HERO_ORBIT_FRAMES.length + 1).padStart(2, '0')} / 06</span>
          <button type="button" aria-label="Previous featured artwork" onClick={() => { setPaused(true); setCycle(c => c + HERO_ORBIT_FRAMES.length - 1); }} className="grid h-11 w-9 place-items-center hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-neon-accent"><ArrowLeft size={16} /></button>
          <button type="button" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} disabled={reducedMotion} onClick={() => setPaused(value => !value)} className="grid h-11 w-9 place-items-center hover:bg-surface-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-neon-accent">{playing ? <Pause size={14} /> : <Play size={14} />}</button>
          <button type="button" aria-label="Next featured artwork" onClick={() => { setPaused(true); setCycle(c => c + 1); }} className="grid h-11 w-9 place-items-center hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-neon-accent"><ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
