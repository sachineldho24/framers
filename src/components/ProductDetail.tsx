"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Frame } from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";

/**
 * Product detail / options screen (POSTERX product-options mockup).
 *
 * Adaptations vs. the static mockup, given our data model:
 * - SIZE buttons switch between sibling frames (each size is its own product
 *   with its own slug + price), navigating to that frame's page.
 * - MATERIAL is visual-only for v1: the schema has no material column or
 *   per-material pricing yet (see plan/08 — needs a product decision). It is
 *   selectable but does not persist or change the price. FLAGGED.
 * - The CTA routes into the stepped designer (/design/start) where the real
 *   frame style + finish are chosen (see plan/11). Material is no longer a
 *   cosmetic selector here.
 */

export function ProductDetail({
  frame,
  siblings,
  sampleImage,
}: {
  frame: Frame;
  siblings: Frame[];
  sampleImage: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function chooseDesignMethod() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const dest = `/design/start?frameId=${frame.id}`;
    router.push(
      user ? dest : `/login?next=${encodeURIComponent(dest)}`
    );
  }

  return (
    <main className="pb-36 pt-16">
      {/* Hero preview */}
      <section className="flex flex-col items-center justify-center overflow-hidden border-b-2 border-border-high-contrast bg-surface-muted px-margin-mobile py-12">
        <div className="group relative">
          <div className="relative z-10 border-[12px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] transition-transform duration-300 hover:-translate-x-2 hover:-translate-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sampleImage}
              alt={`${frame.name} preview`}
              className="block h-auto w-[300px] md:w-[400px]"
            />
          </div>
        </div>

        <div className="mt-16 text-center">
          <span className="label-caps mb-4 inline-block bg-black px-3 py-1 text-white">
            Premium Series
          </span>
          <h1 className="mb-2 mt-4 text-[28px]">{frame.name}</h1>
          <p className="font-display text-[48px] font-black leading-none text-action-red">
            {formatPaise(frame.price_paise)}
          </p>
        </div>
      </section>

      {/* Configuration */}
      <section className="mx-auto max-w-4xl space-y-12 px-margin-mobile py-12">
        {/* Size — switches between sibling frames */}
        <div className="space-y-6">
          <SectionLabel>Select Size</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            {siblings.map((s) => {
              const active = s.id === frame.id;
              return (
                <button
                  key={s.id}
                  onClick={() => !active && router.push(`/frames/${s.slug}`)}
                  className={`border-2 border-black py-4 font-bold uppercase transition-all hover:bg-black hover:text-white ${
                    active ? "bg-black text-white" : ""
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Technical bento */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="flex flex-col justify-between border-2 border-black bg-surface-muted p-6">
            <Icon name="high_quality" className="mb-4 text-4xl" />
            <div>
              <p className="label-caps mb-1 text-[10px]">Paper Quality</p>
              <p className="text-sm font-bold uppercase">300 GSM Archival</p>
            </div>
          </div>
          <div className="flex flex-col justify-between bg-black p-6 text-white">
            <Icon name="ink_pen" className="mb-4 text-4xl text-neon-accent" />
            <div>
              <p className="label-caps mb-1 text-[10px] text-surface-container-high">
                Ink System
              </p>
              <p className="text-sm font-bold uppercase">12-Color Pigment</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {frame.description && (
          <div className="border-t-2 border-surface-container-highest pt-8">
            <p className="leading-relaxed text-on-surface-variant">
              {frame.description}
            </p>
          </div>
        )}

        <div className="text-center text-xs">
          <p className="label-caps text-on-surface-variant">
            Dimensions: {frame.width_mm} × {frame.height_mm} mm
          </p>
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t-2 border-black bg-white/80 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          <button
            onClick={chooseDesignMethod}
            disabled={loading}
            className="w-full border-2 border-black bg-action-red py-5 font-bold uppercase tracking-widest text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Loading…" : "Choose Design Method"}
          </button>
        </div>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-1 w-12 bg-black" />
      <h2 className="label-caps">{children}</h2>
    </div>
  );
}
