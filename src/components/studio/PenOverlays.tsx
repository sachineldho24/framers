"use client";

/**
 * The Pen tool's two canvas overlays.
 *
 * `PenToolOverlay` — drawing a new path, as in Illustrator / Photoshop /
 * Photopea: click to drop a corner anchor, click-and-drag to pull out curve
 * handles, click the first anchor to close, Enter or double-click to finish,
 * Backspace to take the last anchor back, Shift to lock to 45°. Alt is
 * Illustrator's Anchor Point tool: Alt while dragging a new anchor moves only
 * its outgoing handle (a cusp); Alt-drag the last anchor to redirect its
 * outgoing handle; Alt-click it to drop that handle so the next line is
 * straight.
 *
 * `PathEditOverlay` — reshaping an existing path (double-click it, or "Edit
 * points"): drag anchors, drag handles (Alt breaks the pair), drag a segment
 * to bend it, double-click a segment to add an anchor, double-click or
 * Alt-click an anchor to switch corner ⇄ smooth, Alt-drag a corner to pull
 * fresh curve handles out of it, drag a corner's Live Corner dot inward to
 * round it, Delete to remove the selected anchor, Esc / Enter / click away to
 * finish.
 *
 * Both sit over the canvas and take its pointer events while they are up, so
 * the canvas's own select/drag logic never sees a pen click. The wheel is
 * handed back to the canvas so zooming still works mid-path.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { PathLayer, PathNode } from "@/lib/studio/document";
import { docToLocal, docToScreen, localToDoc, screenToDoc, type Box, type Vec, type Viewport } from "@/lib/studio/geometry";
import {
  bendSegment,
  boxOf,
  commandsToD,
  cornerGeometry,
  createPathLayer,
  defaultPathStyle,
  insertNode,
  localNodes,
  mapNode,
  moveAnchor,
  moveHandle,
  nearestSegment,
  pathCommands,
  pullHandles,
  removeNode,
  setCornerRadius,
  snap45,
  toggleSmooth,
  type PathStyle,
} from "@/lib/studio/penPath";
import { useStudio } from "@/lib/studio/StudioContext";

/** Screen px within which a click on the first anchor closes the path. */
const CLOSE_RADIUS = 10;
/** Screen px of drag before a new anchor becomes a curve. */
const DRAG_THRESHOLD = 3;
const ACCENT = "var(--studio-accent, #ccff00)";

/** Keep the wheel zooming the canvas underneath while an overlay is up. */
function forwardWheel(e: React.WheelEvent<HTMLElement | SVGElement>) {
  const canvas = (e.currentTarget as Element).parentElement?.querySelector("canvas");
  canvas?.dispatchEvent(new WheelEvent("wheel", e.nativeEvent));
}

function useToDoc(viewport: Viewport) {
  return useCallback(
    (e: { clientX: number; clientY: number; currentTarget: Element }) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return screenToDoc(viewport, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [viewport]
  );
}

/**
 * The look for the next path: the last path on the page, so a second neon line
 * matches the first; otherwise the default.
 */
function nextPathStyle(layers: readonly { kind: string }[], page: { width: number; height: number }): PathStyle {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const l = layers[i] as PathLayer;
    if (l.kind === "path") {
      return { stroke: l.stroke, strokeWidth: l.strokeWidth, ...(l.glow ? { glow: { ...l.glow } } : {}) };
    }
  }
  return defaultPathStyle(page);
}

/* -------------------------------------------------------------------------- */
/* Drawing a new path                                                          */
/* -------------------------------------------------------------------------- */

export function PenToolOverlay({ viewport }: { viewport: Viewport }) {
  const { doc, apply, select, setTool } = useStudio();
  const [nodes, setNodes] = useState<PathNode[]>([]);
  const [cursor, setCursor] = useState<Vec | null>(null);
  const [dragging, setDragging] = useState(false);
  const nodesRef = useRef<PathNode[]>([]);
  /**
   * The anchor whose handle is being dragged. `redirect` = Alt-drag on the
   * last anchor: only its outgoing handle moves, and a click without a drag
   * removes it.
   */
  const dragRef = useRef<{ index: number; startScreen: Vec; redirect?: boolean; moved?: boolean } | null>(null);
  const toDoc = useToDoc(viewport);
  // Fixed for this path: taken from the page as it was when the tool opened.
  const [style] = useState(() => nextPathStyle(doc.layers, doc));

  const update = useCallback((next: PathNode[]) => {
    nodesRef.current = next;
    setNodes(next);
  }, []);

  /** Commit what's drawn (if it's a path at all) and hand back to Select. */
  const finish = useCallback(
    (closed: boolean) => {
      // A double-click lands two extra clicks on the same spot; drop anchors
      // that sit on top of the one before.
      const eps = 2 / viewport.scale;
      const clean = nodesRef.current.filter(
        (n, i, all) => i === 0 || Math.hypot(n.x - all[i - 1].x, n.y - all[i - 1].y) > eps || n.in || n.out
      );
      nodesRef.current = [];
      setNodes([]);
      if (clean.length >= 2) {
        const layer = createPathLayer({ nodes: clean, closed: closed && clean.length > 2, style });
        apply({ type: "addLayer", layer });
        select(layer.id);
      }
      setTool("select");
    },
    [apply, select, setTool, style, viewport.scale]
  );

  // Leaving the tool some other way (the palette, a shortcut) keeps the path.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);
  useEffect(() => () => {
    if (nodesRef.current.length >= 2) finishRef.current(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const count = nodesRef.current.length;
      if (e.key === "Enter") {
        finish(false);
      } else if (e.key === "Escape") {
        if (count >= 2) finish(false);
        else {
          update([]);
          setTool("select");
        }
      } else if ((e.key === "Backspace" || e.key === "Delete") && count > 0) {
        update(nodesRef.current.slice(0, -1));
      } else {
        return;
      }
      // Ours, not the studio's: Delete must not remove a layer, Esc must not
      // drop the tool before we've committed the path.
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish, setTool, update]);

  const screen = (p: Vec) => docToScreen(viewport, p);
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const nearFirst =
    !!first && !!cursor && nodes.length >= 2 && Math.hypot(screen(first).x - screen(cursor).x, screen(first).y - screen(cursor).y) <= CLOSE_RADIUS;

  const screenNodes = nodes.map((n) =>
    mapNode(n, (x, y) => {
      const s = screen({ x, y });
      return [s.x, s.y];
    })
  );
  const d = commandsToD(pathCommands(screenNodes, false));
  // The segment the next click would add, curved if the last anchor has a handle.
  const preview =
    last && cursor && !dragging
      ? (() => {
          const a = screenNodes[screenNodes.length - 1];
          const c = screen(nearFirst ? first : cursor);
          return a.out ? `M${a.x} ${a.y} Q${a.out[0]} ${a.out[1]} ${c.x} ${c.y}` : `M${a.x} ${a.y} L${c.x} ${c.y}`;
        })()
      : null;
  const width = Math.max(1, style.strokeWidth * viewport.scale);

  return (
    <div
      className="absolute inset-0 z-20 select-none"
      style={{ cursor: nearFirst ? "pointer" : "crosshair", touchAction: "none" }}
      onWheel={forwardWheel}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const current = nodesRef.current;
        // Measured from this click, not the last hover: a tap (or a click with
        // no move before it) must still close the shape.
        const rect = e.currentTarget.getBoundingClientRect();
        const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const firstScreen = current.length >= 2 ? screen(current[0]) : null;
        if (firstScreen && Math.hypot(firstScreen.x - at.x, firstScreen.y - at.y) <= CLOSE_RADIUS) {
          finish(true);
          return;
        }
        let p = toDoc(e);
        const lastIndex = current.length - 1;
        if (e.altKey && lastIndex >= 0) {
          const s = screen(current[lastIndex]);
          if (Math.hypot(s.x - at.x, s.y - at.y) <= CLOSE_RADIUS) {
            dragRef.current = { index: lastIndex, startScreen: { x: e.clientX, y: e.clientY }, redirect: true };
            setDragging(true);
            return;
          }
        }
        if (e.shiftKey && current.length > 0) p = snap45(current[current.length - 1], p);
        update([...current, { x: p.x, y: p.y }]);
        dragRef.current = { index: current.length, startScreen: { x: e.clientX, y: e.clientY } };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        let p = toDoc(e);
        const drag = dragRef.current;
        if (drag) {
          if (!drag.moved && Math.hypot(e.clientX - drag.startScreen.x, e.clientY - drag.startScreen.y) < DRAG_THRESHOLD) return;
          drag.moved = true;
          const anchor = nodesRef.current[drag.index];
          if (e.shiftKey) p = snap45(anchor, p);
          const next = nodesRef.current.slice();
          // Dragging out of a fresh anchor pulls symmetric handles: the out
          // handle follows the pointer, the in handle mirrors it. With Alt (or
          // when redirecting) the in handle stays put — a cusp, as in the
          // video: a curve in, then a sharp turn out.
          const cusp = drag.redirect || e.altKey;
          next[drag.index] = {
            x: anchor.x,
            y: anchor.y,
            out: [p.x, p.y],
            ...(cusp
              ? anchor.in
                ? { in: anchor.in }
                : {}
              : { in: [2 * anchor.x - p.x, 2 * anchor.y - p.y] as [number, number] }),
          };
          update(next);
          return;
        }
        const current = nodesRef.current;
        if (e.shiftKey && current.length > 0) p = snap45(current[current.length - 1], p);
        setCursor(p);
      }}
      onPointerUp={() => {
        const drag = dragRef.current;
        // Alt-click on the last anchor without dragging: drop its outgoing
        // handle, so the next segment leaves it in a straight line.
        if (drag?.redirect && !drag.moved) {
          const next = nodesRef.current.slice();
          const n = { ...next[drag.index] };
          delete n.out;
          next[drag.index] = n;
          update(next);
        }
        dragRef.current = null;
        setDragging(false);
      }}
      onDoubleClick={() => finish(false)}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {nodes.length > 1 && (
          <>
            <path d={d} fill="none" stroke={style.stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
            <path d={d} fill="none" stroke={ACCENT} strokeWidth={1} />
          </>
        )}
        {preview && <path d={preview} fill="none" stroke={ACCENT} strokeWidth={1} strokeDasharray="4 3" />}
        {last && (last.in || last.out) && (() => {
          const a = screen(last);
          return (
            <g>
              {[last.in, last.out].map((h, i) =>
                h ? (
                  <g key={i}>
                    <line x1={a.x} y1={a.y} x2={screen({ x: h[0], y: h[1] }).x} y2={screen({ x: h[0], y: h[1] }).y} stroke={ACCENT} strokeWidth={1} />
                    <circle cx={screen({ x: h[0], y: h[1] }).x} cy={screen({ x: h[0], y: h[1] }).y} r={3.5} fill="#111" stroke={ACCENT} strokeWidth={1.5} />
                  </g>
                ) : null
              )}
            </g>
          );
        })()}
        {nodes.map((n, i) => {
          const s = screen(n);
          const big = i === 0 && nearFirst;
          const r = big ? 6 : 4;
          return (
            <rect
              key={i}
              x={s.x - r}
              y={s.y - r}
              width={r * 2}
              height={r * 2}
              fill={i === nodes.length - 1 ? ACCENT : "#111"}
              stroke={ACCENT}
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      <div data-r="full" className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 bg-black/75 px-3.5 py-1.5 text-center text-[12px] font-medium text-white shadow-lg">
        {nodes.length === 0
          ? "Pen tool — click to place a point, drag to make a curve"
          : nodes.length === 1
            ? "Click for a straight line, drag for a curve · Shift locks 45°"
            : "Click the first point to close · Enter or double-click to finish · Alt-drag the last point to redirect its curve · Backspace undoes a point"}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editing points                                                              */
/* -------------------------------------------------------------------------- */

type EditGesture =
  | { kind: "anchor"; index: number }
  | { kind: "handle"; index: number; which: "in" | "out" }
  | { kind: "bend"; segment: number }
  /** Alt on an anchor: drag pulls new handles, a plain click toggles. */
  | { kind: "convert"; index: number }
  /** A Live Corner dot, dragged along the corner's bisector. */
  | {
      kind: "corner";
      index: number;
      /** Screen px, measured when the drag began. */
      anchor: Vec;
      bisector: [number, number];
      tanHalf: number;
      maxDistance: number;
    };

/** Screen px from a corner to its Live Corner dot at radius 0. */
const CORNER_DOT_OFFSET = 16;

export function PathEditOverlay({ layer, viewport }: { layer: PathLayer; viewport: Viewport }) {
  const { apply, endGesture, setEditingId } = useStudio();
  const [selected, setSelected] = useState<number | null>(null);
  const toDoc = useToDoc(viewport);
  const gestureRef = useRef<{
    g: EditGesture;
    frame: Box;
    start: PathNode[];
    from: Vec;
    moved?: boolean;
  } | null>(null);

  const box = boxOf(layer);
  const local = localNodes(layer);
  const label = `path-edit:${layer.id}`;

  /** Local px → screen px. */
  const toScreen = (x: number, y: number): [number, number] => {
    const s = docToScreen(viewport, localToDoc(box, { x, y }));
    return [s.x, s.y];
  };
  const screenNodes = local.map((n) => mapNode(n, toScreen));

  const commit = (nodes: PathNode[], transient = false) =>
    apply(
      { type: "setPathGeometry", layerId: layer.id, frame: box, nodes },
      transient ? { transient: true, label } : undefined
    );

  const begin = useCallback(
    (e: React.PointerEvent, g: EditGesture) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const svg = (e.currentTarget as Element).closest("svg");
      if (!svg) return;
      svg.setPointerCapture(e.pointerId);
      const frame = boxOf(layer);
      const from = docToLocal(frame, toDoc({ clientX: e.clientX, clientY: e.clientY, currentTarget: svg }));
      gestureRef.current = { g, frame, start: localNodes(layer), from };
    },
    [layer, toDoc]
  );

  const done = useCallback(() => {
    setEditingId(null);
  }, [setEditingId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape" || e.key === "Enter") {
        done();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        if (layer.nodes.length > 2) {
          apply({ type: "setPathGeometry", layerId: layer.id, frame: boxOf(layer), nodes: removeNode(localNodes(layer), selected) });
          setSelected(null);
        }
      } else {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [apply, done, layer, selected]);

  const segmentPaths: { d: string; index: number }[] = [];
  const count = screenNodes.length;
  const segCount = layer.closed && count > 2 ? count : count - 1;
  for (let i = 0; i < segCount; i += 1) {
    const a = screenNodes[i];
    const b = screenNodes[(i + 1) % count];
    segmentPaths.push({ d: commandsToD(pathCommands([a, b], false)), index: i });
  }
  const outline = commandsToD(pathCommands(screenNodes, layer.closed, viewport.scale));

  // A Live Corner dot inside every sharp corner between straight lines, pushed
  // further in as the corner gets rounder.
  const corners =
    screenNodes.length > 60
      ? []
      : screenNodes.flatMap((n, index) => {
          const geo = cornerGeometry(
            screenNodes,
            layer.closed,
            index,
            1,
            Math.max(1e-6, (layer.nodes[index].r ?? 0) * viewport.scale)
          );
          if (!geo) return [];
          const rounded = (layer.nodes[index].r ?? 0) > 0;
          const along = CORNER_DOT_OFFSET + (rounded ? geo.distance : 0);
          return [
            {
              index,
              rounded,
              anchor: { x: n.x, y: n.y },
              bisector: geo.bisector,
              tanHalf: geo.tanHalf,
              maxDistance: geo.maxDistance,
              dot: { x: n.x + geo.bisector[0] * along, y: n.y + geo.bisector[1] * along },
            },
          ];
        });

  return (
    <svg
      className="absolute inset-0 z-20 h-full w-full select-none"
      style={{ touchAction: "none" }}
      onWheel={forwardWheel}
      onPointerDown={(e) => {
        // A click on empty canvas ends point editing.
        if (e.target === e.currentTarget) done();
      }}
      onPointerMove={(e) => {
        const gesture = gestureRef.current;
        if (!gesture) return;
        const p = docToLocal(gesture.frame, toDoc(e));
        const dx = p.x - gesture.from.x;
        const dy = p.y - gesture.from.y;
        const { g, start } = gesture;
        if (!gesture.moved && Math.hypot(dx, dy) * viewport.scale < DRAG_THRESHOLD) return;
        gesture.moved = true;
        let nodes: PathNode[];
        if (g.kind === "corner") {
          // Project the pointer onto the bisector: further in = rounder.
          const s = docToScreen(viewport, toDoc(e));
          const along = (s.x - g.anchor.x) * g.bisector[0] + (s.y - g.anchor.y) * g.bisector[1];
          const distance = Math.max(0, Math.min(g.maxDistance, along - CORNER_DOT_OFFSET));
          nodes = setCornerRadius(start, layer.closed, g.index, (distance * g.tanHalf) / viewport.scale);
        } else {
          nodes =
            g.kind === "anchor"
              ? moveAnchor(start, g.index, dx, dy)
              : g.kind === "handle"
                ? moveHandle(start, g.index, g.which, p, e.altKey)
                : g.kind === "convert"
                  ? pullHandles(start, g.index, p)
                  : bendSegment(start, g.segment, dx, dy);
        }
        apply(
          { type: "setPathGeometry", layerId: layer.id, frame: gesture.frame, nodes },
          { transient: true, label }
        );
      }}
      onPointerUp={() => {
        const gesture = gestureRef.current;
        gestureRef.current = null;
        if (!gesture) return;
        if (gesture.moved) {
          endGesture();
        } else if (gesture.g.kind === "convert") {
          // Alt-click: corner ⇄ smooth.
          commit(toggleSmooth(gesture.start, gesture.g.index, layer.closed));
        }
      }}
    >
      <path d={outline} fill="none" stroke={ACCENT} strokeWidth={1} pointerEvents="none" />

      {/* Fat invisible strokes: grab a segment to bend it. */}
      {segmentPaths.map((s) => (
        <path
          key={s.index}
          d={s.d}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => begin(e, { kind: "bend", segment: s.index })}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const svg = e.currentTarget.closest("svg")!;
            const p = docToLocal(box, toDoc({ clientX: e.clientX, clientY: e.clientY, currentTarget: svg }));
            const hit = nearestSegment(local, layer.closed, p, 30 / viewport.scale);
            if (!hit) return;
            const { nodes, index } = insertNode(local, hit.segment, hit.t);
            commit(nodes);
            setSelected(index);
          }}
        >
          <title>Drag to bend · double-click to add a point</title>
        </path>
      ))}

      <AnchorMarks
        nodes={screenNodes}
        selected={selected}
        onAnchorDown={(e, i) => {
          setSelected(i);
          begin(e, e.altKey ? { kind: "convert", index: i } : { kind: "anchor", index: i });
        }}
        onAnchorToggle={(i) => commit(toggleSmooth(local, i, layer.closed))}
        onHandleDown={(e, i, which) => {
          setSelected(i);
          begin(e, { kind: "handle", index: i, which });
        }}
      />

      {corners.map((c) => (
        <circle
          key={`corner-${c.index}`}
          cx={c.dot.x}
          cy={c.dot.y}
          r={4.5}
          fill={c.rounded ? ACCENT : "#111"}
          stroke={ACCENT}
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onPointerDown={(e) =>
            begin(e, {
              kind: "corner",
              index: c.index,
              anchor: c.anchor,
              bisector: c.bisector,
              tanHalf: c.tanHalf,
              maxDistance: c.maxDistance,
            })
          }
          onDoubleClick={(e) => {
            e.stopPropagation();
            commit(setCornerRadius(local, layer.closed, c.index, 0));
          }}
        >
          <title>Live Corner: drag inward to round this corner · double-click to make it sharp again</title>
        </circle>
      ))}

      <foreignObject x={0} y={0} width="100%" height="48" pointerEvents="none">
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={done}
            data-r="full"
            className="pointer-events-auto bg-black/80 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg hover:bg-black"
          >
            Done editing points
          </button>
        </div>
      </foreignObject>
    </svg>
  );
}

/** Anchors (squares) and their curve handles (circles on stalks), in screen px. */
function AnchorMarks({
  nodes,
  selected,
  onAnchorDown,
  onAnchorToggle,
  onHandleDown,
}: {
  nodes: PathNode[];
  selected: number | null;
  onAnchorDown: (e: React.PointerEvent, index: number) => void;
  onAnchorToggle: (index: number) => void;
  onHandleDown: (e: React.PointerEvent, index: number, which: "in" | "out") => void;
}) {
  return (
    <>
      {nodes.map((n, i) => {
        // Busy paths show handles only where they matter, to stay readable.
        const show = selected === i || nodes.length <= 12;
        return (
          <g key={i}>
            {show &&
              (["in", "out"] as const).map((which) => {
                const h = n[which];
                if (!h) return null;
                return (
                  <g key={which}>
                    <line x1={n.x} y1={n.y} x2={h[0]} y2={h[1]} stroke={ACCENT} strokeWidth={1} pointerEvents="none" />
                    <circle
                      cx={h[0]}
                      cy={h[1]}
                      r={5}
                      fill="#111"
                      stroke={ACCENT}
                      strokeWidth={1.5}
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => onHandleDown(e, i, which)}
                    >
                      <title>Drag to shape the curve · Alt moves this side only</title>
                    </circle>
                  </g>
                );
              })}
            <rect
              x={n.x - 5}
              y={n.y - 5}
              width={10}
              height={10}
              fill={selected === i ? ACCENT : "#111"}
              stroke={ACCENT}
              strokeWidth={1.5}
              style={{ cursor: "move" }}
              onPointerDown={(e) => onAnchorDown(e, i)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onAnchorToggle(i);
              }}
            >
              <title>Drag to move · double-click for corner/curve · Delete removes</title>
            </rect>
          </g>
        );
      })}
    </>
  );
}
