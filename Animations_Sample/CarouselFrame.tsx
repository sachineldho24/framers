import React, { useState, useEffect } from 'react';
import { motion, useTransform, MotionValue } from 'motion/react';
import { Check, Info } from 'lucide-react';
import { Poster } from '../types';
import { cn } from '../lib/utils';
import { PosterRenderer } from './PosterRenderer';

interface CarouselFrameProps {
  key?: string | number;
  poster: Poster;
  index: number;
  rotation: MotionValue<number>;
  totalCount: number;
  containerWidth: number;
  onCenter: (index: number) => void;
  isHoveredOrbit: boolean;
  setIsHoveredOrbit: (hovered: boolean) => void;
  isCentered: boolean;
  isDragging: boolean;
  activeFrameStyle: {
    id: string;
    borderClass: string;
    borderW: string;
    mat: string;
    shadow: string;
  };
}

export function CarouselFrame({
  poster,
  index,
  rotation,
  totalCount,
  containerWidth,
  onCenter,
  isHoveredOrbit,
  setIsHoveredOrbit,
  isCentered,
  isDragging,
  activeFrameStyle
}: CarouselFrameProps) {
  const [localHover, setLocalHover] = useState(false);

  // Divide the cylinder into even sectors based on total poster count
  const sectorAngle = 360 / totalCount;

  // Derive relative angle wrapped to range [-180, 180]
  const cardAngle = useTransform(rotation, (rot) => {
    const angle = (index * sectorAngle) + rot;
    return ((angle + 180) % 360 + 360) % 360 - 180;
  });

  // Calculate horizontal X coordinate based on circular sine mapping
  const x = useTransform(cardAngle, (angle) => {
    // Dynamic horizontal radius scaling based on container size
    const rx = Math.min(500, containerWidth * 0.43);
    return Math.sin(angle * Math.PI / 180) * rx;
  });

  // Calculate curve Y coordinate to bow the carousel slightly downwards at the wings
  const y = useTransform(cardAngle, (angle) => {
    // Elegant curved vertical offset to form a realistic gallery arc
    return (1 - Math.cos(angle * Math.PI / 180)) * 26;
  });

  // Calculate translateZ matching specified metrics:
  // Center: 0px, Near Side (40deg): -80px, Far Side (80deg): -180px
  const z = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= sectorAngle) {
      return -(absAngle / sectorAngle) * 80;
    } else if (absAngle <= sectorAngle * 2) {
      const progress = (absAngle - sectorAngle) / sectorAngle;
      return -80 - (progress * 100);
    } else {
      const progress = (absAngle - sectorAngle * 2) / (180 - sectorAngle * 2);
      return -180 - (progress * 140);
    }
  });

  // Calculate rotateY matching specified metrics:
  // Center: 0deg, Near Side: 12deg (facing center), Far Side: 24deg
  const rotateY = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    let r = 0;
    if (absAngle <= sectorAngle) {
      r = (absAngle / sectorAngle) * 12;
    } else if (absAngle <= sectorAngle * 2) {
      const progress = (absAngle - sectorAngle) / sectorAngle;
      r = 12 + (progress * 12);
    } else {
      const progress = (absAngle - sectorAngle * 2) / (180 - sectorAngle * 2);
      r = 24 + (progress * 10);
    }
    // Items on left/negative angles face right (positive rotateY)
    // Items on right/positive angles face left (negative rotateY)
    return angle < 0 ? r : -r;
  });

  // Calculate scale matching specified metrics:
  // Center: 1.0, Near Side: 0.9, Far Side: 0.75
  const scale = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= sectorAngle) {
      return 1.0 - (absAngle / sectorAngle) * 0.1;
    } else if (absAngle <= sectorAngle * 2) {
      const progress = (absAngle - sectorAngle) / sectorAngle;
      return 0.9 - (progress * 0.15);
    } else {
      const progress = (absAngle - sectorAngle * 2) / (180 - sectorAngle * 2);
      return Math.max(0.48, 0.75 - (progress * 0.22));
    }
  });

  // Map opacity based on viewpoint location (fading behind 90deg)
  const opacity = useTransform(cardAngle, (angle) => {
    const absAngle = Math.abs(angle);
    if (absAngle <= sectorAngle) {
      return 1.0 - (absAngle / sectorAngle) * 0.15;
    } else if (absAngle <= sectorAngle * 2.2) {
      const progress = (absAngle - sectorAngle) / (sectorAngle * 1.2);
      return 0.85 - (progress * 0.45);
    } else if (absAngle <= sectorAngle * 3.0) {
      const progress = (absAngle - sectorAngle * 2.2) / (sectorAngle * 0.8);
      return Math.max(0, 0.4 - (progress * 0.4));
    } else {
      return 0;
    }
  });

  // Map stacking order
  const zIndex = useTransform(cardAngle, (angle) => {
    return Math.round(150 - Math.abs(angle));
  });

  // Determine frame styling: Center displays active selected frame picker style, others display default black wooden frame
  const borderClass = isCentered ? activeFrameStyle.borderClass : 'border-zinc-900';
  const borderW = isCentered ? activeFrameStyle.borderW : 'border-[10px] sm:border-[16px]';
  const matClass = isCentered ? activeFrameStyle.mat : 'p-2.5 sm:p-5 bg-[#FAF9F6] text-zinc-900';
  const shadowClass = isCentered ? activeFrameStyle.shadow : 'shadow-[0_15px_35px_rgba(0,0,0,0.7)]';

  return (
    <motion.div
      style={{
        x,
        y,
        z,
        rotateY,
        scale,
        opacity,
        zIndex,
        transformStyle: 'preserve-3d',
      }}
      className="absolute flex items-center justify-center cursor-pointer pointer-events-auto select-none"
    >
      <motion.div
        onMouseEnter={() => {
          setIsHoveredOrbit(true);
          setLocalHover(true);
        }}
        onMouseLeave={() => {
          setIsHoveredOrbit(false);
          setLocalHover(false);
        }}
        onClick={(e) => {
          if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onCenter(index);
        }}
        whileHover={{
          scale: 1.05,
          z: 50,
          y: -15,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 24,
          mass: 1
        }}
        className={cn(
          "relative rounded-sm overflow-hidden transition-all duration-500 bg-zinc-950",
          localHover 
            ? "shadow-[0_45px_90px_rgba(0,0,0,0.98)] ring-1 ring-zinc-700/50" 
            : shadowClass
        )}
      >
        {/* Gallery Museum Framing mockups */}
        <div 
          className={cn(
            "relative border-solid flex items-center justify-center transition-all duration-700",
            borderClass,
            borderW,
            matClass
          )}
          style={{
            borderStyle: isCentered && activeFrameStyle.id === 'gold' ? 'double' : 'solid'
          }}
        >
          {/* Bevel inset shadow card borders */}
          <div className="absolute inset-0 border border-black/35 pointer-events-none z-10" />
          <div className="absolute inset-[8px] sm:inset-[12px] border border-stone-400/20 pointer-events-none z-10" />

          {/* Museum-quality mount board liner */}
          <div className="relative w-[125px] sm:w-[150px] aspect-[3/4] overflow-hidden bg-stone-100 shadow-[inset_0_2px_10px_rgba(0,0,0,0.18)]">
            <div className="absolute inset-0 border border-stone-300 p-0.5 flex items-center justify-center bg-stone-50">
              
              {/* Graphic Design Poster rendering */}
              <PosterRenderer poster={poster} hideSmallText={true} />

              {/* Museum glass gloss & reflections */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white-[0.03] to-white/12 mix-blend-overlay z-20 pointer-events-none" />
              <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[linear-gradient(45deg,transparent_45%,rgba(255,255,255,0.06)_48%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.02)_52%,transparent_55%)] pointer-events-none z-22 transition-transform duration-1000 ease-out" />
              <div className="absolute inset-0 shadow-[inset_0_4px_12px_rgba(0,0,0,0.3)] z-25 pointer-events-none" />
            </div>

            {/* Gallery spotlight glow simulation */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/10 via-white/2 to-transparent opacity-60 pointer-events-none z-18" />
          </div>
        </div>

        {/* Floating featured badge for centerpiece frame */}
        {isCentered && (
          <div className="absolute top-2.5 right-2.5 z-40 bg-zinc-950/90 border border-zinc-800 text-zinc-300 text-[6.5px] font-mono tracking-widest px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
            Spotlight
          </div>
        )}

        {/* Glassmorphism Title HUD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: localHover ? 1 : 0, y: localHover ? 0 : 15 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="absolute inset-x-2 bottom-2 z-30 glass-panel bg-black/85 backdrop-blur-md px-3 py-2 rounded border border-zinc-800 shadow-xl flex items-center justify-between pointer-events-none"
        >
          <div className="text-left">
            <span className="text-[7px] font-mono text-indigo-400 font-bold uppercase tracking-widest leading-none block">{poster.tag}</span>
            <span className="text-[10px] font-serif font-bold text-white mt-0.5 leading-none block">{poster.title}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono font-bold text-zinc-300">£49.00</span>
            <span className="text-[6.5px] text-zinc-500 block leading-none">Custom Framed</span>
          </div>
        </motion.div>

      </motion.div>
    </motion.div>
  );
}
