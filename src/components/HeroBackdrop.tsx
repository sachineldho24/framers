"use client";

import { useEffect, useRef } from "react";
import styles from "./HeroBackdrop.module.css";

/** A single cached sprite supplies every poster; CSS moves only the row tracks. */
export function HeroBackdrop() {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;

    let visible = true;
    const syncPlayback = () => {
      backdrop.dataset.suspended = String(!visible || document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    });
    observer.observe(backdrop);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, []);

  return (
    <div ref={backdropRef} className={styles.backdrop} aria-hidden="true">
      <div className={styles.wall}>
        {/* Extra rows keep the smaller, tilted tiles covering the hero's corners. */}
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className={styles.track}>
            {/* Identical groups include their trailing gap for an exact loop seam. */}
            {[0, 1, 2, 3].map((copy) => (
              <div key={copy} className={styles.group}>
                {Array.from({ length: 7 }, (_, column) => (
                  <div
                    key={column}
                    className={styles.poster}
                    style={{ backgroundPosition: `${(column / 13) * 100}% ${(row % 3) * 50}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.scrim} />
    </div>
  );
}
