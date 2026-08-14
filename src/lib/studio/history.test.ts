import assert from "node:assert/strict";
import test from "node:test";

import { createDocument } from "./document.ts";
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  endGesture,
  HISTORY_LIMIT,
  redo,
  reset,
  undo,
} from "./history.ts";
import type { StudioDocument } from "./document.ts";

function makeDoc(width: number): StudioDocument {
  return createDocument({ width, height: 100, title: `w${width}` });
}

test("commit records past states and undo/redo round-trips", () => {
  const h = createHistory(makeDoc(1));
  const after = commit(h, { type: "setTitle", title: "two" });
  assert.equal(canUndo(after), true);
  assert.equal(canRedo(after), false);

  const back = undo(after);
  assert.equal(back.present.title, "w1");
  assert.equal(canRedo(back), true);

  const forward = redo(back);
  assert.equal(forward.present.title, "two");
  assert.equal(canUndo(forward), true);
  assert.equal(canRedo(forward), false);
});

test("a transient drag collapses into exactly one undo step", () => {
  const h = createHistory(makeDoc(100));
  const id = "x";
  const move = (x: number) => ({
    type: "setLayerBox" as const,
    layerId: id,
    box: { x },
  });

  let state = commit(h, move(10), { transient: true, label: "drag" });
  for (const x of [11, 12, 13, 14]) {
    state = commit(state, move(x), { transient: true, label: "drag" });
  }
  state = endGesture(state);

  // One undo lands on the pre-drag document.
  const back = undo(state);
  assert.equal(back.present.width, 100);
  // And its past is empty — the drag was a single entry.
  assert.equal(back.past.length, 0);
});

test("two different gestures produce two undo steps", () => {
  let state = createHistory(makeDoc(100));
  state = commit(state, { type: "setTitle", title: "one" });
  state = commit(state, { type: "setTitle", title: "two" });
  state = commit(state, { type: "setTitle", title: "three" });
  state = undo(state);
  assert.equal(state.present.title, "two");
  state = undo(state);
  assert.equal(state.present.title, "one");
  state = undo(state);
  assert.equal(state.present.title, "w100");
  assert.equal(canUndo(state), false);
  assert.equal(canRedo(state), true);
});

test("a transient action on a non-gesture document opens a gesture", () => {
  const h = createHistory(makeDoc(1));
  const after = commit(h, { type: "setTitle", title: "x" }, { transient: true, label: "d" });
  // It committed normally...
  assert.equal(after.present.title, "x");
  assert.equal(after.past.length, 1);
  // ...and the next identical-label commit stays within the same entry.
  const again = commit(
    after,
    { type: "setTitle", title: "y" },
    { transient: true, label: "d" }
  );
  assert.equal(again.past.length, 1);
  assert.equal(again.present.title, "y");
});

test("an action that changes nothing does not push history", () => {
  const h = createHistory(makeDoc(1));
  const after = commit(h, { type: "setTitle", title: "w1" });
  assert.equal(after, h);
  assert.equal(canUndo(after), false);
});

test("no-op commits keep an open gesture open", () => {
  let state = createHistory(makeDoc(100));
  state = commit(state, { type: "setTitle", title: "a" });
  // A drag with a move that lands on the same pixel must not close the gesture.
  state = commit(state, { type: "setTitle", title: "b" }, { transient: true, label: "g" });
  state = commit(state, { type: "setTitle", title: "b" }, { transient: true, label: "g" });
  assert.equal(state.pendingLabel, "g");
  state = endGesture(state);
  assert.equal(state.pendingLabel, null);
  const back = undo(state);
  assert.equal(back.present.title, "a");
});

test("history is capped at HISTORY_LIMIT", () => {
  const overflow = 10;
  let state = createHistory(makeDoc(0));
  for (let i = 1; i <= HISTORY_LIMIT + overflow; i += 1) {
    state = commit(state, { type: "setTitle", title: `t${i}` });
  }
  assert.equal(state.past.length, HISTORY_LIMIT);
  // Unwinding stops at the cap, and the states past it are gone for good.
  let depth = 0;
  while (canUndo(state)) {
    state = undo(state);
    depth += 1;
  }
  assert.equal(depth, HISTORY_LIMIT);
  assert.equal(state.present.title, `t${overflow}`);
});

test("undo after a new commit discards the stale future", () => {
  let state = createHistory(makeDoc(1));
  state = commit(state, { type: "setTitle", title: "a" });
  state = commit(state, { type: "setTitle", title: "b" });
  state = undo(state);
  assert.equal(canRedo(state), true);
  state = commit(state, { type: "setTitle", title: "c" });
  assert.equal(canRedo(state), false);
  const back = undo(state);
  assert.equal(back.present.title, "a");
});

test("reset clears history for a wholesale load", () => {
  const newDoc = makeDoc(2);
  const fresh = reset(newDoc);
  assert.equal(fresh.present, newDoc);
  assert.equal(canUndo(fresh), false);
  assert.equal(canRedo(fresh), false);
});

test("undo and redo are no-ops at the boundaries", () => {
  const h = createHistory(makeDoc(1));
  assert.equal(undo(h), h);
  assert.equal(redo(h), h);
});
