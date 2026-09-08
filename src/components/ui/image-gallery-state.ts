export function nextCreationIndex(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}

export function nearestCreationIndex(
  scrollLeft: number,
  itemOffsets: readonly number[]
): number {
  if (itemOffsets.length === 0) return 0;

  let nearest = 0;
  let distance = Math.abs(itemOffsets[0] - scrollLeft);

  for (let index = 1; index < itemOffsets.length; index += 1) {
    const candidate = Math.abs(itemOffsets[index] - scrollLeft);
    if (candidate < distance) {
      nearest = index;
      distance = candidate;
    }
  }

  return nearest;
}
