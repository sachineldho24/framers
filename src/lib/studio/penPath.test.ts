import assert from "node:assert/strict";
import test from "node:test";

import { createDocument, createImageLayer, migrateDocument, type ImageLayer, type PathLayer, type StudioDocument } from "./document.ts";
import {
  bendSegment,
  createPathLayer,
  curveBounds,
  docNodes,
  fitPath,
  insertNode,
  localNodes,
  maskFromPath,
  moveHandle,
  nearestSegment,
  pathCommands,
  snap45,
  toggleSmooth,
} from "./penPath.ts";
import { studioReducer } from "./reducer.ts";
import { parseSvgPath } from "./svgPath.ts";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const style = { stroke: "#ffffff", strokeWidth: 10 };

test("straight segments are lines; a handle makes a cubic; closing adds the last segment", () => {
  const cmds = pathCommands(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0, out: [15, 5] },
      { x: 10, y: 10 },
    ],
    true
  );
  assert.deepEqual(cmds.map((c) => c.c), ["M", "L", "C", "L", "Z"]);
  assert.deepEqual(cmds[2], { c: "C", x1: 15, y1: 5, x2: 10, y2: 10, x: 10, y: 10 });
});

test("a new path is boxed around its ink and its anchors round-trip to the page", () => {
  const layer = createPathLayer({
    nodes: [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ],
    closed: false,
    style,
  });
  // Padded by half the 10px stroke on every side.
  assert.deepEqual([layer.x, layer.y, layer.width, layer.height], [95, 195, 210, 10]);
  const back = docNodes(layer);
  assert.ok(near(back[0].x, 100) && near(back[0].y, 200) && near(back[1].x, 300));
});

test("re-boxing a rotated path keeps every anchor where it was on the page", () => {
  const base = createPathLayer({
    nodes: [
      { x: 0, y: 0 },
      { x: 100, y: 0, out: [150, 50] },
      { x: 100, y: 100 },
    ],
    closed: false,
    style,
  });
  const rotated: PathLayer = { ...base, rotation: 30 };
  const before = docNodes(rotated);
  const refit = { ...rotated, ...fitPath({ ...rotated }, localNodes(rotated), false, rotated.strokeWidth) };
  const after = docNodes(refit);
  before.forEach((n, i) => {
    assert.ok(near(n.x, after[i].x, 1e-6) && near(n.y, after[i].y, 1e-6));
  });
});

test("bending a straight segment moves its midpoint by exactly the drag", () => {
  const nodes = [
    { x: 0, y: 0 },
    { x: 90, y: 0 },
  ];
  const bent = bendSegment(nodes, 0, 0, 30);
  const [, c] = pathCommands(bent, false);
  assert.equal(c.c, "C");
  if (c.c === "C") {
    const mid = (0 + 3 * c.y1 + 3 * c.y2 + 0) / 8;
    assert.ok(near(mid, 30));
  }
});

test("handles mirror on a smooth anchor unless the link is broken", () => {
  const nodes = [{ x: 0, y: 0, in: [-10, 0] as [number, number], out: [10, 0] as [number, number] }, { x: 50, y: 0 }];
  const mirrored = moveHandle(nodes, 0, "out", { x: 0, y: 20 });
  assert.ok(near(mirrored[0].in![0], 0) && near(mirrored[0].in![1], -10));
  const broken = moveHandle(nodes, 0, "out", { x: 0, y: 20 }, true);
  assert.deepEqual(broken[0].in, [-10, 0]);
});

test("toggleSmooth adds handles along the neighbours and removes them again", () => {
  const nodes = [{ x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 0 }];
  const smooth = toggleSmooth(nodes, 1, false);
  assert.ok(smooth[1].in && smooth[1].out);
  assert.ok(near(smooth[1].in![1], 30) && near(smooth[1].out![1], 30));
  const corner = toggleSmooth(smooth, 1, false);
  assert.equal(corner[1].in, undefined);
});

test("inserting an anchor keeps the curve's shape", () => {
  const nodes = [{ x: 0, y: 0, out: [0, 50] as [number, number] }, { x: 100, y: 0, in: [100, 50] as [number, number] }];
  const { nodes: split, index } = insertNode(nodes, 0, 0.5);
  assert.equal(index, 1);
  assert.equal(split.length, 3);
  const a = curveBounds(nodes, false);
  const b = curveBounds(split, false);
  assert.ok(near(a.maxY, b.maxY, 0.5));
  assert.ok(near(split[1].y, 37.5));
});

test("nearestSegment finds the segment under the pointer", () => {
  const nodes = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  assert.equal(nearestSegment(nodes, false, { x: 50, y: 2 }, 5)?.segment, 0);
  assert.equal(nearestSegment(nodes, false, { x: 98, y: 50 }, 5)?.segment, 1);
  assert.equal(nearestSegment(nodes, false, { x: 50, y: 50 }, 5), null);
});

test("snap45 locks to 45° steps", () => {
  const p = snap45({ x: 0, y: 0 }, { x: 10, y: 1 });
  assert.ok(near(p.y, 0, 1e-9));
});

test("a path becomes a photo mask in the photo's own coordinates", () => {
  const image = createImageLayer({ src: "car.jpg", naturalWidth: 100, naturalHeight: 100, x: 100, y: 100, width: 200, height: 200 });
  const path = createPathLayer({
    nodes: [
      { x: 150, y: 150 },
      { x: 250, y: 150 },
      { x: 200, y: 250 },
    ],
    closed: false,
    style,
  });
  const mask = maskFromPath(path, image);
  assert.equal(mask.kind, "path");
  assert.deepEqual(mask.path?.viewBox, [0, 0, 200, 200]);
  const cmds = parseSvgPath(mask.path!.d)!;
  assert.deepEqual(cmds[0], { c: "M", x: 50, y: 50 });
  // Masks are always closed, even from an open path.
  assert.equal(cmds[cmds.length - 1].c, "Z");
});

function seed(): { doc: StudioDocument; image: ImageLayer; path: PathLayer } {
  const image = createImageLayer({ src: "car.jpg", naturalWidth: 100, naturalHeight: 100, x: 0, y: 0, width: 400, height: 400 });
  const path = createPathLayer({
    nodes: [
      { x: 50, y: 50 },
      { x: 350, y: 50 },
      { x: 200, y: 350 },
    ],
    closed: true,
    style,
  });
  return { doc: { ...createDocument({ width: 400, height: 400 }), layers: [image, path] }, image, path };
}

test("maskWithPath: mask clips the photo and uses the path up", () => {
  const { doc, image, path } = seed();
  const next = studioReducer(doc, { type: "maskWithPath", pathId: path.id, imageId: image.id, mode: "mask" });
  assert.equal(next.layers.length, 1);
  const masked = next.layers[0];
  assert.equal(masked.kind === "image" && masked.mask.kind, "path");
});

test("maskWithPath: cutout puts a masked copy where the path was and keeps the photo", () => {
  const { doc, image, path } = seed();
  const next = studioReducer(doc, { type: "maskWithPath", pathId: path.id, imageId: image.id, mode: "cutout", newId: "img_cut" });
  assert.deepEqual(next.layers.map((l) => l.id), [image.id, "img_cut"]);
  const [orig, cut] = next.layers;
  assert.equal(orig.kind === "image" && orig.mask.kind, "none");
  assert.equal(cut.kind === "image" && cut.mask.kind, "path");
  assert.deepEqual([cut.x, cut.y, cut.width], [image.x, image.y, image.width]);
});

test("setPathStyle adds and removes a glow; re-boxes when the weight changes", () => {
  const { doc, path } = seed();
  let next = studioReducer(doc, { type: "setPathStyle", layerId: path.id, patch: { glow: { color: "#00ffff", size: 40, strength: 80 } } });
  const glowing = next.layers[1] as PathLayer;
  assert.deepEqual(glowing.glow, { color: "#00ffff", size: 40, strength: 80 });
  assert.equal(glowing.width, path.width);
  next = studioReducer(next, { type: "setPathStyle", layerId: path.id, patch: { glow: null, strokeWidth: 30 } });
  const thick = next.layers[1] as PathLayer;
  assert.equal(thick.glow, undefined);
  assert.equal(thick.width, path.width + 20);
});

test("path layers survive a save/load round trip, and junk is dropped", () => {
  const { doc } = seed();
  const withGlow = studioReducer(doc, { type: "setPathStyle", layerId: doc.layers[1].id, patch: { glow: { color: "#ff00ff", size: 20, strength: 50 }, fill: "#000000" } });
  const back = migrateDocument(JSON.parse(JSON.stringify(withGlow)))!;
  assert.deepEqual(back.layers[1], withGlow.layers[1]);
  const junk = migrateDocument({ width: 10, height: 10, layers: [{ kind: "path", nodes: [{ x: 0, y: 0 }] }, { kind: "path", nodes: "nope" }] })!;
  assert.equal(junk.layers.length, 0);
});
