import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CSV_BOM,
  ORDER_EXPORT_COLUMNS,
  csvCell,
  istTimestamp,
  orderExportFilename,
  orderExportRow,
  ordersToCsv,
  toCsv,
} from "./csv.ts";
import type { OrderWithFrame } from "../supabase/types.ts";

function order(overrides: Partial<OrderWithFrame> = {}): OrderWithFrame {
  return {
    id: "8f14e45f-ceea-467a-9c3d-2b1a0f0f1234",
    user_id: "u1",
    frame_id: "f1",
    design_source: "upload",
    design_preview_path: null,
    design_print_path: "u1/s1/print.png",
    razorpay_order_id: "order_TEST123",
    razorpay_payment_id: "pay_TEST123",
    amount_paise: 149900,
    payment_status: "paid",
    customer_name: "Aarti Deshpande",
    customer_phone: "9876543210",
    address_line1: "12, MG Road",
    address_line2: null,
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    status: "pending",
    tracking_number: null,
    courier: null,
    notes: null,
    frame_style_id: null,
    finish_id: null,
    design_session_id: null,
    mockup_path: null,
    crop_x: null,
    crop_y: null,
    crop_scale: null,
    created_at: "2026-08-30T19:45:00.000Z",
    updated_at: "2026-08-31T04:05:00.000Z",
    frame_name: "A4 Classic Black",
    ...overrides,
  };
}

test("csvCell quotes only what needs quoting, and doubles inner quotes", () => {
  assert.equal(csvCell("Pune"), "Pune");
  assert.equal(csvCell(411001), "411001");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");

  assert.equal(csvCell("12, MG Road"), '"12, MG Road"');
  assert.equal(csvCell('He said "no"'), '"He said ""no"""');
  assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
  // Edge whitespace survives a reader that would otherwise trim it.
  assert.equal(csvCell(" padded "), '" padded "');
});

test("csvCell defuses spreadsheet formulas without mangling numbers", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil\",\"x\")"), '"\'=HYPERLINK(""http://evil"",""x"")"');
  // No delimiter in the value, so the apostrophe alone is the whole change.
  assert.equal(csvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  assert.equal(csvCell("@SUM(1+1)"), "'@SUM(1+1)");
  assert.equal(csvCell("+919876543210"), "'+919876543210");

  // Amounts stay values, so the operator can still sum the column.
  assert.equal(csvCell("1499.00"), "1499.00");
  assert.equal(csvCell("-250"), "-250");
  assert.equal(csvCell(-250.5), "-250.5");
});

test("toCsv joins with CRLF and ends with one", () => {
  assert.equal(toCsv([["a", "b"], [1, null]]), "a,b\r\n1,\r\n");
});

test("istTimestamp reports Asia/Kolkata, not the runtime zone", () => {
  // 19:45 UTC is 01:15 the next day in IST — the case a UTC server gets wrong.
  assert.equal(istTimestamp("2026-08-30T19:45:00.000Z"), "2026-08-31 01:15");
  // Midnight IST must be 00:00, never 24:00.
  assert.equal(istTimestamp("2026-08-30T18:30:00.000Z"), "2026-08-31 00:00");
  assert.equal(istTimestamp(null), "");
  assert.equal(istTimestamp("not a date"), "");
});

test("every export row lines up with the header", () => {
  const row = orderExportRow(order());
  assert.equal(row.length, ORDER_EXPORT_COLUMNS.length);

  assert.equal(row[0], "8F14E45F"); // no short_ref yet → derived reference
  assert.equal(row[1], "2026-08-31 01:15");
  assert.equal(row[5], "1499.00"); // paise → rupees, summable
  assert.equal(row[6], "Aarti Deshpande");
});

test("a generated short_ref wins over the derived one", () => {
  assert.equal(orderExportRow(order({ short_ref: "A1B2C3D4" }))[0], "A1B2C3D4");
});

test("ordersToCsv writes a header plus one line per order", () => {
  const csv = ordersToCsv([order(), order({ id: "b", frame_name: "A3 Oak" })]);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], ORDER_EXPORT_COLUMNS.join(","));
  assert.match(lines[2], /A3 Oak/);
});

test("the BOM is one character, so Excel reads the file as UTF-8", () => {
  assert.equal(CSV_BOM.length, 1);
  assert.equal(CSV_BOM.charCodeAt(0), 0xfeff);
});

test("the filename says which queue was exported and when", () => {
  const at = new Date("2026-08-31T04:05:00.000Z");
  assert.equal(
    orderExportFilename({ tab: "needs_action" }, at),
    "framers-orders-needs-action-2026-08-31-0935.csv"
  );
  assert.equal(
    orderExportFilename({ tab: "all", q: "411001" }, at),
    "framers-orders-search-2026-08-31-0935.csv"
  );
});
