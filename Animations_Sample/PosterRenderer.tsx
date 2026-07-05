import { Poster } from '../types';
import { cn } from '../lib/utils';

interface PosterRendererProps {
  poster: Poster;
  className?: string;
  hideSmallText?: boolean;
}

export function PosterRenderer({ poster, className, hideSmallText = false }: PosterRendererProps) {
  // Select style overlay based on poster ID
  const renderOverlay = () => {
    switch (poster.id) {
      case 'gearup':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-4 font-sans text-white bg-black/10">
            {/* Top Bar */}
            <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
              <span className="text-[7px] font-mono tracking-widest text-[#EF4444]">AUTOMOTIVE PRINT SERIES</span>
              <span className="text-[7px] font-mono tracking-widest text-white/50">GEAR_U_P</span>
            </div>

            {/* Neon Loop & Center Design */}
            <div className="absolute inset-0 z-1 pointer-events-none flex items-center justify-center">
              {/* Slanted red neon ellipse */}
              <div 
                className="w-[110%] h-[38%] border-[2px] border-red-500 rounded-[50%] rotate-[-22deg] opacity-90"
                style={{
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.8), inset 0 0 15px rgba(239, 68, 68, 0.4)',
                  borderColor: '#ef4444'
                }}
              />
            </div>

            {/* Main Slanted Title */}
            <div className="relative z-10 mt-6 text-center select-none">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-white uppercase italic origin-center rotate-[-12deg] skew-x-[-12deg] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                <span className="text-red-500">GEAR</span> <span className="text-white">UP</span>
              </h1>
            </div>

            {/* Bottom Credits / Tech Specs */}
            {!hideSmallText && (
              <div className="relative z-10 mt-auto bg-black/60 backdrop-blur-xs p-2 rounded border border-white/5 text-center">
                <p className="text-[5.5px] tracking-wide text-zinc-300 font-sans leading-tight uppercase">
                  THE YAMAHA R6 IS A LEGENDARY SUPER SPORT MOTORCYCLE KNOWN FOR ITS AGGRESSIVE STYLING, RAZOR-SHARP HANDLING, 
                  AND HIGH-REVVING 599CC ENGINE. DESIGNED FOR BOTH THE TRACK ADVANCED AERODYNAMICS.
                </p>
                <div className="mt-1 pb-0.5 border-t border-white/10 pt-1 flex justify-between text-[4.5px] text-zinc-500 font-mono">
                  <span>PROJECT ID // YMH-R6</span>
                  <span>CRAFTED AT FRAME_STUDIO_CO</span>
                </div>
              </div>
            )}
          </div>
        );

      case 'bmw':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-4 text-white bg-black/15 font-sans">
            {/* Top Bar */}
            <div className="flex justify-between items-center border-b border-yellow-500/10 pb-1.5">
              <span className="text-[7.5px] font-mono tracking-widest text-[#EAB308]">M PERFORMANCE COUPE</span>
              <span className="text-[7px] font-mono tracking-widest text-[#EAB308]">EDITION X</span>
            </div>

            {/* Large background styled BMW text */}
            <div className="absolute inset-x-0 top-[22%] z-0 text-center select-none pointer-events-none">
              <h1 className="text-5xl md:text-6xl font-black tracking-widest text-[#EAB308]/20 stroke-1 uppercase">
                BMW
              </h1>
            </div>

            {/* Lower billing credits block */}
            {!hideSmallText && (
              <div className="relative z-10 mt-auto bg-black/70 p-2.5 rounded border border-zinc-900 text-center">
                <div className="text-[12px] font-black text-[#EAB308] tracking-widest mb-1 select-none">
                  BMW
                </div>
                <p className="text-[5.5px] tracking-widest text-zinc-400 font-mono leading-tight uppercase">
                  MECHAYN DESIGN PROTOTYPE // RACING SUSPENSION CHASSIS COUPE EXECUTIVE 
                  CARBON FIBER INTEGRATION // DOUBLE-VANOS TURBOCHARGED ROTOR BRAKES ACTIVE SPORT
                </p>
                <div className="mt-[6px] border-t border-zinc-800/60 pt-1 flex justify-center text-[5px] text-zinc-500 font-mono tracking-wider">
                  POSTER<span className="text-yellow-500">X</span> DESIGN HUB
                </div>
              </div>
            )}
          </div>
        );

      case 'hilux':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-4 font-sans text-white bg-black/10">
            {/* Top name */}
            <div className="flex justify-between items-center text-[6.5px] text-orange-400 font-mono tracking-widest border-b border-orange-500/10 pb-1 flex-row">
              <span>KRISHNA _ DETHAN</span>
              <span>TRD 4X4</span>
            </div>

            {/* Orange Neon Ellipse in base */}
            <div className="absolute inset-0 z-1 pointer-events-none flex items-end justify-center pb-12">
              <div 
                className="w-[85%] h-[24%] border-[2px] border-orange-500 rounded-[50%] rotate-[-4deg] opacity-95"
                style={{
                  boxShadow: '0 0 15px rgba(249, 115, 22, 0.8), inset 0 0 10px rgba(249, 115, 22, 0.4)',
                  borderColor: '#f97316'
                }}
              />
            </div>

            {/* Massive modern italic neon label */}
            <div className="relative z-10 top-2 text-center select-none">
              <h1 className="text-4xl font-extrabold tracking-tighter text-[#F97316] italic uppercase skew-x-[-12deg] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                HILUX
              </h1>
            </div>

            {/* Bottom block */}
            {!hideSmallText && (
              <div className="relative z-15 mt-auto bg-black/65 backdrop-blur-xs p-2 rounded border border-orange-500/10 text-center">
                <p className="text-[5px] tracking-wide text-zinc-300 font-sans leading-tight uppercase">
                  READY FOR ANYTHING. THE TOYOTA HILUX IS BUILT TO LAST, WITH LEGENDARY TOUGHNESS AND A POWERFUL 4X4 SYSTEM. 
                  FROM CITY STREETS TO RUGGED TRAILS, ITS ICONIC DURABILITY ENSURES YOU CAN GO FURTHER HANDCRAFTED.
                </p>
                <div className="mt-1 border-t border-orange-950 pt-1 flex justify-between text-[4.5px] text-orange-500/70 font-mono">
                  <span>TRD OFF-ROAD PRO</span>
                  <span>TOYOTA PERFORMANCE</span>
                </div>
              </div>
            )}
          </div>
        );

      case 'venue':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-4 font-sans text-white bg-black/15">
            {/* Red glowing angles in corner */}
            <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-red-600/80 rounded-tl shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-red-600/80 rounded-tr shadow-[0_0_8px_rgba(239,68,68,0.5)]" />

            {/* Giant Title stretched and tall */}
            <div className="relative z-10 mt-8 text-center select-none">
              <h1 className="text-5xl font-extrabold tracking-[0.25em] text-red-600 uppercase mb-1 drop-shadow-md">
                VENUE
              </h1>
              <span className="text-[6.5px] font-mono uppercase text-white/50 tracking-widest block">CROSSOVER EDITION</span>
            </div>

            {/* Floating poetry block from the original */}
            {!hideSmallText && (
              <div className="mt-auto relative z-10 bg-black/60 p-2 border border-zinc-900 rounded">
                <p className="text-[5.5px] text-zinc-300 select-none font-sans leading-relaxed tracking-wider text-center uppercase">
                  CARS HOLD MORE THAN PEOPLE: THEY HOLD CHAPTERS OF OUR LIVES. FIRST JOURNEYS, LAST GOODBYES, CHILDHOOD TRIPS, 
                  AND YOUTHFUL ESCAPES - ALL ETCHED INTO THE FABRIC OF SEATS AND THE WHISPER OF TYRES AGAINST THE ROAD.
                </p>
                <div className="mt-1 pt-1 border-t border-red-950 text-center text-[4.5px] text-red-500/60 font-mono">
                  HYUNDAI MOTORS SPECIAL EXHIBITION
                </div>
              </div>
            )}
          </div>
        );

      case 'duke':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-4 font-sans text-white bg-black/10">
            {/* Top spec limit */}
            <div className="flex justify-between items-center text-[7px] text-amber-500 font-mono tracking-widest border-b border-amber-500/10 pb-1 flex-row">
              <span>READY TO RACE _ SPEC</span>
              <span>NO. 250</span>
            </div>

            {/* Glowing neon orange circle base */}
            <div className="absolute inset-0 z-1 pointer-events-none flex items-end justify-center pb-12">
              <div 
                className="w-[85%] h-[24%] border-[2px] border-amber-500 rounded-[50%] rotate-[8deg] opacity-90"
                style={{
                  boxShadow: '0 0 15px rgba(245, 158, 11, 0.9), inset 0 0 10px rgba(245, 158, 11, 0.4)',
                  borderColor: '#f59e0b'
                }}
              />
            </div>

            {/* Floating text element slanted */}
            <div className="relative z-10 top-2 text-center select-none">
              <h1 className="text-4xl font-extrabold tracking-tighter text-[#FF6B00] italic uppercase skew-x-[-12deg] drop-shadow-lg">
                DUKE
              </h1>
            </div>

            {/* Specs bottom block */}
            {!hideSmallText && (
              <div className="relative z-15 mt-auto bg-black/70 p-2.5 rounded border border-amber-500/10 text-center">
                <p className="text-[5px] tracking-wide text-zinc-300 font-sans leading-tight uppercase">
                  THE KTM 250 DUKE'S PERFORMANCE IS DRIVEN BY ITS 248.8CC, 30 PS ENGINE. KNOWN FOR A PUNCHY TOP END, 
                  IT CAN REACH A TOP SPEED OF OVER 142 KM/H AND ACCELERATES FROM 0-100 KM/H IN UNDER 8 SECONDS. 
                  ITS LIGHT CHASSIS ENDURES SHARP HANDLING.
                </p>
                <div className="mt-1 border-t border-amber-950 pt-1 flex justify-center text-[5px] text-amber-500/70 font-mono tracking-widest">
                  UNDERGROUND SUPERMOTO LABS
                </div>
              </div>
            )}
          </div>
        );

      case 'classic911':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-5 bg-[#FAF9F6] text-stone-900 border-[10px] border-[#3F6212]/10 font-serif">
            <div className="flex justify-between items-center border-b border-stone-300 pb-1 text-[8px] font-sans tracking-widest uppercase">
              <span>HISTORICAL MOTORSPORT RECORD</span>
              <span className="text-[#3F6212] font-semibold">STUTTGART D.E.</span>
            </div>
            
            <div className="my-auto text-center select-none">
              <h2 className="text-xs uppercase tracking-[0.25em] text-[#3F6212] font-semibold">P O R S C H E</h2>
              <h1 className="text-3xl font-bold font-serif tracking-tight text-stone-900 mt-1">911 TURBO</h1>
              <span className="text-[7px] italic text-stone-500 block mt-1">"Design is not simply what it looks like, but how it works."</span>
            </div>

            {!hideSmallText && (
              <div className="mt-auto flex justify-between items-end border-t border-stone-200 pt-2">
                <div className="text-[6px] font-sans uppercase text-stone-500 leading-tight">
                  <div>Model: Carrera classic</div>
                  <div>Edition: 1989 Heritage</div>
                </div>
                <span className="text-[8px] font-sans font-bold tracking-widest text-[#3F6212]">GERMAN ENGINEERING</span>
              </div>
            )}
          </div>
        );

      case 'monacogp':
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-5 bg-[#faf8f5] text-stone-900 border-[10px] border-stone-200 font-sans">
            <div className="flex justify-between items-center border-b border-stone-300 pb-1 text-[7px] font-mono tracking-widest uppercase">
              <span>VINTAGE SPEED SERIES</span>
              <span>NO.08/95</span>
            </div>

            <div className="my-auto text-left select-none">
              <h1 className="text-3xl font-extrabold tracking-tighter text-stone-950 leading-none">
                MONACO <br /><span className="text-[#991B1B] text-4xl">LEGENDS</span>
              </h1>
              <p className="text-[6.5px] font-mono tracking-widest text-stone-500 uppercase mt-2">
                1968 INTERNATIONAL GRAND PRIX EXCLUSIF
              </p>
            </div>

            {!hideSmallText && (
              <div className="mt-auto flex justify-between items-baseline border-t border-stone-200 pt-2 text-[5.5px] font-mono text-stone-400">
                <span>MONACO CIRCUIT EXPO</span>
                <span className="text-[#991B1B] font-bold text-[7px]">GRAND PRIX ARCHIVE</span>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="absolute inset-0 flex flex-col justify-between p-4 bg-black/20 text-white font-sans">
            {/* Standard backup premium frame */}
            <div className="flex justify-between items-center text-[7px] tracking-widest border-b border-white/10 pb-1 text-white/60 font-mono">
              <span>ART_CURATOR_SERIES</span>
              <span>{poster.tag}</span>
            </div>
            
            <div className="my-auto text-center select-none">
              <h1 className="text-2xl font-serif italic text-white leading-tight">
                {poster.title}
              </h1>
              <span className="text-[8px] tracking-widest text-white/50 block mt-1 uppercase font-mono">{poster.subTitle}</span>
            </div>

            {!hideSmallText && (
              <div className="mt-auto flex justify-between border-t border-white/10 pt-1 text-[6px] font-mono text-white/40">
                <span>FINE ARTWORK PRINT</span>
                <span>{poster.artist || 'Curated Artist'}</span>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden flex flex-col select-none", className)}>
      {/* Background graphic image with dark tone overlay */}
      <img 
        src={poster.src} 
        alt={poster.subTitle}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 hover:scale-105"
      />
      {/* Gentle gradient shroud to keep graphic details readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/35 z-0 pointer-events-none" />
      
      {/* Dynamic Overlay Elements */}
      <div className="relative w-full h-full z-10">
        {renderOverlay()}
      </div>
    </div>
  );
}
