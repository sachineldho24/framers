"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Frame, FrameStyle, Finish } from "@/lib/supabase/types";
import { formatPaise } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { uploadSessionFiles } from "@/lib/session-upload";
import { loadDesignerState } from "@/lib/designer-state";
import { useDesignerState } from "@/lib/useDesignerState";
import { useDesignerImage } from "@/lib/useDesignerImage";
import { CHECKOUT_STORAGE_KEY } from "@/lib/checkout";
import { docSizeForFrame } from "@/lib/studio/document";
import { documentDpi, photoInFrame } from "@/lib/studio/print";
import { FramePreview, type FramePreviewHandle } from "@/components/FramePreview";
import { Icon } from "@/components/Icon";

const MM_PER_INCH = 25.4;

/**
 * Step 5 — Review. Final framed preview, itemised price, → checkout.
 *
 * This is the money screen, so the hierarchy is deliberate: preview → specs →
 * total → one primary action. Three things are on purpose:
 *
 * - The total is the largest thing in the column and sits under a lighter
 *   divider, so it reads as a conclusion rather than one more table row.
 * - The primary button is black with a red hover, matching the pay button on
 *   the next screen. Red stays with the progress rail; a full-width wall of it
 *   here read as a warning and outweighed the product it was selling.
 * - On mobile the primary action is a fixed bottom bar. The spec table and the
 *   promises push a static button well below the fold, and this screen exists
 *   for exactly one action.
 *
 * Every promise at the bottom is one the site already makes elsewhere
 * (design-method's trust row, the marquee, /terms). Nothing new is invented on
 * the last screen before payment.
 */
export function ReviewStep({
  sessionId,
  frame,
  style,
  finish,
  uploadPath,
  printPath,
  printUrl,
}: {
  sessionId: string;
  frame: Frame;
  style: FrameStyle | null;
  finish: Finish | null;
  uploadPath: string | null;
  /** Studio flatten, when the editor has been used. Null before then. */
  printPath: string | null;
  printUrl: string | null;
}) {
  const router = useRouter();
  const upload = useDesignerImage(sessionId);
  const stored = useDesignerState(sessionId);
  const previewRef = useRef<FramePreviewHandle>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The edit wins over the source photo — including over the in-memory
  // objectURL `useDesignerImage` prefers, which is always the raw upload.
  const imageSrc = printUrl ?? upload.imageSrc;
  const edited = Boolean(printPath);

  const total =
    frame.price_paise +
    (style?.price_modifier_paise ?? 0) +
    (finish?.price_modifier_paise ?? 0);

  const finalWIn = (frame.width_mm / MM_PER_INCH).toFixed(1);
  const finalHIn = (frame.height_mm / MM_PER_INCH).toFixed(1);

  // What the *source photo* resolves to in this frame — the same figure the
  // Size step quoted, from the same helper, so the two screens can't disagree.
  // Shown only when the upload's pixels are known (a session resumed in a fresh
  // tab has none), and it describes the photo rather than the flattened page:
  // the studio's own readout stays the authority on a cropped or zoomed layer.
  const px = stored?.imageWidth ?? 0;
  const py = stored?.imageHeight ?? 0;
  const photo = useMemo(() => {
    if (px <= 0 || py <= 0) return null;
    const mm = { widthMm: frame.width_mm, heightMm: frame.height_mm };
    const page = docSizeForFrame(frame.width_mm, frame.height_mm);
    return photoInFrame({ width: px, height: py }, mm, documentDpi(page, mm));
  }, [px, py, frame]);

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

    // What goes to print: the studio's flatten if the editor was used, else the
    // uploaded original (a session that skipped the editor, or one saved before
    // migration 0008 gave us somewhere to record the path).
    const local = loadDesignerState(sessionId);
    const artworkPath = printPath ?? uploadPath ?? local?.uploadPath ?? null;

    if (!artworkPath) {
      setError("Your artwork is missing. Please re-upload.");
      setBusy(false);
      return;
    }

    // Capture + upload the framed mockup composite. Non-fatal: an order with no
    // preview image is worse than nothing, but not worth blocking payment over.
    // It goes through a signed target like the studio's flatten does — the path
    // is fixed, so coming back to this screen is an overwrite, and the browser's
    // own key is only granted INSERT on its folder.
    let mockupPath: string | null = null;
    const cap = previewRef.current?.capture();
    if (cap) {
      try {
        const blob = await dataUrlToBlob(cap.dataUrl);
        const saved = await uploadSessionFiles(sessionId, { mockup: blob });
        mockupPath = saved.mockup ?? null;
      } catch (e) {
        console.error("mockup upload failed", e);
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
        designSource: "upload",
        frameId: frame.id,
        printPath: artworkPath,
        previewPath: mockupPath,
        designId: null,
        sessionId,
        frameStyleId: style?.id ?? null,
        finishId: finish?.id ?? null,
        mockupPath,
      })
    );
    router.push("/checkout");
  }

  return (
    <>
      <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-8 px-margin-mobile pb-40 pt-20 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-12 lg:pb-24 lg:pt-24">
        {/* Preview. Sticky on desktop — the right column is the taller of the
            two now, and the frame scrolling out of sight while you read the
            price is the one thing you are deciding about. */}
        <section className="flex justify-center lg:sticky lg:top-24 lg:self-start">
          <div className="w-full max-w-[400px] border-2 border-black bg-white p-3">
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

        {/* Spec + price, on a white surface so the page's grey reads as a
            gutter rather than as unused space. */}
        <section className="border-2 border-black bg-white p-5 md:p-8">
          <h1 className="text-[36px] leading-[0.95] md:text-[48px]">
            Review Your Frame
          </h1>
          <p className="mt-3 text-[15px] text-on-surface-variant">
            This is exactly what we print, frame and ship.
          </p>

          <table className="mt-7 w-full border-2 border-black text-left">
            <tbody>
              <Row k="Size" v={frame.name} />
              <Row k="Final framed size" v={`${finalWIn}″ × ${finalHIn}″`} />
              <Row
                k="Dimensions"
                v={`${frame.width_mm} × ${frame.height_mm} mm`}
              />
              <Row k="Frame style" v={style?.name ?? "—"} />
              <Row k="Finish" v={finish?.name ?? "—"} />
              <Row
                k="Source"
                v={edited ? "Edited in Framers" : "Uploaded photo"}
              />
            </tbody>
          </table>

          {/* Last chance to catch a photo that is too small for this size —
              the frame may have changed since the Size step said so. */}
          {photo && (
            <div
              className={`mt-4 flex items-start gap-3 border-2 px-4 py-3 ${
                photo.verdict.tone === "poor"
                  ? "border-error text-error"
                  : "border-black"
              }`}
            >
              <Icon
                name={photo.verdict.tone === "poor" ? "warning" : "high_quality"}
                className="mt-0.5 text-[18px]"
              />
              {photo.verdict.tone === "poor" ? (
                <p className="text-[14px]">
                  Your photo works out to about {Math.round(photo.dpi)} DPI at
                  this size, so it may look soft up close.{" "}
                  <Link
                    href={`/design/${sessionId}/size`}
                    className="font-bold underline"
                  >
                    Try a smaller frame
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-[14px] text-on-surface-variant">
                  <strong className="text-black">
                    {Math.round(photo.dpi)} DPI
                  </strong>{" "}
                  at this size — {photo.verdict.label.toLowerCase()}.
                </p>
              )}
            </div>
          )}

          {/* Itemised price. Shipping is stated as a line of its own because a
              total with nothing after it invites the "and then delivery?"
              question at exactly the wrong moment. */}
          <div className="mt-8 space-y-4 border-t-2 border-black pt-6">
            <PriceRow k={`Frame — ${frame.name}`} v={frame.price_paise} />
            {style && style.price_modifier_paise > 0 && (
              <PriceRow
                k={`Style — ${style.name}`}
                v={style.price_modifier_paise}
              />
            )}
            {finish && finish.price_modifier_paise > 0 && (
              <PriceRow
                k={`Finish — ${finish.name}`}
                v={finish.price_modifier_paise}
              />
            )}
            <div className="flex items-center justify-between">
              <span className="label-caps text-on-surface-variant">
                Shipping
              </span>
              <span className="label-caps bg-black px-2 py-1 text-neon-accent">
                Free
              </span>
            </div>
            <div className="flex items-end justify-between border-t border-dashed border-outline-variant pt-6">
              <span className="label-caps text-[13px] text-black">Total</span>
              <span className="font-display text-[34px] font-black leading-none">
                {formatPaise(total)}
              </span>
            </div>
          </div>

          {error && (
            <p className="label-caps mt-6 hidden border-2 border-error px-3 py-2 text-error lg:block">
              {error}
            </p>
          )}

          {/* Desktop primary action; on mobile it lives in the fixed bar. */}
          <button
            onClick={proceed}
            disabled={busy}
            className="brutalist-shadow brutalist-press mt-8 hidden w-full items-center justify-center gap-3 bg-primary py-4 font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-action-red disabled:opacity-60 lg:flex"
          >
            {busy ? "Preparing…" : "Continue to Checkout"}
            <Icon name="arrow_forward" className="text-[20px]" />
          </button>

          <Link
            href={`/design/${sessionId}/edit`}
            className="mt-4 flex w-full items-center justify-center gap-2 border-2 border-black bg-white py-4 text-[14px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
          >
            <Icon name="tune" className="text-[20px]" />
            {edited ? "Keep editing" : "Edit your artwork"}
          </Link>

          <ul className="mt-8 space-y-3 border-t border-outline-variant pt-6">
            <Assurance
              icon="verified"
              text="Archival-grade 300 GSM paper, 12-colour pigment printing."
            />
            <Assurance
              icon="local_shipping"
              text="Free shipping, dispatched within 48 hours in protective packaging."
            />
            <Assurance
              icon="handyman"
              text={
                <>
                  Made to order — replaced free if it arrives damaged or
                  defective.{" "}
                  <Link href="/terms" className="underline hover:text-black">
                    Terms
                  </Link>
                </>
              }
            />
            <Assurance
              icon="verified_user"
              text="Secure payment via Razorpay — UPI, cards and net banking."
            />
          </ul>
        </section>
      </main>

      {/* Mobile action bar. The error is repeated here rather than only in the
          column above: on a phone that copy is off-screen, and a silent failure
          on the last step before payment is the worst place for one. */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-black bg-white px-margin-mobile py-3 lg:hidden">
        {error && (
          <p className="label-caps mb-3 border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}
        <div className="flex items-center gap-4">
          <div>
            <p className="label-caps text-[10px] text-on-surface-variant">
              Total
            </p>
            <p className="font-display text-[22px] font-black leading-none">
              {formatPaise(total)}
            </p>
          </div>
          <button
            onClick={proceed}
            disabled={busy}
            className="brutalist-press flex flex-1 items-center justify-center gap-2 bg-primary py-4 font-bold uppercase tracking-widest text-on-primary disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Checkout"}
            <Icon name="arrow_forward" className="text-[18px]" />
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-outline-variant last:border-0">
      <th
        scope="row"
        className="label-caps w-[42%] border-r border-outline-variant bg-surface-muted px-4 py-4 text-[11px] align-top text-on-surface-variant"
      >
        {k}
      </th>
      <td className="px-4 py-4 text-[15px] font-bold text-black">{v}</td>
    </tr>
  );
}

function PriceRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="label-caps text-on-surface-variant">{k}</span>
      <span className="text-[15px] font-bold">{formatPaise(v)}</span>
    </div>
  );
}

function Assurance({ icon, text }: { icon: string; text: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14px] text-on-surface-variant">
      <Icon name={icon} className="mt-0.5 text-[18px] text-black" />
      <span>{text}</span>
    </li>
  );
}
