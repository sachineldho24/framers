"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET } from "@/lib/storage-shared";
import { Icon } from "./Icon";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * "Upload Finished Art" path — Canva-independent.
 * Uploads the file straight to Supabase Storage from the browser (using the
 * user's session), then carries the print path to checkout via sessionStorage,
 * mirroring the Canva path's hand-off (see ExportController).
 */
export function UploadArtwork({
  frameId,
  frameSlug,
}: {
  frameId: string;
  frameSlug: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Please upload a JPG, PNG, or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 50 MB).");
      return;
    }

    setBusy(true);
    setFileName(file.name);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/frames/${frameSlug}`)}`);
      return;
    }

    // Stable-ish unique name without Math.random/Date in shared libs.
    const ext = file.name.split(".").pop() ?? "bin";
    const uploadId = crypto.randomUUID();
    const isPdf = file.type === "application/pdf";
    const printPath = `${user.id}/uploads/${uploadId}/print.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(DESIGN_BUCKET)
      .upload(printPath, file, { contentType: file.type, upsert: false });

    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setBusy(false);
      return;
    }

    // Preview only for images (PDF has no inline preview in v1).
    const previewPath = isPdf ? null : printPath;

    sessionStorage.setItem(
      "framers_checkout",
      JSON.stringify({
        designSource: "upload",
        frameId,
        printPath,
        previewPath,
        designId: null,
      })
    );
    router.push("/checkout");
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex h-16 w-16 items-center justify-center bg-black">
            <Icon name="upload_file" className="text-4xl text-white" />
          </div>
          <span className="label-caps border-2 border-border-high-contrast bg-action-red px-3 py-1 text-white">
            Pro Upload
          </span>
        </div>
        <h2 className="mb-4 text-[28px] uppercase">Upload Finished Art</h2>
        <p className="mb-8 text-base text-on-surface-variant">
          Already have a design? Upload it here. Supports high-res JPG, PNG, and
          PDF. Minimum 300 DPI recommended.
        </p>
        {fileName && !error && (
          <p className="label-caps mb-4 text-on-surface-variant">
            {busy ? "Uploading" : "Selected"}: {fileName}
          </p>
        )}
        {error && (
          <p className="label-caps mb-4 border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}
      </div>

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
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 border-2 border-border-high-contrast bg-surface py-5 font-bold uppercase text-on-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload File"}
        <Icon name="cloud_upload" />
      </button>
    </div>
  );
}
