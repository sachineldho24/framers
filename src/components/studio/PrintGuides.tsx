"use client";

/**
 * Print guides: where the frame's lip lands.
 *
 * DOM rather than canvas, like every other overlay here — the artwork layer has
 * to stay exactly what gets printed, and a guide drawn into it would be printed
 * too. Positioned by the viewport transform, so it tracks pan and zoom for free.
 *
 * `pointer-events-none` throughout: this is information, never a target. Line
 * weights are in screen pixels (not scaled by the viewport) so the guide stays a
 * hairline at 8% zoom and doesn't turn into a 40 px band at 800%.
 *
 * Two things this deliberately no longer draws: a dashed safe-area rect and a
 * legend pill over the artwork. Both sat on top of the design by default and
 * read as part of it. The safe area still exists — it is what the stray-text
 * warning and snapping use — it just isn't decoration on the canvas.
 */

import type { Viewport } from "@/lib/studio/geometry";
import type { PrintGuideSet } from "@/lib/studio/print";

export function PrintGuides({
  guides,
  viewport,
  page,
}: {
  guides: PrintGuideSet;
  viewport: Viewport;
  page: { width: number; height: number };
}) {
  const { opening } = guides;

  /** Document rect → screen rect. */
  const box = (r: { x: number; y: number; width: number; height: number }) => ({
    left: viewport.offsetX + r.x * viewport.scale,
    top: viewport.offsetY + r.y * viewport.scale,
    width: r.width * viewport.scale,
    height: r.height * viewport.scale,
  });

  const openingBox = box(opening);
  const pageBox = box({ x: 0, y: 0, ...page });

  // Below a few pixels of inset the two rects are the same line, so the whole
  // thing stands down rather than drawing mush.
  if (openingBox.left - pageBox.left < 2) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
    >
      {/* The band the moulding covers. Tinted rather than outlined: "this part
          is hidden" is a region, not an edge. Drawn as the *border* of a
          page-sized box, so the four sides come out right at any zoom without
          four separate elements. */}
      <div
        className="absolute"
        style={{
          ...pageBox,
          borderStyle: "solid",
          borderColor: "rgba(22,22,26,0.10)",
          borderTopWidth: openingBox.top - pageBox.top,
          borderLeftWidth: openingBox.left - pageBox.left,
          borderRightWidth:
            pageBox.left + pageBox.width - (openingBox.left + openingBox.width),
          borderBottomWidth:
            pageBox.top + pageBox.height - (openingBox.top + openingBox.height),
        }}
      />

      {/* The opening: a solid hairline, because it is a real physical edge. */}
      <div
        className="absolute border border-[rgba(22,22,26,0.35)]"
        style={openingBox}
      />
    </div>
  );
}
