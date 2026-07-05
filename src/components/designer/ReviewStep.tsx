"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Frame,
  FrameStyle,
  Finish,
  DesignSource,
} from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { DESIGN_BUCKET } from "@/lib/storage-shared";
import { loadDesignerState } from "@/lib/designer-state";
import { useDesignerImage } from "@/lib/useDesignerImage";
import { CHECKOUT_STORAGE_KEY } from "@/lib/checkout";
import { FramePreview, type FramePreviewHandle } from "@/components/FramePreview";

const MM_PER_INCH = 25.4;

/** Step 5 — Review. Final framed preview, itemised price, → checkout. */
export function ReviewStep({
  sessionId,
  designSource,
  frame,
  style,
  finish,
  canvaDesignId,
  uploadPath,
}: {
  sessionId: string;
  designSource: DesignSource;
  frame: Frame;
  style: FrameStyle | null;
  finish: Finish | null;
  canvaDesignId: string | null;
  uploadPath: string | null;
}) {
  const router = useRouter();
  const { imageSrc } = useDesignerImage(sessionId);
  const previewRef = useRef<FramePreviewHandle>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total =
    frame.price_paise +
    (style?.price_modifier_paise ?? 0) +
    (finish?.price_modifier_paise ?? 0);

  const finalWIn = (frame.width_mm / MM_PER_INCH).toFixed(1);
  const finalHIn = (frame.height_mm / MM_PER_INCH).toFixed(1);

  async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function proceed() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/design/${sessionId}/review`);
      return;
    }

    // The print file: uploaded original (upload path) or — for Canva — the
    // exported file path carried in local state.
    const local = loadDesignerState(sessionId);
    const printPath = uploadPath ?? local?.uploadPath ?? null;

    if (designSource === "upload" && !printPath) {
      setError("Your artwork is missing. Please re-upload.");
      setBusy(false);
      return;
    }

    // Capture + upload the framed mockup composite.
    let mockupPath: string | null = null;
    const cap = previewRef.current?.capture();
    if (cap) {
      try {
        const blob = await dataUrlToBlob(cap.dataUrl);
        mockupPath = `${user.id}/sessions/${sessionId}/mockup.png`;
        const { error: upErr } = await supabase.storage
          .from(DESIGN_BUCKET)
          .upload(mockupPath, blob, {
            contentType: "image/png",
            upsert: true,
          });
        if (upErr) {
          // Non-fatal: continue without a mockup.
          console.error("mockup upload failed", upErr.message);
          mockupPath = null;
        }
      } catch {
        mockupPath = null;
      }
    }

    // Persist crop + mockup on the session.
    await fetch(`/api/design/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mockupPath,
        cropX: cap?.crop.x,
        cropY: cap?.crop.y,
        cropScale: cap?.crop.scale,
      }),
    }).catch(() => null);

    // Hand off to checkout.
    sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        designSource,
        frameId: frame.id,
        printPath: printPath ?? mockupPath, // canva fallback handled server-side
        previewPath: mockupPath,
        designId: canvaDesignId,
        sessionId,
        frameStyleId: style?.id ?? null,
        finishId: finish?.id ?? null,
        mockupPath,
      })
    );
    router.push("/checkout");
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-10 px-margin-mobile pb-24 pt-24 lg:grid-cols-2">
      {/* Preview */}
      <section className="flex items-start justify-center">
        <div className="w-full max-w-md border-2 border-black bg-white p-4">
          <FramePreview
            ref={previewRef}
            widthMm={frame.width_mm}
            heightMm={frame.height_mm}
            moldingColor={style?.molding_color ?? "#141414"}
            moldingWidthMm={style?.molding_width_mm ?? 22}
            finish={finish?.overlay_kind ?? "none"}
            imageSrc={imageSrc}
            editable={false}
          />
        </div>
      </section>

      {/* Spec + price */}
      <section>
        <h1 className="text-[32px] md:text-[40px]">Review Your Frame</h1>

        {designSource === "canva" && !imageSrc && (
          <p className="label-caps mt-4 border-2 border-black bg-surface-muted px-4 py-3">
            Finish designing in Canva, then export from the design screen to
            attach your artwork.
          </p>
        )}

        <table className="mt-8 w-full border-2 border-black text-left">
          <tbody className="label-caps">
            <Row k="Size" v={frame.name} />
            <Row k="Final framed size" v={`${finalWIn}″ × ${finalHIn}″`} />
            <Row k="Dimensions" v={`${frame.width_mm} × ${frame.height_mm} mm`} />
            <Row k="Frame style" v={style?.name ?? "—"} />
            <Row k="Finish" v={finish?.name ?? "—"} />
            <Row
              k="Source"
              v={designSource === "canva" ? "Canva design" : "Uploaded photo"}
            />
          </tbody>
        </table>

        {/* Itemised price */}
        <div className="mt-8 space-y-3 border-t-2 border-black pt-6">
          <PriceRow k="Frame" v={frame.price_paise} />
          {style && style.price_modifier_paise > 0 && (
            <PriceRow k={`Style — ${style.name}`} v={style.price_modifier_paise} />
          )}
          {finish && finish.price_modifier_paise > 0 && (
            <PriceRow
              k={`Finish — ${finish.name}`}
              v={finish.price_modifier_paise}
            />
          )}
          <div className="flex items-center justify-between border-t-2 border-black pt-3">
            <span className="text-[22px] font-black uppercase">Total</span>
            <span className="font-display text-[28px] font-black">
              {formatPaise(total)}
            </span>
          </div>
        </div>

        {error && (
          <p className="label-caps mt-6 border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}

        <button
          onClick={proceed}
          disabled={busy}
          className="brutalist-shadow brutalist-press mt-8 w-full bg-action-red py-5 font-bold uppercase tracking-widest text-white disabled:opacity-60"
        >
          {busy ? "Preparing…" : "Continue to Checkout"}
        </button>
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-black last:border-0">
      <th className="w-1/2 border-r border-black bg-surface-muted px-4 py-3 text-on-surface-variant">
        {k}
      </th>
      <td className="px-4 py-3 text-black">{v}</td>
    </tr>
  );
}

function PriceRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="label-caps text-on-surface-variant">{k}</span>
      <span className="font-bold">{formatPaise(v)}</span>
    </div>
  );
}
