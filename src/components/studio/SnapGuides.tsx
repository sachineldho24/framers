"use client";

/**
 * Smart guides: the thin lines that appear mid-drag to say *why* the layer just
 * jumped.
 *
 * Without them a snap feels like the canvas fighting the pointer. With them it
 * reads as the app agreeing with what you were aiming at, which is the whole
 * point of the feature.
 *
 * DOM, like every overlay here, so nothing is ever drawn into the artwork that
 * would then be printed. Lines are one screen pixel at every zoom, and coloured
 * by what they mean: the accent for the page's own centre and edges, a quieter
 * ink for a neighbour it lined up with.
 */

import type { Viewport } from "@/lib/studio/geometry";
import type { SnapLine } from "@/lib/studio/snap";

const COLOUR: Record<SnapLine["kind"], string> = {
  "page-centre": "var(--studio-accent)",
  "page-edge": "var(--studio-accent)",
  safe: "var(--studio-accent)",
  layer: "rgba(22,22,26,0.55)",
};

export function SnapGuides({
  lines,
  viewport,
  page,
}: {
  lines: SnapLine[];
  viewport: Viewport;
  page: { width: number; height: number };
}) {
  if (lines.length === 0) return null;

  const left = viewport.offsetX;
  const top = viewport.offsetY;
  const width = page.width * viewport.scale;
  const height = page.height * viewport.scale;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[6] overflow-hidden"
    >
      {lines.map((line) => {
        const at =
          line.axis === "x"
            ? left + line.position * viewport.scale
            : top + line.position * viewport.scale;
        // Run the line the length of the page rather than the length of the
        // viewport: it is a statement about the print, and stopping at the paper
        // makes that legible.
        return (
          <span
            key={`${line.axis}-${line.position}-${line.kind}`}
            className="absolute"
            style={
              line.axis === "x"
                ? {
                    left: at,
                    top,
                    width: 1,
                    height,
                    background: COLOUR[line.kind],
                  }
                : {
                    left,
                    top: at,
                    width,
                    height: 1,
                    background: COLOUR[line.kind],
                  }
            }
          />
        );
      })}
    </div>
  );
}
