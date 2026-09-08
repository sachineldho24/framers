import assert from "node:assert/strict";
import test from "node:test";

import { postAuthDestination, safeNextPath } from "./auth-redirect.ts";

test("safeNextPath keeps same-origin paths and rejects everything else", () => {
  assert.equal(safeNextPath("/design/start?frameId=abc"), "/design/start?frameId=abc");
  assert.equal(safeNextPath("/checkout"), "/checkout");

  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(""), "/");
  assert.equal(safeNextPath("//evil.example/path"), "/");
  assert.equal(safeNextPath("/\\evil.example"), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("javascript:alert(1)"), "/");
});

test("a new account lands on the storefront, not on the account page", () => {
  assert.equal(postAuthDestination("signup", "/account"), "/");
  assert.equal(postAuthDestination("signup", null), "/");
  assert.equal(postAuthDestination("signup", "/login"), "/");
});

test("signing up mid-flow still returns to the flow", () => {
  assert.equal(
    postAuthDestination("signup", "/design/abc/upload"),
    "/design/abc/upload"
  );
  assert.equal(postAuthDestination("signup", "/checkout"), "/checkout");
  assert.equal(postAuthDestination("signup", "/orders"), "/orders");
});

test("signing in honours the account page a returning user asked for", () => {
  assert.equal(postAuthDestination("signin", "/account"), "/account");
  assert.equal(postAuthDestination("signin", "/account?tab=x"), "/account?tab=x");
  assert.equal(postAuthDestination("signin", "/login"), "/");
  assert.equal(postAuthDestination("signin", "//evil.example"), "/");
});
