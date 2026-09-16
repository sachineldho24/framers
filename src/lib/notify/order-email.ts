import "server-only";

import { appendOrderEvent } from "@/lib/data/order-events";
import { isEmailConfigured, publicEnv } from "@/lib/env";
import { formatPaise, shortOrderId } from "@/lib/format";
import { deliver, type Message } from "@/lib/notify/mailer";
import type { OrderStatus, OrderWithFrame } from "@/lib/supabase/types";

/**
 * Ship / deliver notifications to the customer.
 *
 * Transport lives in `mailer.ts`; this module only decides what to say and when
 * it is worth saying. Until `EMAIL_API_KEY` and `EMAIL_FROM` exist,
 * `sendFulfilmentEmail` composes the message, records on the order's timeline
 * that it could not be sent, and returns - the status change itself has already
 * been written and must not fail for want of an email.
 */

function compose(order: OrderWithFrame, status: OrderStatus): Message {
  const ref = order.short_ref ?? shortOrderId(order.id);
  const url = `${publicEnv.appUrl}/orders/${order.id}`;
  const consignment = [order.courier, order.tracking_number]
    .filter(Boolean)
    .join(" | ");

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
        `Order #${ref} | ${formatPaise(order.amount_paise)}`,
        "- Framers",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    };
  }

  return {
    subject: `Delivered - Framers order #${ref}`,
    text: [
      `Hi ${order.customer_name.split(" ")[0]},`,
      "",
      `Your ${order.frame_name} has been delivered. We hope it looks right on the wall.`,
      "",
      `Order details: ${url}`,
      "",
      `Order #${ref}`,
      "- Framers",
    ].join("\n"),
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

  const result = await deliver(email, message);
  await appendOrderEvent({
    orderId: order.id,
    kind: "note",
    note: result.sent
      ? `${status} email sent to ${email}.`
      : `${status} email not sent: ${result.detail}`,
  });
}
