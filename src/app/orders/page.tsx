import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { DetailTopBar } from "@/components/DetailTopBar";
import { Icon } from "@/components/Icon";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { getCurrentUser } from "@/lib/auth-server";
import { getOrdersForUser } from "@/lib/data/orders";
import { formatDate, formatPaise, shortOrderId } from "@/lib/format";
import { orderPreviewUrl } from "@/lib/order-preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Orders — Framers" };

/**
 * Order history. Three places in the chrome already link here (`MobileTopBar`,
 * `Navbar`, and `DetailTopBar`'s cart icon), so this route existing
 * is what stops the navigation from dead-ending.
 *
 * `getOrdersForUser` returns **paid** orders only. That is deliberate: an
 * abandoned Razorpay modal leaves a `created` row behind, and a list of ghost
 * orders someone never paid for reads as a billing error. The detail page is
 * more forgiving — the confirmation screen links straight into it while the
 * webhook is still settling.
 *
 * Thumbnails are signed per request (600 s) and resolved in one `Promise.all`
 * rather than in sequence; a missing object yields `null`, not a 500.
 */
export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");

  const orders = await getOrdersForUser(user.id);
  const previews = await Promise.all(orders.map((o) => orderPreviewUrl(o)));

  return (
    <>
      <DetailTopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-margin-mobile pb-32 pt-28">
        <h1 className="text-[32px] uppercase leading-none">Your Orders</h1>
        <p className="label-caps mt-3 text-on-surface-variant">
          {orders.length === 0
            ? "Nothing here yet"
            : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
        </p>

        {orders.length === 0 ? (
          <div className="mt-8 border-2 border-border-high-contrast bg-surface-lowest p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center border-2 border-border-high-contrast">
              <Icon name="inventory_2" className="text-[24px]" />
            </div>
            <h2 className="mt-5 text-[20px] uppercase leading-tight">
              No orders yet
            </h2>
            <p className="mt-3 text-[15px] text-on-surface-variant">
              Frames you order show up here with their print and delivery status.
            </p>
            <Link
              href="/design/start"
              className="brutalist-press mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary py-4 font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-action-red"
            >
              Design a frame
              <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {orders.map((order, i) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-stretch gap-4 border-2 border-border-high-contrast bg-surface-lowest p-3 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
                >
                  {previews[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[i] as string}
                      alt=""
                      className="h-20 w-20 shrink-0 border border-outline-variant object-cover"
                    />
                  ) : (
                    <div className="grid h-20 w-20 shrink-0 place-items-center border border-outline-variant bg-surface-muted">
                      <Icon name="image" className="text-[22px] text-outline" />
                    </div>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div>
                      <p className="label-caps text-on-surface-variant">
                        #{shortOrderId(order.id)}
                      </p>
                      <p className="mt-1 truncate text-[16px] font-bold">
                        {order.frame_name}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      <span className="label-caps text-on-surface-variant">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end justify-between py-0.5">
                    <span className="text-[16px] font-bold">
                      {formatPaise(order.amount_paise)}
                    </span>
                    <Icon
                      name="chevron_right"
                      className="text-[22px] text-on-surface-variant"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
