"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/Icon";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { ALLOWED_TRANSITIONS } from "@/lib/orders/transitions";
import type { OrderStatus, PaymentStatus } from "@/lib/supabase/types";

const LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Start printing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

/**
 * The fulfilment controls.
 *
 * Only transitions `ALLOWED_TRANSITIONS` permits get a button, so an illegal
 * jump is unclickable rather than a 400 — but the server validates again against
 * the row as it stands, because this page may have been open for an hour. A
 * rejected write shows the server's own sentence verbatim; there is no second
 * copy of the rule in this file to drift out of step.
 *
 * Plain `fetch` + `useState` + `router.refresh()`, like `CheckoutClient` — there
 * is no data-fetching library in this project.
 */
export function OrderFulfilmentForm({
  orderId,
  status,
  paymentStatus,
  courier,
  trackingNumber,
  notes,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  courier: string | null;
  trackingNumber: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [courierDraft, setCourierDraft] = useState(courier ?? "");
  const [awbDraft, setAwbDraft] = useState(trackingNumber ?? "");
  const [notesDraft, setNotesDraft] = useState(notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const nextStatuses = ALLOWED_TRANSITIONS[status].filter(
    (s) => s !== "cancelled"
  );
  const shippingKnown = courierDraft.trim() !== "" || awbDraft.trim() !== "";

  async function patch(
    body: Record<string, unknown>,
    busyKey: string,
    successMessage: string
  ) {
    setBusy(busyKey);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!res.ok) {
        setError(json?.error?.message ?? "That change didn't go through.");
        return;
      }
      setSaved(successMessage);
      router.refresh();
    } catch {
      setError("Network problem — the order was not changed.");
    } finally {
      setBusy(null);
    }
  }

  const finished = nextStatuses.length === 0;

  return (
    <section className="border-2 border-border-high-contrast bg-surface-lowest p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-caps text-[12px] text-on-surface-variant">
          Fulfilment
        </h2>
        <OrderStatusBadge status={status} />
      </div>

      {/* Shipping details first: marking an order shipped without them is the
          mistake worth designing out, so the fields sit above the button. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="label-caps text-[10px] text-on-surface-variant">
            Courier
          </span>
          <input
            value={courierDraft}
            onChange={(e) => setCourierDraft(e.target.value)}
            placeholder="Delhivery, BlueDart…"
            maxLength={120}
            className="border-2 border-border-high-contrast bg-surface px-3 py-3 text-[15px] outline-none focus-visible:border-action-red"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-caps text-[10px] text-on-surface-variant">
            Consignment no.
          </span>
          <input
            value={awbDraft}
            onChange={(e) => setAwbDraft(e.target.value.toUpperCase())}
            placeholder="AWB / tracking id"
            maxLength={120}
            className="border-2 border-border-high-contrast bg-surface px-3 py-3 font-label text-[15px] uppercase tracking-widest outline-none focus-visible:border-action-red"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          patch(
            { courier: courierDraft, trackingNumber: awbDraft },
            "tracking",
            "Tracking saved — the customer can see it now."
          )
        }
        className="label-caps mt-3 w-full border-2 border-border-high-contrast px-4 py-3 text-[11px] transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {busy === "tracking" ? "Saving…" : "Save tracking"}
      </button>

      {/* Status advance */}
      {finished ? (
        <p className="mt-6 flex items-start gap-2 border-t-2 border-border-high-contrast pt-5 text-[14px] text-on-surface-variant">
          <Icon name="check_circle" className="mt-0.5 text-[16px]" />
          This order is {status}. Nothing further to do.
        </p>
      ) : (
        <div className="mt-6 border-t-2 border-border-high-contrast pt-5">
          <p className="label-caps text-[10px] text-on-surface-variant">
            Advance
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {nextStatuses.map((next) => (
              <button
                key={next}
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  // Send the fields alongside the status so a shipped order is
                  // never published with an empty tracking block.
                  const body: Record<string, unknown> = { status: next };
                  if (next === "shipped") {
                    body.courier = courierDraft;
                    body.trackingNumber = awbDraft;
                  }
                  patch(body, next, `Marked ${next}.`);
                }}
                className="brutalist-press flex w-full items-center justify-between gap-3 bg-primary px-5 py-4 font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-action-red disabled:opacity-60"
              >
                {busy === next ? "Working…" : LABELS[next]}
                <Icon name="arrow_forward" className="text-[18px]" />
              </button>
            ))}
          </div>

          {nextStatuses.includes("shipped") && !shippingKnown && (
            <p className="mt-3 flex items-start gap-2 text-[13px] text-on-surface-variant">
              <Icon name="info" className="mt-0.5 text-[15px]" />
              No courier or consignment number yet — the customer will see the
              status move with nothing to track.
            </p>
          )}
          {paymentStatus !== "paid" && (
            <p className="mt-3 flex items-start gap-2 text-[13px] text-on-surface-variant">
              <Icon name="lock" className="mt-0.5 text-[15px]" />
              Payment is {paymentStatus}. Printing stays locked until it clears.
            </p>
          )}
        </div>
      )}

      {/* Customer-visible note. Labelled honestly: this exact text renders on
          the customer's order page under "Note from us". */}
      <div className="mt-6 border-t-2 border-border-high-contrast pt-5">
        <label className="flex flex-col gap-2">
          <span className="label-caps text-[10px] text-on-surface-variant">
            Note to customer — they will read this
          </span>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Delayed by a day — reprinting to get the colour right."
            className="border-2 border-border-high-contrast bg-surface px-3 py-3 text-[15px] leading-[1.5] outline-none focus-visible:border-action-red"
          />
        </label>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            patch({ notes: notesDraft }, "notes", "Note saved.")
          }
          className="label-caps mt-3 w-full border-2 border-border-high-contrast px-4 py-3 text-[11px] transition-colors hover:bg-surface-muted disabled:opacity-60"
        >
          {busy === "notes" ? "Saving…" : "Save note"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 border-2 border-error px-4 py-3 text-[14px] text-error"
        >
          <Icon name="error" className="mt-0.5 text-[16px]" />
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="label-caps mt-4 flex items-center gap-2 text-[11px] text-on-surface-variant">
          <Icon name="check" className="text-[14px]" />
          {saved}
        </p>
      )}
    </section>
  );
}
