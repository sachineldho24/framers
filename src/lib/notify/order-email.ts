import "server-only";

import { appendOrderEvent } from "@/lib/data/order-events";
import { isEmailConfigured, publicEnv, serverEnv } from "@/lib/env";
import { formatPaise, shortOrderId } from "@/lib/format";
import type { OrderStatus, OrderWithFrame } from "@/lib/supabase/types";

/**
 * Ship / deliver notifications.
 *
 * The provider is **not yet provisioned** — that goes through the Vercel
 * Marketplace (`vercel integration discover --category messaging`), which needs
 * the CLI installed and this folder linked. Until `EMAIL_API_KEY` and
 * `EMAIL_FROM` exist, `sendFulfilmentEmail` composes the message, records that
 * it could not be sent on the order's timeline, and returns — the status change
 * itself has already been written and must not fail for want of an email.
 *
 * When the integration lands, `deliver()` is the only function that changes.
 */

interface Composed {
  subject: string;
  text: string;
}

function compose(order: OrderWithFrame, status: OrderStatus): Composed {
  const ref = order.short_ref ?? shortOrderId(order.id);
  const url = `${publicEnv.appUrl}/orders/${order.id}`;
  const consignment = [order.courier, order.tracking_number]
    .filter(Boolean)
    .join(" · ");

  if (status === "shipped") {
    return {
      subject: `Your Framers order #${ref} has shipped`,
      text: [
        `Hi ${order.customer_name.split(" ")[0]},`,
        "",
        `Your ${order.frame_name} is on its way.`,
        consignment ? `Courier: ${consignment}` : "",
        "",
        `Track it here: ${url}`,
        "",
        `Order #${ref} · ${formatPaise(order.amount_paise)}`,
        "— Framers",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    };
  }

  return {
    subject: `Delivered — Framers order #${ref}`,
    text: [
      `Hi ${order.customer_name.split(" ")[0]},`,
      "",
      `Your ${order.frame_name} has been delivered. We hope it looks right on the wall.`,
      "",
      `Order details: ${url}`,
      "",
      `Order #${ref}`,
      "— Framers",
    ].join("\n"),
  };
}

/**
 * Hand the composed message to the provider. Throws on a provider error so the
 * caller can log it; the caller never lets that failure reach the operator's
 * write.
 */
async function deliver(
  to: string,
  message: Composed
): Promise<{ sent: boolean; detail: string }> {
  // Reading the getters proves the keys are really there before we claim to
  // have sent anything. Replace the body below with the provider's SDK call
  // once `vercel integration add` has run — `to` and `message` are the whole
  // payload it will need, and are discarded rather than dropped from the
  // signature so wiring the provider up is a one-function change.
  void serverEnv.emailApiKey;
  void serverEnv.emailFrom;
  void to;
  void message;
  return {
    sent: false,
    detail: "Email provider not implemented yet (Marketplace integration pending).",
  };
}

/**
 * Notify the customer that their order shipped or was delivered.
 *
 * Never throws. A failure becomes a `note` event on the order so an operator can
 * see, on the same timeline as the status change, that nobody was told.
 */
export async function sendFulfilmentEmail(
  order: OrderWithFrame,
  status: OrderStatus,
  email: string | null
): Promise<void> {
  if (status !== "shipped" && status !== "delivered") return;

  const message = compose(order, status);

  if (!email) {
    await appendOrderEvent({
      orderId: order.id,
      kind: "note",
      note: `${status} email not sent: no email address on this account.`,
    });
    return;
  }

  if (!isEmailConfigured()) {
    console.warn(
      `[order-email] ${status} notification for ${order.id} not sent: no provider configured.`
    );
    await appendOrderEvent({
      orderId: order.id,
      kind: "note",
      note: `${status} email not sent: no email provider configured.`,
    });
    return;
  }

  try {
    const result = await deliver(email, message);
    await appendOrderEvent({
      orderId: order.id,
      kind: "note",
      note: result.sent
        ? `${status} email sent to ${email}.`
        : `${status} email not sent: ${result.detail}`,
    });
  } catch (e) {
    console.error("[order-email] send failed", e);
    await appendOrderEvent({
      orderId: order.id,
      kind: "note",
      note: `${status} email failed to send to ${email}.`,
    });
  }
}
