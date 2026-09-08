/**
 * Hand the operator the file that actually gets printed.
 *
 * A 302 to a signed Storage URL, so a plain `<a href>` downloads it with no
 * client JavaScript and the bytes never pass through a function.
 *
 * Read the gate here carefully. Every other signing path in this codebase checks
 * `path.startsWith(`${user.id}/`)` — the artwork lives under the *customer's*
 * folder, so an admin signing it fails that check by design. This route replaces
 * that check with `isAdmin()`, which makes `isAdmin()` the only thing standing
 * between a customer's artwork and a URL anyone holding it can fetch. Hence the
 * gate runs before `params` is even read, and the link is short-lived.
 */

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/auth";
import { getOrderForAdmin } from "@/lib/data/orders";
import { shortOrderId } from "@/lib/format";
import { createSignedUrl } from "@/lib/storage";

/** Long enough to start a large download, short enough to be useless later. */
const EXPIRES_SECONDS = 600;

type Variant = "print" | "mockup" | "preview";

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", "Please sign in.", 401);
  if (!isAdmin(user)) return err("forbidden", "Admins only.", 403);

  const { orderId } = await params;
  const requested = new URL(request.url).searchParams.get("variant") ?? "print";
  if (!["print", "mockup", "preview"].includes(requested)) {
    return err("bad_request", "Unknown variant.", 400);
  }
  const variant = requested as Variant;

  const order = await getOrderForAdmin(orderId);
  if (!order) return err("not_found", "Order not found.", 404);

  const path =
    variant === "print"
      ? order.design_print_path
      : variant === "mockup"
        ? order.mockup_path
        : order.design_preview_path;

  if (!path) {
    return err("not_found", `This order has no ${variant} file.`, 404);
  }

  // Name the download after the reference the operator is working from, not
  // after a uuid path segment. The extension has to follow the stored object.
  const ref = order.short_ref ?? shortOrderId(order.id);
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase() || "png";
  const filename = `framers-${ref}-${variant}.${ext}`;

  try {
    const url = await createSignedUrl(path, EXPIRES_SECONDS, {
      download: filename,
    });
    return NextResponse.redirect(url, 302);
  } catch (e) {
    console.error("[admin/orders print] signing failed:", e);
    return err("server_error", "Could not prepare that file.", 500);
  }
}
