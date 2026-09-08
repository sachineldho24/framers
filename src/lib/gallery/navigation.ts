export const clampProgress = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function wheelDistance(delta: number, mode: number, height: number) {
  return delta * (mode === 1 ? 16 : mode === 2 ? height : 1);
}

export function nearestStop(progress: number, stops: readonly number[]) {
  return stops.reduce((best, stop, index) =>
    Math.abs(stop - progress) < Math.abs(stops[best] - progress) ? index : best, 0);
}

/** One clock for every input source. No React or browser dependency. */
export class TourProgress {
  current = 0;
  target = 0;
  paused = false;
  private transition: { from: number; to: number; elapsed: number; duration: number } | null = null;

  get moving() { return !this.paused && (this.transition !== null || this.current !== this.target); }

  seek(value: number, immediate = false) {
    if (this.paused) return;
    this.transition = null;
    this.target = clampProgress(value);
    if (immediate) this.current = this.target;
  }

  nudge(delta: number) {
    if (this.paused) return;
    if (this.transition) this.target = this.current;
    this.seek(this.target + delta);
  }

  goTo(value: number, immediate = false) {
    if (this.paused) return;
    const to = clampProgress(value);
    if (immediate) { this.seek(to, true); return; }
    this.target = to;
    this.transition = { from: this.current, to, elapsed: 0, duration: Math.max(0.65, Math.abs(to - this.current) * 7) };
  }

  tick(seconds: number) {
    if (this.paused) return this.current;
    const dt = Math.max(0, Math.min(seconds, 0.1));
    if (this.transition) {
      const t = this.transition;
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      this.current = t.from + (t.to - t.from) * ease;
      if (p === 1) { this.current = t.to; this.transition = null; }
    } else {
      this.current += (this.target - this.current) * (1 - Math.exp(-dt / 0.22));
      if (Math.abs(this.target - this.current) < 0.00001) this.current = this.target;
    }
    return this.current;
  }

  pause() { this.target = this.current; this.transition = null; this.paused = true; }
  resume() { this.paused = false; }
}
