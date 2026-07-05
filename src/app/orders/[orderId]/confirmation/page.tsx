import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DetailTopBar } from "@/components/DetailTopBar";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth-server";
import { getOrderForUser } from "@/lib/data/orders";
import { formatPaise, shortOrderId } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order Confirmed — Framers" };

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { orderId } = await params;
  const order = await getOrderForUser(orderId, user.id);
  if (!order) notFound();

  const paid = order.payment_status === "paid";

  return (
    <>
      <DetailTopBar />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-margin-mobile pb-32 pt-28 text-center">
        <div className="flex h-16 w-16 items-center justify-center bg-neon-accent">
          <Icon name="check" className="text-4xl text-primary" fill />
        </div>

        <h1 className="mt-6 text-[32px] uppercase leading-none">
          {paid ? "Order Confirmed" : "Payment Processing"}
        </h1>
        <p className="label-caps mt-3 text-on-surface-variant">
          Order #{shortOrderId(order.id)}
        </p>

        <p className="mt-6 text-base text-on-surface-variant">
          {paid
            ? "We've received your order and will start printing your frame shortly."
            : "We're confirming your payment. This page will reflect the final status once it's done."}
        </p>

        <div className="mt-8 w-full border-2 border-border-high-contrast bg-surface-muted p-6 text-left">
          <div className="flex items-center justify-between">
            <span className="label-caps text-on-surface-variant">
              {order.frame_name}
            </span>
            <span className="font-bold">{formatPaise(order.amount_paise)}</span>
          </div>
          <div className="mt-4 border-t border-dashed border-outline-variant pt-4">
            <p className="label-caps text-[10px] text-on-surface-variant">
              Shipping to
            </p>
            <p className="mt-1 text-sm">
              {order.customer_name}, {order.address_line1}
              {order.address_line2 ? `, ${order.address_line2}` : ""},{" "}
              {order.city}, {order.state} {order.pincode}
            </p>
          </div>
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
          <Link
            href={`/orders/${order.id}`}
            className="flex-1 bg-primary py-4 text-center font-bold uppercase text-on-primary transition-colors hover:bg-action-red"
          >
            View Order
          </Link>
          <Link
            href="/"
            className="flex-1 border-2 border-primary py-4 text-center font-bold uppercase transition-colors hover:bg-primary hover:text-on-primary"
          >
            Design Another
          </Link>
        </div>
      </main>
    </>
  );
}
