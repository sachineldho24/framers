/**
 * What the Tools palette puts on the page: shapes, lines, sticky notes, tables
 * and signatures — Canva's Tools, built from the studio's ordinary layers so
 * everything stays selectable, editable and printable.
 *
 * Composite elements (a note is a square plus its words; a table is cells plus
 * their words) are inserted as one group, so they select and move as a unit,
 * and double-clicking a part edits just that part.
 */

import type { Layer, ShapeLayer, StudioDocument, TextLayer } from "./document";
import { createId, createShapeLayer, createTextLayer } from "./document";
import { drawLayerFromPoints } from "./drawing";
import { getShape } from "./shapes";

const shortEdge = (doc: StudioDocument) => Math.min(doc.width, doc.height);

/** A catalogue shape, centred, sized to a fifth of the page's short edge. */
export function createShapeAtCentre(doc: StudioDocument, shapeId: string, color?: string): ShapeLayer {
  const def = getShape(shapeId);
  const box = shortEdge(doc) * 0.22;
  // Lines are wide and short; everything else is square.
  const isLine = def?.category === "lines";
  const width = isLine ? box * 1.6 : box;
  const height = isLine ? box * 0.5 : box;
  return createShapeLayer({
    shapeId,
    x: (doc.width - width) / 2,
    y: (doc.height - height) / 2,
    width,
    height,
    color,
    strokeWidth: (def?.strokeRatio ?? 0.014) * box,
  });
}

export const STICKY_COLORS = ["#ffd43b", "#ffb057", "#ff7a8a", "#6cb8ff", "#4ed48a", "#b38cff"] as const;

/** A sticky note: a coloured square with room to write, grouped. */
export function createStickyNote(doc: StudioDocument, color: string): Layer[] {
  const size = shortEdge(doc) * 0.3;
  const x = (doc.width - size) / 2;
  const y = (doc.height - size) / 2;
  const groupId = createId("grp");
  const note = {
    ...createShapeLayer({ shapeId: "square", x, y, width: size, height: size, color, name: "Sticky note" }),
    groupId,
  };
  const pad = size * 0.09;
  const fontSize = Math.round(size * 0.085);
  const text = {
    ...createTextLayer({
      text: "Add a note",
      x: x + pad,
      y: y + pad,
      width: size - pad * 2,
      height: fontSize * 1.25,
      fontSize,
      fontId: "patrick-hand",
      align: "left",
      color: "#1b1b1b",
      name: "Note text",
    }),
    groupId,
  };
  return [note, text];
}

/**
 * A table: `rows` × `cols` outlined cells, each with an (empty) text box to
 * type into. The header row is bold. Grouped, so it moves as one.
 */
export function createTable(doc: StudioDocument, rows: number, cols: number): Layer[] {
  const width = doc.width * 0.7;
  const cellW = width / cols;
  const cellH = Math.min(cellW * 0.45, (doc.height * 0.6) / rows);
  const x0 = (doc.width - width) / 2;
  const y0 = (doc.height - cellH * rows) / 2;
  const line = Math.max(1, shortEdge(doc) * 0.0018);
  const fontSize = Math.round(Math.min(cellH * 0.34, cellW * 0.16));
  const pad = cellW * 0.08;
  const groupId = createId("grp");

  const cells: ShapeLayer[] = [];
  const texts: TextLayer[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + c * cellW;
      const y = y0 + r * cellH;
      cells.push({
        ...createShapeLayer({
          shapeId: "table-cell",
          x,
          y,
          width: cellW,
          height: cellH,
          color: "#9e9e9e",
          strokeWidth: line,
          name: `Cell ${r + 1}.${c + 1}`,
        }),
        groupId,
      });
      texts.push({
        ...createTextLayer({
          text: r === 0 ? `Heading ${c + 1}` : "",
          x: x + pad,
          y: y + (cellH - fontSize * 1.2) / 2,
          width: cellW - pad * 2,
          height: fontSize * 1.2,
          fontSize,
          fontId: "inter",
          fontWeight: r === 0 ? 700 : 400,
          align: "left",
          color: "#1b1b1b",
          name: `Cell ${r + 1}.${c + 1} text`,
        }),
        verticalAlign: "middle",
        groupId,
      });
    }
  }
  // Outlines under the words, so a click on a cell's middle reaches its text.
  return [...cells, ...texts];
}

/**
 * A drawn signature: the pad's strokes (in pad px), scaled to a third of the
 * page's width and set in the lower third, grouped as one signature.
 */
export function createSignature(
  doc: StudioDocument,
  strokes: [number, number][][],
  color: string
): Layer[] {
  const all = strokes.flat();
  if (all.length === 0) return [];
  const minX = Math.min(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const srcW = Math.max(1, maxX - minX);
  const srcH = Math.max(1, maxY - minY);
  const targetW = doc.width * 0.34;
  const scale = Math.min(targetW / srcW, (doc.height * 0.2) / srcH);
  const outW = srcW * scale;
  const outH = srcH * scale;
  const ox = (doc.width - outW) / 2;
  const oy = doc.height * 0.72 - outH / 2;
  const width = Math.max(1.5, shortEdge(doc) * 0.0035);
  const groupId = strokes.length > 1 ? createId("grp") : undefined;
  return strokes
    .filter((s) => s.length > 0)
    .map((stroke) => ({
      ...drawLayerFromPoints({
        points: stroke.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale] as [number, number]),
        color,
        width,
        pen: "pen",
        name: "Signature",
      }),
      ...(groupId ? { groupId } : {}),
    }));
}

/** A typed signature: the name in a signature script. */
export function createTypedSignature(doc: StudioDocument, name: string, fontId: string, color: string): TextLayer {
  const fontSize = Math.round(shortEdge(doc) * 0.075);
  const width = doc.width * 0.5;
  return createTextLayer({
    text: name,
    x: (doc.width - width) / 2,
    y: doc.height * 0.72 - fontSize * 0.6,
    width,
    height: fontSize * 1.3,
    fontSize,
    fontId,
    align: "center",
    color,
    name: "Signature",
  });
}
