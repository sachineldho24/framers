"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  readCheckoutHandoff,
  clearCheckoutHandoff,
  type CheckoutHandoff,
} from "@/lib/checkout";
import { formatPaise } from "@/lib/format";
import {
  loadRazorpay,
  openRazorpay,
  type RazorpaySuccess,
} from "@/lib/razorpay-client";
import { Icon } from "./Icon";
import { INDIAN_STATES, OUTSIDE_INDIA_MESSAGE, shippingError } from "@/lib/shipping";

interface Summary {
  frame: { id: string; name: string; price_paise: number; width_mm: number; height_mm: number };
  previewUrl: string | null;
}

interface Form {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

const EMPTY_FORM: Form = {
  name: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "IN",
};

export function CheckoutClient() {
  const router = useRouter();
  const [handoff, setHandoff] = useState<CheckoutHandoff | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const shippingDialog = useRef<HTMLDialogElement>(null);
  const [shippingMessage, setShippingMessage] = useState(OUTSIDE_INDIA_MESSAGE);

  function showShippingMessage(message: string) {
    setShippingMessage(message);
    shippingDialog.current?.showModal();
  }

  // Read the design hand-off + load the order summary.
  useEffect(() => {
    const h = readCheckoutHandoff();
    if (!h) {
      router.replace("/");
      return;
    }
    setHandoff(h);

    (async () => {
      // Prefill email from the signed-in user.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setForm((f) => ({ ...f, email: user.email! }));

      const res = await fetch("/api/checkout/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameId: h.frameId, previewPath: h.previewPath }),
      });
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      setSummary((await res.json()) as Summary);
    })();
  }, [router]);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Please enter your full name.";
    if (!/^\d{10}$/.test(form.phone.trim()))
      return "Enter a valid 10-digit phone number.";
    if (!form.addressLine1.trim()) return "Please enter your address.";
    if (!form.city.trim()) return "Please enter your city.";
    return null;
  }

  async function handlePay() {
    if (!handoff || !summary) return;
    const domesticIssue = shippingError(form);
    if (domesticIssue) {
      showShippingMessage(domesticIssue);
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPaying(true);

    // Check before loading/opening a payment window. The order API checks again.
    try {
      const response = await fetch("/api/shipping/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: form.country, state: form.state, pincode: form.pincode.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "We couldn't verify your shipping address. Please try again.");
      }
    } catch (error) {
      showShippingMessage(error instanceof Error ? error.message : "We couldn't verify your shipping address. Please try again.");
      setPaying(false);
      return;
    }

    const ok = await loadRazorpay();
    if (!ok) {
      setError("Couldn't load the payment window. Check your connection.");
      setPaying(false);
      return;
    }

    // 1. Create the Razorpay order + pending order row.
    let created;
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameId: handoff.frameId,
          designSource: handoff.designSource,
          designId: handoff.designId,
          printPath: handoff.printPath,
          previewPath: handoff.previewPath,
          frameStyleId: handoff.frameStyleId ?? null,
          finishId: handoff.finishId ?? null,
          sessionId: handoff.sessionId ?? null,
          mockupPath: handoff.mockupPath ?? null,
          customerName: form.name.trim(),
          customerPhone: form.phone.trim(),
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          country: form.country,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? "Could not start payment.");
      }
      created = (await res.json()) as {
        keyId: string;
        razorpayOrderId: string;
        amountPaise: number;
        orderId: string;
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment.");
      setPaying(false);
      return;
    }

    // 2. Open Razorpay Checkout.
    openRazorpay({
      key: created.keyId,
      amount: created.amountPaise,
      currency: "INR",
      name: "Framers",
      description: summary.frame.name,
      order_id: created.razorpayOrderId,
      prefill: {
        name: form.name.trim(),
        email: form.email.trim(),
        contact: form.phone.trim(),
      },
      theme: { color: "#FF0000" },
      handler: async (response: RazorpaySuccess) => {
        try {
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (!res.ok) throw new Error("verify failed");
          const { orderId } = (await res.json()) as { orderId: string };
          clearCheckoutHandoff();
          router.push(`/orders/${orderId}/confirmation`);
        } catch {
          // Payment likely succeeded but verify lagged — the webhook will mark
          // it paid. Send to the confirmation page anyway (we have the id).
          clearCheckoutHandoff();
          router.push(`/orders/${created.orderId}/confirmation`);
        }
      },
      modal: { ondismiss: () => setPaying(false) },
    });
  }

  if (loadFailed) {
    return (
      <p className="label-caps border-2 border-error px-4 py-3 text-error">
        Couldn&apos;t load your order. Please start again from a frame.
      </p>
    );
  }

  if (!handoff || !summary) {
    return <p className="label-caps text-on-surface-variant">Loading…</p>;
  }

  const inputCls =
    "w-full border-2 border-border-high-contrast bg-surface p-4 label-caps tracking-normal placeholder:text-outline focus:border-action-red focus:outline-none";

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Left: form + review */}
      <div className="space-y-10 lg:col-span-7">
        <section>
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-primary font-bold text-on-primary">
              1
            </span>
            <h2 className="text-[28px] uppercase tracking-tight">Shipping</h2>
          </div>
          <div className="space-y-6">
            <div>
              <label htmlFor="shipping-country" className="label-caps mb-2 block">Country / region</label>
              <select id="shipping-country" autoComplete="shipping country" className={inputCls}
                value={form.country} aria-describedby="shipping-coverage"
                onChange={(event) => {
                  set("country", event.target.value);
                  if (event.target.value !== "IN") showShippingMessage(OUTSIDE_INDIA_MESSAGE);
                }}>
                <option value="IN">India</option>
                <option value="OTHER">Outside India</option>
              </select>
              <p id="shipping-coverage" className="mt-2 text-sm text-on-surface-variant">We currently ship within India only.</p>
            </div>
            <input
              className={inputCls}
              placeholder="FULL NAME"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <input
                className={inputCls}
                type="email"
                placeholder="EMAIL ADDRESS"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
              <input
                className={inputCls}
                type="tel"
                placeholder="PHONE (10 DIGITS)"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <input
              className={inputCls}
              placeholder="ADDRESS LINE 1"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="ADDRESS LINE 2 (OPTIONAL)"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <input
                className={inputCls}
                placeholder="CITY"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
              <div>
                <label htmlFor="shipping-state" className="label-caps mb-2 block">State / union territory</label>
                <select id="shipping-state" autoComplete="shipping address-level1" className={inputCls}
                  value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                </select>
              </div>
              <input
                className={inputCls}
                placeholder="PINCODE"
                aria-label="Indian PIN code"
                autoComplete="shipping postal-code"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-primary font-bold text-on-primary">
              2
            </span>
            <h2 className="text-[28px] uppercase tracking-tight">Review</h2>
          </div>
          <div className="flex items-center gap-6 border-2 border-border-high-contrast bg-surface-muted p-4">
            <div className="h-32 w-24 flex-shrink-0 overflow-hidden border border-outline-variant bg-surface">
              {summary.previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={summary.previewUrl}
                  alt="Your design"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Icon name="description" className="text-3xl text-outline" />
                </div>
              )}
            </div>
            <div className="flex-grow">
              <h3 className="mb-1 text-[18px] font-bold leading-tight uppercase">
                {summary.frame.name}
              </h3>
              <p className="label-caps text-[10px] text-on-surface-variant">
                {summary.frame.width_mm}×{summary.frame.height_mm}mm · Uploaded art
              </p>
              <p className="mt-3 text-[18px] font-bold">
                {formatPaise(summary.frame.price_paise)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Right: summary */}
      <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-5">
        <div className="border-2 border-border-high-contrast bg-surface p-6 shadow-[4px_4px_0px_0px_#000]">
          <h2 className="mb-8 border-b-2 border-border-high-contrast pb-4 text-[28px] uppercase">
            Order Summary
          </h2>
          <div className="mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="label-caps text-on-surface-variant">Subtotal</span>
              <span className="text-[18px] font-bold">
                {formatPaise(summary.frame.price_paise)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="label-caps text-on-surface-variant">Shipping</span>
              <span className="label-caps bg-black px-2 py-0.5 text-neon-accent">
                FREE
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-outline-variant pt-4">
              <span className="text-[22px] font-bold uppercase">Total</span>
              <span className="text-[24px] font-bold">
                {formatPaise(summary.frame.price_paise)}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="label-caps mb-4 border-2 border-error px-3 py-2 text-error">
              {error}
            </p>
          )}

          <button
            onClick={handlePay}
            disabled={paying}
            className="flex w-full items-center justify-center gap-3 bg-primary py-6 font-bold uppercase tracking-widest text-on-primary transition-all hover:bg-action-red active:scale-[0.98] disabled:opacity-60"
          >
            {paying ? "Processing…" : "Pay with Razorpay / UPI"}
            <Icon name="arrow_forward" />
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 opacity-60">
            <Icon name="verified_user" className="text-[18px]" />
            <p className="label-caps text-[10px]">Secure payments via Razorpay</p>
          </div>
        </div>
      </aside>
      <dialog ref={shippingDialog} aria-labelledby="shipping-dialog-title" aria-describedby="shipping-dialog-message"
        className="fixed inset-0 m-auto w-[calc(100%-40px)] max-w-sm border-2 border-border-high-contrast bg-surface p-6 text-on-background backdrop:bg-black/40">
        <h2 id="shipping-dialog-title" className="text-xl font-bold">Shipping availability</h2>
        <p id="shipping-dialog-message" className="mt-3 text-sm leading-relaxed">{shippingMessage}</p>
        <form method="dialog" className="mt-5">
          <button autoFocus className="min-h-11 w-full bg-primary px-4 py-3 font-bold text-white">Back to address</button>
        </form>
      </dialog>
    </div>
  );
}
