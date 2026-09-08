/**
 * The admin queue's tabs. A separate, pure module because the filter bar is a
 * client component and `src/lib/data/orders.ts` is `server-only` — importing the
 * labels from there would pull the service-role client into the browser bundle.
 */

export type AdminOrderTab =
  | "needs_action"
  | "printing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "unpaid"
  | "all";

export const ADMIN_ORDER_TABS: { id: AdminOrderTab; label: string }[] = [
  { id: "needs_action", label: "Needs action" },
  { id: "printing", label: "Printing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "unpaid", label: "Unpaid" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const IDS = new Set<string>(ADMIN_ORDER_TABS.map((t) => t.id));

/** Coerce a `?tab=` value from the URL. Anything unknown is the default tab. */
export function parseTab(value: string | undefined): AdminOrderTab {
  return value && IDS.has(value) ? (value as AdminOrderTab) : "needs_action";
}
