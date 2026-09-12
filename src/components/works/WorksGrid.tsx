"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Maximize2, X } from "lucide-react";
import type { Work } from "@/lib/works";

export function WorksGrid({ items, labels }: { items: readonly Work[]; labels: Record<string, string> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = selected !== null;
  const artwork = selected === null ? null : items[selected];

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      document.body.style.overflow = overflow;
      if (element.open) element.close();
      opener.current?.focus({ preventScroll: true });
    };
  }, [open]);

  function move(direction: number) {
    content.current?.scrollTo({ top: 0 });
    setSelected(index => index === null ? null : (index + direction + items.length) % items.length);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
        {items.map((work, index) => (
          <button
            key={work.id}
            type="button"
            aria-label={`Open ${work.title}, artwork ${index + 1}`}
            aria-haspopup="dialog"
            onClick={event => { opener.current = event.currentTarget; setSelected(index); }}
            className="group min-w-0 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-neon-accent"
          >
            <span className="relative flex aspect-[5/7] items-center justify-center overflow-hidden border border-outline-variant bg-surface-container-low p-3 transition-colors group-hover:border-neon-accent sm:p-4">
              <Image
                src={work.image}
                alt={work.alt}
                width={work.width}
                height={work.height}
                sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 45vw, 30vw"
                className="h-full w-full object-contain"
                loading={index < 3 ? "eager" : "lazy"}
              />
              <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center border border-outline-variant bg-black/90 text-white transition-colors group-hover:border-neon-accent group-hover:text-neon-accent">
                <Maximize2 size={15} aria-hidden="true" />
              </span>
            </span>
            <span className="mt-4 flex items-start justify-between gap-4">
              <span>
                <span className="label-caps mb-2 block text-[10px] text-on-surface-variant">{labels[work.category]}</span>
                <span className="block font-display text-base font-extrabold uppercase leading-snug tracking-tight transition-colors group-hover:text-neon-accent sm:text-lg">{work.title}</span>
              </span>
              <ArrowUpRight size={21} className="mt-5 shrink-0 text-on-surface-variant group-hover:text-neon-accent" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="work-view-title"
        onClose={() => setSelected(null)}
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        onKeyDown={event => {
          if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        }}
        className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-24px)] max-w-6xl overflow-hidden border border-outline-variant bg-background p-0 text-foreground backdrop:bg-black/90"
      >
        <div className="grid max-h-[calc(94dvh-2px)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-4 py-2 sm:px-6">
          <span className="label-caps text-[10px] text-neon-accent">Framers Lab / Our Works</span>
          <button type="button" autoFocus aria-label="Close artwork" onClick={() => dialog.current?.close()} className="grid h-11 w-11 shrink-0 place-items-center hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-neon-accent"><X size={23} /></button>
        </div>
        {artwork && (
          <div ref={content} className="grid min-h-0 overflow-y-auto md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="relative h-[57dvh] bg-surface-container-low sm:h-[70dvh]">
              <Image key={artwork.id} src={artwork.fullImage} alt={artwork.alt} fill loading="eager" sizes="(max-width: 767px) 95vw, 800px" className="object-contain p-3 sm:p-5" />
            </div>
            <div className="flex flex-col border-t border-outline-variant p-5 md:border-l md:border-t-0 md:p-6">
              <p className="label-caps mb-3 text-[10px] text-neon-accent">{labels[artwork.category]}</p>
              <h2 id="work-view-title" className="text-2xl leading-tight">{artwork.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">{artwork.alt}</p>
              <div className="mt-7 border-t border-outline-variant pt-5 md:mt-auto">
                <p className="mb-4 text-sm text-on-surface-variant">Have a photo you love? Make a frame of your own.</p>
                <Link href="/design/start" className="flex min-h-12 items-center justify-between gap-4 bg-neon-accent px-4 font-label text-xs font-bold uppercase text-black hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent">Start framing <ArrowUpRight size={19} aria-hidden="true" /></Link>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-outline-variant px-4 py-2 sm:px-6">
          <button type="button" aria-label="Previous artwork" disabled={items.length < 2} onClick={() => move(-1)} className="flex min-h-11 items-center gap-2 px-2 font-label text-xs uppercase hover:text-neon-accent disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-neon-accent"><ArrowLeft size={18} aria-hidden="true" /> Previous</button>
          <span aria-live="polite" className="font-label text-xs tabular-nums text-on-surface-variant">{String((selected ?? 0) + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
          <button type="button" aria-label="Next artwork" disabled={items.length < 2} onClick={() => move(1)} className="flex min-h-11 items-center gap-2 px-2 font-label text-xs uppercase hover:text-neon-accent disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-neon-accent">Next <ArrowRight size={18} aria-hidden="true" /></button>
        </div>
        </div>
      </dialog>
    </>
  );
}
