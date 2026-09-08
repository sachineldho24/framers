import "server-only";
import { createSignedUrl } from "@/lib/storage";
import type { Order } from "@/lib/supabase/types";

/**
 * A signed URL for the picture of an order, or `null`.
 *
 * `null` rather than a throw is the point. The framed mockup is captured in the
 * browser on the Review step and uploaded **best-effort** — an order with no
 * preview image is deliberately allowed, because failing to save a thumbnail is
 * not worth blocking a payment over. So a missing object is a normal state here,
 * and neither the history list nor the detail page should 500 over one.
 *
 * The mockup (frame + artwork, what the customer saw) wins over the bare design
 * preview; the print file itself is never shown — it is the full page, including
 * whatever runs under the moulding lip.
 */
export async function orderPreviewUrl(
  order: Pick<Order, "mockup_path" | "design_preview_path">,
  expiresInSeconds = 600
): Promise<string | null> {
  const path = order.mockup_path ?? order.design_preview_path;
  if (!path) return null;
  try {
    return await createSignedUrl(path, expiresInSeconds);
  } catch {
    return null;
  }
}
