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
  /** Which shelf of the Elements panel it sits on. */
  category: ShapeCategoryId;
  mode: ShapeMode;
  /**
   * Default stroke width as a fraction of the box's shorter edge, for `stroke`
   * shapes. A fraction rather than px so a line keeps its weight whether it is
   * dropped on an A5 page or an A3 one.
   */
  strokeRatio?: number;
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

/* -------------------------------------------------------------------------- */
/* The catalogue                                                              */
/* -------------------------------------------------------------------------- */

export type ShapeCategoryId = "basic" | "polygons" | "stars" | "arrows" | "lines";

export const SHAPE_CATEGORIES: readonly {
  id: ShapeCategoryId;
  label: string;
}[] = [
  { id: "basic", label: "Basic" },
  { id: "polygons", label: "Polygons" },
  { id: "stars", label: "Stars" },
  { id: "arrows", label: "Arrows" },
  { id: "lines", label: "Lines" },
];

/** Stroke weight, as a fraction of the box, shared by every line element. */
const LINE_RATIO = 0.014;

/**
 * Several subpaths in one shape. A polyline is a single run, so an arrow with a
 * separate head would come out as one continuous V joined to its own shaft.
 */
function runs(...list: readonly (readonly Pt[])[]) {
  return (w: number, h: number): ShapeCommand[] => {
    const out: ShapeCommand[] = [];
    for (const points of list) {
      points.forEach(([x, y], i) => {
        out.push(
          i === 0
            ? { c: "M", x: x * w, y: y * h }
            : { c: "L", x: x * w, y: y * h }
        );
      });
    }
    return out;
  };
}

/**
 * A heart, as six cubics. Not derived from a builder because no builder makes
 * one: the cusp at the top and the point at the bottom are the shape.
 */
function heartPath(w: number, h: number): ShapeCommand[] {
  const X = (v: number) => v * w;
  const Y = (v: number) => v * h;
  return [
    { c: "M", x: X(0.5), y: Y(0.3) },
    { c: "C", x1: X(0.5), y1: Y(0.16), x2: X(0.4), y2: Y(0.05), x: X(0.28), y: Y(0.05) },
    { c: "C", x1: X(0.12), y1: Y(0.05), x2: X(0.02), y2: Y(0.2), x: X(0.05), y: Y(0.4) },
    { c: "C", x1: X(0.08), y1: Y(0.62), x2: X(0.3), y2: Y(0.82), x: X(0.5), y: Y(0.95) },
    { c: "C", x1: X(0.7), y1: Y(0.82), x2: X(0.92), y2: Y(0.62), x: X(0.95), y: Y(0.4) },
    { c: "C", x1: X(0.98), y1: Y(0.2), x2: X(0.88), y2: Y(0.05), x: X(0.72), y: Y(0.05) },
    { c: "C", x1: X(0.6), y1: Y(0.05), x2: X(0.5), y2: Y(0.16), x: X(0.5), y: Y(0.3) },
    { c: "Z" },
  ];
}

/**
 * Every element the panel can hand out. Ids are stable and stored on the layer,
 * so renaming one orphans saved documents - add, never rename.
 */
export const SHAPE_CATALOG: readonly ShapeDef[] = [
  { id: "square", label: "Square", category: "basic", mode: "fill", path: poly(RECT_PTS) },
  { id: "rounded-square", label: "Rounded square", category: "basic", mode: "fill", path: roundedRect(0.18) },
  {
    id: "circle",
    label: "Circle",
    category: "basic",
    mode: "fill",
    // A circle stretched by its box is an ellipse, so one def covers both.
    path: (w, h) => ellipseCmds(w / 2, h / 2, w / 2, h / 2),
  },
  {
    id: "triangle",
    label: "Triangle",
    category: "basic",
    mode: "fill",
    path: poly([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
  },
  {
    id: "right-triangle",
    label: "Right triangle",
    category: "basic",
    mode: "fill",
    path: poly([
      [0, 0],
      [1, 1],
      [0, 1],
    ]),
  },
  {
    id: "diamond",
    label: "Diamond",
    category: "basic",
    mode: "fill",
    path: poly([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]),
  },
  {
    id: "trapezoid",
    label: "Trapezoid",
    category: "basic",
    mode: "fill",
    path: poly([
      [0.2, 0],
      [0.8, 0],
      [1, 1],
      [0, 1],
    ]),
  },
  {
    id: "parallelogram",
    label: "Parallelogram",
    category: "basic",
    mode: "fill",
    path: poly([
      [0.28, 0],
      [1, 0],
      [0.72, 1],
      [0, 1],
    ]),
  },
  {
    id: "cross",
    label: "Cross",
    category: "basic",
    mode: "fill",
    path: poly([
      [0.35, 0],
      [0.65, 0],
      [0.65, 0.35],
      [1, 0.35],
      [1, 0.65],
      [0.65, 0.65],
      [0.65, 1],
      [0.35, 1],
      [0.35, 0.65],
      [0, 0.65],
      [0, 0.35],
      [0.35, 0.35],
    ]),
  },
  { id: "heart", label: "Heart", category: "basic", mode: "fill", path: heartPath },
  {
    id: "speech",
    label: "Speech bubble",
    category: "basic",
    mode: "fill",
    // Body plus a tail. The tail is wound the same way as the body so the two
    // union under the nonzero fill rule instead of punching a hole.
    path: (w, h) => [
      ...roundedRect(0.14)(w, h * 0.78),
      { c: "M", x: w * 0.26, y: h * 0.78 },
      { c: "L", x: w * 0.46, y: h * 0.78 },
      { c: "L", x: w * 0.2, y: h },
      { c: "Z" },
    ],
  },

  { id: "pentagon", label: "Pentagon", category: "polygons", mode: "fill", path: regularPolygon(5) },
  { id: "hexagon", label: "Hexagon", category: "polygons", mode: "fill", path: regularPolygon(6) },
  { id: "heptagon", label: "Heptagon", category: "polygons", mode: "fill", path: regularPolygon(7) },
  { id: "octagon", label: "Octagon", category: "polygons", mode: "fill", path: regularPolygon(8) },

  { id: "star", label: "Star", category: "stars", mode: "fill", path: star(5, 0.4) },
  { id: "star-6", label: "Six-point star", category: "stars", mode: "fill", path: star(6, 0.55) },
  { id: "sparkle", label: "Sparkle", category: "stars", mode: "fill", path: star(4, 0.22) },
  { id: "burst", label: "Burst", category: "stars", mode: "fill", path: star(12, 0.78) },

  {
    id: "arrow-right",
    label: "Arrow right",
    category: "arrows",
    mode: "fill",
    path: poly([
      [0, 0.3],
      [0.55, 0.3],
      [0.55, 0.06],
      [1, 0.5],
      [0.55, 0.94],
      [0.55, 0.7],
      [0, 0.7],
    ]),
  },
  {
    id: "arrow-left",
    label: "Arrow left",
    category: "arrows",
    mode: "fill",
    path: poly([
      [1, 0.3],
      [1, 0.7],
      [0.45, 0.7],
      [0.45, 0.94],
      [0, 0.5],
      [0.45, 0.06],
      [0.45, 0.3],
    ]),
  },
  {
    id: "arrow-up",
    label: "Arrow up",
    category: "arrows",
    mode: "fill",
    path: poly([
      [0.3, 1],
      [0.3, 0.45],
      [0.06, 0.45],
      [0.5, 0],
      [0.94, 0.45],
      [0.7, 0.45],
      [0.7, 1],
    ]),
  },
  {
    id: "arrow-down",
    label: "Arrow down",
    category: "arrows",
    mode: "fill",
    path: poly([
      [0.3, 0],
      [0.7, 0],
      [0.7, 0.55],
      [0.94, 0.55],
      [0.5, 1],
      [0.06, 0.55],
      [0.3, 0.55],
    ]),
  },
  {
    id: "chevron",
    label: "Chevron",
    category: "arrows",
    mode: "fill",
    path: poly([
      [0, 0],
      [0.42, 0],
      [1, 0.5],
      [0.42, 1],
      [0, 1],
      [0.58, 0.5],
    ]),
  },
  {
    id: "arrow-double",
    label: "Double arrow",
    category: "arrows",
    mode: "fill",
    path: poly([
      [0, 0.5],
      [0.34, 0.06],
      [0.34, 0.34],
      [0.66, 0.34],
      [0.66, 0.06],
      [1, 0.5],
      [0.66, 0.94],
      [0.66, 0.66],
      [0.34, 0.66],
      [0.34, 0.94],
    ]),
  },

  {
    id: "line",
    label: "Line",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: line([
      [0, 0.5],
      [1, 0.5],
    ]),
  },
  {
    id: "line-diagonal",
    label: "Diagonal",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: line([
      [0, 1],
      [1, 0],
    ]),
  },
  {
    id: "line-zigzag",
    label: "Zigzag",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: line([
      [0, 0.6],
      [0.25, 0.1],
      [0.5, 0.6],
      [0.75, 0.1],
      [1, 0.6],
    ]),
  },
  {
    id: "line-wavy",
    label: "Wave",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: (w, h) => [
      { c: "M", x: 0, y: h / 2 },
      { c: "Q", x1: w * 0.25, y1: 0, x: w * 0.5, y: h / 2 },
      { c: "Q", x1: w * 0.75, y1: h, x: w, y: h / 2 },
    ],
  },
  {
    id: "line-elbow",
    label: "Elbow",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: (w, h) => [
      { c: "M", x: 0, y: h * 0.9 },
      { c: "L", x: w * 0.5, y: h * 0.9 },
      { c: "L", x: w * 0.5, y: h * 0.1 },
      { c: "L", x: w, y: h * 0.1 },
    ],
  },
  {
    id: "line-curve",
    label: "Curve",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: (w, h) => [
      { c: "M", x: 0, y: h * 0.9 },
      { c: "Q", x1: w * 0.5, y1: h * 0.02, x: w, y: h * 0.9 },
    ],
  },
  {
    id: "line-dashed",
    label: "Dashed",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "butt",
    dash: [2.5, 2],
    path: line([
      [0, 0.5],
      [1, 0.5],
    ]),
  },
  {
    id: "line-dotted",
    label: "Dotted",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    // A zero-length dash with a round cap *is* a dot; anything longer is a dash.
    dash: [0.01, 2],
    path: line([
      [0, 0.5],
      [1, 0.5],
    ]),
  },
  {
    id: "line-arrow",
    label: "Arrow line",
    category: "lines",
    mode: "stroke",
    strokeRatio: LINE_RATIO,
    lineCap: "round",
    path: runs(
      [
        [0, 0.5],
        [0.82, 0.5],
      ],
      [
        [0.58, 0.24],
        [0.82, 0.5],
        [0.58, 0.76],
      ]
    ),
  },
];

const SHAPES_BY_ID = new Map(SHAPE_CATALOG.map((s) => [s.id, s]));

/** The def behind a stored `shapeId`, or null if the catalogue dropped it. */
/**
 * Building blocks for the Tools palette that are not elements in their own
 * right — never on an Elements shelf, but drawn by the same renderer.
 */
const INTERNAL_SHAPES: readonly ShapeDef[] = [
  {
    // A table cell's outline: a closed rectangle, stroked.
    id: "table-cell",
    label: "Table cell",
    category: "basic",
    mode: "stroke",
    lineCap: "butt",
    path: (w, h) => [
      { c: "M", x: 0, y: 0 },
      { c: "L", x: w, y: 0 },
      { c: "L", x: w, y: h },
      { c: "L", x: 0, y: h },
      { c: "Z" },
    ],
  },
];
const INTERNAL_BY_ID = new Map(INTERNAL_SHAPES.map((s) => [s.id, s]));

export function getShape(id: string): ShapeDef | null {
  return SHAPES_BY_ID.get(id) ?? INTERNAL_BY_ID.get(id) ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The catalogue's commands as an SVG `d`, so a thumbnail is the same geometry
 * the renderer draws rather than a second drawing of it.
 */
export function shapePathD(def: ShapeDef, w: number, h: number): string {
  const parts: string[] = [];
  for (const c of def.path(w, h)) {
    if (c.c === "M") parts.push(`M${round2(c.x)} ${round2(c.y)}`);
    else if (c.c === "L") parts.push(`L${round2(c.x)} ${round2(c.y)}`);
    else if (c.c === "Q")
      parts.push(`Q${round2(c.x1)} ${round2(c.y1)} ${round2(c.x)} ${round2(c.y)}`);
    else if (c.c === "C")
      parts.push(
        `C${round2(c.x1)} ${round2(c.y1)} ${round2(c.x2)} ${round2(c.y2)} ${round2(c.x)} ${round2(c.y)}`
      );
    else parts.push("Z");
  }
  return parts.join(" ");
}
