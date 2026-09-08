import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_TRANSITIONS,
  canTransition,
  refundError,
  REFUNDABLE_FROM,
  transitionError,
} from "./transitions.ts";
import type { OrderStatus, PaymentStatus } from "../supabase/types.ts";

/**
 * The two rules worth having in code are "no skipping a stage" and "nothing goes
 * to print before the money lands". Everything here is one of those.
 */

function order(status: OrderStatus, payment: PaymentStatus = "paid") {
  return { status, payment_status: payment };
}

test("canTransition follows the stage order", () => {
  assert.equal(canTransition("pending", "processing"), true);
  assert.equal(canTransition("processing", "shipped"), true);
  assert.equal(canTransition("shipped", "delivered"), true);

  // No skipping.
  assert.equal(canTransition("pending", "shipped"), false);
  assert.equal(canTransition("pending", "delivered"), false);
  assert.equal(canTransition("processing", "delivered"), false);
});

test("canTransition allows same → same, so a courier-only edit is legal", () => {
  for (const s of Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[]) {
    assert.equal(canTransition(s, s), true, s);
  }
});

test("terminal states have no exits", () => {
  assert.deepEqual(ALLOWED_TRANSITIONS.delivered, []);
  assert.deepEqual(ALLOWED_TRANSITIONS.cancelled, []);
  assert.equal(canTransition("delivered", "shipped"), false);
  assert.equal(canTransition("cancelled", "processing"), false);
});

test("cancelling is available from any live state, not from a finished one", () => {
  assert.equal(canTransition("pending", "cancelled"), true);
  assert.equal(canTransition("processing", "cancelled"), true);
  assert.equal(canTransition("shipped", "cancelled"), false);
  assert.equal(canTransition("delivered", "cancelled"), false);
});

test("transitionError is null for a legal move on a paid order", () => {
  assert.equal(transitionError(order("pending"), "processing"), null);
  assert.equal(transitionError(order("processing"), "shipped"), null);
  assert.equal(transitionError(order("shipped"), "delivered"), null);
});

test("transitionError names the allowed next steps on an illegal move", () => {
  const message = transitionError(order("pending"), "shipped");
  assert.ok(message);
  assert.match(message, /processing/);
});

test("transitionError says 'final' rather than listing nothing", () => {
  const message = transitionError(order("delivered"), "shipped");
  assert.ok(message);
  assert.match(message, /final/);
});

test("an unpaid order cannot start printing", () => {
  for (const payment of ["created", "failed", "refunded"] as PaymentStatus[]) {
    const message = transitionError(order("pending", payment), "processing");
    assert.ok(message, payment);
    assert.match(message, /not paid|nothing goes to print/i);
  }
});

test("an unpaid order can still be cancelled", () => {
  assert.equal(transitionError(order("pending", "created"), "cancelled"), null);
  assert.equal(transitionError(order("pending", "failed"), "cancelled"), null);
});

test("a no-op status is never blocked by the payment rule", () => {
  assert.equal(transitionError(order("pending", "created"), "pending"), null);
});

test("refunds are only recordable against captured money", () => {
  assert.deepEqual(REFUNDABLE_FROM, ["paid"]);
  assert.equal(refundError({ payment_status: "paid" }), null);
  assert.match(String(refundError({ payment_status: "refunded" })), /Already/);
  assert.match(
    String(refundError({ payment_status: "created" })),
    /nothing captured/i
  );
});
