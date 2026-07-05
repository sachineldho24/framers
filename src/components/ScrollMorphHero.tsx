'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';

/* ───────────────────────────── Data ─────────────────────────────
 * 5 curated, full-bleed automotive poster crops. Ordered so the cleanest art
 * (Toyota Hilux, flat orange neon) lands dead-centre as the hero/front frame
 * the rest of the gallery fans out around.
 */
interface HeroFrame {
  id: string;
  title: string;
  src: string;
}

const HERO_FRAMES: HeroFrame[] = [
  { id: 'polo', title: 'VW Polo', src: '/posters/polo.jpg' },
  { id: 'duke', title: 'KTM Duke', src: '/posters/duke.jpg' },
  { id: 'hilux', title: 'Toyota Hilux', src: '/posters/hilux.jpg' },
  { id: 'venue', title: 'Hyundai Venue', src: '/posters/venue.jpg' },
  { id: 'bmw', title: 'BMW M3', src: '/posters/bmw.jpg' },
];

const N = HERO_FRAMES.length;
const CENTER = Math.floor(N / 2); // 2 (hilux)
const MAX_OFFSET = (N - 1) / 2; // 2

/* ─────────────────── Single gallery-fan frame ───────────────────
 *
 * APPROACH C — GALLERY FAN + PARALLAX.
 *
 * progress 0 → every frame collapsed onto the centre as a single overlapping
 *              STACK (tiny stagger + jitter so it reads as ONE card; centre on
 *              top and fully opaque, flanks tucked behind it).
 *
 * progress 1 → frames spread into a BALANCED, SHALLOW GALLERY ARC — a symmetric
 *              fan, NOT an edge-on 3D ellipse. Each frame sits at its slot:
 *                 x = offset * gapX
 *                 y = (offset^2) * arcDrop   (flanks dip gently below the centre)
 *              The centre/hero frame stays largest, brightest, on top; flanks
 *              scale down a touch and tilt outward like a hand of cards.
 *
 * PARALLAX: flank frames do NOT all arrive at once. Each frame's transforms are
 *           keyframed on its OWN progress window (inner frames lead, outer
 *           frames trail), so the fan opens with depth and the spread feels
 *           weighted rather than rigid. Every property is a per-frame
 *           `useTransform` on the shared scroll MotionValue → zero re-renders.
 */
interface FanFrameProps {
  frame: HeroFrame;
  index: number;
  progress: MotionValue<number>;
  gapX: number;
  arcDrop: number;
}

function FanFrame({ frame, index, progress, gapX, arcDrop }: FanFrameProps) {
  const offset = index - CENTER; // -2 .. +2
  const dist = Math.abs(offset); // 0,1,2  (0 = centre/hero)
  const isCenter = dist === 0;
  const depth = dist / MAX_OFFSET; // 0 (centre) .. 1 (outer)

  // ── Fanned-out end geometry. ──
  const endX = offset * gapX;
  const endY = offset * offset * arcDrop; // parabolic dip → balanced arc
  const endScale = isCenter ? 1 : 1 - depth * 0.18; // gentle, gallery-like
  const endOpacity = isCenter ? 1 : 1 - depth * 0.18;
  const endRotate = offset * 4; // tilt outward like a hand of cards

  // ── Stacked start geometry (single-card pile). ──
  const startX = offset * 6;
  const startY = dist * 4;
  const startRotate = offset * -2;

  // ── PARALLAX: per-frame progress window. ──
  // Inner frames (dist 1) lead and settle early; the outer pair (dist 2) trail.
  // Centre stays put. This staggers arrival so the fan opens with layered depth.
  const lead = depth * 0.18; // outer frames start a touch later (0 / .09 / .18)
  const settle = 0.78 + depth * 0.16; // and finish later (.78 / .87 / .96)

  const x = useTransform(progress, [lead, settle], [startX, endX], { clamp: true });
  const y = useTransform(progress, [lead, settle], [startY, endY], { clamp: true });
  const rotate = useTransform(progress, [lead, settle], [startRotate, endRotate], {
    clamp: true,
  });
  const scale = useTransform(
    progress,
    [lead, settle],
    [isCenter ? 1 : 0.96, endScale],
    { clamp: true },
  );

  // Flanks stay hidden behind the stack at rest, then fade in as the fan opens.
  const opacity = useTransform(
    progress,
    [lead, lead + 0.14, settle],
    isCenter ? [1, 1, 1] : [0, 0.4, endOpacity],
    { clamp: true },
  );

  // Centre painted on top; nearer flanks above farther ones.
  const zIndex = 50 - dist * 10;

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity, zIndex, willChange: 'transform' }}
      className="absolute left-1/2 top-1/2 -ml-[clamp(72px,21.5vw,116px)] -mt-[clamp(96px,28.6vw,155px)]"
    >
      <div
        className={[
          'relative box-border border-solid border-border-high-contrast bg-white',
          // thick brutalist black molding, clamp-sized for mobile → desktop
          'border-[clamp(6px,2.4vw,13px)]',
          // hard 6px offset only on the active centre frame
          isCenter ? 'brutalist-shadow' : '',
        ].join(' ')}
      >
        {/* thin white inner mat — sharp corners, no bevel/glass/blur */}
        <div className="border-[clamp(4px,1.7vw,9px)] border-solid border-white bg-white">
          <div className="relative aspect-3/4 w-[clamp(120px,38vw,206px)] overflow-hidden bg-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.src}
              alt={frame.title}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────── Reduced-motion / SSR static fallback ───────────────
 * No scroll-jacking: a clean responsive brutalist row with the same copy + CTA.
 */
function StaticHero() {
  return (
    <section className="relative w-full overflow-x-hidden bg-surface px-margin-mobile py-section">
      <div className="mx-auto max-w-5xl text-center">
        <p className="label-caps mb-3 text-action-red">Custom Framing · Delivered</p>
        <h1 className="font-display text-[clamp(34px,9vw,76px)] leading-[0.95] text-primary">
          Frame Anything
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-on-surface-variant">
          Upload any photo, poster, or print. We frame it by hand and ship it to
          your door.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="#frames"
            className="brutalist-press inline-block border-2 border-action-red bg-action-red px-12 py-4 font-bold uppercase text-on-primary"
          >
            Start Framing
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {HERO_FRAMES.map((frame) => (
          <div
            key={frame.id}
            className="relative box-border border-[6px] border-solid border-border-high-contrast bg-white"
          >
            <div className="border-[4px] border-solid border-white bg-white">
              <div className="relative aspect-3/4 w-full overflow-hidden bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.src}
                  alt={frame.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────── Main Export ────────────────────────────
 * TALL outer wrapper (~280vh) → inner stage is `sticky top-0` and full svh, so
 * the viewport stays PINNED while scroll progress drives the gallery-fan morph.
 * When the wrapper scrolls past, the page releases to normal flow below.
 */
export function ScrollMorphHero() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Responsive fan geometry (px), clamped HARD so frames never overflow at 360px.
  const [{ gapX, arcDrop }, setGeom] = useState({ gapX: 96, arcDrop: 14 });

  useEffect(() => {
    const computeGeom = () => {
      const w = window.innerWidth;
      // Frame outer width mirrors the clamp() used on the image below.
      const frameW = Math.min(232, Math.max(132, w * 0.42));
      // Per-slot horizontal gap: the two outer frames sit at ±2·gapX, so cap the
      // gap so the outermost frame's far edge stays inside the viewport (− margin).
      const maxGap = Math.max(28, (w - frameW) / 2 / MAX_OFFSET - 6);
      const gx = Math.min(maxGap, w < 640 ? w * 0.2 : Math.min(w * 0.13, 150));
      // Shallow arc: outer frames dip a little below the centre.
      const drop = Math.min(28, gx * 0.18);
      setGeom({ gapX: gx, arcDrop: drop });
    };
    computeGeom();
    window.addEventListener('resize', computeGeom, { passive: true });
    return () => window.removeEventListener('resize', computeGeom);
  }, []);

  // Hooks must run unconditionally; branch on render below.
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });

  // Ease the spread so it feels weighted and completes a touch before the end.
  const progress = useTransform(scrollYProgress, [0, 0.85, 1], [0, 1, 1]);
  // Headline LOCKS IN as the fan completes: subtle rise + brighten, then holds.
  const copyOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.78, 1, 1]);
  const copyY = useTransform(scrollYProgress, [0, 0.6], [10, 0]);
  // Scroll cue fades out as soon as the user starts expanding the stack.
  const cueOpacity = useTransform(scrollYProgress, [0, 0.16], [1, 0]);

  if (reduce) {
    return <StaticHero />;
  }

  return (
    // NOTE: overflow-x-CLIP (not hidden). `overflow-x:hidden` forces overflow-y
    // to compute as `auto`, turning this into a scroll container and BREAKING the
    // sticky pin (the stage scrolls away instead of pinning). `clip` clips
    // horizontally without creating a scroll container, so the pin holds.
    <div
      ref={wrapperRef}
      className="relative w-full overflow-x-clip bg-surface"
      style={{ height: '250vh' }}
    >
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] min-h-[540px] w-full flex-col items-center justify-between overflow-hidden py-[clamp(16px,4vh,48px)]">
        {/* Headline + subtitle (top) — fades / locks in as the fan completes. */}
        <motion.div
          style={{ opacity: copyOpacity, y: copyY }}
          className="relative z-[60] px-margin-mobile pt-[max(env(safe-area-inset-top),4px)] text-center"
        >
          <p className="label-caps mb-2 text-action-red">Custom Framing · Delivered</p>
          <h1 className="font-display text-[clamp(30px,8vw,72px)] leading-[0.92] text-primary">
            Frame Anything
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-on-surface-variant sm:max-w-md sm:text-base">
            Upload any photo, poster, or print. We frame it by hand and ship it to
            your door.
          </p>
        </motion.div>

        {/* Fan stage. Capped width so the gallery never overflows 360px. */}
        <div className="relative z-10 flex w-full max-w-[820px] flex-1 items-center justify-center">
          {HERO_FRAMES.map((frame, index) => (
            <FanFrame
              key={frame.id}
              frame={frame}
              index={index}
              progress={progress}
              gapX={gapX}
              arcDrop={arcDrop}
            />
          ))}
        </div>

        {/* CTA + scroll cue (bottom). */}
        <motion.div
          style={{ opacity: copyOpacity }}
          className="relative z-[60] flex flex-col items-center gap-4 px-margin-mobile pb-[max(env(safe-area-inset-bottom),4px)]"
        >
          <Link
            href="#frames"
            className="brutalist-press inline-block border-2 border-action-red bg-action-red px-10 py-3.5 font-bold uppercase text-on-primary"
          >
            Start Framing
          </Link>
          <motion.span
            style={{ opacity: cueOpacity }}
            className="label-caps flex items-center gap-2 text-on-surface-variant"
          >
            <span className="inline-block h-3 w-px bg-action-red" />
            Scroll to Expand
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}
