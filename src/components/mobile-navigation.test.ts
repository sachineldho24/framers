import assert from "node:assert/strict";
import test from "node:test";

import {
  DRAWER_ACCOUNT_LINKS,
  DRAWER_DISCOVER_LINKS,
  PROFILE_MENU_LINKS,
  drawerFocusWrapTarget,
} from "./mobile-navigation.ts";

test("drawer navigation groups approved destinations for mobile scanning", () => {
  assert.deepEqual(
    DRAWER_DISCOVER_LINKS.map((item) => item.href),
    [
      "/design/start",
      "/#shop",
      "/gallery",
      "/works",
    ]
  );
  assert.deepEqual(
    DRAWER_ACCOUNT_LINKS.map((item) => item.href),
    ["/orders", "/account"]
  );

  const links = [...DRAWER_DISCOVER_LINKS, ...DRAWER_ACCOUNT_LINKS];
  assert.equal(
    new Set(links.map((item) => item.href)).size,
    links.length
  );
});

test("drawerFocusWrapTarget loops focus at both dialog boundaries", () => {
  assert.equal(drawerFocusWrapTarget(true, 0, 6), 6);
  assert.equal(drawerFocusWrapTarget(false, 6, 6), 0);
  assert.equal(drawerFocusWrapTarget(false, 3, 6), null);
});

test("the profile menu offers the signed-in destinations, not sign-in", () => {
  assert.deepEqual(
    PROFILE_MENU_LINKS.map((item) => item.href),
    ["/orders", "/account"]
  );
  for (const item of PROFILE_MENU_LINKS) {
    assert.ok(item.label.length > 0);
    assert.ok(item.icon.length > 0);
    assert.doesNotMatch(item.href, /^\/login/);
  }
});
