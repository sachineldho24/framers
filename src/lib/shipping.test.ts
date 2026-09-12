import { test } from "node:test";
import assert from "node:assert/strict";
import { shippingError, OUTSIDE_INDIA_MESSAGE } from "./shipping";
import { verifyIndianPincode } from "./shipping-server";

test("shipping rejects foreign or omitted countries and foreign states", () => {
  for (const country of ["US", "AE", "GB", "OTHER", undefined]) {
    assert.equal(shippingError({ country, state: "Kerala", pincode: "682001" }), OUTSIDE_INDIA_MESSAGE);
  }
  assert(shippingError({ country: "IN", state: "Dubai", pincode: "682001" }));
  assert.equal(shippingError({ country: "IN", state: "Kerala", pincode: "682001" }), null);
});
test("shipping rejects invalid PIN formats", () => {
  for (const pincode of ["000000", "SW1A 1AA", "10001", "6820010", null]) {
    assert(shippingError({ country: "IN", state: "Kerala", pincode }));
  }
});
const lookup = (offices: unknown[]) => async () => new Response(JSON.stringify([{ Status: "Success", PostOffice: offices }]));
const office = { Country: "India", State: "Kerala", Pincode: "682001" };
test("PIN lookup must match India, PIN and selected state", async () => {
  assert.equal(await verifyIndianPincode("682001", "Kerala", lookup([office])), null);
  assert(await verifyIndianPincode("682001", "Tamil Nadu", lookup([office])));
  assert(await verifyIndianPincode("682001", "Kerala", lookup([{ ...office, Country: "Singapore" }])));
  assert(await verifyIndianPincode("682001", "Kerala", lookup([{ ...office, Pincode: "682002" }])));
  assert(await verifyIndianPincode("999999", "Kerala", lookup([])));
});
test("lookup failure cannot approve shipping", async () => {
  await assert.rejects(verifyIndianPincode("682001", "Kerala", async () => new Response("Unavailable", { status: 503 })));
  await assert.rejects(verifyIndianPincode("682001", "Kerala", async () => { throw Error("Offline"); }));
});
