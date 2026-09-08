import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { CancelRefundControl } from "@/components/admin/CancelRefundControl";
import { OrderEventLog } from "@/components/admin/OrderEventLog";
import { OrderFulfilmentForm } from "@/components/admin/OrderFulfilmentForm";
import { DesignPreview } from "@/components/DesignPreview";
import { Icon } from "@/components/Icon";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { isCurrentUserAdmin } from "@/lib/auth-server";
import { getOrderEvents } from "@/lib/data/order-events";
import { getOrderForAdmin } from "@/lib/data/orders";
import { getUserContact } from "@/lib/data/users";
import {
  formatDateTime,
  formatPaise,
  shortOrderId,
} from "@/lib/format";
import { orderPreviewUrl } from "@/lib/order-preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order — Framers Ops" };

/** One labelled fact. The operator scans these; nothing here is editable. */
function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="label-caps text-[10px] text-on-surface-variant">{label}</p>
      <p
        className={
          mono
            ? "mt-1 select-all break-all font-label text-[13px] uppercase tracking-wider"
            : "mt-1 break-words text-[15px]"
        }
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The order an operator actually works from: what to print, where to send it,
 * what has been paid, and the controls to move it along.
 *
 * `isCurrentUserAdmin()` again — not because `layout.tsx` forgot, but because a
 * layout is not a security boundary in the App Router and this page prints a
 * customer's address, phone and email from the service-role client.
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect("/");

  const { orderId } = await params;
  const order = await getOrderForAdmin(orderId);
  if (!order) notFound();

  const [previewUrl, events, contact] = await Promise.all([
    orderPreviewUrl(order),
    getOrderEvents(order.id),
    getUserContact(order.user_id),
  ]);

  const ref = order.short_ref ?? shortOrderId(order.id);

  return (
    <>
      <Link
        href="/admin"
        className="label-caps inline-flex items-center gap-1 text-[11px] text-on-surface-variant transition-colors hover:text-black"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Queue
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] uppercase leading-none">Order #{ref}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <span className="label-caps text-[11px] text-on-surface-variant">
              Placed {formatDateTime(order.created_at)}
            </span>
          </div>
        </div>
        <p className="font-display text-[28px] font-black leading-none">
          {formatPaise(order.amount_paise)}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        <div className="min-w-0">
          {/* What to print. The mockup is what the customer saw; the print file
              is the full page including whatever runs under the lip, so it is a
              download rather than something to eyeball here. */}
          <section className="border-2 border-border-high-contrast bg-surface-lowest p-5 md:p-6">
            <h2 className="label-caps text-[12px] text-on-surface-variant">
              Artwork
            </h2>
            <div className="mt-4 flex items-start gap-4">
              {previewUrl ? (
                <DesignPreview
                  url={previewUrl}
                  alt={`Mockup for order ${ref}`}
                  className="w-28 shrink-0 md:w-36"
                />
              ) : (
                <div className="grid h-28 w-28 shrink-0 place-items-center border-2 border-outline-variant bg-surface-muted md:h-36 md:w-36">
                  <Icon name="image" className="text-[24px] text-outline" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">{order.frame_name}</p>
                <p className="label-caps mt-2 text-[10px] text-on-surface-variant">
                  {order.design_source}
                </p>

                <a
                  href={`/api/admin/orders/${order.id}/print`}
                  className="brutalist-press mt-4 flex items-center justify-between gap-3 bg-primary px-4 py-3 font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-action-red"
                >
                  Download print file
                  <Icon name="download" className="text-[18px]" />
                </a>
                <div className="mt-2 flex flex-wrap gap-2">
                  {order.mockup_path && (
                    <a
                      href={`/api/admin/orders/${order.id}/print?variant=mockup`}
                      className="label-caps border-2 border-border-high-contrast px-3 py-2 text-[10px] transition-colors hover:bg-surface-muted"
                    >
                      Mockup
                    </a>
                  )}
                  {order.design_preview_path && (
                    <a
                      href={`/api/admin/orders/${order.id}/print?variant=preview`}
                      className="label-caps border-2 border-border-high-contrast px-3 py-2 text-[10px] transition-colors hover:bg-surface-muted"
                    >
                      Preview
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Ship to. Copied verbatim from the order row, which is the address
              as it was at checkout — not whatever the customer's profile says
              now. */}
          <section className="mt-6 border-2 border-border-high-contrast bg-surface-muted p-5 md:p-6">
            <h2 className="label-caps text-[12px] text-on-surface-variant">
              Ship to
            </h2>
            <p className="mt-3 select-all text-[15px] leading-[1.6]">
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
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`tel:${order.customer_phone}`}
                className="label-caps border-2 border-border-high-contrast px-4 py-2 text-[10px] transition-colors hover:bg-surface-lowest"
              >
                Call
              </a>
              {contact.email && (
                <a
                  href={`mailto:${contact.email}?subject=Framers%20order%20%23${ref}`}
                  className="label-caps border-2 border-border-high-contrast px-4 py-2 text-[10px] transition-colors hover:bg-surface-lowest"
                >
                  Email
                </a>
              )}
            </div>
            <p className="mt-3 break-all text-[13px] text-on-surface-variant">
              {contact.email ?? "No email on the account."}
            </p>
          </section>

          <section className="mt-6 border-2 border-border-high-contrast bg-surface-lowest p-5 md:p-6">
            <h2 className="label-caps text-[12px] text-on-surface-variant">
              Payment
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Fact label="Amount" value={formatPaise(order.amount_paise)} />
              <Fact label="Status" value={order.payment_status} />
              <Fact
                label="Razorpay order"
                value={order.razorpay_order_id}
                mono
              />
              <Fact
                label="Razorpay payment"
                value={order.razorpay_payment_id ?? "—"}
                mono
              />
              <Fact label="Last change" value={formatDateTime(order.updated_at)} />
              <Fact label="Customer id" value={order.user_id} mono />
            </div>
          </section>

          <OrderEventLog events={events} />
        </div>

        <div className="min-w-0">
          <OrderFulfilmentForm
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
            courier={order.courier}
            trackingNumber={order.tracking_number}
            notes={order.notes}
          />
          <CancelRefundControl
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
          />
        </div>
      </div>
    </>
  );
}
