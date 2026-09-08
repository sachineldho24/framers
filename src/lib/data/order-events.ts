import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderEvent, OrderEventKind } from "@/lib/supabase/types";

export { statusTimestamps } from "@/lib/orders/timeline";
export type { StatusTimestamps } from "@/lib/orders/timeline";

/**
 * The append-only order timeline (migration 0009).
 *
 * Writes go through the service client, like every other write in
 * `src/lib/data/` — `order_events` has no client-facing INSERT policy, on
 * purpose: a customer must never be able to fabricate a "shipped" entry.
 */

/** Every event for an order, oldest first — the order the stepper reads. */
export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("order_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    // 42P01 = undefined_table: 0009 has not been run yet. The rest of the page
    // is still worth rendering, so an un-migrated database means "no history",
    // not a 500. Same judgement as the studio's 42703 handling.
    if (error.code === "42P01") return [];
    throw new Error(`Failed to load order events: ${error.message}`);
  }
  return data ?? [];
}

export interface NewOrderEvent {
  orderId: string;
  kind: OrderEventKind;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  /** Null for anything the system decided (webhook, verify route). */
  actorId?: string | null;
}

/**
 * Append one event. Never throws for a missing table — an audit line is not
 * worth failing the write it describes, and the caller has already changed the
 * order by the time this runs.
 */
export async function appendOrderEvent(event: NewOrderEvent): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: event.orderId,
    kind: event.kind,
    from_status: event.fromStatus ?? null,
    to_status: event.toStatus ?? null,
    note: event.note ?? null,
    actor_id: event.actorId ?? null,
  });
  if (error) console.error("[order-events] append failed", error);
}
