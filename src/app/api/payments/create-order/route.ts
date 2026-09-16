import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRazorpayConfigured, publicEnv } from "@/lib/env";
import { getFrameById } from "@/lib/data/frames";
import { getFrameStyleById } from "@/lib/data/frame-styles";
import { getFinishById } from "@/lib/data/finishes";
import { createPendingOrder } from "@/lib/data/orders";
import { razorpay } from "@/lib/razorpay";
import type { DesignSource } from "@/lib/supabase/types";
import { shippingError } from "@/lib/shipping";
import { verifyIndianPincode } from "@/lib/shipping-server";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface Body {
  frameId?: string;
  designSource?: DesignSource;
  printPath?: string;
  previewPath?: string | null;
  customerName?: string;
  customerPhone?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  // Designer-flow fields.
  frameStyleId?: string | null;
  finishId?: string | null;
  sessionId?: string | null;
  mockupPath?: string | null;
}

/**
 * POST /api/payments/create-order
 * Creates a Razorpay order + a 'created' (unpaid) order row, then returns the
 * info the browser needs to open Razorpay Checkout. Price is taken from the DB,
 * never trusted from the client. See plan/02 Path B.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);

  if (!isRazorpayConfigured()) {
    return err(
      "razorpay_unconfigured",
      "Payments aren't available yet. Please try again later.",
      503
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return err("bad_request", "Invalid request.", 400);
  }

  if (!body || typeof body !== "object") return err("bad_request", "Invalid request.", 400);
  const shippingIssue = shippingError(body);
  if (shippingIssue) return err("invalid_shipping", shippingIssue, 400);
  try {
    const pinIssue = await verifyIndianPincode(body.pincode!, body.state!);
    if (pinIssue) return err("invalid_shipping", pinIssue, 400);
  } catch {
    return err("shipping_unavailable", "We couldn't verify your Indian PIN code. Please try again shortly.", 503);
  }

  // Required fields.
  const required = [
    body.frameId,
    body.designSource,
    body.printPath,
    body.customerName,
    body.customerPhone,
    body.addressLine1,
    body.city,
    body.state,
    body.pincode,
  ];
  if (required.some((v) => !v)) {
    return err("bad_request", "Missing required checkout fields.", 400);
  }

  // The design files must belong to this user.
  if (!body.printPath!.startsWith(`${user.id}/`)) {
    return err("forbidden", "Invalid design reference.", 403);
  }

  const frame = await getFrameById(body.frameId!);
  if (!frame || !frame.is_active) {
    return err("not_found", "Frame not found.", 404);
  }

  // Flat pricing: the frame's own price, read from the DB. Never trust the
  // client's amount, and never add a style or finish upcharge - the moulding
  // and the glazing change how the frame is made, not what it costs. The
  // chosen rows are still validated and still recorded on the order, because
  // the bench builds the job from them (see migration 0011).
  const amountPaise = frame.price_paise;
  let frameStyleId: string | null = null;
  let finishId: string | null = null;

  if (body.frameStyleId) {
    const style = await getFrameStyleById(body.frameStyleId);
    if (!style) return err("bad_request", "Invalid frame style.", 400);
    frameStyleId = style.id;
  }
  if (body.finishId) {
    const finish = await getFinishById(body.finishId);
    if (!finish) return err("bad_request", "Invalid finish.", 400);
    finishId = finish.id;
  }

  try {
    // 1. Razorpay order (amount authoritative from DB).
    const rzpOrder = await razorpay().orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `frame_${frame.id}_${user.id}`.slice(0, 40),
      notes: { frameId: frame.id, userId: user.id },
    });

    // 2. Pending order row.
    const orderId = await createPendingOrder({
      userId: user.id,
      frameId: frame.id,
      amountPaise,
      razorpayOrderId: rzpOrder.id,
      designSource: body.designSource!,
      designPreviewPath: body.previewPath ?? null,
      designPrintPath: body.printPath!,
      frameStyleId,
      finishId,
      designSessionId: body.sessionId ?? null,
      mockupPath: body.mockupPath ?? null,
      customerName: body.customerName!,
      customerPhone: body.customerPhone!,
      addressLine1: body.addressLine1!,
      addressLine2: body.addressLine2 ?? null,
      city: body.city!,
      state: body.state!.trim(),
      pincode: body.pincode!.trim(),
    });

    return NextResponse.json({
      keyId: publicEnv.razorpayKeyId,
      razorpayOrderId: rzpOrder.id,
      amountPaise,
      orderId,
    });
  } catch (e) {
    console.error("[payments/create-order] failed:", e);
    return err("razorpay_error", "Could not start payment.", 502);
  }
}
