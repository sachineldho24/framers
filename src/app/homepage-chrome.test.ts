import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const homepage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const topBar = readFileSync(
  new URL("../components/MobileTopBar.tsx", import.meta.url),
  "utf8"
);

test("homepage uses website navigation without the mobile-app bottom bar", () => {
  assert.match(homepage, /MobileTopBar/);
  assert.doesNotMatch(homepage, /BottomNav/);
  assert.doesNotMatch(homepage, /\bpb-20\b/);
  assert.doesNotMatch(homepage, /New Arrivals|getActiveFrames|\bSAMPLES\b/);
  assert.match(homepage, /id="shop"/);
  assert.equal(
    existsSync(new URL("../components/BottomNav.tsx", import.meta.url)),
    false
  );
});

test("homepage hero uses the desktop viewport instead of stacking a fixed-height mobile hero", () => {
  assert.match(homepage, /lg:min-h-\[calc\(100svh-4rem\)\]/);
  assert.match(homepage, /lg:grid-cols-/);
  assert.match(homepage, /lg:text-left/);
  assert.match(homepage, /lg:h-\[min\(72svh,620px\)\]/);
  assert.match(homepage, /max-w-\[1280px\] items-center gap-7 grid-cols-1/);
  assert.match(homepage, /text-\[clamp\(2rem,8vw,3.75rem\)\]/);
  assert.doesNotMatch(homepage, /Custom Framing/);
});

test("nothing rules a line under the storefront header", () => {
  const start = topBar.indexOf("<header");
  const openingTag = topBar.slice(start, topBar.indexOf(">", start) + 1);
  assert.match(openingTag, /^<header className="fixed top-0/);
  assert.doesNotMatch(openingTag, /border-b/);
});

test("the header offers a profile menu rather than a bare account link", () => {
  assert.match(topBar, /PROFILE_MENU_LINKS/);
  assert.match(topBar, /aria-haspopup="menu"/);
  // Signed out, the person icon starts a sign-in; it no longer walks the visitor
  // into /account just to be bounced to /login.
  assert.match(topBar, /href="\/login"/);
});

test("shop-by-category cards get more height on laptop viewports", () => {
  assert.match(homepage, /aspect-\[4\/3\][^"]*lg:aspect-\[6\/5\]/);
});

test("homepage carries a testimonials section", () => {
  assert.match(homepage, /<Testimonials \/>/);
  assert.match(homepage, /from "@\/components\/Testimonials"/);
});
