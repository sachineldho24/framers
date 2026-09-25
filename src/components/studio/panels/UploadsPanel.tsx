"use client";

/**
 * Uploads: the images available to this design, plus a way to add more.
 *
 * Clicking a thumbnail adds another layer using that same source — the image is
 * already uploaded and signed, so a second copy costs nothing but a layer.
 *
 * The list is the user's photo library, not just this design's: anything they
 * have uploaded before is here to reuse without uploading again.
 */

import Image from "next/image";

import { createImageLayer } from "@/lib/studio/document";
import { containBox } from "@/lib/studio/geometry";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, IconButton, StudioButton } from "../ui";

/** Drag payload from an upload thumbnail: the upload's storage path. */
export const UPLOAD_DRAG_MIME = "application/x-framers-upload";

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
  onRemove,
  uploading = false,
  error,
}: {
  uploads: UploadEntry[];
  onAddImage: () => void;
  /** Take a photo out of the library. Absent = no remove control. */
  onRemove?: (src: string) => void;
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
      {error && <p role="alert" className="mb-3 text-sm text-[#ffb4ab]">{error}</p>}

      {uploads.length === 0 ? (
        <EmptyState
          icon="image"
          title="No images yet"
          body="Upload a photo or artwork to place it on the page. It stays in your uploads for your next design too."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {uploads.map((entry) => (
            <li key={entry.src} className="group/upl relative">
              <button
                type="button"
                onClick={() => addLayer(entry)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData(UPLOAD_DRAG_MIME, entry.src);
                }}
                data-r="md"
                className="group relative block w-full overflow-hidden border border-[var(--studio-border)] bg-[var(--studio-canvas-bg)] transition-shadow hover:shadow-md"
                title={`Add ${entry.name} to the page, or drag it onto a photo to replace it`}
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
              {onRemove && (
                // Positioned by this wrapper: IconButton lives inside its
                // Tooltip's element, which an `absolute` on the button would
                // anchor to instead of the thumbnail.
                <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/upl:opacity-100 group-focus-within/upl:opacity-100 [@media(hover:none)]:opacity-100">
                  <IconButton
                    icon="close"
                    label={`Remove ${entry.name} from your uploads`}
                    size="sm"
                    tooltipSide="top"
                    onClick={() => onRemove(entry.src)}
                    className="bg-black/65 text-white shadow-sm backdrop-blur-sm hover:bg-black/80"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
