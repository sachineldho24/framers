import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The front door is a redirect, not a page. Asserted against the source because
 * the thing being protected is a decision - an interstitial is easy to
 * reintroduce by accident, and each one costs the buyer a click that buys
 * nothing.
 */

const page = readFileSync(
  new URL("../../app/design/start/page.tsx", import.meta.url),
  "utf8"
);
const starter = readFileSync(
  new URL("./StartDesign.tsx", import.meta.url),
  "utf8"
);
const uploadStep = readFileSync(
  new URL("./UploadStep.tsx", import.meta.url),
  "utf8"
);

test("the designer's front door starts the flow instead of asking a question", () => {
  assert.match(page, /<StartDesign/);
  assert.doesNotMatch(page, /StartChooser/);
  assert.doesNotMatch(page, /How it works/);
});

test("starting a design lands on the upload step with the frame preserved", () => {
  assert.match(starter, /\/api\/design\/session/);
  assert.match(starter, /initDesignerState\(sessionId, "upload", frameId\)/);
  assert.match(starter, /router\.replace\(`\/design\/\$\{sessionId\}\/upload`\)/);
});

test("the go-between cannot be trapped by the back button", () => {
  // `push` here would re-enter this page on Back and mint a second session.
  assert.doesNotMatch(starter, /router\.push\(/);
});

test("the upload step still offers both ways in", () => {
  assert.match(uploadStep, /onDrop/);
  assert.match(uploadStep, /Open Studio/);
});
