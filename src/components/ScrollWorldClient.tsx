"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  WORLD_FRAME_SEQUENCE,
  WORLD_SCENES,
} from "@/components/scroll-world/content";
import {
  FrameSequencePlayer,
} from "@/components/scroll-world/FrameSequencePlayer";
import {
  recoverBrokenImage,
  selectInitialImageSource,
} from "@/components/scroll-world/imageFallback";
import {
  buildTimeline,
  getActiveSceneIndex,
  getCopyCrossfade,
  getSegmentProgress,
  getStoryboardTime,
  type ScrollTimeline,
} from "@/components/scroll-world/timeline";

import styles from "./ScrollWorldClient.module.css";

type NetworkInformation = {
  saveData?: boolean;
};

// Per-item stagger indices handed to CSS custom properties for the reveal cascade.
type CSSWordVars = CSSProperties &
  Partial<Record<"--char-index" | "--tag-index", number>>;

// Split-flap headline: each character is a hinged 3D tile that flips up into
// place, staggered by a running index so the whole line cascades. Words stay
// intact (whitespace between them) so wrapping and text-balancing still work.
// The visible title is exposed via aria-label on the <h2>; tiles are hidden.
const renderFlipTitle = (title: string) => {
  let charIndex = 0;
  return title.split(" ").map((word, wordIndex) => (
    <span key={`${word}-${wordIndex}`} className={styles.flipWord} aria-hidden="true">
      {[...word].map((char, i) => {
        const index = charIndex++;
        return (
          <span
            key={`${char}-${i}`}
            className={styles.flipChar}
            style={{ "--char-index": index } as CSSWordVars}
          >
            {char}
          </span>
        );
      })}
    </span>
  ));
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

const shortSide = () => Math.min(window.innerWidth, window.innerHeight);

export function ScrollWorldClient() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const imageRefs = useRef<Array<HTMLImageElement | null>>([]);
  const copyRefs = useRef<Array<HTMLElement | null>>([]);
  const timelineRef = useRef<ScrollTimeline>({ segments: [], totalHeight: 0 });
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!root || !track) return;

    const mountedImages = [...imageRefs.current];
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const connection = (navigator as Navigator & {
      connection?: NetworkInformation;
    }).connection;
    // Reduced-motion and data-saver users keep the still/copy experience and make
    // zero frame-sequence requests: the player is never created for them.
    const stillsOnly = reducedMotion || Boolean(connection?.saveData);
    const imagePreloaders: HTMLImageElement[] = [];
    let disposed = false;
    let updateFrame = 0;
    let currentActive = -1;
    let laidOutWidth = window.innerWidth;
    let player: FrameSequencePlayer | null = null;
    const seoBlock = document.querySelector<HTMLElement>("[data-sw-seo]");

    document.body.classList.add("world-active");
    if (seoBlock) seoBlock.hidden = true;

    const preloadStill = (index: number) => {
      const image = mountedImages[index];
      if (!image) return;
      const scene = WORLD_SCENES[index];
      const candidates = [scene.poster, scene.still, scene.fallbackStill].filter(
        (source): source is string => Boolean(source),
      );
      const preloader = new Image();
      let candidateIndex = 0;

      const tryNext = () => {
        const candidate = candidates[candidateIndex++];
        if (candidate) preloader.src = candidate;
      };

      preloader.onload = () => {
        if (!disposed) image.src = preloader.src;
      };
      preloader.onerror = tryNext;
      imagePreloaders.push(preloader);
      tryNext();
    };

    // Scene 1 is the first paint — load it now. The remaining stills are only a
    // pre-canvas fallback (the scrubber owns imagery once decoded), so defer them
    // to idle time to keep the initial fetch off the critical path.
    preloadStill(0);
    const deferRest = () => {
      if (disposed) return;
      for (let index = 1; index < mountedImages.length; index += 1) {
        preloadStill(index);
      }
    };
    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(deferRest, { timeout: 1500 })
        : window.setTimeout(deferRest, 400);

    const markFilmReady = () => {
      if (disposed || !canvas) return;
      // Fade the canvas in only after its first valid frame is drawn, so first
      // paint never flashes black over the still.
      canvas.classList.add(styles.filmReady);
    };

    if (!stillsOnly && canvas) {
      try {
        player = new FrameSequencePlayer(
          canvas,
          WORLD_FRAME_SEQUENCE,
          shortSide(),
          markFilmReady,
        );
      } catch {
        player = null;
      }
    }

    const update = () => {
      const timeline = timelineRef.current;
      if (timeline.segments.length === 0) return;

      const y = window.scrollY || window.pageYOffset;
      const active = getActiveSceneIndex(timeline.segments, y);
      const segment = timeline.segments[active];
      const rawProgress = getSegmentProgress(segment, y);
      const scene = WORLD_SCENES[active];
      const nextIndex = Math.min(active + 1, WORLD_SCENES.length - 1);

      // Scroll -> storyboard time -> deterministic frame. rAF-coalesced upstream.
      player?.seek(getStoryboardTime(scene, rawProgress));

      if (active !== currentActive) {
        currentActive = active;
        setActiveScene(active);
      }

      sceneRefs.current.forEach((node) => {
        if (node) node.style.opacity = "0";
      });

      const transition =
        nextIndex === active ? 0 : smoothstep((rawProgress - 0.88) / 0.12);
      const activeNode = sceneRefs.current[active];
      const nextNode = sceneRefs.current[nextIndex];
      if (activeNode) activeNode.style.opacity = String(1 - transition);
      if (nextNode && nextIndex !== active) {
        nextNode.style.opacity = String(transition);
      }

      imageRefs.current.forEach((image, index) => {
        if (!image) return;
        const localProgress = index === active ? rawProgress : 0;
        image.style.transform = `scale(${(1.01 + localProgress * 0.025).toFixed(4)})`;
      });

      copyRefs.current.forEach((copy, index) => {
        if (!copy) return;

        const copyTransition = getCopyCrossfade(
          rawProgress,
          nextIndex !== active,
        );
        const opacity =
          index === active
            ? copyTransition.current
            : index === nextIndex
              ? copyTransition.next
              : 0;

        copy.style.opacity = String(opacity);
        copy.style.pointerEvents = opacity > 0.58 ? "auto" : "none";
        const offset = (1 - opacity) * (window.innerWidth <= 860 ? 18 : 26);
        copy.style.transform =
          window.innerWidth <= 860
            ? `translateY(${offset.toFixed(2)}px)`
            : `translate(${(
                (index % 2 === 0 ? -1 : 1) * offset
              ).toFixed(2)}px, calc(-50% + ${(
                offset * 0.35
              ).toFixed(2)}px))`;
      });

      if (hintRef.current) {
        hintRef.current.style.opacity = String(clamp(1 - y / 460));
      }
    };

    const layout = () => {
      laidOutWidth = window.innerWidth;
      const mobileFactor = window.innerWidth <= 860 ? 1.12 : 1;
      timelineRef.current = buildTimeline(
        WORLD_SCENES,
        window.innerHeight,
        mobileFactor,
      );
      track.style.height = `${timelineRef.current.totalHeight}px`;
      player?.resize();
      update();
    };

    const requestUpdate = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = 0;
        update();
      });
    };

    const onResize = () => {
      // Ignore height-only resizes on touch (mobile URL-bar collapse) so the
      // page never jumps; a real width change re-lays-out and re-sizes the canvas.
      if (window.innerWidth === laidOutWidth && window.innerWidth <= 860) return;
      layout();
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", layout);

    layout();

    return () => {
      disposed = true;
      if (updateFrame) window.cancelAnimationFrame(updateFrame);
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", layout);
      imagePreloaders.forEach((preloader) => {
        preloader.onload = null;
        preloader.onerror = null;
      });
      player?.dispose();
      document.body.classList.remove("world-active");
      if (seoBlock) seoBlock.hidden = false;
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root} aria-label="Inside Framers Lab">
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Framers Lab home">
          <strong>Framers Lab</strong>
          <span>The world of a frame</span>
        </Link>

        <Link href="/design/start" className={styles.topCta}>
          Frame yours
        </Link>
      </header>

      <div className={styles.stage} aria-hidden="true">
        {WORLD_SCENES.map((scene, index) => (
          <div
            key={scene.id}
            ref={(node) => {
              sceneRefs.current[index] = node;
            }}
            className={styles.scene}
            style={{ opacity: index === 0 ? 1 : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(node) => {
                imageRefs.current[index] = node;
              }}
              src={selectInitialImageSource(
                scene.poster ?? scene.still,
                scene.fallbackStill,
              )}
              alt=""
              decoding={index === 0 ? "sync" : "async"}
              loading={index < 2 ? "eager" : "lazy"}
              onError={(event) => {
                recoverBrokenImage(event.currentTarget, scene.fallbackStill);
              }}
            />
          </div>
        ))}
        <canvas ref={canvasRef} className={styles.film} aria-hidden="true" />
        <div className={styles.scrim} />
        <div className={styles.filmGrain} />
      </div>

      <div className={styles.copyLayer}>
        {WORLD_SCENES.map((scene, index) => (
          <article
            key={scene.id}
            ref={(node) => {
              copyRefs.current[index] = node;
            }}
            className={styles.copy}
            data-story-stage={scene.id}
            data-active={activeScene === index ? "true" : "false"}
            style={{ opacity: index === 0 ? 1 : 0 }}
          >
            <div className={styles.copyMeta}>
              <span>{scene.eyebrow}</span>
            </div>
            <h2 aria-label={scene.title}>
              {renderFlipTitle(scene.title)}
            </h2>
            <p>{scene.body}</p>
            <ul>
              {scene.tags.map((tag, tagIndex) => (
                <li key={tag} style={{ "--tag-index": tagIndex } as CSSWordVars}>
                  {tag}
                </li>
              ))}
            </ul>
            {index === WORLD_SCENES.length - 1 ? (
              <div className={styles.actions}>
                <Link href="/design/start">Start your frame</Link>
                <Link href="/#frames">View the collection</Link>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div ref={hintRef} className={styles.hint} aria-hidden="true">
        <span>Scroll through the lab</span>
        <i />
      </div>

      <div ref={trackRef} className={styles.track} aria-hidden="true" />
    </div>
  );
}
