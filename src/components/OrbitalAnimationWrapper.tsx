'use client';

import dynamic from 'next/dynamic';

// Client-only: relies on window measurement + animation frames.
// TRIAL: the hero currently runs "The Stamp" (HeroStamp). To go back to the 3D
// orbital carousel, point this import at './OrbitalAnimation' / mod.OrbitalAnimation
// — OrbitalAnimation.tsx is left untouched for exactly that reason.
const HeroMotion = dynamic(
  () => import('./HeroStamp').then((mod) => mod.HeroStamp),
  { ssr: false },
);

export function OrbitalAnimationWrapper() {
  return <HeroMotion />;
}
