import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shippingError } from "@/lib/shipping";
import { verifyIndianPincode } from "@/lib/shipping-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: { message: "Please sign in." } }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: { message: "Invalid shipping address." } }, { status: 400 });
  const error = shippingError(body);
  if (error) return NextResponse.json({ error: { message: error } }, { status: 400 });
  try {
    const issue = await verifyIndianPincode(body.pincode, body.state);
    if (issue) return NextResponse.json({ error: { message: issue } }, { status: 400 });
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ error: { message: "We couldn't verify your Indian PIN code. Please try again shortly." } }, { status: 503 });
  }
}
