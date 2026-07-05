'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';

/* Self-contained 3D orbital carousel sized to its parent box (the hero card).
 * Frames auto-rotate around a ring; the front frame is largest/opaque, the back
 * ones recede and dim. Drag/swipe horizontally to spin; vertical touch still
 * scrolls the page (touch-action: pan-y). No page scroll-jacking. */

interface OrbitFrameData {
  id: string;
  src: string;
  alt: string;
}

const FRAMES: OrbitFrameData[] = [
  { id: 'hilux', src: '/posters/hilux.jpg', alt: 'Framed Toyota Hilux print' },
  { id: 'venue', src: '/posters/venue.jpg', alt: 'Framed Hyundai Venue print' },
  { id: 'duke', src: '/posters/duke.jpg', alt: 'Framed KTM Duke print' },
  { id: 'bmw', src: '/posters/bmw.jpg', alt: 'Framed BMW M3 print' },
  { id: 'polo', src: '/posters/polo.jpg', alt: 'Framed VW Polo print' },
];
const N = FRAMES.length;

function OrbitFrame({
  data,
  index,
  rotation,
  radiusX,
  frameW,
}: {
  data: OrbitFrameData;
  index: number;
  rotation: MotionValue<number>;
  radiusX: number;
  frameW: number;
}) {
  const base = (index / N) * 360;
  const theta = useTransform(rotation, (r) => ((base + r) * Math.PI) / 180);
  const x = useTransform(theta, (t) => Math.sin(t) * radiusX);
  const depth = useTransform(theta, (t) => Math.cos(t)); // back -1 .. front 1
  const scale = useTransform(depth, (d) => 0.58 + 0.42 * ((d + 1) / 2));
  const opacity = useTransform(depth, (d) => 0.22 + 0.78 * ((d + 1) / 2));
  const zIndex = useTransform(depth, (d) => Math.round((d + 1) * 100));
  const frameH = frameW * 1.4;

  return (
    <motion.div
      style={{
        x,
        scale,
        opacity,
        zIndex,
        width: frameW,
        marginLeft: -frameW / 2,
        marginTop: -frameH / 2,
      }}
      className="absolute left-1/2 top-1/2 will-change-transform"
    >
      {/* brutalist frame: thick black molding + white mat */}
      <div className="border-[5px] border-solid border-border-high-contrast bg-white sm:border-[7px] md:border-[9px]">
        <div className="bg-white p-1 sm:p-1.5 md:p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.src}
            alt={data.alt}
            draggable={false}
            className="block aspect-3/4 w-full border-2 border-border-high-contrast object-cover"
          />
        </div>
      </div>
    </motion.div>
  );
}

export function OrbitalAnimation() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotation = useMotionValue(0);
  const [geo, setGeo] = useState({ radiusX: 108, frameW: 150 });

  const dragging = useRef(false);
  const pending = useRef(false);
  const hovering = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const lastX = useRef(0);

  useEffect(() => {
    const measure = () => {
      const w = ref.current?.clientWidth ?? 360;
      // Scale frame size AND orbit radius with the available width so the arc
      // spreads out on desktop instead of staying tiny + overlapping.
      const frameW = Math.round(Math.max(150, Math.min(255, w * 0.21)));
      const radiusX = Math.round(w * 0.27);
      setGeo({ radiusX, frameW });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Idle auto-rotation (paused while dragging / hovering / reduced-motion).
  useAnimationFrame((_t, delta) => {
    if (reduce || dragging.current || hovering.current) return;
    rotation.set(rotation.get() + (delta / 1000) * 15);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    lastX.current = e.clientX;
    dragging.current = false;
    pending.current = true;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pending.current) return;
    if (!dragging.current) {
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        dragging.current = true;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else if (Math.abs(dy) > 10) {
        pending.current = false; // vertical intent → let the page scroll
        return;
      } else {
        return;
      }
    }
    const ddx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    rotation.set(rotation.get() + ddx * 0.4);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    pending.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      className="relative h-full w-full cursor-grab select-none active:cursor-grabbing"
      style={{ perspective: 1000, touchAction: 'pan-y' }}
    >
      {FRAMES.map((f, i) => (
        <OrbitFrame
          key={f.id}
          data={f}
          index={i}
          rotation={rotation}
          radiusX={geo.radiusX}
          frameW={geo.frameW}
        />
      ))}
    </div>
  );
}
