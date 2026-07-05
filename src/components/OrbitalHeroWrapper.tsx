'use client';

import dynamic from 'next/dynamic';

const OrbitalHero = dynamic(
  () => import('./OrbitalHero').then((mod) => mod.OrbitalHero),
  { ssr: false }
);

export function OrbitalHeroWrapper() {
  return <OrbitalHero />;
}
