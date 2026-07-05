import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useAnimationFrame, animate } from 'motion/react';
import { Sparkles, Eye, ShieldAlert, BadgeInfo, Anchor, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { FabricCanvas } from './FabricCanvas';
import { PREMIUM_POSTERS } from '../data/posters';
import { PosterRenderer } from './PosterRenderer';
import { CarouselFrame } from './CarouselFrame';
import { Poster } from '../types';

const FRAMES = [
  { id: 'modern', name: 'Modern Black', borderClass: 'border-zinc-900', borderW: 'border-[10px] sm:border-[16px]', mat: 'p-2.5 sm:p-5 bg-zinc-50 text-zinc-950', shadow: 'shadow-[0_25px_50px_rgba(0,0,0,0.85)]' },
  { id: 'wood', name: 'Oak Wood', borderClass: 'border-[#a27f54]', borderW: 'border-[10px] sm:border-[16px]', mat: 'p-2.5 sm:p-5 bg-[#faf6ed] text-[#422108]', shadow: 'shadow-[0_25px_50px_rgba(162,127,84,0.35)]' },
  { id: 'white', name: 'Gallery White', borderClass: 'border-[#FBFBFA]', borderW: 'border-[10px] sm:border-[16px]', mat: 'p-2.5 sm:p-5 bg-white text-zinc-900', shadow: 'shadow-[0_25px_50px_rgba(255,255,255,0.06)] ring-1 ring-zinc-800' },
  { id: 'gold', name: 'Vintage Gold', borderClass: 'border-[#cda332]', borderW: 'border-[10px] sm:border-[16px] border-double', mat: 'p-2.5 sm:p-5 bg-[#fbfaf0] text-[#5c4600]', shadow: 'shadow-[0_25px_50px_rgba(205,163,50,0.22)]' },
];

// HTML5 Canvas Gallery Dust Particle Simulator for an immersive museum air effect
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
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      alpha: number;
      alphaSpeed: number;
    }> = [];

    // Instantiate 42 delicate amber gallery dust particles
    for (let i = 0; i < 42; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -Math.random() * 0.22 - 0.04, // slowly float upwards
        alpha: Math.random() * 0.45 + 0.08,
        alphaSpeed: (Math.random() * 0.004 + 0.001) * (Math.random() > 0.5 ? 1 : -1)
      });
    }

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        w = canvas.width = parent.clientWidth;
        h = canvas.height = parent.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Warm subtle boundary wrapping transitions
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = h;

        // Delicate breathing alpha
        p.alpha += p.alphaSpeed;
        if (p.alpha > 0.55 || p.alpha < 0.08) {
          p.alphaSpeed = -p.alphaSpeed;
        }

        ctx.beginPath();
        // Warm gold gallery lamp reflection accents
        ctx.fillStyle = `rgba(215, 175, 45, ${Math.max(0, p.alpha)})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70" />;
}

export function Hero() {
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isHoveredOrbit, setIsHoveredOrbit] = useState(false);
  const [isAnimatingToCenter, setIsAnimatingToCenter] = useState(true); // Sweep entrance is active initially
  const [activeIndex, setActiveIndex] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartRotationRef = useRef(0);
  const dragTimeRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeAnimRef = useRef<any>(null);
  const timeoutRef = useRef<number | null>(null);

  const activeFrame = FRAMES[selectedFrameIdx];
  const centerPoster = PREMIUM_POSTERS[activeIndex] || PREMIUM_POSTERS[0];

  // Continuous loop rotation motion value
  const rotation = useMotionValue(0);

  // Apple-style parallax micro tilt springs
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springConfig = { damping: 48, stiffness: 55, mass: 2.2 };
  const smoothTiltX = useSpring(tiltX, springConfig);
  const smoothTiltY = useSpring(tiltY, springConfig);

  // Mount Sweep Entrance: Carousel spins up and stagger displays
  useEffect(() => {
    // Elegant sweeping entrance. From deep spin 110deg down to 0deg
    activeAnimRef.current = animate(rotation, [110, 0], {
      type: 'spring',
      stiffness: 42,
      damping: 14,
      mass: 1.5,
      onComplete: () => {
        setIsAnimatingToCenter(false);
      }
    });

    return () => {
      if (activeAnimRef.current) activeAnimRef.current.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Update containerWidth to maintain responsive coordinates
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync closest index state with rotation to render curated specification meta card below
  useEffect(() => {
    const n = PREMIUM_POSTERS.length;
    const sector = 360 / n;
    
    const unsubscribe = rotation.on('change', (latest) => {
      // Find centered multiplier matching nearest index
      const itemIdx = Math.round(-latest / sector);
      const normalisedIndex = ((itemIdx % n) + n) % n;
      setActiveIndex(normalisedIndex);
    });

    return () => unsubscribe();
  }, [rotation]);

  // Framer Motion continuous animation ticking loop
  useAnimationFrame((time, delta) => {
    // If hovering, drag/scroll deceleration, or actively centering, do not auto tick
    if (isHoveredOrbit || isAnimatingToCenter) return;

    // Linear rotation: 24s per full 360deg cycle
    const degreesPerMillisecond = 360 / 24000;
    rotation.set(rotation.get() - degreesPerMillisecond * delta);
  });

  // Highlight clicking selection to centers a targeted frame
  const handleCenterPoster = (targetIndex: number) => {
    setIsAnimatingToCenter(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const n = PREMIUM_POSTERS.length;
    const sector = 360 / n;
    const targetAngle = -targetIndex * sector;

    // Calculate nearest multiple of 360 to prevent rapid back-spinning jumps
    const currentAngle = rotation.get();
    const nearestAngle = targetAngle + Math.round((currentAngle - targetAngle) / 360) * 360;

    if (activeAnimRef.current) {
      activeAnimRef.current.stop();
    }

    activeAnimRef.current = animate(rotation, nearestAngle, {
      type: 'spring',
      stiffness: 65,
      damping: 20,
      mass: 1.1,
      onComplete: () => {
        // Resume automated Linear drift after 8.5 seconds of idle resting
        timeoutRef.current = window.setTimeout(() => {
          setIsAnimatingToCenter(false);
        }, 8500);
      }
    });
  };

  // 360-Degree Panoramic Pointer Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary click / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (activeAnimRef.current) {
      activeAnimRef.current.stop();
    }

    isDraggingRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartRotationRef.current = rotation.get();
    dragTimeRef.current = performance.now();
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;

    setIsAnimatingToCenter(true); // Suspend auto-rotate/springs
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

    const deltaX = e.clientX - dragStartXRef.current;
    
    // Guard threshold to distinguish clicks from dragging
    if (!isDraggingRef.current && Math.abs(deltaX) > 4) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }

    if (isDraggingRef.current) {
      const sensitivity = 500; // full container sweep rotates 500 degrees
      const degrees = (deltaX / containerWidth) * sensitivity;
      rotation.set(dragStartRotationRef.current + degrees);

      // Instantaneous dragging velocity calculations
      const now = performance.now();
      const dt = now - lastTimeRef.current;
      if (dt > 0) {
        const dx = e.clientX - lastXRef.current;
        const instantV = (dx / dt) * (sensitivity / containerWidth);
        // Exponential moving average to smooth raw dragging noise
        velocityRef.current = velocityRef.current * 0.55 + instantV * 0.45;
      }
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const wasDragging = isDraggingRef.current;
    
    isDraggingRef.current = false;
    setTimeout(() => {
      setIsDragging(false);
    }, 45);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (wasDragging) {
      const v = velocityRef.current;
      const sector = 360 / PREMIUM_POSTERS.length;
      
      // Calculate inertial displacement in degrees: v * 240ms duration factor
      const targetRot = rotation.get() + (v * 240);
      const alignedNearestSnapAngle = Math.round(targetRot / sector) * sector;

      if (activeAnimRef.current) activeAnimRef.current.stop();

      // Feed initial kinetic velocity directly into the spring settle
      activeAnimRef.current = animate(rotation, alignedNearestSnapAngle, {
        type: 'spring',
        stiffness: 48,
        damping: 18,
        mass: 1.1,
        velocity: v * 12, // start spring velocity matching hand sweep
        onComplete: () => {
          const finalRot = rotation.get();
          const nearestIdx = Math.round(-finalRot / sector);
          const normalisedIdx = ((nearestIdx % PREMIUM_POSTERS.length) + PREMIUM_POSTERS.length) % PREMIUM_POSTERS.length;
          setActiveIndex(normalisedIdx);

          timeoutRef.current = window.setTimeout(() => {
            setIsAnimatingToCenter(false);
          }, 8500);
        }
      });
    }
  };

  // Parallel subtle mouse cursor tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;

    // Gentle maximum 3D axis tilt of ~4.2 degrees
    tiltX.set(normY * 4.2);
    tiltY.set(-normX * 4.2);
  };

  const handleMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
    setIsHoveredOrbit(false);
  };

  // Immersive Scroll and Wheel triggers
  const lastScrollYRef = useRef(0);
  const lastWheelTimeRef = useRef(0);

  // 1. Mouse wheel / Trackpad glide within 3D orbit gallery area
  const handleWheel = (e: React.WheelEvent) => {
    // Determine primary scroll intensity across x and y axes (sensitive to trackpads)
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 4) return;

    if (isDraggingRef.current) return;

    if (activeAnimRef.current) {
      activeAnimRef.current.stop();
    }
    setIsAnimatingToCenter(true); // lock linear autoplay

    const currentRotation = rotation.get();
    // Spin responsiveness adjustment
    const newRot = currentRotation - (delta * 0.14);
    rotation.set(newRot);

    // Prompt soft settle / snapping to nearest poster once scroll quietens
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const finalRot = rotation.get();
      const sector = 360 / PREMIUM_POSTERS.length;
      const nearestIdx = Math.round(-finalRot / sector);
      const normalisedIdx = ((nearestIdx % PREMIUM_POSTERS.length) + PREMIUM_POSTERS.length) % PREMIUM_POSTERS.length;
      handleCenterPoster(normalisedIdx);
    }, 450);
  };

  // 2. Global window scroll parallax: gallery spins elegantly as user scrolls webpage
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleWindowScroll = () => {
      if (isDraggingRef.current) return;

      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollYRef.current;
      lastScrollYRef.current = currentScrollY;

      if (Math.abs(diff) < 0.5) return;

      if (activeAnimRef.current && !isAnimatingToCenter) {
        activeAnimRef.current.stop();
      }
      setIsAnimatingToCenter(true);

      const currentRotation = rotation.get();
      // Scroll down moves forwards; scroll up moves backwards
      const newRotation = currentRotation - (diff * 0.11);
      rotation.set(newRotation);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        const finalRot = rotation.get();
        const sector = 360 / PREMIUM_POSTERS.length;
        const nearestIdx = Math.round(-finalRot / sector);
        const normalisedIdx = ((nearestIdx % PREMIUM_POSTERS.length) + PREMIUM_POSTERS.length) % PREMIUM_POSTERS.length;
        handleCenterPoster(normalisedIdx);
      }, 700);
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [rotation, isAnimatingToCenter]);

  return (
    <div className="relative w-full bg-[#0B0B0B] text-white min-h-[960px] md:min-h-[1050px] overflow-hidden flex flex-col items-center py-16">
      
      {/* Immersive backing spotlight synced with active centerpiece poster color */}
      <div 
        className="absolute top-[35%] md:top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[680px] md:h-[680px] rounded-full z-0 pointer-events-none opacity-30 filter blur-3xl transition-colors duration-1000"
        style={{ 
          background: `radial-gradient(circle, ${centerPoster.accentColor || '#6366f1'} 0%, transparent 68%)` 
        }} 
      />

      {/* Museum-quality luxury flanking outline columns */}
      <div className="absolute left-[6%] inset-y-0 w-px bg-gradient-to-b from-zinc-950 via-zinc-900/25 to-zinc-950 pointer-events-none hidden md:block z-0" />
      <div className="absolute right-[6%] inset-y-0 w-px bg-gradient-to-b from-zinc-950 via-zinc-900/25 to-zinc-950 pointer-events-none hidden md:block z-0" />
      
      {/* 3D WebGL Silk Fabric backing drape */}
      <div className="absolute inset-0 z-0 opacity-25 pointer-events-none">
        <FabricCanvas />
      </div>

      {/* Floating interactive dust spec atmosphere */}
      <DustParticles />

      {/* Exhibition Header */}
      <div className="relative z-20 text-center max-w-4xl px-6 mb-12 flex flex-col items-center select-none">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md mb-6"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">Premium Gallery Exhibition</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-[5rem] font-serif font-medium tracking-tight text-white leading-[1.05] max-w-3xl"
        >
          Elegance, Raised to<br />
          <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-zinc-300 via-white to-zinc-400">Gallery Standard</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.3 }}
          className="mt-6 text-xs sm:text-sm text-zinc-400 max-w-xl font-sans tracking-wide leading-relaxed"
        >
          An interactive, three-dimensional physical showcase. Select masterworks to rotate them to the front spotlight, and customize active framing woods with the live deck.
        </motion.p>
      </div>

      {/* 3D Curved Cylindrical Carousel Area */}
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
        {/* Apple-style structural 3D parallax tilt parent */}
        <motion.div
          style={{
            rotateX: smoothTiltX,
            rotateY: smoothTiltY,
            transformStyle: 'preserve-3d',
            perspective: 1800,
          }}
          className="relative w-full h-full flex items-center justify-center pointer-events-none"
        >
          {PREMIUM_POSTERS.map((poster, index) => (
            <CarouselFrame
              key={poster.id}
              poster={poster}
              index={index}
              rotation={rotation}
              totalCount={PREMIUM_POSTERS.length}
              containerWidth={containerWidth}
              onCenter={handleCenterPoster}
              isHoveredOrbit={isHoveredOrbit}
              setIsHoveredOrbit={setIsHoveredOrbit}
              isCentered={activeIndex === index}
              isDragging={isDragging}
              activeFrameStyle={activeFrame}
            />
          ))}
        </motion.div>
      </div>

      {/* Sleek Minimalist Interaction Blueprint Indicator */}
      <div className="relative z-30 flex items-center justify-center gap-2 mt-4 mb-8 select-none">
        <div className="flex items-center gap-2 bg-zinc-950/60 backdrop-blur-md border border-zinc-900/60 px-4 py-1.5 rounded-full text-[9px] font-mono text-zinc-400 tracking-widest uppercase shadow-lg select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span>Drag, Swipe, or Scroll to Spin</span>
        </div>
      </div>

      {/* METADATA HUD CARD: Update artwork details beautifully on swap */}
      <div className="relative z-30 w-full max-w-2xl px-6 mb-10 min-h-[170px] flex justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={centerPoster.id}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            className="w-full glass-panel bg-zinc-950/80 border border-zinc-800/60 p-6 sm:p-8 rounded-xl flex flex-col md:flex-row justify-between items-start gap-6 shadow-2xl relative overflow-hidden"
          >
            {/* Soft decorative background spotlight matching print theme */}
            <div 
              className="absolute top-0 right-0 w-44 h-44 rounded-full pointer-events-none filter blur-2xl opacity-15"
              style={{ background: centerPoster.accentColor || '#6366f1' }}
            />

            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold tracking-widest text-[#818cf8] uppercase bg-[#818cf8]/15 px-2 py-0.5 rounded leading-none block">
                  {centerPoster.tag}
                </span>
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">
                  Catalog Id: EX-{centerPoster.id.split('-')[0].toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mt-3.5 tracking-tight leading-none">
                {centerPoster.title}
              </h2>
              <p className="text-xs sm:text-sm italic text-zinc-400 mt-1 font-serif">
                {centerPoster.subTitle}
              </p>
              <p className="text-xs text-zinc-500 mt-4 leading-relaxed font-sans max-w-md">
                A custom curated design print rendered using premium matte photography. Crafted securely in museum glass with professional acid-free backing mounts. Perfect addition to modern layouts.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end justify-between h-full min-h-[90px] w-full md:w-auto border-t md:border-t-0 md:border-l border-zinc-800/60 pt-4 md:pt-0 md:pl-6 self-stretch">
              <div className="text-left md:text-right">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest leading-none block">Curation Price</span>
                <span className="text-2xl font-mono font-black text-indigo-400 mt-1.5 block">£49.00</span>
                <span className="text-[8px] text-emerald-400 font-mono mt-1 block">In stock / Ships worldwide</span>
              </div>

              <div className="flex items-center gap-2 mt-4 md:mt-0 w-full sm:w-auto">
                <a 
                  href="#configuration-section"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('configuration-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto text-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-[10px] font-sans font-bold uppercase tracking-widest rounded transition-all shadow-md hover:shadow-indigo-500/20 shadow-indigo-600/10"
                >
                  Configure Prints
                </a>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Frame Style Picker Deck */}
      <div className="relative z-30 px-6 py-4.5 bg-zinc-950/90 border border-zinc-800/80 rounded-full flex flex-wrap justify-center items-center gap-5 shadow-2xl max-w-lg mx-auto select-none mt-2">
        <span className="text-[8.5px] font-mono font-black uppercase text-indigo-400 tracking-widest flex items-center gap-1.5">
          <BadgeInfo className="w-3.5 h-3.5 text-indigo-400" />
          Framing Material
        </span>
        <div className="h-4.5 w-px bg-zinc-800" />
        <div className="flex items-center gap-1.5">
          {FRAMES.map((f, idx) => (
            <button
              key={f.id}
              onClick={() => setSelectedFrameIdx(idx)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[9px] font-sans font-black uppercase tracking-widest transition-all cursor-pointer border",
                selectedFrameIdx === idx
                  ? "border-[#818cf8] text-[#818cf8] bg-[#818cf8]/10 shadow-[0_0_12px_rgba(129,140,248,0.22)]"
                  : "border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-700 bg-transparent"
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Exhibition Coordinates Watermark */}
      <div className="mt-14 flex justify-between items-center w-full max-w-[1400px] px-8 text-zinc-600 text-[8.5px] font-mono font-semibold relative z-20 select-none uppercase">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>Interactive 3D Stage // v1.5</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Scroll down for the custom Frame Configurator</span>
          <span>Click cards to spotlight</span>
        </div>
      </div>

    </div>
  );
}
