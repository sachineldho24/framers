"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET } from "@/lib/storage-shared";
import { patchDesignerState } from "@/lib/designer-state";
import { Icon } from "@/components/Icon";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB

/**
 * Step 2 — Upload. Split-screen: left copy + CTAs, right hard dashed drop-zone.
 * Preview is ephemeral (objectURL); the file is uploaded to Storage now so the
 * size/frame steps can reference a stable path, but nothing is ordered yet.
 *
 * Two ways in, because the photo isn't always what someone starts from. Upload
 * Image is the primary path and stays first. Open Studio skips ahead to the
 * editor with a blank page — for a design built out of text, or a photo that
 * hasn't been found yet — and the editor's own Uploads panel adds the picture
 * later. The studio no longer needs a frame to open (it starts on A4 and the
 * Resize menu picks a real one), so this can't dead-end; the frame is still
 * required before Review, which is where it starts costing money.
 */
export function UploadStep({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const uploadInFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (uploadInFlight.current) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Please upload a JPG, PNG, WebP, or PDF file.");
      return;
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError(file.size === 0 ? "That file is empty. Please choose another file." : "File is too large (max 30 MB).");
      return;
    }

    uploadInFlight.current = true;
    setBusy(true);
    let objectUrl: string | null = null;
    try {
      const isImage = file.type !== "application/pdf";
      let imageWidth: number | null = null;
      let imageHeight: number | null = null;
      if (isImage) {
        objectUrl = URL.createObjectURL(file);
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => reject(new Error("That file isn't a readable image. Please choose another image."));
          img.src = objectUrl!;
        });
        imageWidth = dimensions.width;
        imageHeight = dimensions.height;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again before uploading your file.");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const uploadPath = `${user.id}/uploads/${crypto.randomUUID()}/source.${ext}`;
      const { error: upErr } = await supabase.storage.from(DESIGN_BUCKET)
        .upload(uploadPath, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const response = await fetch(`/api/design/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadPath }),
      });
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Please sign in again before uploading your file."
          : "Your file couldn't be saved to this design. Please try uploading again.");
      }
      patchDesignerState(sessionId, { uploadPath, previewObjectUrl: objectUrl, imageWidth, imageHeight });
      objectUrl = null; // Working state owns the successful preview until navigation.
      router.push(`/design/${sessionId}/size`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed. Check your connection and try again.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      uploadInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 pt-14 md:grid-cols-2">
      {/* Left — copy + action */}
      <section className="flex flex-col justify-center px-margin-mobile py-16 md:px-16">
        <h1 className="text-[40px] leading-[1.05] md:text-[48px]">
          Add Your Photo
        </h1>
        <p className="mt-4 max-w-md text-on-surface-variant">
          We&apos;ll show it inside your frame right away.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {["JPG / PNG / WEBP / PDF", "MAX 30 MB", "MIN 150 DPI"].map((c) => (
            <span
              key={c}
              className="label-caps bg-black px-3 py-1 text-white"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="brutalist-shadow brutalist-press flex w-full items-center justify-center gap-3 bg-action-red py-5 font-bold uppercase tracking-widest text-white disabled:opacity-60"
          >
            <Icon name="upload" className="text-[20px]" />
            {busy ? "Uploading…" : "Upload Image"}
          </button>

          {/* Secondary on purpose: most people have a photo, and the frame's
              proportions are easier to judge with one in place. */}
          <button
            onClick={() => router.push(`/design/${sessionId}/edit`)}
            disabled={busy}
            className="brutalist-press flex w-full items-center justify-center gap-3 border-2 border-border-high-contrast bg-surface py-5 font-bold uppercase tracking-widest text-on-background transition-colors hover:bg-surface-container hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red disabled:opacity-60"
          >
            <Icon name="brush" className="text-[20px]" />
            Open Studio
          </button>

          <p className="text-[13px] text-on-surface-variant">
            Start in the editor with a blank page — add text now and your photo
            whenever you like. You&apos;ll pick a frame size before checkout.
          </p>
        </div>

        {error && (
          <p role="alert" className="label-caps mt-6 max-w-sm border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleFile(f);
          }}
        />
      </section>

      {/* Right — drop zone */}
      <section className="flex items-center justify-center border-t-2 border-border-high-contrast bg-surface-muted px-margin-mobile py-16 md:border-l-2 md:border-t-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={`flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-center border-2 border-dashed ${
            dragOver ? "border-action-red bg-surface" : "border-border-high-contrast"
          }`}
        >
          <Icon name="image" className="text-6xl text-outline" />
          <p className="label-caps mt-4 text-on-surface-variant">
            Or drag &amp; drop here
          </p>
        </div>
      </section>
    </main>
  );
}
