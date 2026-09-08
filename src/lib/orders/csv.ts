/**
 * CSV for the admin order export.
 *
 * Pure — no Supabase client, no environment, no `server-only` — so the escaping
 * rules and the spreadsheet-injection guard are unit-tested rather than trusted.
 * The route handler above it only fetches rows and sets headers.
 *
 * Why CSV and not `.xlsx`: Excel opens this file natively (given the BOM below),
 * Sheets imports it, and a real xlsx would mean either a new dependency or a
 * hand-rolled zip writer for a spreadsheet no formula ever runs in.
 */

import { shortOrderId } from "@/lib/format";
import type { OrderWithFrame } from "@/lib/supabase/types";

/** RFC 4180 specifies CRLF, and Excel on Windows is the reader that cares. */
const EOL = "\r\n";

/**
 * Excel and Sheets **evaluate** a cell that begins with one of these. Customer
 * name, address and note are free text typed by strangers, so `=HYPERLINK(…)`
 * or a DDE payload in the name field would run on the operator's machine the
 * moment they open the export. A leading apostrophe forces the cell to text.
 *
 * Plain numbers are exempt so amounts, phone numbers and pincodes stay values.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Excel assumes the system codepage unless a CSV opens with a byte-order mark,
 * which turns `₹` and any non-Latin name into mojibake. Prepended by the route,
 * kept here so the reason lives next to the format.
 */
export const CSV_BOM = "\uFEFF";

export type CsvValue = string | number | null | undefined;

/** One escaped, injection-guarded CSV field. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "number" ? String(value) : value;
  const guarded =
    FORMULA_LEAD.test(raw) && !PLAIN_NUMBER.test(raw) ? `'${raw}` : raw;
  // Quote around delimiters, quotes, newlines, and edge whitespace a reader
  // would otherwise trim away.
  return /[",\r\n]|^\s|\s$/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

/** Rows → a complete CSV body, header row included by the caller. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join(EOL) + EOL;
}

/**
 * `YYYY-MM-DD HH:mm` in IST — unambiguous, sorts as text, and parses as a date
 * in both Excel and Sheets. Pinned to Asia/Kolkata for the same reason
 * `formatDateTime` is: the operator and the courier are both in IST, and a
 * server rendering in UTC would date a late-evening order to the day before.
 */
export function istTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

/** Paise → a plain rupee number Excel can sum (`149900` → `1499.00`). */
function rupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * The sheet's header row. Order matters — `orderExportRow` below is positional,
 * and the two are asserted to stay the same length.
 */
export const ORDER_EXPORT_COLUMNS = [
  "Reference",
  "Placed (IST)",
  "Order status",
  "Payment status",
  "Frame",
  "Amount (INR)",
  "Customer",
  "Phone",
  "Address line 1",
  "Address line 2",
  "City",
  "State",
  "Pincode",
  "Courier",
  "Tracking number",
  "Note to customer",
  "Razorpay order ID",
  "Razorpay payment ID",
  "Order ID",
  "Last updated (IST)",
] as const;

/** One order as a row of cells, positionally matching the header above. */
export function orderExportRow(order: OrderWithFrame): CsvValue[] {
  return [
    order.short_ref ?? shortOrderId(order.id),
    istTimestamp(order.created_at),
    order.status,
    order.payment_status,
    order.frame_name,
    rupees(order.amount_paise),
    order.customer_name,
    order.customer_phone,
    order.address_line1,
    order.address_line2,
    order.city,
    order.state,
    order.pincode,
    order.courier,
    order.tracking_number,
    order.notes,
    order.razorpay_order_id,
    order.razorpay_payment_id,
    order.id,
    istTimestamp(order.updated_at),
  ];
}

/** The whole export: header row plus one row per order. */
export function ordersToCsv(orders: readonly OrderWithFrame[]): string {
  return toCsv([ORDER_EXPORT_COLUMNS, ...orders.map(orderExportRow)]);
}

/**
 * A filename that says what the operator actually exported, so three downloads
 * in an afternoon do not become `orders (2).csv`.
 */
export function orderExportFilename(
  scope: { tab: string; q?: string },
  now: Date = new Date()
): string {
  const stamp = istTimestamp(now.toISOString())
    .replace(" ", "-")
    .replaceAll(":", "");
  const label = scope.q ? "search" : scope.tab.replaceAll("_", "-");
  return `framers-orders-${label}-${stamp}.csv`;
}
