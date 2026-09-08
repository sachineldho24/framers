/**
 * Fulfilment writes — the only way an order's status, courier, consignment
 * number or customer-facing note changes.
 *
 * This route is deliberately **not** listed in `ADMIN_PREFIXES`
 * (`src/lib/supabase/middleware.ts`): the proxy answers an unauthorised hit on
 * an `/admin` *page* with a 307 to `/`, which for a `fetch()` means an HTML
 * body where the caller expected JSON. So the gate lives here, in the handler,
 * and returns a real 403.
 *
 * Note what the gate is holding: every read in `src/lib/data/orders.ts` uses the
 * service-role client, so Postgres's `"Admins manage all orders"` policy is not
 * in the path at all. `isAdmin()` below is the entire boundary between one
 * customer's order and another's.
 */

import { NextResponse } from "next/server";

import { getUserContact } from "@/lib/data/users";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/auth";
import {
  updateOrderFulfilment,
  type FulfilmentPatch,
} from "@/lib/data/orders";
import { sendFulfilmentEmail } from "@/lib/notify/order-email";
import type { OrderStatus, PaymentStatus } from "@/lib/supabase/types";

const STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "created",
  "paid",
  "failed",
  "refunded",
];

/** Long enough for a real note, short enough not to be a payload. */
const MAX_NOTE = 1000;
const MAX_FIELD = 120;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: err("unauthorized", "Please sign in.", 401) };
  if (!isAdmin(user)) return { error: err("forbidden", "Admins only.", 403) };
  return { user };
}

interface PatchBody {
  status?: unknown;
  courier?: unknown;
  trackingNumber?: unknown;
  notes?: unknown;
  paymentStatus?: unknown;
}

/** `null` clears the field, `undefined`/absent leaves it alone. */
function readText(
  value: unknown,
  max: number
): { ok: true; value?: string | null } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string" || value.length > max) return { ok: false };
  return { ok: true, value };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const { orderId } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  const patch: FulfilmentPatch = {};

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as OrderStatus)) {
      return err("bad_request", "Unknown status.", 400);
    }
    patch.status = body.status as OrderStatus;
  }

  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus as PaymentStatus)) {
      return err("bad_request", "Unknown payment status.", 400);
    }
    patch.paymentStatus = body.paymentStatus as PaymentStatus;
  }

  const courier = readText(body.courier, MAX_FIELD);
  const tracking = readText(body.trackingNumber, MAX_FIELD);
  const notes = readText(body.notes, MAX_NOTE);
  if (!courier.ok || !tracking.ok || !notes.ok) {
    return err("bad_request", "A field was too long or the wrong type.", 400);
  }
  if (courier.value !== undefined) patch.courier = courier.value;
  if (tracking.value !== undefined) patch.trackingNumber = tracking.value;
  if (notes.value !== undefined) patch.notes = notes.value;

  if (Object.keys(patch).length === 0) {
    return err("bad_request", "Nothing to change.", 400);
  }

  let result;
  try {
    result = await updateOrderFulfilment(orderId, patch, gate.user.id);
  } catch (e) {
    console.error("[admin/orders PATCH] failed:", e);
    return err("server_error", "Could not update this order.", 500);
  }

  if (!result.ok) {
    return result.reason === "not_found"
      ? err("not_found", "Order not found.", 404)
      : err("invalid_transition", result.message, 400);
  }

  // Mail is a side effect of a write that already succeeded, so a bounced send
  // is logged and recorded on the timeline — never a failed status update.
  if (result.statusChangedTo === "shipped" || result.statusChangedTo === "delivered") {
    try {
      const { email } = await getUserContact(result.order.user_id);
      await sendFulfilmentEmail(result.order, result.statusChangedTo, email);
    } catch (e) {
      console.error("[admin/orders PATCH] notification failed:", e);
    }
  }

  return NextResponse.json({ ok: true, order: result.order });
}
