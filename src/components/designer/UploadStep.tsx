"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET } from "@/lib/storage-shared";
import { patchDesignerState } from "@/lib/designer-state";
import { Icon } from "@/components/Icon";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
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
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Please upload a JPG, PNG, or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 30 MB).");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/design/${sessionId}/upload`);
      return;
    }

    const ext = file.name.split(".").pop() ?? "bin";
    const uploadId = crypto.randomUUID();
    const uploadPath = `${user.id}/uploads/${uploadId}/source.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(DESIGN_BUCKET)
      .upload(uploadPath, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setBusy(false);
      return;
    }

    // Measure natural dimensions for the DPI / max-print logic on the next step.
    const isImage = file.type !== "application/pdf";
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    const objectUrl = isImage ? URL.createObjectURL(file) : null;
    if (objectUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          imageWidth = img.naturalWidth;
          imageHeight = img.naturalHeight;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = objectUrl;
      });
    }

    // Persist working state (client) + the session (server). The patch upserts,
    // so a session resumed in a fresh tab (no local record) still keeps this.
    patchDesignerState(sessionId, {
      uploadPath,
      previewObjectUrl: objectUrl,
      imageWidth,
      imageHeight,
    });

    await fetch(`/api/design/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadPath }),
    }).catch(() => null);

    router.push(`/design/${sessionId}/size`);
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
          {["JPG / PNG / PDF", "MAX 30 MB", "MIN 150 DPI"].map((c) => (
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
            className="brutalist-press flex w-full items-center justify-center gap-3 border-2 border-black bg-white py-5 font-bold uppercase tracking-widest text-black transition-colors hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red disabled:opacity-60"
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
          <p className="label-caps mt-6 max-w-sm border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </section>

      {/* Right — drop zone */}
      <section className="flex items-center justify-center border-t-2 border-black bg-surface-muted px-margin-mobile py-16 md:border-l-2 md:border-t-0">
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
            dragOver ? "border-action-red bg-white" : "border-black"
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
