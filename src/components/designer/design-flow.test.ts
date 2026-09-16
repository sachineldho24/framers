import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * The flow the buyer walks: upload, size, editor, review. The style step is
 * gone, so these assert the shape of the funnel rather than any one screen -
 * a stray `push("/frame")` would put a dead end back in front of checkout.
 */

const sizeStep = readFileSync(
  new URL("./SizeStep.tsx", import.meta.url),
  "utf8"
);
const chrome = readFileSync(
  new URL("./DesignerChrome.tsx", import.meta.url),
  "utf8"
);
const sessionRoute = readFileSync(
  new URL("../../app/api/design/session/route.ts", import.meta.url),
  "utf8"
);

test("choosing a size goes straight to the editor", () => {
  assert.match(sizeStep, /router\.push\(`\/design\/\$\{sessionId\}\/edit`\)/);
  assert.doesNotMatch(sizeStep, /\/frame`/);
});

test("the frame step is gone, not just unlinked", () => {
  assert.equal(
    existsSync(new URL("./FrameStep.tsx", import.meta.url)),
    false,
    "FrameStep is still on disk"
  );
  assert.equal(
    existsSync(
      new URL("../../app/design/[sessionId]/frame/page.tsx", import.meta.url)
    ),
    false,
    "the /design/[sessionId]/frame page still exists"
  );
});

test("the progress rail counts the four steps that exist", () => {
  assert.match(chrome, /\{ key: "upload"/);
  assert.match(chrome, /\{ key: "size"/);
  assert.match(chrome, /\{ key: "edit"/);
  assert.match(chrome, /\{ key: "review"/);
  assert.doesNotMatch(chrome, /key: "frame"/);
});

test("a session is born with the house moulding and glazing", () => {
  // Nothing asks the buyer for these any more, so the order must still be able
  // to say what to build.
  assert.match(sessionRoute, /getActiveFrameStyles/);
  assert.match(sessionRoute, /getActiveFinishes/);
  assert.match(sessionRoute, /frameStyleId: styles\[0\]\?\.id \?\? null/);
  assert.match(sessionRoute, /finishId: finishes\[0\]\?\.id \?\? null/);
});
