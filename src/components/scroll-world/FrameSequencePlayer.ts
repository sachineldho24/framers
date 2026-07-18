import {
  coverGeometry,
  frameUrl,
  LruBitmapCache,
  planPreload,
  selectFrameTier,
  timeToFrameIndex,
  type FrameManifest,
  type FrameSource,
  type FrameTier,
} from "./frameSequence";

export type FrameSequenceManifest = FrameManifest &
  FrameSource & {
    tiers: Record<FrameTier, { width: number; height: number }>;
  };

type DecodedFrame = {
  width: number;
  height: number;
  close: () => void;
  draw: (
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => void;
};

const DESKTOP_CACHE = 14;
const MOBILE_CACHE = 16;
const DESKTOP_AHEAD = 8;
const DESKTOP_BEHIND = 2;
const MOBILE_AHEAD = 5;
const MOBILE_BEHIND = 2;
const MAX_CONCURRENCY = 4;
const MAX_DPR = 2;

// Scrub easing (see docs/plans/…eight-stage-scroll-world-design.md "Motion
// design"): rather than snapping to the exact frame for the newest scroll
// position, an internal rAF loop eases a displayed time toward that target.
// EASE_TAU_MS is the exponential catch-up time constant — smaller is snappier,
// larger is more cinematic lag. MAX_TRAVERSE_FPS caps how many film frames the
// displayed time can cross per real second so even a hard flick "flies" through
// frames continuously instead of jumping past the preload window to a nearest-
// frame fallback (the staccato the direct-seek version produced).
const EASE_TAU_MS = 90;
const MAX_TRAVERSE_FPS = 210;
// After a tab is backgrounded the next rAF dt is huge; cap it so the ease takes
// a normal-sized step rather than lurching.
const MAX_TICK_MS = 64;

const supportsBitmap =
  typeof createImageBitmap === "function" &&
  typeof fetch === "function";

/**
 * Wraps a decoded source (ImageBitmap when available, else a decoded
 * HTMLImageElement) behind a uniform draw/close surface so the renderer treats
 * both identically.
 */
function wrapBitmap(bitmap: ImageBitmap): DecodedFrame {
  return {
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
    draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(bitmap, dx, dy, dw, dh),
  };
}

function wrapImage(image: HTMLImageElement): DecodedFrame {
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => {
      image.src = "";
    },
    draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(image, dx, dy, dw, dh),
  };
}

/**
 * Canvas image-sequence renderer. Scroll drives a storyboard time; the player
 * maps time -> frame index, draws the exact frame when decoded (else the nearest
 * cached frame, never blocking scroll), and keeps decode work + memory bounded
 * via a directional preload window, a concurrency cap, and an LRU bitmap cache.
 *
 * All DOM/network work lives here so the React layer stays declarative and the
 * pure mapping helpers (frameSequence.ts) stay unit-testable.
 */
export class FrameSequencePlayer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly manifest: FrameSequenceManifest;
  private readonly tier: FrameTier;
  private readonly cache: LruBitmapCache<DecodedFrame>;
  private readonly ahead: number;
  private readonly behind: number;

  private readonly inFlight = new Map<number, AbortController>();
  private disposed = false;
  private firstDrawn = false;
  private drawnIndex = -1;
  private targetIndex = 0;
  private direction = 1;
  private activeInFlight = 0;
  private cssWidth = 0;
  private cssHeight = 0;

  // Scrub-easing state: `targetTime` is where scroll wants us; `displayTime` is
  // the eased value actually shown. The rAF loop runs only while they differ.
  private targetTime = 0;
  private displayTime = 0;
  private easeRaf = 0;
  private lastTickMs = 0;

  private onFirstDraw?: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    manifest: FrameSequenceManifest,
    shortSideCssPx: number,
    onFirstDraw?: () => void,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d canvas context unavailable");
    this.ctx = ctx;
    this.manifest = manifest;
    this.tier = selectFrameTier(shortSideCssPx);
    this.onFirstDraw = onFirstDraw;

    const mobile = this.tier === "mobile";
    this.cache = new LruBitmapCache<DecodedFrame>(
      mobile ? MOBILE_CACHE : DESKTOP_CACHE,
    );
    this.ahead = mobile ? MOBILE_AHEAD : DESKTOP_AHEAD;
    this.behind = mobile ? MOBILE_BEHIND : DESKTOP_BEHIND;
  }

  /** Whether a valid frame has painted (used to gate the canvas fade-in). */
  get hasPainted(): boolean {
    return this.firstDrawn;
  }

  /**
   * Match the backing store to the canvas's CSS layout box, DPR-capped at 2,
   * then repaint. CSS owns layout (desktop full-bleed, mobile cinematic band);
   * the player never sets inline styles.
   */
  resize(): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.drawnIndex >= 0) {
      const frame = this.cache.get(this.drawnIndex);
      if (frame) this.paint(frame);
    }
  }

  /**
   * Point the player at a storyboard time. Records the target and makes sure the
   * easing loop is running; the actual frame is drawn by that loop as the eased
   * `displayTime` catches up. Called every scroll rAF tick from the React layer.
   */
  seek(time: number): void {
    if (this.disposed) return;
    this.targetTime = Number.isFinite(time) ? time : 0;
    // First seek: land on the target immediately so initial paint isn't animated
    // in from time 0 (which would look like an unsolicited fly-through on load).
    if (!this.firstDrawn) {
      this.displayTime = this.targetTime;
      this.renderCurrent();
    }
    if (!this.easeRaf) {
      this.lastTickMs = 0;
      this.easeRaf = requestAnimationFrame(this.tick);
    }
  }

  /**
   * rAF-driven ease: move `displayTime` toward `targetTime` by an exponential
   * step (frame-rate independent), clamped to MAX_TRAVERSE_FPS so a hard flick
   * still traverses frame-by-frame instead of skipping past the preload window.
   * Stops itself once caught up so an idle page costs no rAF.
   */
  private readonly tick = (now: number): void => {
    this.easeRaf = 0;
    if (this.disposed) return;

    const dtMs = this.lastTickMs ? Math.min(MAX_TICK_MS, now - this.lastTickMs) : 16;
    this.lastTickMs = now;

    const remaining = this.targetTime - this.displayTime;
    // Frame-rate-independent exponential approach: fraction covered this tick.
    const easeStep = remaining * (1 - Math.exp(-dtMs / EASE_TAU_MS));
    const maxStep = (MAX_TRAVERSE_FPS / this.manifest.fps) * (dtMs / 1000);
    const clampedStep =
      Math.sign(easeStep) * Math.min(Math.abs(easeStep), maxStep);

    // Snap the last sub-frame gap so we always settle exactly on the target.
    const frameEpsilon = 0.5 / this.manifest.fps;
    if (Math.abs(remaining) <= frameEpsilon) {
      this.displayTime = this.targetTime;
    } else {
      this.displayTime += clampedStep;
    }

    this.renderCurrent();

    if (this.displayTime !== this.targetTime) {
      this.easeRaf = requestAnimationFrame(this.tick);
    } else {
      this.lastTickMs = 0;
    }
  };

  /** Draw the frame for the current `displayTime` and schedule its preload. */
  private renderCurrent(): void {
    const index = timeToFrameIndex(this.displayTime, this.manifest);
    if (index !== this.targetIndex) {
      this.direction = index >= this.targetIndex ? 1 : -1;
      this.targetIndex = index;
    }

    const exact = this.cache.get(index);
    if (exact) {
      if (index !== this.drawnIndex) this.paint(exact, index);
    } else {
      this.drawNearest(index);
    }

    this.pump();
  }

  private drawNearest(index: number): void {
    let best: DecodedFrame | undefined;
    let bestDistance = Infinity;
    for (let offset = 1; offset < this.manifest.frameCount; offset += 1) {
      const ahead = this.cache.get(index + offset);
      if (ahead) {
        best = ahead;
        bestDistance = offset;
        break;
      }
      const behind = this.cache.get(index - offset);
      if (behind) {
        best = behind;
        bestDistance = offset;
        break;
      }
    }
    if (best && bestDistance !== Infinity) {
      // Keep drawnIndex as-is so the exact frame still repaints once decoded.
      this.paint(best);
    }
  }

  private paint(frame: DecodedFrame, index?: number): void {
    if (this.cssWidth === 0 || this.cssHeight === 0) return;
    const geo = coverGeometry(
      frame.width,
      frame.height,
      this.cssWidth,
      this.cssHeight,
    );
    frame.draw(this.ctx, geo.dx, geo.dy, geo.drawWidth, geo.drawHeight);
    if (index !== undefined) this.drawnIndex = index;

    if (!this.firstDrawn) {
      this.firstDrawn = true;
      this.onFirstDraw?.();
    }
  }

  /** Launch fetch/decode for the preload window, up to the concurrency cap. */
  private pump(): void {
    if (this.disposed) return;
    const wanted = planPreload({
      current: this.targetIndex,
      direction: this.direction,
      ahead: this.ahead,
      behind: this.behind,
      frameCount: this.manifest.frameCount,
    });

    // Abort in-flight requests that fell outside the current window (stale after
    // a large scroll jump) so their slots free up for relevant frames.
    for (const [index, controller] of this.inFlight) {
      if (!wanted.includes(index)) {
        controller.abort();
        this.inFlight.delete(index);
        this.activeInFlight = Math.max(0, this.activeInFlight - 1);
      }
    }

    for (const index of wanted) {
      if (this.activeInFlight >= MAX_CONCURRENCY) break;
      if (this.cache.has(index) || this.inFlight.has(index)) continue;
      this.load(index);
    }
  }

  private load(index: number): void {
    const controller = new AbortController();
    this.inFlight.set(index, controller);
    this.activeInFlight += 1;
    const url = frameUrl(this.manifest, this.tier, index);

    this.decode(url, controller.signal)
      .then((frame) => {
        if (this.disposed || controller.signal.aborted) {
          frame?.close();
          return;
        }
        if (frame) {
          this.cache.set(index, frame);
          // If this is the frame the user is currently sitting on, paint it now.
          if (index === this.targetIndex && index !== this.drawnIndex) {
            this.paint(frame, index);
          }
        }
      })
      .catch(() => {
        /* transient fetch/decode failure: nearest-frame fallback covers it */
      })
      .finally(() => {
        this.inFlight.delete(index);
        this.activeInFlight = Math.max(0, this.activeInFlight - 1);
        if (!this.disposed) this.pump();
      });
  }

  private async decode(
    url: string,
    signal: AbortSignal,
  ): Promise<DecodedFrame | null> {
    if (supportsBitmap) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`frame ${response.status}`);
      const blob = await response.blob();
      if (signal.aborted) return null;
      const bitmap = await createImageBitmap(blob);
      return wrapBitmap(bitmap);
    }

    // HTMLImageElement.decode() fallback for browsers without createImageBitmap.
    return new Promise<DecodedFrame | null>((resolve, reject) => {
      const image = new Image();
      const onAbort = () => {
        image.src = "";
        reject(new Error("aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      image.src = url;
      image
        .decode()
        .then(() => {
          signal.removeEventListener("abort", onAbort);
          resolve(signal.aborted ? null : wrapImage(image));
        })
        .catch(reject);
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.easeRaf) {
      cancelAnimationFrame(this.easeRaf);
      this.easeRaf = 0;
    }
    for (const controller of this.inFlight.values()) controller.abort();
    this.inFlight.clear();
    this.activeInFlight = 0;
    this.cache.clear();
  }
}
