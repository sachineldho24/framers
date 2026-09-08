/**
 * Legal fulfilment transitions.
 *
 * Pure — no Supabase imports, no environment access — so it can be unit-tested
 * and so both the API handler and the admin UI can share one source of truth:
 * the form only offers transitions `canTransition` permits, and the handler
 * rejects anything else with `transitionError`'s message shown verbatim.
 *
 * The database enforces only that `status` is one of the five literals (a CHECK
 * constraint, `0001_init.sql`). The *order* of those five is enforced here.
 */

import type { OrderStatus, PaymentStatus } from "@/lib/supabase/types";

/**
 * What each status may move to. Terminal states have no exits — the event log
 * is append-only, so a mistake stays visible rather than being reversed away.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Payment states from which "mark refunded" is meaningful. */
export const REFUNDABLE_FROM: PaymentStatus[] = ["paid"];

/**
 * True when `to` is reachable from `from` in one hop. Same → same is allowed:
 * a PATCH that only edits the courier still sends the unchanged status.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Null when the change is allowed, otherwise the sentence the operator sees.
 *
 * Two rules that belong in code rather than in an operator's head:
 * a leap past a stage (pending → shipped) and starting production on an order
 * whose money has not landed.
 */
export function transitionError(
  order: { status: OrderStatus; payment_status: PaymentStatus },
  to: OrderStatus,
): string | null {
  if (!canTransition(order.status, to)) {
    const exits = ALLOWED_TRANSITIONS[order.status];
    return exits.length === 0
      ? `This order is ${order.status} — that is final and cannot be changed.`
      : `Can't go from ${order.status} to ${to}. Next allowed: ${exits.join(", ")}.`;
  }

  // Cancelling is always available while the order is live, paid or not.
  if (to === "cancelled" || to === order.status) return null;

  if (order.payment_status !== "paid") {
    return `Payment is ${order.payment_status}, not paid. Nothing goes to print until it clears.`;
  }

  return null;
}

/** Null when marking this payment refunded makes sense, else the reason. */
export function refundError(order: { payment_status: PaymentStatus }): string | null {
  if (order.payment_status === "refunded") return "Already marked refunded.";
  if (!REFUNDABLE_FROM.includes(order.payment_status)) {
    return `Payment is ${order.payment_status} — there is nothing captured to refund.`;
  }
  return null;
}
