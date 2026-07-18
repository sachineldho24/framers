export type FrameTier = "desktop" | "mobile";

export type FrameManifest = {
  fps: number;
  frameCount: number;
  duration: number;
};

export type FrameSource = {
  baseUrl: string;
  pattern: string;
};

/**
 * Maps a storyboard time (seconds) to a deterministic frame index. The master is
 * sampled at a fixed fps, so index = round(time * fps), clamped to the sequence and
 * defensive against NaN/Infinity from a mid-seek read.
 */
export function timeToFrameIndex(time: number, manifest: FrameManifest): number {
  if (!Number.isFinite(time)) return 0;
  const last = Math.max(0, manifest.frameCount - 1);
  const index = Math.round(time * manifest.fps);
  return Math.min(last, Math.max(0, index));
}

/**
 * Phone-class devices (short side <= 600 CSS px) scrub the lighter 960x540 tier;
 * tablets and desktops get the 1920x1080 master. Deterministic on the short side.
 */
export function selectFrameTier(shortSideCssPx: number): FrameTier {
  return shortSideCssPx <= 600 ? "mobile" : "desktop";
}

export type PreloadPlan = {
  current: number;
  direction: number;
  ahead: number;
  behind: number;
  frameCount: number;
};

/**
 * Directional sliding preload window: the exact requested frame first, then more
 * frames in the current scroll direction than behind it. Never emits an out-of-range
 * or duplicate index.
 */
export function planPreload(plan: PreloadPlan): number[] {
  const { current, ahead, behind, frameCount } = plan;
  const dir = plan.direction < 0 ? -1 : 1;
  const order: number[] = [];
  const push = (index: number) => {
    if (index >= 0 && index < frameCount && !order.includes(index)) {
      order.push(index);
    }
  };

  push(current);
  for (let i = 1; i <= ahead; i += 1) push(current + dir * i);
  for (let i = 1; i <= behind; i += 1) push(current - dir * i);

  return order;
}

export type CoverGeometry = {
  drawWidth: number;
  drawHeight: number;
  dx: number;
  dy: number;
};

/**
 * `object-fit: cover` geometry for drawing a source frame into a target box: scale so
 * the frame fully covers the box, then centre the overflow.
 */
export function coverGeometry(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
): CoverGeometry {
  const scale = Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  return {
    drawWidth,
    drawHeight,
    dx: (boxWidth - drawWidth) / 2,
    dy: (boxHeight - drawHeight) / 2,
  };
}

const pad4 = (index: number) => String(index).padStart(4, "0");

export function frameUrl(
  source: FrameSource,
  tier: FrameTier,
  index: number,
): string {
  const file = source.pattern.replace("####", pad4(index));
  return `${source.baseUrl}/${tier}/${file}`;
}

type Closable = { close: () => void };

/**
 * Bounded least-recently-used cache of decoded frames. Evicting or clearing a decoded
 * bitmap calls `close()` so the browser can release its backing memory immediately.
 */
export class LruBitmapCache<T extends Closable> {
  private readonly capacity: number;
  private readonly map = new Map<number, T>();

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  get size(): number {
    return this.map.size;
  }

  has(index: number): boolean {
    return this.map.has(index);
  }

  get(index: number): T | undefined {
    const value = this.map.get(index);
    if (value === undefined) return undefined;
    // Refresh recency: delete + re-insert moves it to the newest position.
    this.map.delete(index);
    this.map.set(index, value);
    return value;
  }

  set(index: number, value: T): void {
    if (this.map.has(index)) {
      this.map.delete(index);
    }
    this.map.set(index, value);

    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.map.get(oldest);
      this.map.delete(oldest);
      evicted?.close();
    }
  }

  clear(): void {
    for (const value of this.map.values()) {
      value.close();
    }
    this.map.clear();
  }
}
