import "server-only";
import { appendOrderEvent } from "@/lib/data/order-events";
import { refundError, transitionError } from "@/lib/orders/transitions";
import type { AdminOrderTab } from "@/lib/orders/tabs";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  DesignSource,
  Order,
  OrderStatus,
  OrderWithFrame,
  PaymentStatus,
} from "@/lib/supabase/types";

export interface NewOrderInput {
  userId: string;
  frameId: string;
  amountPaise: number;
  razorpayOrderId: string;
  designSource: DesignSource;
  designPreviewPath: string | null;
  designPrintPath: string;
  customerName: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  // Designer-flow fields (optional).
  frameStyleId?: string | null;
  finishId?: string | null;
  designSessionId?: string | null;
  mockupPath?: string | null;
}

/** Insert a 'created' (unpaid) order. Idempotent on razorpay_order_id. */
export async function createPendingOrder(
  input: NewOrderInput
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .upsert(
      {
        user_id: input.userId,
        frame_id: input.frameId,
        amount_paise: input.amountPaise,
        razorpay_order_id: input.razorpayOrderId,
        razorpay_payment_id: null,
        payment_status: "created",
        status: "pending",
        design_source: input.designSource,
        design_preview_path: input.designPreviewPath,
        design_print_path: input.designPrintPath,
        frame_style_id: input.frameStyleId ?? null,
        finish_id: input.finishId ?? null,
        design_session_id: input.designSessionId ?? null,
        mockup_path: input.mockupPath ?? null,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
      },
      { onConflict: "razorpay_order_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create order: ${error.message}`);

  // Opens the timeline. `create-order` mints a fresh Razorpay order id on every
  // call, so the upsert's conflict branch effectively never runs and this cannot
  // double up. Migration 0009 backfills the same event for pre-0009 orders.
  await appendOrderEvent({
    orderId: data.id,
    kind: "status",
    toStatus: "pending",
    note: "Order placed",
    actorId: null,
  });

  return data.id;
}

/**
 * Mark an order paid. Idempotent — the `.in()` guard means only an order still
 * awaiting money moves, so a Razorpay webhook retry arriving after an operator
 * marked the order `refunded` can no longer flip it back to `paid`.
 *
 * Returns the order id, or **null when nothing was updated** — which means
 * "already settled", not an error. Both callers are fine with that: the webhook
 * ignores the return value entirely and `verify` answers with the id it read
 * for itself a moment earlier.
 *
 * The null/id distinction is also what makes the paid transition *detectable*,
 * so exactly one `payment` event is appended however many times Razorpay
 * retries.
 */
export async function markOrderPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      razorpay_payment_id: razorpayPaymentId,
      payment_status: "paid",
    })
    .eq("razorpay_order_id", razorpayOrderId)
    .in("payment_status", ["created", "failed"])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to mark order paid: ${error.message}`);
  if (!data) return null;

  await appendOrderEvent({
    orderId: data.id,
    kind: "payment",
    note: `Payment captured (${razorpayPaymentId})`,
    actorId: null,
  });
  return data.id;
}

/** Look up an order by its Razorpay order id (service role). */
export async function getOrderByRazorpayId(
  razorpayOrderId: string
): Promise<Order | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);
  return data;
}

/** Orders for a user, newest first, with frame name (for /orders). */
export async function getOrdersForUser(
  userId: string
): Promise<OrderWithFrame[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return attachFrameNames(data ?? []);
}

/** A single order for a user (ownership enforced), with frame name. */
export async function getOrderForUser(
  orderId: string,
  userId: string
): Promise<OrderWithFrame | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);
  if (!data) return null;
  const [withName] = await attachFrameNames([data]);
  return withName;
}

/** Resolve frame names for a set of orders in one query. */
async function attachFrameNames(orders: Order[]): Promise<OrderWithFrame[]> {
  if (orders.length === 0) return [];
  const supabase = createServiceClient();
  const frameIds = [...new Set(orders.map((o) => o.frame_id))];
  const { data: frames } = await supabase
    .from("frames")
    .select("id, name")
    .in("id", frameIds);

  const nameById = new Map((frames ?? []).map((f) => [f.id, f.name]));
  return orders.map((o) => ({
    ...o,
    frame_name: nameById.get(o.frame_id) ?? "Frame",
  }));
}

// =============================================================================
// Admin / fulfilment
//
// Everything below is gated in TypeScript, never by Postgres: every read in this
// file uses the service-role client, so the `"Admins manage all orders"` RLS
// policy gives the app nothing. `isAdmin()` in the page or the route handler is
// the only boundary, and it must fail closed.
// =============================================================================

/** The admin queue's filter tabs — defined in a client-safe module. */
export type { AdminOrderTab } from "@/lib/orders/tabs";
export { ADMIN_ORDER_TABS, parseTab } from "@/lib/orders/tabs";

export const ADMIN_PAGE_SIZE = 25;

/** PostgREST refuses a wider window than this (Supabase's `max-rows`). */
const MAX_ROWS_PER_REQUEST = 1000;

/** Rows per request while building an export. */
const EXPORT_PAGE_SIZE = 500;

/**
 * Hard ceiling on an export, so one click cannot try to hold the entire order
 * table in a function's memory. At the volumes this shop is built for, hitting
 * it means someone wants a database dump, not a spreadsheet.
 */
export const EXPORT_MAX_ROWS = 5000;

/**
 * A PostgREST `or=` filter is a comma-separated list inside parentheses, so a
 * comma, parenthesis or `*` in the search box would rewrite the query rather
 * than be matched by it. Strip them; keep everything an order reference, name,
 * phone or pincode can legitimately contain.
 */
function sanitiseSearch(q: string): string {
  return q.replace(/[,()*"'\\%]/g, " ").trim().slice(0, 60);
}

/** Build the `.or()` argument for a search term. */
function searchFilter(q: string, includeShortRef: boolean): string {
  const clauses = [
    `customer_name.ilike.*${q}*`,
    `customer_phone.ilike.*${q}*`,
    `pincode.ilike.*${q}*`,
    `razorpay_order_id.ilike.*${q}*`,
  ];
  if (includeShortRef) {
    clauses.unshift(`short_ref.eq.${q.replace(/^#/, "").toUpperCase()}`);
  }
  return clauses.join(",");
}

export interface AdminOrderQuery {
  tab?: AdminOrderTab;
  q?: string;
  page?: number;
  /**
   * Rows per page. Defaults to the queue's `ADMIN_PAGE_SIZE`; the CSV export
   * raises it so a few thousand orders is a handful of round trips rather than a
   * hundred. Clamped to PostgREST's own `max-rows` ceiling.
   */
  pageSize?: number;
}

export interface AdminOrderPage {
  orders: OrderWithFrame[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The admin queue: one filtered, counted, paginated page of orders.
 *
 * Frame names come from the same `attachFrameNames` fan-out the customer list
 * uses rather than an embedded `orders(*, frames(name))` select — every table in
 * `types.ts` declares `Relationships: []`, so an embedded join is not typed.
 */
export async function listOrdersForAdmin(
  query: AdminOrderQuery = {}
): Promise<AdminOrderPage> {
  const tab = query.tab ?? "needs_action";
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(
    MAX_ROWS_PER_REQUEST,
    Math.max(1, Math.floor(query.pageSize ?? ADMIN_PAGE_SIZE))
  );
  const q = sanitiseSearch(query.q ?? "");
  const from = (page - 1) * pageSize;

  const run = async (includeShortRef: boolean) => {
    const supabase = createServiceClient();
    let builder = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    // A search is a lookup, not a filtered browse — an operator pasting a
    // reference wants the order wherever it currently sits, so the tab's status
    // filter stands down while `q` is present.
    if (q) return builder.or(searchFilter(q, includeShortRef));

    switch (tab) {
      case "needs_action":
        builder = builder
          .eq("payment_status", "paid")
          .in("status", ["pending", "processing"]);
        break;
      case "printing":
        builder = builder.eq("status", "processing");
        break;
      case "shipped":
        builder = builder.eq("status", "shipped");
        break;
      case "delivered":
        builder = builder.eq("status", "delivered");
        break;
      case "cancelled":
        builder = builder.eq("status", "cancelled");
        break;
      case "unpaid":
        builder = builder.in("payment_status", ["created", "failed"]);
        break;
      case "all":
        break;
    }

    return builder;
  };

  let { data, error, count } = await run(true);

  // 42703 = undefined_column: migration 0009 has not been run, so `short_ref`
  // does not exist yet. Search the columns that do rather than 500.
  if (error?.code === "42703" && q) {
    ({ data, error, count } = await run(false));
  }
  if (error) throw new Error(`Failed to load orders: ${error.message}`);

  return {
    orders: await attachFrameNames(data ?? []),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Every order matching the queue's current filters, for the CSV export.
 *
 * Deliberately built *on* `listOrdersForAdmin` rather than beside it: the export
 * has to mean the same thing as the tab the operator is looking at, and a second
 * copy of the tab switch (and of the `short_ref` fallback) would eventually
 * disagree with the first. Cost is one request per `EXPORT_PAGE_SIZE` rows.
 *
 * `truncated` is true when the filter matches more than `EXPORT_MAX_ROWS`, so
 * the caller can say so instead of quietly handing over a partial sheet.
 */
export async function listOrdersForAdminExport(
  query: Omit<AdminOrderQuery, "page" | "pageSize"> = {}
): Promise<{ orders: OrderWithFrame[]; total: number; truncated: boolean }> {
  const orders: OrderWithFrame[] = [];
  let total = 0;

  for (let page = 1; ; page += 1) {
    const result = await listOrdersForAdmin({
      ...query,
      page,
      pageSize: EXPORT_PAGE_SIZE,
    });
    total = result.total;
    orders.push(...result.orders);

    if (result.orders.length < EXPORT_PAGE_SIZE) break;
    if (orders.length >= EXPORT_MAX_ROWS) break;
  }

  return {
    orders: orders.slice(0, EXPORT_MAX_ROWS),
    total,
    truncated: total > EXPORT_MAX_ROWS,
  };
}

/**
 * A single order for an admin — no `user_id` filter, which is exactly why none
 * of the customer-facing readers above could be reused.
 */
export async function getOrderForAdmin(
  orderId: string
): Promise<OrderWithFrame | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);
  if (!data) return null;
  const [withName] = await attachFrameNames([data]);
  return withName;
}

/** Fields an operator can change. `undefined` means "leave alone". */
export interface FulfilmentPatch {
  status?: OrderStatus;
  courier?: string | null;
  trackingNumber?: string | null;
  /** Rendered to the customer as "Note from us" — not an internal field. */
  notes?: string | null;
  /** Only `"refunded"` is accepted: recording a decision made in Razorpay. */
  paymentStatus?: PaymentStatus;
}

export type FulfilmentResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; message: string }
  | {
      ok: true;
      order: OrderWithFrame;
      /** Set when `status` actually moved — what the mail hook keys on. */
      statusChangedTo: OrderStatus | null;
    };

/** Empty string from a form field means "clear it", not "set it to ''". */
function normalise(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Apply a fulfilment patch, then write the audit trail.
 *
 * Validation happens against the row as it is *now*, not as the operator's page
 * last rendered it, so two tabs cannot race an order from `pending` to
 * `shipped`. Only genuinely changed columns are written, and one `order_events`
 * row is appended per changed dimension — status, tracking, payment, note — so
 * the timeline reads as a sequence of decisions rather than of form submissions.
 */
export async function updateOrderFulfilment(
  orderId: string,
  patch: FulfilmentPatch,
  actorId: string | null
): Promise<FulfilmentResult> {
  const current = await getOrderForAdmin(orderId);
  if (!current) return { ok: false, reason: "not_found" };

  const nextStatus =
    patch.status !== undefined && patch.status !== current.status
      ? patch.status
      : null;

  if (nextStatus) {
    const message = transitionError(current, nextStatus);
    if (message) return { ok: false, reason: "invalid", message };
  }

  let paymentChange: PaymentStatus | null = null;
  if (
    patch.paymentStatus !== undefined &&
    patch.paymentStatus !== current.payment_status
  ) {
    if (patch.paymentStatus !== "refunded") {
      return {
        ok: false,
        reason: "invalid",
        message:
          "Payment status is set by Razorpay. Only 'refunded' can be recorded here.",
      };
    }
    const message = refundError(current);
    if (message) return { ok: false, reason: "invalid", message };
    paymentChange = "refunded";
  }

  const courier = normalise(patch.courier);
  const tracking = normalise(patch.trackingNumber);
  const notes = normalise(patch.notes);

  // Typed to match the table's Update shape: the generated `short_ref` and the
  // primary key are unwritable, and excluding them here is what makes an
  // accidental `update.id = …` a compile error rather than a Postgres one.
  const update: Partial<Omit<Order, "id" | "short_ref">> = {};
  if (nextStatus) update.status = nextStatus;
  if (paymentChange) update.payment_status = paymentChange;
  if (courier !== undefined && courier !== current.courier) {
    update.courier = courier;
  }
  if (tracking !== undefined && tracking !== current.tracking_number) {
    update.tracking_number = tracking;
  }
  if (notes !== undefined && notes !== current.notes) update.notes = notes;

  if (Object.keys(update).length === 0) {
    return { ok: true, order: current, statusChangedTo: null };
  }

  const supabase = createServiceClient();
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select("*")
    .single();
  if (updateError) {
    throw new Error(`Failed to update order: ${updateError.message}`);
  }

  if (nextStatus) {
    await appendOrderEvent({
      orderId,
      kind: "status",
      fromStatus: current.status,
      toStatus: nextStatus,
      actorId,
    });
  }
  if (paymentChange) {
    await appendOrderEvent({
      orderId,
      kind: "payment",
      note: "Marked refunded — refund issued from the Razorpay dashboard.",
      actorId,
    });
  }
  if (update.courier !== undefined || update.tracking_number !== undefined) {
    const shownCourier = update.courier ?? current.courier ?? "Courier";
    const shownAwb = update.tracking_number ?? current.tracking_number;
    await appendOrderEvent({
      orderId,
      kind: "tracking",
      note: shownAwb ? `${shownCourier} · ${shownAwb}` : shownCourier,
      actorId,
    });
  }
  if (update.notes !== undefined) {
    await appendOrderEvent({
      orderId,
      kind: "note",
      note: update.notes ?? "Note to customer cleared",
      actorId,
    });
  }

  const [withName] = await attachFrameNames([updated]);
  return { ok: true, order: withName, statusChangedTo: nextStatus };
}

export interface AdminOrderCounts {
  needsAction: number;
  printing: number;
  shipped: number;
  delivered: number;
  unpaid: number;
  /** Sum of `amount_paise` on paid orders placed in the last 7 days. */
  revenue7dPaise: number;
}

/** The metric tiles above the queue. One round of parallel counts. */
export async function getAdminOrderCounts(): Promise<AdminOrderCounts> {
  const supabase = createServiceClient();
  const head = { count: "exact" as const, head: true };
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [needsAction, printing, shipped, delivered, unpaid, revenue] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", head)
        .eq("payment_status", "paid")
        .in("status", ["pending", "processing"]),
      supabase.from("orders").select("id", head).eq("status", "processing"),
      supabase.from("orders").select("id", head).eq("status", "shipped"),
      supabase.from("orders").select("id", head).eq("status", "delivered"),
      supabase
        .from("orders")
        .select("id", head)
        .in("payment_status", ["created", "failed"]),
      supabase
        .from("orders")
        .select("amount_paise")
        .eq("payment_status", "paid")
        .gte("created_at", since),
    ]);

  return {
    needsAction: needsAction.count ?? 0,
    printing: printing.count ?? 0,
    shipped: shipped.count ?? 0,
    delivered: delivered.count ?? 0,
    unpaid: unpaid.count ?? 0,
    revenue7dPaise: (revenue.data ?? []).reduce(
      (sum, r) => sum + (r.amount_paise ?? 0),
      0
    ),
  };
}
