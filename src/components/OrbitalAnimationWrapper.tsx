'use client';

import dynamic from 'next/dynamic';
import { HERO_ORBIT_FRAMES } from '@/lib/storefront-content';

// Client-only: relies on window measurement + animation frames.
// TRIAL: the hero currently runs "The Stamp" (HeroStamp). To go back to the 3D
// orbital carousel, point this import at './OrbitalAnimation' / mod.OrbitalAnimation
// — OrbitalAnimation.tsx is left untouched for exactly that reason.
const HeroMotion = dynamic(
  () => import('./HeroStamp').then((mod) => mod.HeroStamp),
  { ssr: false, loading: () => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={HERO_ORBIT_FRAMES[0].image} alt={HERO_ORBIT_FRAMES[0].alt} fetchPriority="high" className="h-full w-full object-contain" />
  ) },
);

export function OrbitalAnimationWrapper() {
  return <HeroMotion />;
}
