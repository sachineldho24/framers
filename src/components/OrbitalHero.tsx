'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useAnimationFrame,
  useTransform,
  animate,
  type MotionValue,
} from 'motion/react';
import { Sparkles, BadgeInfo } from 'lucide-react';

/* ───────────────────────────── Data ───────────────────────────── */

interface HeroPoster {
  id: string;
  title: string;
  subTitle: string;
  tag: string;
  accentColor: string;
  src: string;
}

const HERO_POSTERS: HeroPoster[] = [
  {
    id: 'gearup',
    title: 'GEAR UP',
    subTitle: 'Yamaha R6 — Supersport Legend',
    tag: 'EXHIBITION 01',
    accentColor: '#EF4444',
    src: '/hero-posters/01.jpg',
  },
  {
    id: 'bmw',
    title: 'BMW M3',
    subTitle: 'M Performance Coupe Edition',
    tag: 'EXHIBITION 02',
    accentColor: '#EAB308',
    src: '/hero-posters/11.jpg',
  },
  {
    id: 'duke',
    title: 'KTM DUKE',
    subTitle: '250 — Ready to Race',
    tag: 'EXHIBITION 03',
    accentColor: '#FF6B00',
    src: '/hero-posters/15.jpg',
  },
  {
    id: 'hilux',
    title: 'TOYOTA HILUX',
    subTitle: 'TRD 4×4 Off-Road Pro',
    tag: 'EXHIBITION 04',
    accentColor: '#F97316',
    src: '/hero-posters/19.jpg',
  },
  {
    id: 'venue',
    title: 'HYUNDAI VENUE',
    subTitle: 'Crossover N-Line Edition',
    tag: 'EXHIBITION 05',
    accentColor: '#EF4444',
    src: '/hero-posters/24.jpg',
  },
];

/* ───────────────────────── Dust Particles ──────────────────────── */

function DustParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let h = (canvas.height = canvas.parentElement?.clientHeight || 900);

    const particles: Array<{
      x: number; y: number; r: number;
      vx: number; vy: number;
      alpha: number; alphaSpeed: number;
    }> = [];

    for (let i = 0; i < 42; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -Math.random() * 0.22 - 0.04,
        alpha: Math.random() * 0.45 + 0.08,
        alphaSpeed: (Math.random() * 0.004 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      });
    }

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) { w = canvas.width = parent.clientWidth; h = canvas.height = parent.clientHeight; }
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = h;
        p.alpha += p.alphaSpeed;
        if (p.alpha > 0.55 || p.alpha < 0.08) p.alphaSpeed = -p.alphaSpeed;
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, p.alpha * 0.25)})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', handleResize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-40" />;
}

/* ──────────────────── Individual Carousel Card ─────────────────── */

interface OrbitalCardProps {
  poster: HeroPoster;
  index: number;
  rotation: MotionValue<number>;
  totalCount: number;
  containerWidth: number;
  onCenter: (index: number) => void;
  isHoveredOrbit: boolean;
  setIsHoveredOrbit: (h: boolean) => void;
  isCentered: boolean;
  isDragging: boolean;
}

function OrbitalCard({
  poster, index, rotation, totalCount, containerWidth,
  onCenter, isHoveredOrbit, setIsHoveredOrbit, isCentered, isDragging,
}: OrbitalCardProps) {
  const [localHover, setLocalHover] = useState(false);
  const sectorAngle = 360 / totalCount;

  const cardAngle = useTransform(rotation, (rot) => {
    const angle = index * sectorAngle + rot;
    return ((angle + 180) % 360 + 360) % 360 - 180;
  });

  const x = useTransform(cardAngle, (angle) => {
    const rx = Math.min(500, containerWidth * 0.43);
    return Math.sin((angle * Math.PI) / 180) * rx;
  });

  const y = useTransform(cardAngle, (angle) => {
    return (1 - Math.cos((angle * Math.PI) / 180)) * 26;
  });

  const z = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= sectorAngle) return -(absAngle / sectorAngle) * 80;
    if (absAngle <= sectorAngle * 2) {
      const progress = (absAngle - sectorAngle) / sectorAngle;
      return -80 - progress * 100;
    }
    const progress = (absAngle - sectorAngle * 2) / (180 - sectorAngle * 2);
    return -180 - progress * 140;
  });

  const rotateY = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    let r = 0;
    if (absAngle <= sectorAngle) r = (absAngle / sectorAngle) * 12;
    else if (absAngle <= sectorAngle * 2) {
      const progress = (absAngle - sectorAngle) / sectorAngle;
      r = 12 + progress * 12;
    } else {
      const progress = (absAngle - sectorAngle * 2) / (180 - sectorAngle * 2);
      r = 24 + progress * 10;
    }
    return angle < 0 ? r : -r;
  });

  const scale = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= sectorAngle) return 1.0 - (absAngle / sectorAngle) * 0.1;
    if (absAngle <= sectorAngle * 2) {
      const progress = (absAngle - sectorAngle) / sectorAngle;
      return 0.9 - progress * 0.15;
    }
    const progress = (absAngle - sectorAngle * 2) / (180 - sectorAngle * 2);
    return Math.max(0.48, 0.75 - progress * 0.22);
  });

  const opacity = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= sectorAngle) return 1.0 - (absAngle / sectorAngle) * 0.15;
    if (absAngle <= sectorAngle * 2.2) {
      const progress = (absAngle - sectorAngle) / (sectorAngle * 1.2);
      return 0.85 - progress * 0.45;
    }
    if (absAngle <= sectorAngle * 3.0) {
      const progress = (absAngle - sectorAngle * 2.2) / (sectorAngle * 0.8);
      return Math.max(0, 0.4 - progress * 0.4);
    }
    return 0;
  });

  const zIndex = useTransform(cardAngle, (angle) => Math.round(150 - Math.abs(angle)));

  return (
    <motion.div
      style={{ x, y, z, rotateY, scale, opacity, zIndex, transformStyle: 'preserve-3d' }}
      className="absolute flex items-center justify-center cursor-pointer pointer-events-auto select-none"
    >
      <motion.div
        onMouseEnter={() => { setIsHoveredOrbit(true); setLocalHover(true); }}
        onMouseLeave={() => { setIsHoveredOrbit(false); setLocalHover(false); }}
        onClick={(e) => { if (isDragging) { e.preventDefault(); e.stopPropagation(); return; } onCenter(index); }}
        whileHover={{ scale: 1.05, z: 50, y: -15 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 1 }}
        className={`relative overflow-hidden transition-all duration-500 bg-surface orbital-hero-card ${
          localHover
            ? 'shadow-[0_30px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/10'
            : isCentered
              ? 'shadow-[0_20px_40px_rgba(0,0,0,0.18)]'
              : 'shadow-[0_10px_25px_rgba(0,0,0,0.12)]'
        }`}
      >
        {/* Museum Framing */}
        <div
          className={`relative flex items-center justify-center transition-all duration-700 border-solid ${
            isCentered
              ? 'border-[10px] sm:border-[16px] border-zinc-900'
              : 'border-[10px] sm:border-[16px] border-zinc-900'
          } p-2.5 sm:p-5 bg-zinc-50`}
        >
          {/* Bevel inset shadows */}
          <div className="absolute inset-0 border border-black/35 pointer-events-none z-10" />
          <div className="absolute inset-[8px] sm:inset-[12px] border border-stone-400/20 pointer-events-none z-10" />

          {/* Poster Image */}
          <div className="relative w-[125px] sm:w-[150px] aspect-[3/4] overflow-hidden bg-stone-100 shadow-[inset_0_2px_10px_rgba(0,0,0,0.18)]">
            <div className="absolute inset-0 border border-stone-300 p-0.5 flex items-center justify-center bg-stone-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poster.src}
                alt={poster.title}
                className="absolute inset-0 w-full h-full object-cover z-0"
                draggable={false}
              />

              {/* Museum glass reflections */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.12] mix-blend-overlay z-20 pointer-events-none" />
              <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[linear-gradient(45deg,transparent_45%,rgba(255,255,255,0.06)_48%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.02)_52%,transparent_55%)] pointer-events-none z-[22]" />
              <div className="absolute inset-0 shadow-[inset_0_4px_12px_rgba(0,0,0,0.3)] z-[25] pointer-events-none" />
            </div>

            {/* Spotlight glow */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/10 via-white/[0.02] to-transparent opacity-60 pointer-events-none z-[18]" />
          </div>
        </div>

        {/* Spotlight badge */}
        {isCentered && (
          <div className="absolute top-2.5 right-2.5 z-40 bg-surface/90 border border-outline-variant text-on-surface-variant text-[6.5px] font-mono tracking-widest px-1.5 py-0.5 uppercase flex items-center gap-1 orbital-hero-badge">
            <span className="w-1 h-1 bg-neon-accent animate-pulse orbital-hero-dot" />
            Spotlight
          </div>
        )}

        {/* Glassmorphism Title HUD on hover */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: localHover ? 1 : 0, y: localHover ? 0 : 15 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="absolute inset-x-2 bottom-2 z-30 orbital-glass-panel bg-surface/90 backdrop-blur-md px-3 py-2 border border-outline-variant shadow-lg flex items-center justify-between pointer-events-none"
        >
          <div className="text-left">
            <span className="text-[7px] font-mono text-on-background font-bold uppercase tracking-widest leading-none block">{poster.tag}</span>
            <span className="text-[10px] font-bold text-on-background mt-0.5 leading-none block" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{poster.title}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant">Custom</span>
            <span className="text-[6.5px] text-on-surface-variant block leading-none">Framed Print</span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────── Main Export ──────────────────────────── */

export function OrbitalHero() {
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isHoveredOrbit, setIsHoveredOrbit] = useState(false);
  const [isAnimatingToCenter, setIsAnimatingToCenter] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartRotationRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const centerPoster = HERO_POSTERS[activeIndex] || HERO_POSTERS[0];

  // Continuous rotation motion value
  const rotation = useMotionValue(0);

  // Parallax tilt springs
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springConfig = { damping: 48, stiffness: 55, mass: 2.2 };
  const smoothTiltX = useSpring(tiltX, springConfig);
  const smoothTiltY = useSpring(tiltY, springConfig);

  // Sweep entrance animation
  useEffect(() => {
    activeAnimRef.current = animate(rotation, [110, 0], {
      type: 'spring',
      stiffness: 42,
      damping: 14,
      mass: 1.5,
      onComplete: () => setIsAnimatingToCenter(false),
    });

    return () => {
      if (activeAnimRef.current) activeAnimRef.current.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Responsive container width
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync active index from rotation
  useEffect(() => {
    const n = HERO_POSTERS.length;
    const sector = 360 / n;
    const unsubscribe = rotation.on('change', (latest) => {
      const itemIdx = Math.round(-latest / sector);
      const normalisedIndex = ((itemIdx % n) + n) % n;
      setActiveIndex(normalisedIndex);
    });
    return () => unsubscribe();
  }, [rotation]);

  // Auto-rotation loop
  useAnimationFrame((_time, delta) => {
    if (isHoveredOrbit || isAnimatingToCenter) return;
    const degreesPerMs = 360 / 24000;
    rotation.set(rotation.get() - degreesPerMs * delta);
  });

  // Center a targeted poster
  const handleCenterPoster = useCallback((targetIndex: number) => {
    setIsAnimatingToCenter(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const n = HERO_POSTERS.length;
    const sector = 360 / n;
    const targetAngle = -targetIndex * sector;
    const currentAngle = rotation.get();
    const nearestAngle = targetAngle + Math.round((currentAngle - targetAngle) / 360) * 360;

    if (activeAnimRef.current) activeAnimRef.current.stop();

    activeAnimRef.current = animate(rotation, nearestAngle, {
      type: 'spring',
      stiffness: 65,
      damping: 20,
      mass: 1.1,
      onComplete: () => {
        timeoutRef.current = window.setTimeout(() => setIsAnimatingToCenter(false), 8500);
      },
    });
  }, [rotation]);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (activeAnimRef.current) activeAnimRef.current.stop();

    isDraggingRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartRotationRef.current = rotation.get();
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    setIsAnimatingToCenter(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const deltaX = e.clientX - dragStartXRef.current;
    if (!isDraggingRef.current && Math.abs(deltaX) > 4) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }
    if (isDraggingRef.current) {
      const sensitivity = 500;
      const degrees = (deltaX / containerWidth) * sensitivity;
      rotation.set(dragStartRotationRef.current + degrees);

      const now = performance.now();
      const dt = now - lastTimeRef.current;
      if (dt > 0) {
        const dx = e.clientX - lastXRef.current;
        const instantV = (dx / dt) * (sensitivity / containerWidth);
        velocityRef.current = velocityRef.current * 0.55 + instantV * 0.45;
      }
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;
    setTimeout(() => setIsDragging(false), 45);

    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}

    if (wasDragging) {
      const v = velocityRef.current;
      const sector = 360 / HERO_POSTERS.length;
      const targetRot = rotation.get() + v * 240;
      const alignedSnap = Math.round(targetRot / sector) * sector;

      if (activeAnimRef.current) activeAnimRef.current.stop();

      activeAnimRef.current = animate(rotation, alignedSnap, {
        type: 'spring',
        stiffness: 48,
        damping: 18,
        mass: 1.1,
        velocity: v * 12,
        onComplete: () => {
          const finalRot = rotation.get();
          const nearestIdx = Math.round(-finalRot / sector);
          const normIdx = ((nearestIdx % HERO_POSTERS.length) + HERO_POSTERS.length) % HERO_POSTERS.length;
          setActiveIndex(normIdx);
          timeoutRef.current = window.setTimeout(() => setIsAnimatingToCenter(false), 8500);
        },
      });
    }
  };

  // Mouse tilt parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(normY * 4.2);
    tiltY.set(-normX * 4.2);
  };

  const handleMouseLeave = () => { tiltX.set(0); tiltY.set(0); setIsHoveredOrbit(false); };

  // Scroll/wheel handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 4 || isDraggingRef.current) return;

    if (activeAnimRef.current) activeAnimRef.current.stop();
    setIsAnimatingToCenter(true);

    const newRot = rotation.get() - delta * 0.14;
    rotation.set(newRot);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const finalRot = rotation.get();
      const sector = 360 / HERO_POSTERS.length;
      const nearestIdx = Math.round(-finalRot / sector);
      const normIdx = ((nearestIdx % HERO_POSTERS.length) + HERO_POSTERS.length) % HERO_POSTERS.length;
      handleCenterPoster(normIdx);
    }, 450);
  }, [rotation, handleCenterPoster]);

  // Window scroll parallax
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleWindowScroll = () => {
      if (isDraggingRef.current) return;
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollYRef.current;
      lastScrollYRef.current = currentScrollY;
      if (Math.abs(diff) < 0.5) return;

      if (activeAnimRef.current && !isAnimatingToCenter) activeAnimRef.current.stop();
      setIsAnimatingToCenter(true);

      const newRotation = rotation.get() - diff * 0.11;
      rotation.set(newRotation);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        const finalRot = rotation.get();
        const sector = 360 / HERO_POSTERS.length;
        const nearestIdx = Math.round(-finalRot / sector);
        const normIdx = ((nearestIdx % HERO_POSTERS.length) + HERO_POSTERS.length) % HERO_POSTERS.length;
        handleCenterPoster(normIdx);
      }, 700);
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [rotation, isAnimatingToCenter, handleCenterPoster]);

  return (
    <div className="orbital-hero relative w-full bg-background text-on-background min-h-[860px] md:min-h-[960px] overflow-hidden flex flex-col items-center py-16">

      {/* Backing spotlight */}
      <div
        className="absolute top-[35%] md:top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[680px] md:h-[680px] z-0 pointer-events-none opacity-15 blur-3xl transition-colors duration-1000 orbital-hero-spotlight"
        style={{ background: `radial-gradient(circle, ${centerPoster.accentColor} 0%, transparent 68%)` }}
      />

      {/* Flanking columns */}
      <div className="absolute left-[6%] inset-y-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none hidden md:block z-0" />
      <div className="absolute right-[6%] inset-y-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none hidden md:block z-0" />

      {/* Dust particles */}
      <DustParticles />

      {/* Exhibition Header */}
      <div className="relative z-20 text-center max-w-4xl px-6 mb-12 flex flex-col items-center select-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-outline-variant bg-surface/70 backdrop-blur-md mb-6 orbital-hero-pill"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-on-surface-variant">Premium Gallery Exhibition</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-[5rem] font-bold tracking-tight text-on-background leading-[1.05] max-w-3xl"
          style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
        >
          Elegance, Raised to<br />
          <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 via-zinc-100 to-zinc-400">
            Gallery Standard
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.3 }}
          className="mt-6 text-xs sm:text-sm text-on-surface-variant max-w-xl tracking-wide leading-relaxed"
          style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
        >
          An interactive, three-dimensional physical showcase. Drag, swipe, or scroll to explore masterwork poster prints in cinematic 3D framing.
        </motion.p>
      </div>

      {/* 3D Carousel Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={() => setIsHoveredOrbit(true)}
        onWheel={handleWheel}
        className="relative w-full max-w-[1400px] h-[370px] sm:h-[480px] flex items-center justify-center z-20 overflow-visible px-4 my-4 group cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ perspective: 1800, transformStyle: 'preserve-3d' }}
      >
        <motion.div
          style={{
            rotateX: smoothTiltX,
            rotateY: smoothTiltY,
            transformStyle: 'preserve-3d',
            perspective: 1800,
          }}
          className="relative w-full h-full flex items-center justify-center pointer-events-none"
        >
          {HERO_POSTERS.map((poster, index) => (
            <OrbitalCard
              key={poster.id}
              poster={poster}
              index={index}
              rotation={rotation}
              totalCount={HERO_POSTERS.length}
              containerWidth={containerWidth}
              onCenter={handleCenterPoster}
              isHoveredOrbit={isHoveredOrbit}
              setIsHoveredOrbit={setIsHoveredOrbit}
              isCentered={activeIndex === index}
              isDragging={isDragging}
            />
          ))}
        </motion.div>
      </div>

      {/* Interaction hint */}
      <div className="relative z-30 flex items-center justify-center gap-2 mt-4 mb-8 select-none">
        <div className="flex items-center gap-2 bg-surface/70 backdrop-blur-md border border-outline-variant px-4 py-1.5 text-[9px] font-mono text-on-surface-variant tracking-widest uppercase shadow-sm select-none orbital-hero-pill">
          <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse orbital-hero-dot" />
          <span>Drag, Swipe, or Scroll to Spin</span>
        </div>
      </div>

      {/* Metadata HUD Card */}
      <div className="relative z-30 w-full max-w-2xl px-6 mb-10 min-h-[150px] flex justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={centerPoster.id}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            className="w-full orbital-glass-panel bg-surface/80 border border-outline-variant p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start gap-6 shadow-xl relative overflow-hidden"
          >
            {/* Decorative spotlight */}
            <div
              className="absolute top-0 right-0 w-44 h-44 pointer-events-none blur-2xl opacity-15 orbital-hero-spotlight"
              style={{ background: centerPoster.accentColor }}
            />

            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold tracking-widest text-on-background uppercase bg-surface-container px-2 py-0.5 leading-none block orbital-hero-badge">
                  {centerPoster.tag}
                </span>
              </div>
              <h3
                className="text-xl sm:text-2xl font-bold text-on-background mt-3.5 tracking-tight leading-none"
                style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
              >
                {centerPoster.title}
              </h3>
              <p className="text-xs sm:text-sm italic text-on-surface-variant mt-1" style={{ fontFamily: 'var(--font-display), Georgia, serif' }}>
                {centerPoster.subTitle}
              </p>
              <p className="text-xs text-on-surface-variant mt-4 leading-relaxed max-w-md" style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
                A custom curated design print rendered using premium matte photography. Crafted securely in museum glass with professional acid-free backing mounts.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end justify-between h-full min-h-[90px] w-full md:w-auto border-t md:border-t-0 md:border-l border-outline-variant pt-4 md:pt-0 md:pl-6 self-stretch">
              <div className="text-left md:text-right">
                <span className="text-[8px] font-mono text-on-surface-variant uppercase tracking-widest leading-none block">Custom Framing</span>
                <span className="text-2xl font-mono font-black text-on-background mt-1.5 block">From ₹300</span>
                <span className="text-[8px] text-emerald-600 font-mono mt-1 block">In stock / Ships across India</span>
              </div>

              <div className="flex items-center gap-2 mt-4 md:mt-0 w-full sm:w-auto">
                <a
                  href="#frames"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('frames')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto text-center px-4 py-2 bg-black hover:bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-md orbital-hero-btn"
                >
                  Configure Prints
                </a>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer watermark */}
      <div className="mt-8 flex justify-between items-center w-full max-w-[1400px] px-8 text-zinc-400 text-[8.5px] font-mono font-semibold relative z-20 select-none uppercase">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-neon-accent animate-pulse orbital-hero-dot" />
          <span>Interactive 3D Stage // v1.0</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="hidden sm:inline">Scroll down to explore</span>
          <span>Click cards to spotlight</span>
        </div>
      </div>
    </div>
  );
}
