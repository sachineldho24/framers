/**
 * Balancing the testimonial marquee's columns.
 *
 * Pure and separate from the `.tsx` so it can be unit-tested — the original
 * component hard-coded `slice(0, 3) / slice(3, 6) / slice(6, 9)`, which silently
 * drops a tenth testimonial the day someone adds one. Same reason
 * `image-gallery-state.ts` sits next to `image-gallery.tsx`.
 */

/**
 * Split a list into `columnCount` contiguous, near-equal chunks.
 *
 * Contiguous rather than round-robin so each column still reads top to bottom in
 * the order the content module declares, and near-equal so the three marquees
 * are roughly the same height — a column with one fewer card loops visibly
 * faster than its neighbours.
 */
export function distributeTestimonials<T>(
  items: readonly T[],
  columnCount: number
): T[][] {
  const columns = Math.max(1, Math.floor(columnCount));
  const base = Math.floor(items.length / columns);
  const remainder = items.length % columns;

  const out: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < columns; i += 1) {
    // The first `remainder` columns carry the extra card.
    const size = base + (i < remainder ? 1 : 0);
    out.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return out;
}
