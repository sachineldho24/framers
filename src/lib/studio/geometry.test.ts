import assert from "node:assert/strict";
import test from "node:test";

import {
  alignToPage,
  boundingRect,
  containBox,
  coverBox,
  docToLocal,
  docToScreen,
  fitViewport,
  handleCursor,
  handlePoint,
  hitTestBox,
  hitTestTargets,
  localToDoc,
  normaliseAngle,
  oppositeHandle,
  resizeFromHandle,
  rotationFromPointer,
  screenToDoc,
  snapRotation,
  zoomAt,
  type Box,
} from "./geometry.ts";

const box: Box = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };
const rotated: Box = { x: 100, y: 100, width: 200, height: 100, rotation: 90 };

function near(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("localToDoc and docToLocal round-trip through rotation", () => {
  for (const rotation of [0, 37, 90, 180, 271]) {
    const b = { ...box, rotation };
    const point = { x: 150, y: 60 };
    const back = docToLocal(b, localToDoc(b, point));
    near(back.x, point.x, 1e-9);
    near(back.y, point.y, 1e-9);
  }
});

test("hitTestBox respects rotation rather than the axis-aligned bounds", () => {
  // The 200×100 box spans x 100–300, y 100–200 unrotated; turned 90° about its
  // centre (200,150) it spans x 150–250, y 50–250 instead. Each of these points
  // is inside exactly one of those two regions.
  const belowUnrotated = { x: 200, y: 230 };
  assert.equal(hitTestBox(box, belowUnrotated), false);
  assert.equal(hitTestBox(rotated, belowUnrotated), true);

  const rightOfRotated = { x: 280, y: 150 };
  assert.equal(hitTestBox(box, rightOfRotated), true);
  assert.equal(hitTestBox(rotated, rightOfRotated), false);
});

test("handle points sit on the rotated frame, not the screen axes", () => {
  // Rotating 90° about the centre (200,150) sends the local top-left to (250,50).
  const nw = handlePoint(rotated, "nw");
  near(nw.x, 250);
  near(nw.y, 50);
  // ...and the local bottom-right to the opposite diagonal.
  const se = handlePoint(rotated, "se");
  near(se.x, 150);
  near(se.y, 250);
});

test("resizing from a corner keeps the opposite corner pinned", () => {
  for (const handle of ["nw", "ne", "se", "sw"] as const) {
    const anchorBefore = handlePoint(box, oppositeHandle(handle));
    const next = resizeFromHandle(box, handle, { x: 400, y: 400 });
    const anchorAfter = handlePoint(next, oppositeHandle(handle));
    near(anchorAfter.x, anchorBefore.x, 1e-9);
    near(anchorAfter.y, anchorBefore.y, 1e-9);
  }
});

test("resizing a rotated box keeps its anchor pinned too", () => {
  const anchorBefore = handlePoint(rotated, "se");
  const next = resizeFromHandle(rotated, "nw", { x: 40, y: 220 });
  const anchorAfter = handlePoint(next, "se");
  near(anchorAfter.x, anchorBefore.x, 1e-9);
  near(anchorAfter.y, anchorBefore.y, 1e-9);
  assert.equal(next.rotation, 90);
});

test("edge handles move only their own axis", () => {
  const east = resizeFromHandle(box, "e", { x: 500, y: 999 });
  assert.equal(east.height, box.height);
  assert.ok(east.width > box.width);

  const south = resizeFromHandle(box, "s", { x: 999, y: 500 });
  assert.equal(south.width, box.width);
  assert.ok(south.height > box.height);
});

test("aspect lock holds the ratio for corner and edge drags", () => {
  const aspect = box.width / box.height;
  const corner = resizeFromHandle(box, "se", { x: 700, y: 130 }, { aspect });
  near(corner.width / corner.height, aspect, 1e-9);

  // Dragging a vertical edge with a locked aspect must still widen the box.
  const edge = resizeFromHandle(box, "s", { x: 0, y: 400 }, { aspect });
  near(edge.width / edge.height, aspect, 1e-9);
});

test("resize clamps to the minimum size instead of inverting", () => {
  const next = resizeFromHandle(box, "se", { x: 90, y: 90 });
  assert.ok(next.width >= 8);
  assert.ok(next.height >= 8);
});

test("resizing from the centre grows symmetrically", () => {
  const next = resizeFromHandle(box, "se", { x: 350, y: 250 }, { fromCentre: true });
  near(next.width, 300);
  near(next.height, 200);
  // Centre is unmoved.
  near(next.x + next.width / 2, 200);
  near(next.y + next.height / 2, 150);
});

test("rotationFromPointer measures from the top of the box", () => {
  // The angle is measured to the rotate grip, which hangs below the box, so
  // "pointer directly below the centre" means the box is upright: 0°.
  near(normaliseAngle(rotationFromPointer(box, { x: 200, y: 400 })), 0);
  // Dragging the grip above the centre turns the box upside down: 180°.
  near(normaliseAngle(rotationFromPointer(box, { x: 200, y: -100 })), 180);
});

test("snapRotation nudges onto right angles and steps by 15 when forced", () => {
  assert.equal(snapRotation(88, false), 90);
  assert.equal(snapRotation(80, false), 80);
  assert.equal(snapRotation(80, true), 75);
  assert.equal(snapRotation(-2, false), 0);
});

test("handleCursor rotates with the box", () => {
  assert.equal(handleCursor("n", 0), "ns-resize");
  assert.equal(handleCursor("n", 90), "ew-resize");
  assert.equal(handleCursor("e", 90), "ns-resize");
});

test("boundingRect grows to contain a rotated box", () => {
  const bounds = boundingRect({ ...box, rotation: 90 });
  near(bounds.width, 100);
  near(bounds.height, 200);
  near(bounds.x, 150);
  near(bounds.y, 50);
});

test("hitTestTargets prefers the rotate grip, then handles, then the body", () => {
  const rotateGrip = { x: 200, y: 230 };
  assert.equal(hitTestTargets(box, rotateGrip, 10, 30), "rotate");
  assert.equal(hitTestTargets(box, { x: 100, y: 100 }, 10, 30), "nw");
  assert.equal(hitTestTargets(box, { x: 200, y: 150 }, 10, 30), "body");
  assert.equal(hitTestTargets(box, { x: 900, y: 900 }, 10, 30), null);
});

test("fitViewport centres the document inside the padded viewport", () => {
  const vp = fitViewport(1000, 500, 800, 600, 50);
  near(vp.scale, 0.7);
  near(vp.offsetX, (800 - 700) / 2);
  near(vp.offsetY, (600 - 350) / 2);
});

test("docToScreen and screenToDoc are inverses", () => {
  const vp = { scale: 0.42, offsetX: 31, offsetY: -17 };
  const point = { x: 123.5, y: 456.25 };
  const back = screenToDoc(vp, docToScreen(vp, point));
  near(back.x, point.x, 1e-9);
  near(back.y, point.y, 1e-9);
});

test("zoomAt keeps the anchor point fixed on screen", () => {
  const vp = { scale: 1, offsetX: 0, offsetY: 0 };
  const anchor = { x: 300, y: 200 };
  const docBefore = screenToDoc(vp, anchor);
  const zoomed = zoomAt(vp, 2.5, anchor);
  const screenAfter = docToScreen(zoomed, docBefore);
  near(screenAfter.x, anchor.x, 1e-9);
  near(screenAfter.y, anchor.y, 1e-9);
});

test("containBox fits inside and coverBox fills the page", () => {
  const contain = containBox(1000, 1000, 2000, 1000);
  near(contain.width, 1000);
  near(contain.height, 500);
  near(contain.y, 250);

  const cover = coverBox(1000, 1000, 2000, 1000);
  near(cover.height, 1000);
  near(cover.width, 2000);
  near(cover.x, -500);
});

test("alignToPage uses rotated bounds so alignment looks correct", () => {
  const left = alignToPage(box, 1000, 1000, "left");
  near(boundingRect(left).x, 0);

  const right = alignToPage(box, 1000, 1000, "right");
  near(boundingRect(right).x + boundingRect(right).width, 1000);

  const centred = alignToPage({ ...box, rotation: 90 }, 1000, 1000, "centre");
  const bounds = boundingRect(centred);
  near(bounds.x + bounds.width / 2, 500);
});
