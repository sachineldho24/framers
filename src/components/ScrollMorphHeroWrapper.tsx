'use client';

import dynamic from 'next/dynamic';

const ScrollMorphHero = dynamic(
  () => import('./ScrollMorphHero').then((mod) => mod.ScrollMorphHero),
  { ssr: false }
);

export function ScrollMorphHeroWrapper() {
  return <ScrollMorphHero />;
}
