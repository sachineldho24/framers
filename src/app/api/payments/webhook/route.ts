import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { markOrderPaid } from "@/lib/data/orders";
import { sendNewOrderAlert } from "@/lib/notify/new-order-alert";

/**
 * POST /api/payments/webhook
 * Razorpay server-to-server confirmation. The source of truth for "paid".
 * Must verify the HMAC signature on the RAW body before doing anything.
 * Returns 200 on success (Razorpay retries non-2xx).
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const rawBody = await request.text();

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    console.error("[payments/webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
      order?: { entity?: { id?: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  // We care about a successful capture.
  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id ?? event.payload?.order?.entity?.id;
    const paymentId = payment?.id;

    if (orderId && paymentId) {
      try {
        // A non-null return means *this* call is the one that moved the order
        // to paid, so exactly one alert goes out however often Razorpay retries
        // this webhook or races the browser's verify request.
        const paidOrderId = await markOrderPaid(orderId, paymentId);
        if (paidOrderId) await sendNewOrderAlert(paidOrderId);
      } catch (e) {
        console.error("[payments/webhook] markOrderPaid failed:", e);
        // 500 so Razorpay retries.
        return NextResponse.json({ error: "processing" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
