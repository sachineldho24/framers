import Link from "next/link";
import type { Frame } from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";

/**
 * Product card in the high-contrast mockup style: surface-muted pad, framed sample
 * image, hover border, optional NEW badge. Whole card links to frame detail.
 */
export function FrameCard({
  frame,
  sampleImage,
  isNew = false,
}: {
  frame: Frame;
  sampleImage: string;
  isNew?: boolean;
}) {
  return (
    <Link href={`/frames/${frame.slug}`} className="group flex flex-col">
      <div className="relative aspect-3/4 w-full border-2 border-transparent bg-surface-muted p-6 transition-all duration-300 group-hover:border-border-high-contrast">
        {isNew && (
          <span className="label-caps absolute left-4 top-4 z-10 bg-primary px-3 py-1 text-[10px] text-white">
            New
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sampleImage}
          alt={`${frame.name} sample`}
          className="h-full w-full border-2 border-black object-cover"
        />
      </div>
      <div className="mt-6 text-center">
        <h4 className="text-base font-bold uppercase">{frame.name}</h4>
        <p className="label-caps mt-1 text-on-surface-variant">
          {formatPaise(frame.price_paise)}
        </p>
      </div>
    </Link>
  );
}
