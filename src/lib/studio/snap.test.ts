import assert from "node:assert/strict";
import test from "node:test";

import {
  NO_SNAP,
  snapBox,
  snapCandidates,
  snapKey,
  SNAP_TOLERANCE,
  type SnapBox,
} from "./snap.ts";

/** A 1000×800 page, so the two axes can't be confused for each other. */
const PAGE = { width: 1000, height: 800 };

/** The inner box the frame's lip leaves visible, well away from the page edge. */
const SAFE = { x: 40, y: 40, width: 920, height: 720 };

function box(x: number, y: number, width = 200, height = 100): SnapBox {
  return { x, y, width, height };
}

test("a box a hair off the page's centre is pulled onto it", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  // Centre would be x=400, y=350. Three pixels out on both axes.
  const result = snapBox(box(403, 353), candidates, 6);
  assert.equal(result.dx, -3);
  assert.equal(result.dy, -3);
  assert.deepEqual(
    result.lines.map((l) => `${l.axis}:${l.kind}`),
    ["x:page-centre", "y:page-centre"]
  );
});

test("a box outside the tolerance is left exactly where it was", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  const result = snapBox(box(430, 380), candidates, 6);
  assert.equal(result.dx, 0);
  assert.equal(result.dy, 0);
  assert.deepEqual(result.lines, []);
});

test("the centre wins over an edge that is equally close", () => {
  // A 200-wide box at x=500 has its left edge on the page centre (500) and its
  // own centre at 600. Move it so both are 4px from a candidate: the centre
  // candidate must be the one that grabs.
  const candidates = snapCandidates(PAGE, null, [], null);
  // Box centre 504 → page centre 500 is 4 away. Left edge 404 → nothing near.
  const result = snapBox(box(404, 0), candidates, 6);
  assert.equal(result.dx, -4);
  assert.ok(result.lines.some((l) => l.kind === "page-centre"));
});

test("an edge snaps to the page edge when no centre is in reach", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  const result = snapBox(box(4, 3), candidates, 6);
  assert.equal(result.dx, -4);
  assert.equal(result.dy, -3);
  const kinds = result.lines.map((l) => l.kind);
  assert.ok(kinds.includes("page-edge"));
});

test("the safe box is a target, because that is where the moulding stops", () => {
  const candidates = snapCandidates(PAGE, SAFE, [], null);
  // Left edge at 43: the paper's edge (0) is far, the safe edge (40) is 3 away.
  const result = snapBox(box(43, 300), candidates, 6);
  assert.equal(result.dx, -3);
  assert.ok(result.lines.some((l) => l.kind === "safe"));
});

test("a neighbour's edges and centre are targets, and the dragged layer isn't", () => {
  const neighbour = {
    id: "n",
    visible: true,
    x: 100,
    y: 100,
    width: 300,
    height: 200,
  };
  const dragged = { id: "d", visible: true, x: 0, y: 0, width: 50, height: 50 };
  const candidates = snapCandidates(PAGE, null, [neighbour, dragged], "d");

  // The neighbour's left edge is 100. Nothing from the dragged layer should be
  // offered, or a layer would snap to where it already is and never move.
  assert.ok(candidates.x.some((c) => c.position === 100 && c.kind === "layer"));
  assert.ok(!candidates.x.some((c) => c.position === 0 && c.kind === "layer"));
  assert.ok(candidates.x.some((c) => c.position === 250 && c.kind === "layer"));
  assert.ok(candidates.x.some((c) => c.position === 400 && c.kind === "layer"));

  const result = snapBox(box(103, 500, 50, 50), candidates, 6);
  assert.equal(result.dx, -3);
  assert.ok(result.lines.some((l) => l.kind === "layer" && l.position === 100));
});

test("hidden and rotated neighbours are not offered", () => {
  const candidates = snapCandidates(
    PAGE,
    null,
    [
      { id: "hidden", visible: false, x: 111, y: 111, width: 10, height: 10 },
      {
        id: "turned",
        visible: true,
        x: 222,
        y: 222,
        width: 10,
        height: 10,
        rotation: 30,
      },
    ],
    null
  );
  assert.ok(!candidates.x.some((c) => c.position === 111));
  assert.ok(!candidates.x.some((c) => c.position === 222));
});

test("a rotated box is never snapped, because its stored edges are invisible", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  const turned: SnapBox = { ...box(403, 353), rotation: 15 };
  assert.deepEqual(snapBox(turned, candidates, 6), NO_SNAP);
});

test("every reported line really is aligned once the nudge is applied", () => {
  const candidates = snapCandidates(PAGE, SAFE, [], null);
  for (const start of [
    box(402, 351),
    box(2, 2),
    box(41, 39),
    box(797, 697),
    box(500, 400, 1000, 800),
  ]) {
    const { dx, dy, lines } = snapBox(start, candidates, 6);
    const moved = { ...start, x: start.x + dx, y: start.y + dy };
    for (const line of lines) {
      const positions =
        line.axis === "x"
          ? [moved.x, moved.x + moved.width / 2, moved.x + moved.width]
          : [moved.y, moved.y + moved.height / 2, moved.y + moved.height];
      assert.ok(
        positions.some((p) => Math.abs(p - line.position) < 0.01),
        `${line.axis} line at ${line.position} is not touched by the box`
      );
    }
  }
});

test("a box already flush reports the line and asks for no movement", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  const result = snapBox(box(400, 350), candidates, 6);
  assert.equal(result.dx, 0);
  assert.equal(result.dy, 0);
  assert.equal(result.lines.length, 2);
});

test("a coincident guide is reported once, so two lines don't stack up", () => {
  // A layer edge sitting exactly on the page centre must not produce two
  // identical overlay lines.
  // The neighbour's centre is 500, which is also the page's centre; its own
  // edges (460, 540) are nowhere near the dragged box's (400, 500, 600).
  const candidates = snapCandidates(
    PAGE,
    null,
    [{ id: "n", visible: true, x: 460, y: 700, width: 80, height: 10 }],
    null
  );
  const result = snapBox(box(400, 350), candidates, 6);
  const xs = result.lines.filter((l) => l.axis === "x");
  assert.equal(xs.length, 1);
  // Priority order decides which kind is named for the shared position.
  assert.equal(xs[0].kind, "page-centre");
});

test("tolerance scales, so the pull is the same size at every zoom", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  // Zoomed out to 0.25, six screen pixels is 24 document pixels.
  const far = snapBox(box(420, 350), candidates, SNAP_TOLERANCE / 0.25);
  assert.equal(far.dx, -20);
  // At 1:1 the same box is out of reach.
  assert.equal(snapBox(box(420, 350), candidates, SNAP_TOLERANCE).dx, 0);
});

test("snapKey changes with the lines and not with anything else", () => {
  const candidates = snapCandidates(PAGE, null, [], null);
  const a = snapBox(box(400, 350), candidates, 6);
  const b = snapBox(box(401, 351), candidates, 6);
  assert.equal(snapKey(a.lines), snapKey(b.lines));
  assert.notEqual(snapKey(a.lines), snapKey(snapBox(box(2, 2), candidates, 6).lines));
  assert.equal(snapKey([]), "");
});
