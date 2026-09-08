"use client";

import { motion, useReducedMotion } from "motion/react";

import { TESTIMONIALS } from "@/lib/storefront-content";
import { distributeTestimonials } from "@/components/ui/testimonial-columns";
import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";

/** Per-column loop lengths. Deliberately co-prime-ish so the three columns
 *  never line up into a single scrolling block. */
const COLUMN_DURATIONS = [15, 19, 17];

/**
 * Customer quotes as three vertically looping columns, between the category grid
 * and the newsletter block — social proof belongs after the visitor knows what
 * is on sale and before they are asked for an email address.
 *
 * A client component because the marquee is a `motion` transform and because
 * `prefers-reduced-motion` decides the layout: with motion the columns are
 * clamped and masked into a 740px window, without it they render at full height
 * so every quote is still readable.
 */
export function Testimonials() {
  const reduce = useReducedMotion();
  const columns = distributeTestimonials(TESTIMONIALS, 3);

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-title"
      className="relative scroll-mt-16 bg-surface px-margin-mobile py-section"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="mx-auto flex max-w-[540px] flex-col items-center justify-center text-center"
        >
          <span className="label-caps border-2 border-border-high-contrast px-4 py-1 text-[10px]">
            Testimonials
          </span>

          <h2
            id="testimonials-title"
            className="mt-5 text-[clamp(1.75rem,5vw,3.5rem)] uppercase leading-none tracking-tighter"
          >
            What Our Customers Say
          </h2>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant sm:text-base">
            Photos uploaded from a phone, printed, framed and posted across
            India.
          </p>
        </motion.div>

        <div
          className={`mt-10 flex justify-center gap-6 ${
            reduce
              ? "items-start"
              : "max-h-[740px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]"
          }`}
        >
          {columns.map((column, index) => (
            <TestimonialsColumn
              key={index}
              testimonials={column}
              duration={COLUMN_DURATIONS[index]}
              animate={!reduce}
              // One column on a phone, two on a tablet, all three on a laptop —
              // the cards are a fixed 320px, so a third column below `lg` would
              // either overflow or squeeze the quotes into a ribbon.
              className={
                index === 1
                  ? "hidden md:block"
                  : index === 2
                    ? "hidden lg:block"
                    : undefined
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
