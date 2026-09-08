/**
 * `GET /api/admin/orders/export` — the queue the operator is looking at, as a
 * CSV they can open in Excel or Sheets.
 *
 * A plain `<a href>` target: the response *is* the file, so no client JavaScript
 * builds a blob and nothing about the export depends on the browser. The link
 * carries the same `tab` and `q` the page was rendered with, which is what makes
 * "export what I'm looking at" true rather than approximately true.
 *
 * The gate is `isAdmin()` and nothing else. Every read below uses the
 * service-role client, so RLS grants this route no protection at all, and one
 * row here carries a customer's name, phone number and full address. It fails
 * closed and it is never cached.
 */

import { getCurrentUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/auth";
import { listOrdersForAdminExport } from "@/lib/data/orders";
import {
  CSV_BOM,
  orderExportFilename,
  ordersToCsv,
} from "@/lib/orders/csv";
import { parseTab } from "@/lib/orders/tabs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthorized", message: "Please sign in." } },
      { status: 401 }
    );
  }
  if (!isAdmin(user)) {
    return Response.json(
      { error: { code: "forbidden", message: "Admins only." } },
      { status: 403 }
    );
  }

  const params = new URL(request.url).searchParams;
  const tab = parseTab(params.get("tab") ?? undefined);
  const q = (params.get("q") ?? "").trim();

  const { orders, total, truncated } = await listOrdersForAdminExport({
    tab,
    q,
  });
  const filename = orderExportFilename({ tab, q });

  return new Response(CSV_BOM + ordersToCsv(orders), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Says what the sheet holds without the operator counting rows — and
      // admits it when the ceiling clipped the export.
      "X-Export-Rows": String(orders.length),
      "X-Export-Total": String(total),
      "X-Export-Truncated": truncated ? "1" : "0",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
