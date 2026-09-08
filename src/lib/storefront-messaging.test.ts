import assert from "node:assert/strict";
import test from "node:test";

import { MARQUEE_ITEMS } from "./storefront-messaging.ts";

test("marquee uses only supportable fulfilment and product claims", () => {
  assert.deepEqual(
    MARQUEE_ITEMS.map((item) => item.text),
    [
      "FREE SHIPPING",
      "300 GSM ARCHIVAL",
      "DISPATCH IN 3 DAYS",
      "REPLACED IF DAMAGED",
    ],
  );

  const copy = MARQUEE_ITEMS.map((item) => item.text).join(" ");
  assert.doesNotMatch(copy, /discount|off|sale|weekly|collector/i);
});
