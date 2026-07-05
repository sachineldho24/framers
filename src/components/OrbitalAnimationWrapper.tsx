'use client';

import dynamic from 'next/dynamic';

// Client-only: relies on window measurement + animation frames.
const OrbitalAnimation = dynamic(
  () => import('./OrbitalAnimation').then((mod) => mod.OrbitalAnimation),
  { ssr: false },
);

export function OrbitalAnimationWrapper() {
  return <OrbitalAnimation />;
}
