import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { DesignSource, Order, OrderWithFrame } from "@/lib/supabase/types";

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
  return data.id;
}

/**
 * Mark an order paid. Idempotent — only flips a 'created' order to 'paid'.
 * Returns the order id, or null if no matching order.
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
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to mark order paid: ${error.message}`);
  return data?.id ?? null;
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
