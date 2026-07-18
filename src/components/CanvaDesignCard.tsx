"use client";

import { useStartDesign } from "@/lib/useStartDesign";
import { Icon } from "./Icon";

/** "Design in Canva" card on the design-method screen. */
export function CanvaDesignCard({
  frameId,
  frameSlug,
}: {
  frameId: string;
  frameSlug: string;
}) {
  const { start, loading, error } = useStartDesign(frameId, frameSlug);

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex h-16 w-16 items-center justify-center bg-black">
            <Icon name="palette" className="text-4xl text-white" />
          </div>
          <span className="label-caps border-2 border-black bg-neon-accent px-3 py-1">
            Easy Editor
          </span>
        </div>
        <h2 className="mb-4 text-[28px] uppercase">Design in Canva</h2>
        <p className="mb-8 text-base text-on-surface-variant">
          Use our templates on Canva.com. Access thousands of assets and
          professional layouts sized exactly for your frame.
        </p>
        {error && (
          <p className="label-caps mb-4 border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}
      </div>

      <div>
        <button
          onClick={start}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 border-2 border-black bg-black py-5 font-bold uppercase text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 disabled:opacity-60"
        >
          {loading ? "Starting…" : "Start Designing"}
          <Icon name="open_in_new" />
        </button>
        {/* Canva brand attribution — required at the integration entry point. */}
        <p className="label-caps mt-3 text-center text-on-surface-variant">
          Powered by Canva
        </p>
      </div>
    </div>
  );
}
