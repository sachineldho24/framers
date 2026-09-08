"use client";

import React from "react";
import { motion } from "motion/react";

/**
 * One vertically looping column of testimonial cards.
 *
 * The loop is the whole trick: the list is rendered twice and the track is
 * animated to `-50%`, so the moment the first copy has scrolled away the second
 * copy is exactly where the first started. No JS ticker, no scroll listener —
 * one transform the compositor owns.
 *
 * Adapted from the shadcn-style `testimonials-columns-1` block to this
 * codebase's design system: `globals.css` enforces `border-radius: 0` globally,
 * so the source's `rounded-3xl` was never going to render, and drop shadows are
 * replaced by the house `.brutalist-shadow` offset. Faces are initials tiles
 * rather than stock portraits — see the note above `TESTIMONIALS`.
 */

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  city: string;
  occasion: string;
};

/** Up to two initials from a display name, for the avatar tile. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

export function TestimonialCard({
  testimonial,
  ariaHidden = false,
}: {
  testimonial: Testimonial;
  /** True for the marquee's duplicate copy — same pixels, read once. */
  ariaHidden?: boolean;
}) {
  return (
    <figure
      aria-hidden={ariaHidden || undefined}
      className="brutalist-shadow w-full max-w-xs border-2 border-border-high-contrast bg-surface-lowest p-8"
    >
      <blockquote className="text-[15px] leading-6 text-on-surface">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center bg-primary font-display text-[14px] font-black leading-none text-on-primary"
        >
          {initialsOf(testimonial.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold leading-5">
            {testimonial.name}
          </span>
          <span className="label-caps block truncate text-[10px] leading-4 text-on-surface-variant">
            {testimonial.occasion} · {testimonial.city}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: readonly Testimonial[];
  duration?: number;
  /**
   * False under `prefers-reduced-motion`. The column then renders **one** copy
   * at its natural height instead of a stalled marquee — a paused loop inside
   * the section's `max-h` clamp would leave most of the quotes permanently
   * unreachable, since there is no scrollbar to reach them with.
   */
  animate?: boolean;
}) => {
  const animate = props.animate ?? true;

  if (!animate) {
    return (
      <div className={props.className}>
        <div className="flex flex-col gap-6">
          {props.testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={props.className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {new Array(2).fill(0).map((_, copy) => (
          <React.Fragment key={copy}>
            {props.testimonials.map((testimonial) => (
              <TestimonialCard
                key={`${copy}-${testimonial.id}`}
                testimonial={testimonial}
                ariaHidden={copy === 1}
              />
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
