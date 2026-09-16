import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composeNewOrderAlert,
  describeStyle,
  formatSizeMm,
  referenceFor,
  type NewOrderAlertContext,
} from "./order-alert-message.ts";

function context(
  overrides: Partial<NewOrderAlertContext> = {}
): NewOrderAlertContext {
  return {
    orderId: "8f2c1d4e-0000-4000-8000-000000000000",
    reference: "A1B2C3D4",
    placedAt: "2026-09-13T11:02:00.000Z",
    amountPaise: 149900,
    paymentId: "pay_QWERTY123",
    frameName: "Classic Black",
    frameSizeMm: { widthMm: 300, heightMm: 400 },
    frameStyle: {
      name: "Walnut",
      material: "Wood",
      color: "Walnut",
      moldingWidthMm: 30,
    },
    finishName: "Gloss",
    designSource: "upload",
    designSessionId: "abcdef01-2345-6789-abcd-ef0123456789",
    crop: { x: 0.1, y: -0.04, scale: 1.2 },
    customer: {
      name: "Arun Menon",
      phone: "+919876543210",
      email: "arun@example.com",
    },
    addressLines: ["12 MG Road", "Kochi, Kerala 682001"],
    files: {
      print: "https://storage.example/print.pdf?sig=1",
      mockup: null,
      preview: null,
    },
    adminUrl: "https://framers.in/admin/orders/8f2c1d4e",
    notes: null,
    ...overrides,
  };
}

test("formatSizeMm reads as one measurement", () => {
  assert.equal(formatSizeMm({ widthMm: 300, heightMm: 400 }), "300x400 mm");
});

test("describeStyle skips empty parts instead of leaving a gap", () => {
  assert.equal(
    describeStyle({
      name: "Walnut",
      material: "Wood",
      color: "",
      moldingWidthMm: 30,
    }),
    "(Wood | 30mm moulding)"
  );
  assert.equal(describeStyle(null), null);
});

test("referenceFor prefers the stored short ref", () => {
  assert.equal(referenceFor({ id: "x", short_ref: "DEADBEEF" }), "DEADBEEF");
  assert.equal(
    referenceFor({ id: "8f2c1d4e-0000-4000-8000-000000000000" }),
    "8F2C1D4E"
  );
});

test("the subject leads with the reference and the size that decides the job", () => {
  const { subject } = composeNewOrderAlert(context());
  assert.match(subject, /^New order #A1B2C3D4/);
  assert.match(subject, /Walnut/);
  assert.match(subject, /300x400 mm/);
});

test("the body carries every detail needed to start framing", () => {
  const { text } = composeNewOrderAlert(context());
  for (const expected of [
    "#A1B2C3D4",
    "pay_QWERTY123",
    "Classic Black | 300x400 mm",
    "Walnut",
    "Gloss",
    "12 MG Road",
    "Kochi, Kerala 682001",
    "+919876543210",
    "Arun Menon",
    "https://storage.example/print.pdf?sig=1",
    "https://framers.in/admin/orders/8f2c1d4e",
  ]) {
    assert.ok(text.includes(expected), `missing from body: ${expected}`);
  }
});

test("states the crop so the bench can reproduce what the customer saw", () => {
  const { text } = composeNewOrderAlert(context());
  assert.ok(text.includes("crop 0.10/-0.04 @1.20"));
});

test("omits the file section when nothing could be signed", () => {
  const { text, html } = composeNewOrderAlert(
    context({ files: { print: null, mockup: null, preview: null } })
  );
  assert.ok(!text.includes("Print file"));
  assert.ok(!html.includes("Files</div>"));
});

test("an order with no style still composes (pre-0006 rows)", () => {
  const { subject, text } = composeNewOrderAlert(
    context({ frameStyle: null, finishName: null, frameSizeMm: null })
  );
  assert.ok(!subject.includes("undefined"));
  assert.ok(!text.includes("undefined"));
  assert.ok(!text.includes("null"));
  assert.ok(text.includes("Style"));
});

test("escapes customer text in the HTML body", () => {
  const { html } = composeNewOrderAlert(
    context({
      customer: {
        name: "Arun <script>alert(1)</script>",
        phone: "+91",
        email: null,
      },
      notes: 'Size is "300x400" & red pls',
    })
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp;"));
  assert.ok(html.includes("&quot;"));
});

test("reply-to is the customer, and null when there is no address", () => {
  assert.equal(composeNewOrderAlert(context()).replyTo, "arun@example.com");
  assert.equal(
    composeNewOrderAlert(
      context({ customer: { name: "A", phone: "9", email: null } })
    ).replyTo,
    null
  );
});
