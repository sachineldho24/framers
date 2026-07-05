import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { serverEnv, publicEnv } from "@/lib/env";

/** Lazily-constructed Razorpay client (server-only). */
let client: Razorpay | null = null;
export function razorpay(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: publicEnv.razorpayKeyId,
      key_secret: serverEnv.razorpayKeySecret,
    });
  }
  return client;
}

/**
 * Verify the signature returned to the browser by Razorpay Checkout.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", serverEnv.razorpayKeySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqual(expected, params.signature);
}

/**
 * Verify a webhook payload signature.
 * signature = HMAC_SHA256(rawBody, webhook_secret)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", serverEnv.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(expected, signature);
}

/** Constant-time compare that won't throw on length mismatch. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
