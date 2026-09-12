"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/Icon";
import { canTransition } from "@/lib/orders/transitions";
import type { OrderStatus, PaymentStatus } from "@/lib/supabase/types";

/**
 * Cancel, and record a refund.
 *
 * Two-step, because both are one-way: `cancelled` and `refunded` have no exits
 * in `ALLOWED_TRANSITIONS`.
 *
 * **This does not move money.** There is no Razorpay refund call anywhere in the
 * codebase; the operator issues the refund in the Razorpay dashboard and this
 * button records that they did. The copy says so rather than implying the button
 * did it, because a refund the customer never receives is worse than one nobody
 * wrote down.
 */
export function CancelRefundControl({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"cancel" | "refund" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = canTransition(status, "cancelled") && status !== "cancelled";
  const canRefund = paymentStatus === "paid";

  if (!canCancel && !canRefund) return null;

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
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
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Network problem — nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 border-2 border-error p-5">
      <h2 className="label-caps text-[12px] text-error">Cancel &amp; refund</h2>

      {canCancel && (
        <div className="mt-4">
          {confirming === "cancel" ? (
            <div className="border-2 border-error bg-surface-lowest p-4">
              <p className="text-[14px]">
                Cancel this order? It cannot be un-cancelled, and the customer
                sees a cancellation notice on their order page immediately.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send({ status: "cancelled" })}
                  className="label-caps brutalist-press bg-error px-5 py-3 text-[11px] text-on-error disabled:opacity-60"
                >
                  {busy ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(null)}
                  className="label-caps border-2 border-border-high-contrast px-5 py-3 text-[11px] transition-colors hover:bg-surface-muted disabled:opacity-60"
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming("cancel")}
              className="label-caps flex w-full items-center justify-between gap-3 border-2 border-error px-5 py-3 text-[11px] text-error transition-colors hover:bg-error hover:text-on-error"
            >
              Cancel this order
              <Icon name="cancel" className="text-[16px]" />
            </button>
          )}
        </div>
      )}

      {canRefund && (
        <div className="mt-3">
          {confirming === "refund" ? (
            <div className="border-2 border-error bg-surface-lowest p-4">
              <p className="text-[14px]">
                This records the decision only — it does <strong>not</strong>{" "}
                move any money. Issue the refund in the{" "}
                <a
                  href="https://dashboard.razorpay.com/app/payments"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-action-red"
                >
                  Razorpay dashboard
                </a>{" "}
                first, then mark it here so the order stops reading as paid.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send({ paymentStatus: "refunded" })}
                  className="label-caps brutalist-press bg-error px-5 py-3 text-[11px] text-on-error disabled:opacity-60"
                >
                  {busy ? "Recording…" : "I've refunded it in Razorpay"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(null)}
                  className="label-caps border-2 border-border-high-contrast px-5 py-3 text-[11px] transition-colors hover:bg-surface-muted disabled:opacity-60"
                >
                  Not yet
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming("refund")}
              className="label-caps flex w-full items-center justify-between gap-3 border-2 border-error px-5 py-3 text-[11px] text-error transition-colors hover:bg-error hover:text-on-error"
            >
              Mark payment refunded
              <Icon name="currency_exchange" className="text-[16px]" />
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 text-[14px] text-error"
        >
          <Icon name="error" className="mt-0.5 text-[16px]" />
          {error}
        </p>
      )}
    </section>
  );
}
