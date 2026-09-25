"use client";

/**
 * The decoded images, shared below the shell — for the two things that need
 * pixels rather than document state: photo colours and layer thumbnails.
 *
 * Photo colours are Canva's "Photo colours": the main inks of every picture on
 * the page, offered in each colour picker so a headline can pick up the red of
 * the car behind it without an eyedropper.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { StudioDocument } from "@/lib/studio/document";
import { extractPalette } from "@/lib/studio/photoPalette";
import type { ImageMap } from "@/lib/studio/render";

import { cx } from "./ui";

interface StudioAssets {
  /** Main colours of one image, most dominant first. [] until it has loaded. */
  paletteFor: (src: string) => string[];
  /** Colours across every visible photo on the page, deduplicated. */
  photoColours: string[];
  /** A displayable URL for an image layer's source, once decoded. */
  urlFor: (src: string) => string | null;
}

const AssetsContext = createContext<StudioAssets>({
  paletteFor: () => [],
  photoColours: [],
  urlFor: () => null,
});

const PER_PHOTO = 6;
const MAX_PHOTO_COLOURS = 12;

/**
 * Extraction reads pixels, so it runs once per decoded image, not per render.
 * Keyed by the image object, so a replaced or evicted image frees its entry.
 */
const paletteCache = new WeakMap<object, string[]>();

export function StudioAssetsProvider({
  doc,
  images,
  children,
}: {
  doc: StudioDocument;
  images: ImageMap;
  children: ReactNode;
}) {
  const value = useMemo<StudioAssets>(() => {
    const paletteFor = (src: string) => {
      const image = images.get(src);
      if (!image) return [];
      const known = paletteCache.get(image);
      if (known) return known;
      const palette = extractPalette(
        image as CanvasImageSource & { width: number; height: number },
        { count: PER_PHOTO }
      );
      paletteCache.set(image, palette);
      return palette;
    };

    const seen = new Set<string>();
    const photoColours: string[] = [];
    // Frontmost first: the photo on top is the one people are matching.
    for (const layer of [...doc.layers].reverse()) {
      if (layer.kind !== "image" || !layer.visible) continue;
      for (const colour of paletteFor(layer.src)) {
        if (seen.has(colour) || photoColours.length >= MAX_PHOTO_COLOURS) continue;
        seen.add(colour);
        photoColours.push(colour);
      }
    }

    const urlFor = (src: string) => {
      const image = images.get(src);
      return image && "src" in image ? (image as HTMLImageElement).src : null;
    };

    return { paletteFor, photoColours, urlFor };
  }, [doc.layers, images]);

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export function useStudioAssets() {
  return useContext(AssetsContext);
}

/**
 * "Photo colours" row for any colour picker. Renders nothing while the page has
 * no photos, so pickers don't grow an empty heading.
 */
export function PhotoColourSwatches({
  value,
  onPick,
  className,
}: {
  value?: string;
  onPick: (colour: string) => void;
  className?: string;
}) {
  const { photoColours } = useStudioAssets();
  if (photoColours.length === 0) return null;
  const current = value?.toLowerCase();
  return (
    <div className={className}>
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--studio-ink-muted)]">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          image
        </span>
        Photo colours
      </p>
      <div className="flex flex-wrap gap-1.5">
        {photoColours.map((colour) => (
          <button
            key={colour}
            type="button"
            data-r="full"
            title={colour.toUpperCase()}
            aria-label={`Use photo colour ${colour}`}
            aria-pressed={current === colour}
            onClick={() => onPick(colour)}
            style={{ backgroundColor: colour }}
            className={cx(
              "h-6 w-6 border transition-transform hover:scale-110",
              current === colour
                ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/40"
                : "border-[#353534]"
            )}
          />
        ))}
      </div>
    </div>
  );
}
