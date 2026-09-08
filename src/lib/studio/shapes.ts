/**
 * Vector shape geometry for the Elements panel.
 *
 * A shape is a *path*, not pixels: a list of commands generated for a given box
 * size. That single representation serves both places a shape has to appear —
 * `render.ts` traces the commands onto the canvas, and the Elements panel turns
 * the same commands into an SVG `d` string for its thumbnails. There is no
 * second drawing path, for the same reason `drawDocument` is the only renderer:
 * a thumbnail that disagrees with the print is a lie in a print product.
 *
 * The commands come out in **absolute px within the box**, not normalised, so a
 * shape can decide for itself which parts scale with the box and which do not.
 * A rounded rectangle wants a corner radius that stays circular when the box is
 * stretched; an ellipse wants exactly the opposite. Only the shape knows.
 *
 * Nothing here touches the document, React or canvas state — it is pure data in,
 * numbers out, which is what makes the whole catalogue unit-testable.
 */

/** A path command. `Q`/`C` control points are absolute, as in SVG. */
export type ShapeCommand =
  | { c: "M"; x: number; y: number }
  | { c: "L"; x: number; y: number }
  | { c: "Q"; x1: number; y1: number; x: number; y: number }
  | { c: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: "Z" };

/**
 * Filled shapes are closed regions; stroked shapes are open runs (lines).
 * The distinction is the shape's, not the layer's: filling a polyline paints a
 * region the user never drew, so the renderer must not guess.
 */
export type ShapeMode = "fill" | "stroke";

export interface ShapeDef {
  id: string;
  label: string;
  mode: ShapeMode;
  /** Dash pattern in multiples of the stroke width. Empty = solid. */
  dash?: readonly number[];
  lineCap?: "butt" | "round";
  /** The path, in px, inside a `w` × `h` box whose origin is its top-left. */
  path: (w: number, h: number) => ShapeCommand[];
}

type Pt = readonly [number, number];

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Rescale a point list so its bounding box spans exactly 0–1 on both axes.
 *
 * Regular polygons and stars are generated on a circle, which leaves a pentagon
 * with dead space under its base. Fitting means the box the user drags is the
 * box the shape actually occupies — otherwise selection handles float away from
 * the artwork and alignment silently lies.
 */
function fit(points: readonly Pt[]): Pt[] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  return points.map(([x, y]) => [(x - minX) / spanX, (y - minY) / spanY] as const);
}

/** Closed polygon from normalised points. */
function poly(points: readonly Pt[], close = true) {
  return (w: number, h: number): ShapeCommand[] => {
    const out: ShapeCommand[] = points.map(([x, y], i) =>
      i === 0
        ? { c: "M", x: x * w, y: y * h }
        : { c: "L", x: x * w, y: y * h }
    );
    if (close) out.push({ c: "Z" });
    return out;
  };
}

/** `sides`-sided regular polygon, fitted to the box. */
function regularPolygon(sides: number, startDeg = -90) {
  const points: Pt[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = ((startDeg + (360 * i) / sides) * Math.PI) / 180;
    points.push([0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle)]);
  }
  return poly(fit(points));
}

/**
 * A star or burst: `points` spikes alternating between the box edge and
 * `inner` × that radius. `inner` near 1 gives a sunburst, near 0.4 a classic star.
 */
function star(points: number, inner: number, startDeg = -90) {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? 0.5 : 0.5 * inner;
    const angle = ((startDeg + (360 * i) / (points * 2)) * Math.PI) / 180;
    out.push([0.5 + radius * Math.cos(angle), 0.5 + radius * Math.sin(angle)]);
  }
  return poly(fit(out));
}

/** Circle-to-bezier constant: the control-point offset that fits an arc to 0.02%. */
const KAPPA = 0.5522847498307936;

/** Four cubics around an ellipse. `reverse` winds it the other way, cutting a hole. */
function ellipseCmds(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  reverse = false
): ShapeCommand[] {
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;
  const sweep: ShapeCommand[] = reverse
    ? [
        { c: "C", x1: cx + rx, y1: cy - oy, x2: cx + ox, y2: cy - ry, x: cx, y: cy - ry },
        { c: "C", x1: cx - ox, y1: cy - ry, x2: cx - rx, y2: cy - oy, x: cx - rx, y: cy },
        { c: "C", x1: cx - rx, y1: cy + oy, x2: cx - ox, y2: cy + ry, x: cx, y: cy + ry },
        { c: "C", x1: cx + ox, y1: cy + ry, x2: cx + rx, y2: cy + oy, x: cx + rx, y: cy },
      ]
    : [
        { c: "C", x1: cx + rx, y1: cy + oy, x2: cx + ox, y2: cy + ry, x: cx, y: cy + ry },
        { c: "C", x1: cx - ox, y1: cy + ry, x2: cx - rx, y2: cy + oy, x: cx - rx, y: cy },
        { c: "C", x1: cx - rx, y1: cy - oy, x2: cx - ox, y2: cy - ry, x: cx, y: cy - ry },
        { c: "C", x1: cx + ox, y1: cy - ry, x2: cx + rx, y2: cy - oy, x: cx + rx, y: cy },
      ];
  return [{ c: "M", x: cx + rx, y: cy }, ...sweep, { c: "Z" }];
}

/**
 * Rectangle with circular corners.
 *
 * `radius` is a fraction of the box's **shorter** edge and the same number of px
 * is used on both axes, so stretching the box keeps the corners round instead of
 * shearing them into quarter-ellipses.
 */
function roundedRect(radius: number) {
  return (w: number, h: number): ShapeCommand[] => {
    const r = Math.min(radius * Math.min(w, h), w / 2, h / 2);
    if (r <= 0) return poly(RECT_PTS)(w, h);
    return [
      { c: "M", x: r, y: 0 },
      { c: "L", x: w - r, y: 0 },
      { c: "Q", x1: w, y1: 0, x: w, y: r },
      { c: "L", x: w, y: h - r },
      { c: "Q", x1: w, y1: h, x: w - r, y: h },
      { c: "L", x: r, y: h },
      { c: "Q", x1: 0, y1: h, x: 0, y: h - r },
      { c: "L", x: 0, y: r },
      { c: "Q", x1: 0, y1: 0, x: r, y: 0 },
      { c: "Z" },
    ];
  };
}

const RECT_PTS: Pt[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** Open polyline from normalised points — a line element, not a region. */
function line(points: readonly Pt[]) {
  return poly(points, false);
}
