/**
 * Reading an order's timeline. Pure — no database, no `server-only` — so the
 * customer stepper's dating logic is unit-testable and can be imported from
 * either side of the server boundary.
 */

import type { OrderEvent, OrderStatus } from "@/lib/supabase/types";

/** Statuses that appear as stages on the customer's stepper. */
export type StatusTimestamps = Partial<Record<OrderStatus, string>>;

const STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

function isStatus(value: string | null): value is OrderStatus {
  return value !== null && (STATUSES as string[]).includes(value);
}

/**
 * When each status was first reached.
 *
 * First occurrence wins: if an operator mis-clicks `shipped`, corrects course
 * and ships again later, the customer sees the date the order actually became
 * shipped the first time — and both events remain in the log for us. The events
 * are expected in ascending `created_at` order (which is how
 * `getOrderEvents` returns them); this does not re-sort them.
 */
export function statusTimestamps(events: OrderEvent[]): StatusTimestamps {
  const out: StatusTimestamps = {};
  for (const e of events) {
    if (e.kind !== "status") continue;
    if (!isStatus(e.to_status)) continue;
    if (out[e.to_status]) continue;
    out[e.to_status] = e.created_at;
  }
  return out;
}
