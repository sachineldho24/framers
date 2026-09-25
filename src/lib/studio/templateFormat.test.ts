import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocument,
  createImageLayer,
  createTextLayer,
  migrateDocument,
  unfilledSlots,
  type ImageLayer,
  type StudioDocument,
} from "./document.ts";
import { studioReducer } from "./reducer.ts";
import { maskCommands } from "./strokes.ts";
import { parseSvgPath, scaleCommands } from "./svgPath.ts";
import {
  coverCrop,
  fromFramersTemplate,
  toFramersTemplate,
  type FramersTemplate,
} from "./templateFormat.ts";

const images = (doc: StudioDocument) => doc.layers.filter((l): l is ImageLayer => l.kind === "image");

/* ------------------------------------------------------------------ svgPath */

test("parseSvgPath reads absolute and relative commands, expanding H/V/S/T", () => {
  const cmds = parseSvgPath("M10 10 h20 v20 H10 z m5 5 l1 1 C0 0 1 1 2 2 S4 4 5 5 Q6 6 7 7 T9 9");
  assert.ok(cmds);
  assert.deepEqual(cmds[0], { c: "M", x: 10, y: 10 });
  assert.deepEqual(cmds[1], { c: "L", x: 30, y: 10 });
  assert.deepEqual(cmds[2], { c: "L", x: 30, y: 30 });
  assert.deepEqual(cmds[3], { c: "L", x: 10, y: 30 });
  assert.deepEqual(cmds[4], { c: "Z" });
  // After Z the pen is back at the subpath start, so m5 5 lands at 15,15.
  assert.deepEqual(cmds[5], { c: "M", x: 15, y: 15 });
  assert.deepEqual(cmds[6], { c: "L", x: 16, y: 16 });
  // S reflects the previous C's second control point (1,1) about (2,2).
  assert.deepEqual(cmds[8], { c: "C", x1: 3, y1: 3, x2: 4, y2: 4, x: 5, y: 5 });
  // T reflects Q's control (6,6) about (7,7).
  assert.deepEqual(cmds[10], { c: "Q", x1: 8, y1: 8, x: 9, y: 9 });
});

test("parseSvgPath treats extra moveto pairs as linetos and handles packed numbers", () => {
  const cmds = parseSvgPath("M0,0 10-5.5.5.5z");
  assert.deepEqual(cmds, [
    { c: "M", x: 0, y: 0 },
    { c: "L", x: 10, y: -5.5 },
    { c: "L", x: 0.5, y: 0.5 },
    { c: "Z" },
  ]);
});

test("parseSvgPath refuses arcs, garbage and paths that don't start with a moveto", () => {
  assert.equal(parseSvgPath("M0 0 A5 5 0 0 1 10 10"), null);
  assert.equal(parseSvgPath("L10 10"), null);
  assert.equal(parseSvgPath("M0"), null);
  assert.equal(parseSvgPath(""), null);
});

test("scaleCommands maps a viewBox onto the drawn box", () => {
  const cmds = parseSvgPath("M10 20 L110 220")!;
  assert.deepEqual(scaleCommands(cmds, [10, 20, 100, 200], 50, 50), [
    { c: "M", x: 0, y: 0 },
    { c: "L", x: 50, y: 50 },
  ]);
});

/* -------------------------------------------------------------- masks/slots */

test("shape and path masks trace; bad ones fall back to the plain box", () => {
  assert.ok(maskCommands({ kind: "shape", radius: 0, shapeId: "heart" }, 100, 100));
  assert.equal(maskCommands({ kind: "shape", radius: 0, shapeId: "line" }, 100, 100), null);
  const quad = maskCommands({ kind: "path", radius: 0, path: { d: "M0 0 L10 0 L10 10 Z", viewBox: [0, 0, 10, 10] } }, 200, 100);
  assert.deepEqual(quad?.[1], { c: "L", x: 200, y: 0 });

  const doc = migrateDocument({
    width: 100,
    height: 100,
    layers: [
      { kind: "image", src: "a", mask: { kind: "shape", shapeId: "no-such-shape" } },
      { kind: "image", src: "b", mask: { kind: "path", path: { d: "M0 0 A1 1 0 0 0 2 2", viewBox: [0, 0, 1, 1] } } },
      { kind: "image", src: "c", mask: { kind: "shape", shapeId: "star" }, role: "placeholder", sample: true },
    ],
  })!;
  const [a, b, c] = images(doc);
  assert.equal(a.mask.kind, "none");
  assert.equal(b.mask.kind, "none");
  assert.deepEqual(c.mask, { kind: "shape", radius: 0.08, shapeId: "star" });
  assert.equal(c.role, "placeholder");
  assert.equal(c.sample, true);
});

test("a photo slot must be filled, and a locked slot still takes a photo", () => {
  let doc = createDocument({ width: 1000, height: 1000 });
  const slot = { ...createImageLayer({ src: "sample.jpg", naturalWidth: 800, naturalHeight: 600, x: 0, y: 0, width: 400, height: 400 }), locked: true };
  const decor = { ...createImageLayer({ src: "tape.png", naturalWidth: 10, naturalHeight: 10, x: 0, y: 0, width: 10, height: 10 }), locked: true };
  doc = { ...doc, layers: [slot, decor] };

  doc = studioReducer(doc, { type: "setLayerRole", layerId: slot.id, role: "placeholder" });
  assert.deepEqual(unfilledSlots(doc).map((l) => l.id), [slot.id]);

  doc = studioReducer(doc, { type: "replaceLayerImage", layerId: slot.id, src: "mine.jpg", naturalWidth: 1000, naturalHeight: 500 });
  const filled = images(doc)[0];
  assert.equal(filled.src, "mine.jpg");
  assert.equal(filled.sample, undefined);
  assert.equal(filled.role, "placeholder");
  // Cover-cropped to the square box.
  assert.equal(filled.crop.h, 1);
  assert.ok(Math.abs(filled.crop.w - 0.5) < 1e-9);
  assert.equal(unfilledSlots(doc).length, 0);

  // A locked picture that isn't a slot still refuses.
  const before = doc;
  doc = studioReducer(doc, { type: "replaceLayerImage", layerId: decor.id, src: "x.jpg", naturalWidth: 1, naturalHeight: 1 });
  assert.equal(doc, before);

  doc = studioReducer(doc, { type: "setLayerRole", layerId: slot.id, role: "decor" });
  assert.equal(images(doc)[0].role, undefined);
});

test("setMask switches between catalogue frames and clears stale outlines", () => {
  const layer = createImageLayer({ src: "a", naturalWidth: 10, naturalHeight: 10, x: 0, y: 0, width: 10, height: 10 });
  let doc: StudioDocument = { ...createDocument({ width: 10, height: 10 }), layers: [layer] };
  doc = studioReducer(doc, { type: "setMask", layerId: layer.id, mask: { kind: "shape", shapeId: "heart" } });
  assert.deepEqual(images(doc)[0].mask, { kind: "shape", radius: 0.08, shapeId: "heart" });
  doc = studioReducer(doc, { type: "setMask", layerId: layer.id, mask: { kind: "circle" } });
  assert.deepEqual(images(doc)[0].mask, { kind: "circle", radius: 0.08 });
});

/* ------------------------------------------------------------ cover crop */

test("coverCrop fills the box and honours the focal point within the source", () => {
  assert.deepEqual(coverCrop(1, 200, 100), { x: 0.25, y: 0, w: 0.5, h: 1 });
  assert.deepEqual(coverCrop(1, 200, 100, { x: 0, y: 0.5 }), { x: 0, y: 0, w: 0.5, h: 1 });
  assert.deepEqual(coverCrop(1, 200, 100, { x: 0.9, y: 0.5 }), { x: 0.5, y: 0, w: 0.5, h: 1 });
});

/* --------------------------------------------------------------- round trip */

function sampleDoc(): StudioDocument {
  const doc = createDocument({ width: 1080, height: 1080, title: "Polaroid collage", background: "#f4e9dc", printMm: { widthMm: 200, heightMm: 200 } });
  const photo: ImageLayer = {
    ...createImageLayer({ src: "uploads/photo.jpg", naturalWidth: 1600, naturalHeight: 1200, x: 108, y: 108, width: 864, height: 864 }),
    rotation: -3,
    mask: { kind: "shape", radius: 0.08, shapeId: "heart" },
    role: "placeholder",
    sample: true,
    adjust: { brightness: 20, contrast: 0, saturation: -50 },
  };
  const round: ImageLayer = {
    ...createImageLayer({ src: "uploads/photo.jpg", naturalWidth: 1600, naturalHeight: 1200, x: 0, y: 0, width: 200, height: 100 }),
    mask: { kind: "circle", radius: 0.08 },
  };
  const caption = { ...createTextLayer({ text: "Framers\nTest", x: 140, y: 890, width: 520, height: 120, fontSize: 98, fontId: "anton" }), role: "editable" as const, locked: true };
  return { ...doc, layers: [photo, round, caption] };
}

test("export produces a schema-shaped template", () => {
  const { template, warnings } = toFramersTemplate(sampleDoc(), { now: () => new Date("2026-09-23T00:00:00Z") });
  assert.equal(template.schemaVersion, "1.0");
  assert.match(template.id, /^[A-Za-z0-9_-]{4,64}$/);
  assert.deepEqual(template.canvas, { width: 1080, height: 1080, physical: { widthMm: 200, heightMm: 200 } });
  // One image asset shared by both layers, one font.
  assert.deepEqual(Object.keys(template.assets).sort(), ["font_anton", "img_1"]);
  const [frame, circle, text] = template.pages[0].layers;
  assert.equal(frame.type, "frame");
  assert.equal(frame.role, "placeholder");
  assert.equal(frame.transform.rotation, -3);
  assert.equal(circle.type, "frame");
  assert.equal(text.type, "text");
  assert.deepEqual(text.locks, { all: true });
  if (text.type === "text") assert.equal(text.text.paragraphs.length, 2);
  if (frame.type === "frame") assert.deepEqual(frame.fill.filters, { brightness: 0.2, saturation: -0.5 });
  for (const l of template.pages[0].layers) assert.match(l.id, /^[A-Za-z0-9_-]{4,64}$/);
  assert.deepEqual(warnings, []);
});

test("export → import round-trips geometry, frames, roles and text", () => {
  const original = sampleDoc();
  const { template } = toFramersTemplate(original);
  const back = fromFramersTemplate(JSON.parse(JSON.stringify(template)));
  assert.ok(back);
  const { doc } = back;
  assert.equal(doc.width, 1080);
  assert.equal(doc.background, "#f4e9dc");
  assert.deepEqual(doc.printMm, { widthMm: 200, heightMm: 200 });
  assert.equal(doc.layers.length, 3);

  const [photo, circle, caption] = doc.layers;
  assert.equal(photo.kind, "image");
  if (photo.kind === "image") {
    assert.deepEqual(photo.mask, { kind: "shape", radius: 0.08, shapeId: "heart" });
    assert.equal(photo.role, "placeholder");
    assert.equal(photo.sample, true);
    assert.equal(photo.rotation, -3);
    assert.equal(photo.src, "uploads/photo.jpg");
    assert.deepEqual(photo.adjust, { brightness: 20, contrast: 0, saturation: -50 });
  }
  // The circle comes back as the catalogue circle — same outline, same pixels.
  if (circle.kind === "image") assert.equal(circle.mask.kind === "shape" || circle.mask.kind === "path", true);
  assert.equal(caption.kind, "text");
  if (caption.kind === "text") {
    assert.equal(caption.text, "Framers\nTest");
    assert.equal(caption.fontId, "anton");
    assert.equal(caption.locked, true);
    assert.equal(caption.role, "editable");
  }
});

test("import maps a Canva-style polaroid: background, custom quad frame with overlay, grid, group", () => {
  const tpl: FramersTemplate = {
    schemaVersion: "1.0",
    id: "polaroid-1",
    name: "Polaroid",
    canvas: { width: 1080, height: 1080 },
    assets: {
      bg: { kind: "image", version: 1, width: 1621, height: 1080, renditions: { screen: "bg.jpg" } },
      border: { kind: "image", version: 1, width: 257, height: 257, renditions: { print: "border.png" } },
      photo: { kind: "image", version: 1, width: 1000, height: 1000, renditions: { print: "photo.jpg" } },
      serif: { kind: "font", version: 1, family: "Nope Sans" },
    },
    pages: [
      {
        id: "page",
        background: { color: "#ffffff", image: { asset: "bg", fit: "cover" } },
        layers: [
          {
            id: "frame",
            type: "frame",
            role: "placeholder",
            locks: { position: true, size: true, rotation: true },
            transform: { x: 107.6, y: 108, width: 864.4, height: 863.6 },
            mask: { path: { d: "M12.9 13.5 L244.7 13.5 L244.7 240.7 L12.9 240.7 Z", viewBox: [0, 0, 256.32, 256.08] } },
            fill: { asset: "photo", fit: "cover" },
            overlay: { asset: "border", placement: "above" },
          },
          {
            id: "grid",
            type: "grid",
            transform: { x: 0, y: 0, width: 210, height: 100 },
            grid: { areas: [["a", "b"]], columns: ["1fr", "1fr"], rows: ["1fr"], columnGap: 10 },
            cells: { a: { fill: { asset: "photo" }, role: "placeholder" }, b: { fill: { asset: "photo" } } },
          },
          {
            id: "group",
            type: "group",
            transform: { x: 500, y: 500, width: 100, height: 100 },
            children: [
              {
                id: "cap1",
                type: "text",
                transform: { x: 10, y: 20, width: 80, height: 30 },
                text: { paragraphs: [{ runs: [{ text: "Hi" }] }], style: { font: "serif", fontSize: 40, color: "#3c3333" } },
              },
              { id: "art1", type: "shape", transform: { x: 0, y: 0, width: 10, height: 10 }, shape: { kind: "ellipse", fill: "#ff0000" } },
            ],
          },
        ],
      },
    ],
  };

  const result = fromFramersTemplate(tpl);
  assert.ok(result);
  const { doc, warnings } = result;
  const kinds = doc.layers.map((l) => `${l.kind}:${l.name}`);
  // background, photo, overlay (above), 2 grid cells, text, shape
  assert.equal(doc.layers.length, 7, kinds.join(", "));

  const [bg, photo, overlay, cellA, cellB, text, shape] = doc.layers;
  assert.equal(bg.kind === "image" && bg.src, "bg.jpg");
  assert.equal(bg.locked, true);

  assert.equal(photo.kind, "image");
  if (photo.kind === "image") {
    assert.equal(photo.mask.kind, "path");
    assert.equal(photo.sample, true);
    assert.equal(photo.locked, true);
    // Square photo into a near-square box: cover crop is nearly full.
    assert.ok(photo.crop.w > 0.99 && photo.crop.h > 0.99);
  }
  assert.equal(overlay.kind === "image" && overlay.src, "border.png");
  assert.equal(overlay.locked, true);
  assert.ok(photo.groupId && photo.groupId === overlay.groupId);

  // Two 100px cells with a 10px gap.
  assert.deepEqual([cellA.x, cellA.width, cellB.x, cellB.width], [0, 100, 110, 100]);
  assert.equal(cellA.kind === "image" && cellA.sample, true);
  assert.equal(cellB.kind === "image" && cellB.sample, undefined);
  assert.ok(cellA.groupId && cellA.groupId === cellB.groupId);

  // Group children are offset by the group's box.
  assert.deepEqual([text.x, text.y], [510, 520]);
  assert.equal(text.kind === "text" && text.fontId, "anton"); // unknown family → default
  assert.equal(shape.kind === "shape" && shape.shapeId, "circle");
  assert.ok(text.groupId && text.groupId === shape.groupId);

  assert.ok(warnings.some((w) => /font could not be found/.test(w)));
  assert.equal(unfilledSlots(doc).length, 2);
});

test("import rotates group children about the group centre", () => {
  const result = fromFramersTemplate({
    schemaVersion: "1.0",
    id: "rot-group",
    name: "Rot",
    canvas: { width: 100, height: 100 },
    assets: {},
    pages: [
      {
        id: "page",
        background: {},
        layers: [
          {
            id: "grp1",
            type: "group",
            transform: { x: 0, y: 0, width: 100, height: 100, rotation: 90 },
            children: [{ id: "sq1", type: "shape", transform: { x: 0, y: 45, width: 10, height: 10 }, shape: { kind: "rect", fill: "#000000" } }],
          },
        ],
      },
    ],
  });
  const [sq] = result!.doc.layers;
  // Centre (5,50) rotated 90° clockwise about (50,50) → (50,5).
  assert.ok(Math.abs(sq.x + 5 - 50) < 1e-9 && Math.abs(sq.y + 5 - 5) < 1e-9);
  assert.equal(sq.rotation, 90);
});

test("import refuses things that aren't templates", () => {
  assert.equal(fromFramersTemplate(null), null);
  assert.equal(fromFramersTemplate({ schemaVersion: "2.0" }), null);
  assert.equal(fromFramersTemplate({ schemaVersion: "1.0", canvas: { width: 0, height: 1 }, pages: [{}] }), null);
});

test("a duplicate is unlocked, ungrouped and not a required slot, with the id the caller asked for", () => {
  const slot: ImageLayer = {
    ...createImageLayer({ src: "sample.jpg", naturalWidth: 10, naturalHeight: 10, x: 0, y: 0, width: 10, height: 10 }),
    locked: true,
    role: "placeholder",
    sample: true,
    groupId: "grp_1",
  };
  let doc: StudioDocument = { ...createDocument({ width: 100, height: 100 }), layers: [slot] };
  doc = studioReducer(doc, { type: "duplicateLayer", layerId: slot.id, newId: "img_copy" });
  const copy = doc.layers[1];
  assert.equal(copy.id, "img_copy");
  assert.equal(copy.locked, false);
  assert.equal(copy.role, undefined);
  assert.equal(copy.groupId, undefined);
  assert.equal(copy.kind === "image" && copy.sample, undefined);
  // The original is untouched, and the copy can be deleted.
  assert.equal(doc.layers[0].locked, true);
  assert.deepEqual(unfilledSlots(doc).map((l) => l.id), [slot.id]);
  doc = studioReducer(doc, { type: "removeLayer", layerId: "img_copy" });
  assert.equal(doc.layers.length, 1);

  // A clashing newId falls back to a fresh one rather than duplicating an id.
  doc = studioReducer(doc, { type: "duplicateLayer", layerId: slot.id, newId: slot.id });
  assert.notEqual(doc.layers[1].id, slot.id);
});
