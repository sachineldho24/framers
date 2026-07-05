import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { getOrderByRazorpayId, markOrderPaid } from "@/lib/data/orders";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/payments/verify
 * Called by the browser right after Razorpay Checkout succeeds. Verifies the
 * client signature, marks the order paid (the webhook also does this — whichever
 * lands first wins, both are idempotent), and returns the internal order id so
 * the client can redirect to the confirmation page.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return err("bad_request", "Missing payment fields.", 400);
  }

  const valid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!valid) {
    return err("invalid_signature", "Payment could not be verified.", 400);
  }

  // Confirm the order exists and belongs to this user.
  const order = await getOrderByRazorpayId(razorpay_order_id);
  if (!order || order.user_id !== user.id) {
    return err("not_found", "Order not found.", 404);
  }

  await markOrderPaid(razorpay_order_id, razorpay_payment_id);
  return NextResponse.json({ orderId: order.id });
}
