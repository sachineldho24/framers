import "server-only";

import { appendOrderEvent } from "@/lib/data/order-events";
import { getOrderForAdmin } from "@/lib/data/orders";
import { getUserContact } from "@/lib/data/users";
import { isOrderAlertConfigured, publicEnv, serverEnv } from "@/lib/env";
import { deliver } from "@/lib/notify/mailer";
import {
  composeNewOrderAlert,
  referenceFor,
  type NewOrderAlertContext,
} from "@/lib/notify/order-alert-message";
import { createSignedUrl } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderWithFrame } from "@/lib/supabase/types";

/**
 * "A framing job just landed" - the mail that starts the work.
 *
 * Call this **only from the paid transition**, and only when `markOrderPaid`
 * returned an id rather than `null`. That return value is the whole
 * exactly-once mechanism: `verify` (the customer's browser) and the Razorpay
 * webhook both race to move the order off `created`, and the loser's guarded
 * UPDATE matches no row. So the winner sends, the loser stays quiet, and a
 * webhook retry arriving an hour later cannot send a second alert.
 *
 * Never throws. This runs *inside* the payment routes, where a mail failure
 * must not become a 500 that tells Razorpay to retry a payment it already
 * captured - a failed alert is recorded on the order's timeline instead, which
 * is where an operator will look when the job never hit the bench.
 */

/**
 * A week. Longer than the shop's own clock on a job, short enough that a
 * forwarded alert is not a permanent link to a customer's artwork.
 */
const FILE_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

/** `framers-A1B2C3D4-print.pdf` - mirrors the admin print route's naming. */
function filenameFor(reference: string, variant: string, path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase() || "bin";
  return `framers-${reference}-${variant}.${ext}`;
}

/**
 * Sign one stored object, or `null`.
 *
 * `null` rather than a throw, for the same reason `orderPreviewUrl` works that
 * way: the mockup is uploaded best-effort at checkout, so "this order has no
 * mockup" is an ordinary state and not a reason to withhold the alert.
 */
async function signFile(
  path: string | null,
  reference: string,
  variant: string
): Promise<string | null> {
  if (!path) return null;
  try {
    return await createSignedUrl(path, FILE_LINK_TTL_SECONDS, {
      download: filenameFor(reference, variant, path),
    });
  } catch (e) {
    console.warn("[new-order-alert] could not sign", path, e);
    return null;
  }
}

/**
 * Style, finish and frame dimensions for the alert.
 *
 * Read with the **service role**, not the public storefront readers: those
 * policies are `using (is_active = true)`, so a style retired the week after
 * this order would vanish from its own alert. The bench needs to know what was
 * sold, not what is currently for sale.
 */
async function loadProductDetails(order: OrderWithFrame) {
  const supabase = createServiceClient();
  const [style, finish, frame] = await Promise.all([
    order.frame_style_id
      ? supabase
          .from("frame_styles")
          .select("name, material, color, molding_width_mm")
          .eq("id", order.frame_style_id)
          .maybeSingle()
      : null,
    order.finish_id
      ? supabase
          .from("finishes")
          .select("name")
          .eq("id", order.finish_id)
          .maybeSingle()
      : null,
    supabase
      .from("frames")
      .select("width_mm, height_mm")
      .eq("id", order.frame_id)
      .maybeSingle(),
  ]);

  const s = style?.data;
  const f = frame?.data;
  return {
    frameSizeMm:
      f && typeof f.width_mm === "number" && typeof f.height_mm === "number"
        ? { widthMm: f.width_mm, heightMm: f.height_mm }
        : null,
    frameStyle: s
      ? {
          name: s.name ?? "",
          material: s.material ?? "",
          color: s.color ?? "",
          moldingWidthMm: s.molding_width_mm ?? 0,
        }
      : null,
    finishName: finish?.data?.name ?? null,
  };
}

async function buildContext(
  order: OrderWithFrame
): Promise<NewOrderAlertContext> {
  const reference = referenceFor(order);

  const [products, contact, print, mockup, preview] = await Promise.all([
    loadProductDetails(order),
    getUserContact(order.user_id),
    signFile(order.design_print_path, reference, "print"),
    signFile(order.mockup_path, reference, "mockup"),
    signFile(order.design_preview_path, reference, "preview"),
  ]);

  const crop =
    order.crop_x !== null || order.crop_y !== null || order.crop_scale !== null
      ? {
          x: order.crop_x ?? 0,
          y: order.crop_y ?? 0,
          scale: order.crop_scale ?? 1,
        }
      : null;

  return {
    orderId: order.id,
    reference,
    placedAt: order.created_at,
    amountPaise: order.amount_paise,
    paymentId: order.razorpay_payment_id,
    frameName: order.frame_name,
    frameSizeMm: products.frameSizeMm,
    frameStyle: products.frameStyle,
    finishName: products.finishName,
    designSource: order.design_source,
    designSessionId: order.design_session_id,
    crop,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: contact.email,
    },
    addressLines: [
      order.address_line1,
      order.address_line2 ?? "",
      `${order.city}, ${order.state} ${order.pincode}`,
    ],
    files: { print, mockup, preview },
    adminUrl: `${publicEnv.appUrl}/admin/orders/${order.id}`,
    notes: order.notes,
  };
}

/**
 * Mail the operator who does the framing.
 *
 * Never throws, so it is safe to `await` from inside a payment route. It is
 * *not* self-deduplicating - calling it twice sends two emails, and keeping
 * that promise is the caller's job (see the `markOrderPaid` contract above).
 */
export async function sendNewOrderAlert(orderId: string): Promise<void> {
  try {
    if (!isOrderAlertConfigured()) {
      // A deploy state, not an order event: logged only, so a half-provisioned
      // environment does not staple a "we told nobody" note to every order an
      // operator opens.
      console.warn(
        `[new-order-alert] ${orderId}: not sent - EMAIL_API_KEY, EMAIL_FROM and ORDER_NOTIFICATION_EMAIL must all be set.`
      );
      return;
    }

    const order = await getOrderForAdmin(orderId);
    if (!order) {
      console.error(
        `[new-order-alert] ${orderId}: order vanished before the alert.`
      );
      return;
    }

    const to = serverEnv.orderNotificationEmail;
    const result = await deliver(
      to,
      composeNewOrderAlert(await buildContext(order))
    );

    await appendOrderEvent({
      orderId,
      kind: "note",
      note: result.sent
        ? `New-order alert emailed to ${to}.`
        : `New-order alert NOT sent: ${result.detail}`,
    });
    if (!result.sent) {
      console.error(`[new-order-alert] ${orderId}: ${result.detail}`);
    }
  } catch (e) {
    // Last resort. Whatever broke (a missing migration, an unreachable
    // database) must not surface as a payment that looks failed.
    console.error("[new-order-alert] failed", e);
  }
}
