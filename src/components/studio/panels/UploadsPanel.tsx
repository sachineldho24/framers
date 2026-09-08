"use client";

/**
 * Uploads: the images available to this design, plus a way to add more.
 *
 * Clicking a thumbnail adds another layer using that same source — the image is
 * already uploaded and signed, so a second copy costs nothing but a layer.
 */

import Image from "next/image";

import { createImageLayer } from "@/lib/studio/document";
import { containBox } from "@/lib/studio/geometry";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, StudioButton } from "../ui";

export interface UploadEntry {
  /** Storage path, stored on the layer. */
  src: string;
  name: string;
  /** Signed or blob URL for display. */
  url: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export function UploadsPanel({
  uploads,
  onAddImage,
  uploading = false,
  error,
}: {
  uploads: UploadEntry[];
  onAddImage: () => void;
  uploading?: boolean;
  error?: string | null;
}) {
  const { doc, apply, select } = useStudio();

  function addLayer(entry: UploadEntry) {
    const naturalWidth = entry.naturalWidth ?? doc.width;
    const naturalHeight = entry.naturalHeight ?? doc.height;
    // Placed contained rather than at natural size: a 6000px phone photo would
    // otherwise land mostly off-page.
    const box = containBox(doc.width, doc.height, naturalWidth, naturalHeight);
    const layer = createImageLayer({
      src: entry.src,
      name: entry.name,
      naturalWidth,
      naturalHeight,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    apply({ type: "addLayer", layer });
    select(layer.id);
  }

  return (
    <div>
      <StudioButton
        variant="outline"
        icon="add_photo_alternate"
        onClick={onAddImage}
        disabled={uploading}
        aria-busy={uploading}
        className="mb-3 w-full"
      >
        {uploading ? "Uploading…" : "Upload an image"}
      </StudioButton>
      {error && <p role="alert" className="mb-3 text-sm text-[#a02a24]">{error}</p>}

      {uploads.length === 0 ? (
        <EmptyState
          icon="image"
          title="No images yet"
          body="Upload a photo or artwork to place it on the page."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {uploads.map((entry) => (
            <li key={entry.src}>
              <button
                type="button"
                onClick={() => addLayer(entry)}
                data-r="md"
                className="group relative block w-full overflow-hidden border border-[var(--studio-border)] bg-[var(--studio-canvas-bg)] transition-shadow hover:shadow-md"
                title={`Add ${entry.name} to the page`}
              >
                <span className="relative block aspect-square">
                  <Image
                    src={entry.url}
                    alt={entry.name}
                    fill
                    unoptimized
                    sizes="140px"
                    className="object-cover"
                  />
                </span>
                <span className="sr-only">Add {entry.name} to the page</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
