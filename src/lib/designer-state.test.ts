import assert from "node:assert/strict";
import { test } from "node:test";

import {
  designerStateSnapshot,
  initDesignerState,
  loadDesignerState,
  patchDesignerState,
  subscribeDesignerState,
} from "./designer-state.ts";

/**
 * The designer's sessionStorage layer, exercised against a fake Storage.
 *
 * Two contracts are worth pinning down here, because both failed silently in
 * the browser rather than loudly in a test: `patchDesignerState` has to create
 * the record it is merging into (a session resumed in a fresh tab has none, and
 * returning early there threw away the upload's pixel dimensions), and
 * `designerStateSnapshot` has to return the *same object* until something is
 * actually written, or `useSyncExternalStore` re-renders forever.
 */

class FakeStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
}

const g = globalThis as unknown as { window?: unknown; sessionStorage?: Storage };
g.window = {};
g.sessionStorage = new FakeStorage() as unknown as Storage;

function fresh(): string {
  g.sessionStorage!.clear();
  return `s-${Math.random().toString(36).slice(2)}`;
}

test("a patch with nothing stored creates the record instead of dropping it", () => {
  const id = fresh();
  const state = patchDesignerState(id, { imageWidth: 4000, imageHeight: 3000 });
  assert.equal(state.imageWidth, 4000);
  assert.equal(loadDesignerState(id)?.imageHeight, 3000);
  // The rest of the shape is present, so callers can read it without guards.
  assert.equal(state.designSource, "upload");
  assert.equal(state.cropScale, 1);
});

test("a patch merges, and can never move the record to another session", () => {
  const id = fresh();
  patchDesignerState(id, { frameId: "a4", imageWidth: 900 });
  const after = patchDesignerState(id, { frameId: "a3" });
  assert.equal(after.frameId, "a3");
  assert.equal(after.imageWidth, 900);
  assert.equal(
    patchDesignerState(id, { sessionId: "someone-else" }).sessionId,
    id
  );
});

test("the ephemeral object URL is never written to storage", () => {
  const id = fresh();
  patchDesignerState(id, { previewObjectUrl: "blob:nope", uploadPath: "u/1.jpg" });
  assert.equal(loadDesignerState(id)?.previewObjectUrl, undefined);
  assert.equal(loadDesignerState(id)?.uploadPath, "u/1.jpg");
});

test("init keeps what is already there rather than resetting the flow", () => {
  const id = fresh();
  patchDesignerState(id, { frameId: "a4" });
  assert.equal(initDesignerState(id, "upload", "a3").frameId, "a4");
});

test("the snapshot is identity-stable until something is written", () => {
  const id = fresh();
  patchDesignerState(id, { frameId: "a4" });
  const first = designerStateSnapshot(id);
  assert.equal(designerStateSnapshot(id), first, "re-read handed back a new object");
  patchDesignerState(id, { frameId: "a4" }); // same value, same JSON
  assert.equal(designerStateSnapshot(id), first, "an identical write invalidated it");
  patchDesignerState(id, { frameId: "a3" });
  assert.notEqual(designerStateSnapshot(id), first);
});

test("two sessions do not evict each other's snapshot", () => {
  fresh();
  const a = "session-a";
  const b = "session-b";
  patchDesignerState(a, { frameId: "a4" });
  patchDesignerState(b, { frameId: "a3" });
  const snapA = designerStateSnapshot(a);
  const snapB = designerStateSnapshot(b);
  // Interleaved reads: a single-slot cache would hand back a new object every
  // time here, which is an infinite render loop in `useSyncExternalStore`.
  assert.equal(designerStateSnapshot(a), snapA);
  assert.equal(designerStateSnapshot(b), snapB);
  assert.equal(designerStateSnapshot(a), snapA);
  assert.equal(snapA?.frameId, "a4");
  assert.equal(snapB?.frameId, "a3");
});

test("subscribers hear every write, and nothing after unsubscribing", () => {
  const id = fresh();
  let calls = 0;
  const off = subscribeDesignerState(() => {
    calls += 1;
  });
  patchDesignerState(id, { frameId: "a4" });
  patchDesignerState(id, { finishId: "matte" });
  assert.equal(calls, 2);
  off();
  patchDesignerState(id, { frameId: "a3" });
  assert.equal(calls, 2);
});
