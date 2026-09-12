import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { AdminOrderFilters } from "@/components/admin/AdminOrderFilters";
import { Icon } from "@/components/Icon";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { isCurrentUserAdmin } from "@/lib/auth-server";
import {
  getAdminOrderCounts,
  listOrdersForAdmin,
  ADMIN_PAGE_SIZE,
  EXPORT_MAX_ROWS,
} from "@/lib/data/orders";
import { formatDate, formatPaise, shortOrderId } from "@/lib/format";
import { parseTab } from "@/lib/orders/tabs";
import type { OrderWithFrame } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders — Framers Ops" };

/** Paid, unactioned and older than this reads as late rather than as new. */
const STALE_MS = 48 * 60 * 60 * 1000;

function isStale(order: OrderWithFrame): boolean {
  if (order.payment_status !== "paid") return false;
  if (order.status !== "pending" && order.status !== "processing") return false;
  return Date.now() - new Date(order.created_at).getTime() > STALE_MS;
}

/**
 * `/admin` **is** the queue — there is no landing page above it, because
 * `Navbar` has been pointing here for admin users since before any of these
 * routes existed.
 *
 * The `isCurrentUserAdmin()` check is repeated here rather than trusted from
 * `layout.tsx`: in the App Router a layout is not a security boundary, and this
 * page reads every customer's address with the service-role key.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect("/");

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const q = (sp.q ?? "").trim();
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;

  const [counts, result] = await Promise.all([
    getAdminOrderCounts(),
    listOrdersForAdmin({ tab, q, page }),
  ]);

  const { orders, total } = result;
  const lastPage = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const pageParams = (n: number) => {
    const params = new URLSearchParams();
    if (tab !== "needs_action") params.set("tab", tab);
    if (q) params.set("q", q);
    if (n > 1) params.set("page", String(n));
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  };

  // The export carries the filters the page was rendered with, so the file and
  // the screen always agree on what "these orders" means. Page number is
  // deliberately not passed — an export is the whole queue, not this page of it.
  const exportParams = new URLSearchParams({ tab });
  if (q) exportParams.set("q", q);
  const exportHref = `/api/admin/orders/export?${exportParams.toString()}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] uppercase leading-none">Orders</h1>
          <p className="label-caps mt-3 text-on-surface-variant">
            Fulfilment queue
          </p>
        </div>

        {total > 0 && (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <a
              href={exportHref}
              className="label-caps brutalist-press inline-flex min-h-12 items-center gap-2 border-2 border-border-high-contrast bg-surface-lowest px-5 text-[11px] transition-colors hover:bg-primary hover:text-on-primary"
            >
              <Icon name="download" className="text-[18px]" />
              Export CSV
            </a>
            <p className="label-caps text-[10px] text-on-surface-variant">
              {total > EXPORT_MAX_ROWS
                ? `First ${EXPORT_MAX_ROWS.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}`
                : `${total.toLocaleString("en-IN")} ${total === 1 ? "order" : "orders"}`}{" "}
              · opens in Excel
            </p>
          </div>
        )}
      </div>

      <AdminMetrics counts={counts} />
      <AdminOrderFilters tab={tab} q={q} total={total} />

      {orders.length === 0 ? (
        <div className="mt-6 border-2 border-border-high-contrast bg-surface-lowest p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border-2 border-border-high-contrast">
            <Icon name="inbox" className="text-[24px]" />
          </div>
          <h2 className="mt-5 text-[20px] uppercase leading-tight">
            {q ? "No matches" : "Nothing in this queue"}
          </h2>
          <p className="mt-3 text-[15px] text-on-surface-variant">
            {q
              ? "Try the order reference, the customer's phone number, or their pincode."
              : "Orders land here as soon as Razorpay confirms the payment."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards. Desktop: a real table — an operator scanning
              40 orders needs columns that line up. */}
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className={`flex flex-col gap-3 border-2 border-border-high-contrast p-4 transition-colors hover:bg-surface-muted ${
                    isStale(order) ? "bg-neon-accent/10" : "bg-surface-lowest"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="label-caps text-[11px] text-on-surface-variant">
                        #{order.short_ref ?? shortOrderId(order.id)}
                      </p>
                      <p className="mt-1 truncate text-[16px] font-bold">
                        {order.frame_name}
                      </p>
                    </div>
                    <span className="shrink-0 text-[16px] font-bold">
                      {formatPaise(order.amount_paise)}
                    </span>
                  </div>
                  <p className="truncate text-[14px] text-on-surface-variant">
                    {order.customer_name} · {order.city}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    {order.payment_status !== "paid" && (
                      <span className="label-caps border border-outline-variant px-2 py-1 text-[10px] text-on-surface-variant">
                        {order.payment_status}
                      </span>
                    )}
                    <span className="label-caps text-[10px] text-on-surface-variant">
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto border-2 border-border-high-contrast md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-high-contrast bg-surface-muted">
                  {["Ref", "Frame", "Customer", "Status", "Placed", "Amount"].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="label-caps px-4 py-3 text-[10px] text-on-surface-variant"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b border-outline-variant last:border-b-0 ${
                      isStale(order) ? "bg-neon-accent/10" : "bg-surface-lowest"
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="label-caps text-[12px] underline decoration-2 underline-offset-4 hover:text-action-red"
                      >
                        #{order.short_ref ?? shortOrderId(order.id)}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 align-middle text-[15px] font-bold">
                      {order.frame_name}
                    </td>
                    <td className="px-4 py-3 align-middle text-[14px]">
                      <span className="block truncate">
                        {order.customer_name}
                      </span>
                      <span className="label-caps text-[10px] text-on-surface-variant">
                        {order.city} {order.pincode}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        <OrderStatusBadge status={order.status} />
                        {order.payment_status !== "paid" && (
                          <span className="label-caps border border-outline-variant px-2 py-1 text-[10px] text-on-surface-variant">
                            {order.payment_status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-[13px] text-on-surface-variant">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-[15px] font-bold">
                      {formatPaise(order.amount_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lastPage > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-6 flex items-center justify-between gap-3"
            >
              {page > 1 ? (
                <Link
                  href={pageParams(page - 1)}
                  className="label-caps inline-flex items-center gap-1 border-2 border-border-high-contrast px-4 py-3 text-[11px] transition-colors hover:bg-surface-muted"
                >
                  <Icon name="arrow_back" className="text-[16px]" />
                  Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="label-caps text-[11px] text-on-surface-variant">
                Page {page} of {lastPage}
              </span>
              {page < lastPage ? (
                <Link
                  href={pageParams(page + 1)}
                  className="label-caps inline-flex items-center gap-1 border-2 border-border-high-contrast px-4 py-3 text-[11px] transition-colors hover:bg-surface-muted"
                >
                  Older
                  <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
