/**
 * SVG path data → the studio's `ShapeCommand`s.
 *
 * A frame imported from a template (or from a Canva-style design, whose photo
 * slots are arbitrary polygons like the polaroid's tilted quad) carries its clip
 * as an SVG `d` string in its own viewBox. The renderer only knows how to trace
 * `ShapeCommand`s, so this turns the string into those — absolute, and with the
 * shorthand forms (H/V/S/T) expanded — once, and `scaleCommands` maps them into
 * whatever box the layer is drawn at.
 *
 * Arcs (`A`) are deliberately unsupported: no template the studio ships uses
 * them, and a half-right arc is worse than a clear refusal. `parseSvgPath`
 * returns `null` for anything it can't read, and the caller falls back to the
 * plain box.
 */

import type { ShapeCommand } from "./shapes";

export type ViewBox = [number, number, number, number];

/** Longest `d` we'll accept. A frame outline is a few hundred characters. */
export const MAX_PATH_LENGTH = 20_000;

const TOKEN = /([MmLlHhVvCcSsQqTtZzAa])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

export function parseSvgPath(d: string): ShapeCommand[] | null {
  if (typeof d !== "string" || d.length === 0 || d.length > MAX_PATH_LENGTH) return null;

  const tokens: (string | number)[] = [];
  for (const m of d.matchAll(TOKEN)) {
    tokens.push(m[1] ?? Number(m[2]));
  }
  if (tokens.length === 0 || typeof tokens[0] !== "string") return null;

  const out: ShapeCommand[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // Last control point, for the S/T reflections.
  let lastC: [number, number] | null = null;
  let lastQ: [number, number] | null = null;

  const num = (): number | null => {
    const t = tokens[i];
    if (typeof t !== "number" || !Number.isFinite(t)) return null;
    i += 1;
    return t;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === "string") {
      cmd = t;
      i += 1;
    } else if (cmd === "" || cmd === "Z" || cmd === "z") {
      // A number with no command to repeat.
      return null;
    }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;

    switch (cmd.toUpperCase()) {
      case "M": {
        const a = num();
        const b = num();
        if (a === null || b === null) return null;
        x = ox + a;
        y = oy + b;
        startX = x;
        startY = y;
        out.push({ c: "M", x, y });
        // Extra pairs after a moveto are implicit linetos.
        cmd = rel ? "l" : "L";
        lastC = lastQ = null;
        break;
      }
      case "L": {
        const a = num();
        const b = num();
        if (a === null || b === null) return null;
        x = ox + a;
        y = oy + b;
        out.push({ c: "L", x, y });
        lastC = lastQ = null;
        break;
      }
      case "H": {
        const a = num();
        if (a === null) return null;
        x = ox + a;
        out.push({ c: "L", x, y });
        lastC = lastQ = null;
        break;
      }
      case "V": {
        const a = num();
        if (a === null) return null;
        y = oy + a;
        out.push({ c: "L", x, y });
        lastC = lastQ = null;
        break;
      }
      case "C": {
        const v = [num(), num(), num(), num(), num(), num()];
        if (v.some((n) => n === null)) return null;
        const [x1, y1, x2, y2, ex, ey] = v as number[];
        out.push({ c: "C", x1: ox + x1, y1: oy + y1, x2: ox + x2, y2: oy + y2, x: ox + ex, y: oy + ey });
        lastC = [ox + x2, oy + y2];
        lastQ = null;
        x = ox + ex;
        y = oy + ey;
        break;
      }
      case "S": {
        const v = [num(), num(), num(), num()];
        if (v.some((n) => n === null)) return null;
        const [x2, y2, ex, ey] = v as number[];
        const x1 = lastC ? 2 * x - lastC[0] : x;
        const y1 = lastC ? 2 * y - lastC[1] : y;
        out.push({ c: "C", x1, y1, x2: ox + x2, y2: oy + y2, x: ox + ex, y: oy + ey });
        lastC = [ox + x2, oy + y2];
        lastQ = null;
        x = ox + ex;
        y = oy + ey;
        break;
      }
      case "Q": {
        const v = [num(), num(), num(), num()];
        if (v.some((n) => n === null)) return null;
        const [x1, y1, ex, ey] = v as number[];
        out.push({ c: "Q", x1: ox + x1, y1: oy + y1, x: ox + ex, y: oy + ey });
        lastQ = [ox + x1, oy + y1];
        lastC = null;
        x = ox + ex;
        y = oy + ey;
        break;
      }
      case "T": {
        const a = num();
        const b = num();
        if (a === null || b === null) return null;
        const x1: number = lastQ ? 2 * x - lastQ[0] : x;
        const y1: number = lastQ ? 2 * y - lastQ[1] : y;
        x = ox + a;
        y = oy + b;
        out.push({ c: "Q", x1, y1, x, y });
        lastQ = [x1, y1];
        lastC = null;
        break;
      }
      case "Z": {
        out.push({ c: "Z" });
        x = startX;
        y = startY;
        lastC = lastQ = null;
        break;
      }
      default:
        // Arcs, or garbage.
        return null;
    }
  }

  return out.length > 0 && out[0].c === "M" ? out : null;
}

/** Map commands from a viewBox into a `w` × `h` box at the origin. */
export function scaleCommands(
  commands: readonly ShapeCommand[],
  viewBox: ViewBox,
  w: number,
  h: number
): ShapeCommand[] {
  const [vx, vy, vw, vh] = viewBox;
  const sx = vw > 0 ? w / vw : 1;
  const sy = vh > 0 ? h / vh : 1;
  const X = (n: number) => (n - vx) * sx;
  const Y = (n: number) => (n - vy) * sy;
  return commands.map((c) => {
    switch (c.c) {
      case "M":
      case "L":
        return { c: c.c, x: X(c.x), y: Y(c.y) };
      case "Q":
        return { c: "Q", x1: X(c.x1), y1: Y(c.y1), x: X(c.x), y: Y(c.y) };
      case "C":
        return { c: "C", x1: X(c.x1), y1: Y(c.y1), x2: X(c.x2), y2: Y(c.y2), x: X(c.x), y: Y(c.y) };
      default:
        return c;
    }
  });
}

const PARSED = new Map<string, ShapeCommand[] | null>();

/** `parseSvgPath`, memoised — a mask is traced on every frame of a drag. */
export function parseSvgPathCached(d: string): ShapeCommand[] | null {
  const hit = PARSED.get(d);
  if (hit !== undefined) return hit;
  const parsed = parseSvgPath(d);
  if (PARSED.size > 64) PARSED.clear();
  PARSED.set(d, parsed);
  return parsed;
}

/** Short, stable fingerprint of a path, for cache keys. */
export function pathFingerprint(d: string): string {
  let h = 5381;
  for (let k = 0; k < d.length; k += 1) h = ((h << 5) + h + d.charCodeAt(k)) | 0;
  return `${d.length}:${(h >>> 0).toString(36)}`;
}
