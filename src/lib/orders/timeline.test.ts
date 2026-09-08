import assert from "node:assert/strict";
import { test } from "node:test";

import { statusTimestamps } from "./timeline.ts";
import type { OrderEvent, OrderEventKind } from "../supabase/types.ts";

let seq = 0;

function event(partial: {
  kind?: OrderEventKind;
  to?: string | null;
  at: string;
}): OrderEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    order_id: "o1",
    kind: partial.kind ?? "status",
    from_status: null,
    to_status: partial.to ?? null,
    note: null,
    actor_id: null,
    created_at: partial.at,
  };
}

test("statusTimestamps dates each stage it reached", () => {
  const stamps = statusTimestamps([
    event({ to: "pending", at: "2026-08-01T10:00:00Z" }),
    event({ to: "processing", at: "2026-08-02T10:00:00Z" }),
    event({ to: "shipped", at: "2026-08-03T10:00:00Z" }),
  ]);

  assert.equal(stamps.pending, "2026-08-01T10:00:00Z");
  assert.equal(stamps.processing, "2026-08-02T10:00:00Z");
  assert.equal(stamps.shipped, "2026-08-03T10:00:00Z");
  assert.equal(stamps.delivered, undefined);
});

test("first occurrence wins, so a corrected status keeps the real date", () => {
  const stamps = statusTimestamps([
    event({ to: "shipped", at: "2026-08-03T10:00:00Z" }),
    event({ to: "shipped", at: "2026-08-09T10:00:00Z" }),
  ]);
  assert.equal(stamps.shipped, "2026-08-03T10:00:00Z");
});

test("only 'status' events date the stepper", () => {
  const stamps = statusTimestamps([
    event({ kind: "tracking", to: "shipped", at: "2026-08-01T10:00:00Z" }),
    event({ kind: "payment", to: null, at: "2026-08-01T11:00:00Z" }),
    event({ kind: "note", to: "delivered", at: "2026-08-01T12:00:00Z" }),
  ]);
  assert.deepEqual(stamps, {});
});

test("an unknown to_status is ignored rather than trusted", () => {
  const stamps = statusTimestamps([
    event({ to: "in_transit", at: "2026-08-01T10:00:00Z" }),
    event({ to: null, at: "2026-08-01T11:00:00Z" }),
  ]);
  assert.deepEqual(stamps, {});
});

test("cancelled is dated too — the notice says when", () => {
  const stamps = statusTimestamps([
    event({ to: "pending", at: "2026-08-01T10:00:00Z" }),
    event({ to: "cancelled", at: "2026-08-04T09:30:00Z" }),
  ]);
  assert.equal(stamps.cancelled, "2026-08-04T09:30:00Z");
});

test("no events is an empty map, not a throw", () => {
  assert.deepEqual(statusTimestamps([]), {});
});
