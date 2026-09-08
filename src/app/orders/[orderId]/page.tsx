import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { DesignPreview } from "@/components/DesignPreview";
import { DetailTopBar } from "@/components/DetailTopBar";
import { Icon } from "@/components/Icon";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderStatusStepper } from "@/components/OrderStatusStepper";
import { getCurrentUser } from "@/lib/auth-server";
import { getOrderEvents, statusTimestamps } from "@/lib/data/order-events";
import { getOrderForUser } from "@/lib/data/orders";
import { formatDate, formatPaise, shortOrderId } from "@/lib/format";
import { orderPreviewUrl } from "@/lib/order-preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Order — Framers" };

/**
 * Order detail — where an order lives after the confirmation screen.
 *
 * Ownership is enforced in the query (`getOrderForUser` filters on `user_id`)
 * and a miss is a 404, not a 403: whether an order id exists is not something
 * one customer should be able to learn about another.
 *
 * Unlike the history list this does *not* filter on `payment_status`. The
 * confirmation screen links straight here, and a payment being confirmed by the
 * webhook a moment later is normal — so an order that is still `created` gets a
 * plain explanation rather than a 404 that reads like a lost order.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");

  const { orderId } = await params;
  const order = await getOrderForUser(orderId, user.id);
  if (!order) notFound();

  const [previewUrl, events] = await Promise.all([
    orderPreviewUrl(order),
    getOrderEvents(order.id),
  ]);
  const timestamps = statusTimestamps(events);
  const paid = order.payment_status === "paid";
  const cancelled = order.status === "cancelled";
  const cancelledAt = timestamps.cancelled;

  return (
    <>
      <DetailTopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-margin-mobile pb-32 pt-28">
        <Link
          href="/orders"
          className="label-caps inline-flex items-center gap-1 text-[11px] text-on-surface-variant transition-colors hover:text-black"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          All orders
        </Link>

        <h1 className="mt-4 text-[32px] uppercase leading-none">
          Order #{shortOrderId(order.id)}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="label-caps text-[11px] text-on-surface-variant">
            Placed {formatDate(order.created_at)}
          </span>
        </div>

        {/* Payment state is separate from fulfilment state, and only worth
            saying when it isn't the expected one. */}
        {!paid && (
          <div className="mt-6 flex items-start gap-3 border-2 border-border-high-contrast bg-surface-muted px-4 py-3">
            <Icon name="schedule" className="mt-0.5 text-[18px]" />
            <p className="text-[14px] text-on-surface-variant">
              {order.payment_status === "failed" ||
              order.payment_status === "refunded"
                ? `This order's payment is marked ${order.payment_status}. Nothing has been sent to print.`
                : "We're still confirming your payment with Razorpay. Printing starts once it clears — refresh in a minute."}
            </p>
          </div>
        )}

        {cancelled ? (
          <div className="mt-8 flex items-start gap-3 border-2 border-error px-4 py-4 text-error">
            <Icon name="cancel" className="mt-0.5 text-[18px]" />
            <p className="text-[14px]">
              This order was cancelled
              {cancelledAt ? ` on ${formatDate(cancelledAt)}` : ""}. If a payment
              was captured it is refunded to the original method — that can take
              up to 7 working days to show on your statement.
            </p>
          </div>
        ) : (
          <section className="mt-8 border-2 border-border-high-contrast bg-surface-lowest p-5 md:p-6">
            <h2 className="label-caps text-[12px] text-on-surface-variant">
              Progress
            </h2>
            <div className="mt-4">
              <OrderStatusStepper
                status={order.status}
                timestamps={timestamps}
              />
            </div>
          </section>
        )}

        {/* Tracking. Shown as soon as either half of it exists — a courier name
            with no number still tells you who is knocking. */}
        {(order.tracking_number || order.courier) && (
          <section className="mt-6 border-2 border-border-high-contrast bg-neon-accent p-5">
            <h2 className="label-caps text-[12px] text-primary">Tracking</h2>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="label-caps text-[10px] text-primary/70">Courier</p>
                <p className="text-[16px] font-bold text-primary">
                  {order.courier ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="label-caps text-[10px] text-primary/70">
                  Consignment no.
                </p>
                <p className="select-all font-label text-[16px] font-bold uppercase tracking-widest text-primary">
                  {order.tracking_number ?? "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 border-2 border-border-high-contrast bg-surface-lowest p-5 md:p-6">
          <h2 className="label-caps text-on-surface-variant">In this order</h2>

          <div className="mt-4 flex items-start gap-4">
            {previewUrl ? (
              <DesignPreview
                url={previewUrl}
                alt="Your framed design"
                className="w-24 shrink-0 md:w-32"
              />
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center border-2 border-outline-variant bg-surface-muted md:h-32 md:w-32">
                <Icon name="image" className="text-[24px] text-outline" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold">{order.frame_name}</p>
              <p className="label-caps mt-2 text-[10px] text-on-surface-variant">
                Made to order · Free shipping
              </p>
              <p className="mt-3 font-display text-[26px] font-black leading-none">
                {formatPaise(order.amount_paise)}
              </p>
              <p className="label-caps mt-2 text-[10px] text-on-surface-variant">
                Paid by {order.razorpay_payment_id ? "Razorpay" : "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 border-2 border-border-high-contrast bg-surface-muted p-5">
          <h2 className="label-caps text-on-surface-variant">Shipping to</h2>
          <p className="mt-3 text-[15px] leading-[1.6]">
            <span className="font-bold">{order.customer_name}</span>
            <br />
            {order.address_line1}
            {order.address_line2 ? (
              <>
                <br />
                {order.address_line2}
              </>
            ) : null}
            <br />
            {order.city}, {order.state} {order.pincode}
            <br />
            {order.customer_phone}
          </p>
        </section>

        {order.notes && (
          <section className="mt-6 border-2 border-border-high-contrast p-5">
            <h2 className="label-caps text-on-surface-variant">Note from us</h2>
            <p className="mt-3 text-[15px] leading-[1.6]">{order.notes}</p>
          </section>
        )}

        <p className="mt-8 text-[14px] text-on-surface-variant">
          Something wrong with this order? Message us on Instagram at{" "}
          <a
            href="https://www.instagram.com/_posterx.in"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline hover:text-action-red"
          >
            @_posterx.in
          </a>{" "}
          with order #{shortOrderId(order.id)}.
        </p>
      </main>
    </>
  );
}
