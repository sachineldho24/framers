"use client";

/**
 * The canvas surface.
 *
 * The <canvas> draws artwork only — selection chrome is DOM (see
 * SelectionOverlay), so hover, cursors, tooltips and focus all work natively.
 *
 * Gestures are handled imperatively: a drag mutates a ref and redraws directly,
 * committing to history transiently under one label so the whole drag collapses
 * to a single undo step. React re-renders from the committed document, but the
 * pointer path never waits on one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  docToLocal,
  docToScreen,
  handleAxes,
  HANDLE_HIT_TOLERANCE,
  hitTestTargets,
  resizeFromHandle,
  rotationFromPointer,
  ROTATE_GRIP_OFFSET,
  screenToDoc,
  snapRotation,
  zoomBy,
  type Box,
  type GrabTarget,
  type HandleId,
  type Viewport,
} from "@/lib/studio/geometry";
import {
  cropFromHandle,
  cropFromPan,
  cropWindow,
  hitTestCropHandle,
} from "@/lib/studio/crop";
import { createStroke, extendStroke } from "@/lib/studio/strokes";
import { drawDocument, type ImageMap } from "@/lib/studio/render";
import {
  NO_SNAP,
  snapBox,
  snapCandidates,
  snapKey,
  SNAP_TOLERANCE,
  type SnapCandidates,
  type SnapLine,
} from "@/lib/studio/snap";
import {
  unfilledSlots,
  type CropRect,
  type ImageLayer,
  type Layer,
  type Stroke,
} from "@/lib/studio/document";
import { useStudio } from "@/lib/studio/StudioContext";
import { useStudioFonts } from "@/lib/studio/useStudioFonts";
import { textLayerHeight } from "@/lib/studio/textMeasure";

import { Icon } from "@/components/Icon";
import { CropOverlay } from "./CropOverlay";
import { UPLOAD_DRAG_MIME } from "./panels/UploadsPanel";
import { PrintGuides } from "./PrintGuides";
import { GroupSelectionOverlay, MarqueeOverlay } from "./GroupSelectionOverlay";
import { SelectionOverlay } from "./SelectionOverlay";
import { appendPoint, drawLayerFromPoints, penWidth, strokeHit, type PenKind } from "@/lib/studio/drawing";
import { createId } from "@/lib/studio/document";
import {
  groupOf,
  layersInRect,
  rectFromPoints,
  scaleLayers,
  selectionBounds,
  withGroups,
  type Rect,
} from "@/lib/studio/multiSelect";
import { SnapGuides } from "./SnapGuides";
import { TextEditOverlay } from "./TextEditOverlay";
import { useCompactStudio } from "./useCompactStudio";

type Gesture =
  | { kind: "none" }
  /** A pen stroke being drawn; points in document px. */
  | {
      kind: "pen";
      id: string;
      points: [number, number][];
      color: string;
      width: number;
      pen: PenKind;
    }
  /** Rubbing out drawn strokes. */
  | { kind: "pen-erase" }
  /** Rubber-band selection from an empty spot. */
  | { kind: "marquee"; startDoc: { x: number; y: number }; additive: boolean; base: string[] }
  /** Several layers dragged together. */
  | {
      kind: "move-many";
      starts: { id: string; x: number; y: number }[];
      startDoc: { x: number; y: number };
    }
  /** Several layers scaled together from a corner of their joint bounds. */
  | { kind: "scale-many"; start: Layer[]; bounds: Rect; handle: HandleId }
  | {
      kind: "move";
      layerId: string;
      startBox: Box;
      startDoc: { x: number; y: number };
      /**
       * Computed once, when the drag opens: the neighbours can't move while it
       * is running, and rebuilding the list on every pointermove would be the
       * one avoidable allocation in the hot path.
       */
      candidates: SnapCandidates;
    }
  | {
      kind: "resize";
      layerId: string;
      target: Exclude<GrabTarget, "body" | "rotate">;
      startBox: Box;
      /**
       * Text only. A corner drag scales the type with the box, and the scale has
       * to be measured against the size the drag *started* at — reading the
       * current size each move would compound the ratio.
       */
      startFontSize?: number;
    }
  | { kind: "rotate"; layerId: string; startBox: Box }
  | { kind: "pan"; startX: number; startY: number; startViewport: Viewport }
  /**
   * Two fingers on the surface: zoom about the midpoint, pan with it. Everything
   * is recomputed from `startViewport` and the opening measurements on every
   * move, never accumulated, so a pinch that wanders can't drift the page away
   * from the fingers holding it.
   */
  | {
      kind: "pinch";
      idA: number;
      idB: number;
      startDistance: number;
      startMid: { x: number; y: number };
      startViewport: Viewport;
    }
  | {
      kind: "paint";
      layerId: string;
      stroke: Stroke;
      box: Box;
    }
  // Crop drags carry the layer box (to convert doc → local) and the crop rect
  // as it was when the drag opened, so every move is computed from the start
  // rather than accumulated — no drift over a long drag.
  | {
      kind: "crop-move";
      layerId: string;
      box: Box;
      startCrop: CropRect;
      startLocal: { x: number; y: number };
    }
  | {
      kind: "crop-resize";
      layerId: string;
      box: Box;
      handle: HandleId;
      startCrop: CropRect;
    };

function isImageLayer(layer: Layer | null): layer is ImageLayer {
  return layer?.kind === "image";
}

export function StudioCanvas({
  images,
  onContextMenu,
  onDropUpload,
  onFillSlot,
}: {
  images: ImageMap;
  /** Right-click on the canvas; coordinates are viewport-relative. */
  onContextMenu?: (x: number, y: number, layerId: string | null) => void;
  /**
   * An upload was dragged from the Uploads panel and dropped. `targetId` is the
   * photo under the pointer — Canva's "drop into a frame" — or null for bare
   * page, where the shell adds a new layer at `point` (doc px).
   */
  onDropUpload?: (src: string, point: { x: number; y: number }, targetId: string | null) => void;
  /** The "Add your photo" button on an empty photo slot. */
  onFillSlot?: (layerId: string) => void;
}) {
  const {
    doc,
    docRef,
    selectedId,
    selectedLayer,
    selectedLayers,
    selectMany,
    pen,
    editingId,
    setEditingId,
    tool,
    viewport,
    brush,
    apply,
    endGesture,
    select,
    setViewport,
    fitTo,
    viewportPristineRef,
    guides,
    showGuides,
  } = useStudio();

  // A face landing has to repaint: canvas silently substitutes a fallback for a
  // family it hasn't got, so the first paint of a freshly opened document is in
  // the wrong typeface until this bumps.
  const fontRevision = useStudioFonts(doc);
  const compact = useCompactStudio();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gestureRef = useRef<Gesture>({ kind: "none" });
  const maskCache = useRef<Map<string, HTMLCanvasElement | OffscreenCanvas>>(
    new Map()
  );
  const spaceRef = useRef(false);

  /**
   * Live pointers on the surface, so a second finger can be recognised as a
   * pinch. Keyed by `pointerId`; a mouse only ever puts one entry in here.
   */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());

  /**
   * The guides currently being honoured, mirrored in a ref so the pointer path
   * can skip the `setState` when the set hasn't changed — otherwise a drag along
   * a snapped edge would re-render the overlay on every single move.
   */
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const snapKeyRef = useRef("");
  const showSnapLines = useCallback((lines: SnapLine[]) => {
    const key = snapKey(lines);
    if (key === snapKeyRef.current) return;
    snapKeyRef.current = key;
    setSnapLines(lines);
  }, []);

  // Refs the imperative pointer path reads, so its listeners don't need to be
  // rebound on every state change. Mirrored in an effect rather than during
  // render: pointer events are only dispatched after effects have flushed, so
  // these are always current by the time a gesture reads them.
  const viewportRef = useRef(viewport);
  const toolRef = useRef(tool);
  const brushRef = useRef(brush);
  const selectedIdRef = useRef(selectedId);
  const selectedIdsRef = useRef<string[]>([]);
  const penRef = useRef(pen);
  useEffect(() => {
    penRef.current = pen;
    viewportRef.current = viewport;
    toolRef.current = tool;
    brushRef.current = brush;
    selectedIdRef.current = selectedId;
    selectedIdsRef.current = selectedLayers.map((l) => l.id);
  }, [viewport, tool, brush, selectedId, selectedLayers, pen]);

  /** The rubber band being drawn, in document px — rendered as an overlay. */
  const [marquee, setMarquee] = useState<Rect | null>(null);

  const createCanvas = useMemo(
    () => (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    },
    []
  );

  /**
   * Repaint. Reads the document and viewport React rendered with — not the
   * refs above — so the canvas is a pure function of the committed state and
   * can't lag it by an effect.
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawDocument(ctx, doc, {
      viewport,
      surfaceWidth: cssW,
      surfaceHeight: cssH,
      images,
      createCanvas,
      showTransparencyGrid: true,
      maskCache: maskCache.current,
      // The textarea overlay is showing this layer's words already; drawing them
      // underneath as well would double every glyph.
      skipLayerId: compact ? undefined : editingId ?? undefined,
    });
    // `fontRevision` is not read here — it is a dependency so that a face
    // arriving forces the repaint. The lint rule can only see the read, not the
    // reason, so it has to be told.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, viewport, images, createCanvas, editingId, fontRevision, compact]);

  // Bumped by the ResizeObserver so a container resize redraws (and, the first
  // time it reports a real width, fits) without `draw` having to own the
  // observer and be torn down on every edit.
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => setResizeTick((n) => n + 1));
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // The container size we last reacted to. The page is kept centred against it:
  // the canvas column narrows when a panel opens and widens when it closes, and
  // without this the artwork stays pinned to its old offset and drifts to one
  // side. It also covers a first measurement taken before the chrome settled,
  // which is what left the page sitting left of centre on open.
  const sizeRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;

    const last = sizeRef.current;
    if (last && last.w === w && last.h === h) return;
    sizeRef.current = { w, h };

    // Nothing has been panned or zoomed yet, so fitting is still the right
    // answer — and re-running it corrects the scale as well as the offset.
    if (!last || viewportPristineRef.current || compact) {
      fitTo(w, h);
      return;
    }

    // Mid-edit: keep the zoom and the user's framing, and move the origin by
    // half the change so whatever was centred stays centred.
    setViewport((v) => ({
      ...v,
      offsetX: v.offsetX + (w - last.w) / 2,
      offsetY: v.offsetY + (h - last.h) / 2,
    }));
  }, [resizeTick, fitTo, setViewport, viewportPristineRef, compact]);

  // A *page* resize changes what "fit" means. Unlike a container resize this is
  // always deliberate — the Resize menu or a custom size — so it re-fits even
  // when the viewport isn't pristine: going from A4 to 900 mm at the old zoom
  // leaves the page overflowing the window with nothing to say why.
  const pageKey = `${doc.width}x${doc.height}`;
  const lastPageRef = useRef(pageKey);
  useEffect(() => {
    if (lastPageRef.current === pageKey) return;
    lastPageRef.current = pageKey;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { width: w, height: h } = wrap.getBoundingClientRect();
    if (w > 0 && h > 0) fitTo(w, h);
  }, [pageKey, fitTo]);

  useEffect(() => {
    draw();
  }, [draw, resizeTick]);

  /** Any positioned event → document coordinates. */
  const toDoc = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return screenToDoc(viewportRef.current, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const layerBox = useCallback((layer: Layer): Box => {
    return {
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
    };
  }, []);

  /** Topmost layer under a document point, respecting visibility and z-order. */
  const pickLayer = useCallback(
    (point: { x: number; y: number }): Layer | null => {
      const layers = docRef.current.layers;
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const layer = layers[i];
        if (!layer.visible || layer.opacity <= 0) continue;
        const local = docToLocal(layerBox(layer), point);
        if (
          local.x >= 0 &&
          local.y >= 0 &&
          local.x <= layer.width &&
          local.y <= layer.height
        ) {
          return layer;
        }
      }
      return null;
    },
    [docRef, layerBox]
  );

  /** The photo a dragged upload would land in, for the drop highlight. */
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const dropTargetAt = useCallback(
    (e: { clientX: number; clientY: number }): ImageLayer | null => {
      const hit = pickLayer(toDoc(e));
      if (!hit || hit.kind !== "image") return null;
      // A locked photo only accepts a drop when it is a customer photo slot,
      // matching what the reducer will allow.
      return hit.locked && hit.role !== "placeholder" ? null : hit;
    },
    [pickLayer, toDoc]
  );

  /**
   * Every line this drag may line up with. Built at pointerdown because the
   * neighbours can't move while it runs.
   *
   * The safe box is only offered while it is on screen: snapping to a line the
   * user can't see would read as the canvas glitching.
   */
  const candidatesFor = useCallback(
    (excludeId: string | null): SnapCandidates => {
      const current = docRef.current;
      return snapCandidates(
        { width: current.width, height: current.height },
        showGuides && guides ? guides.safe : null,
        current.layers,
        excludeId
      );
    },
    [docRef, guides, showGuides]
  );

  /** Remove every drawn stroke under the pointer (unlocked ones). */
  const eraseStrokesAt = useCallback(
    (point: { x: number; y: number }) => {
      const tolerance = 6 / viewportRef.current.scale;
      for (const layer of docRef.current.layers) {
        if (layer.kind !== "draw" || layer.locked || !layer.visible) continue;
        if (strokeHit(layer, point, tolerance)) {
          apply({ type: "removeLayer", layerId: layer.id }, { transient: true, label: "pen-erase" });
        }
      }
    },
    [apply, docRef]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button === 2) return; // context menu handles its own
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // A second finger means the user is framing the view, not editing a layer.
      // Close whatever was in progress first so it lands as its own undo step,
      // then take over the viewport for as long as both fingers are down.
      if (pointersRef.current.size === 2) {
        const [[idA, a], [idB, b]] = [...pointersRef.current.entries()];
        if (gestureRef.current.kind !== "none") endGesture();
        showSnapLines([]);
        const rect = canvas.getBoundingClientRect();
        gestureRef.current = {
          kind: "pinch",
          idA,
          idB,
          startDistance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
          // Canvas-relative, because that is the space `zoomBy` anchors in.
          startMid: {
            x: (a.x + b.x) / 2 - rect.left,
            y: (a.y + b.y) / 2 - rect.top,
          },
          startViewport: viewportRef.current,
        };
        return;
      }
      if (pointersRef.current.size > 2) return; // a third finger changes nothing

      // Space-drag and middle-drag pan, whatever the active tool.
      if (spaceRef.current || e.button === 1) {
        gestureRef.current = {
          kind: "pan",
          startX: e.clientX,
          startY: e.clientY,
          startViewport: viewportRef.current,
        };
        return;
      }

      const point = toDoc(e);
      const activeTool = toolRef.current;

      // Draw: every press starts a new stroke — its own layer, like Canva's.
      if (activeTool === "pen") {
        const settings = penRef.current;
        const current = docRef.current;
        const kind = settings.pen;
        const width = penWidth(kind, settings.sizes[kind], Math.min(current.width, current.height));
        const id = createId("drw");
        const points: [number, number][] = [[point.x, point.y]];
        gestureRef.current = { kind: "pen", id, points, color: settings.colors[kind], width, pen: kind };
        apply(
          { type: "addLayer", layer: drawLayerFromPoints({ id, points, color: settings.colors[kind], width, pen: kind }) },
          { transient: true, label: `pen:${id}` }
        );
        return;
      }
      if (activeTool === "pen-eraser") {
        gestureRef.current = { kind: "pen-erase" };
        eraseStrokesAt(point);
        return;
      }
      const current = selectedIdRef.current
        ? (docRef.current.layers.find((l) => l.id === selectedIdRef.current) ??
          null)
        : null;

      // Brush tools paint on the selected layer regardless of what's under the
      // cursor — clicking outside the layer would otherwise deselect mid-stroke.
      if (
        (activeTool === "eraser" || activeTool === "draw") &&
        isImageLayer(current) &&
        !current.locked
      ) {
        const box = layerBox(current);
        const local = docToLocal(box, point);
        const stroke = createStroke(
          activeTool === "draw" ? "restore" : brushRef.current.mode,
          brushRef.current.size,
          brushRef.current.feather,
          { x: local.x / current.width, y: local.y / current.height }
        );
        gestureRef.current = { kind: "paint", layerId: current.id, stroke, box };
        apply(
          { type: "addStroke", layerId: current.id, stroke },
          { transient: true, label: `paint:${stroke.id}` }
        );
        return;
      }

      // Crop works on the selected layer only, and takes over the whole
      // surface: dragging inside the window pans the visible region, dragging a
      // handle resizes it. Neither touches the layer's footprint on the page.
      if (activeTool === "crop" && isImageLayer(current) && !current.locked) {
        const box = layerBox(current);
        const local = docToLocal(box, point);
        const scale = viewportRef.current.scale;
        const handle = hitTestCropHandle(
          cropWindow(current.crop, current.width, current.height),
          local,
          HANDLE_HIT_TOLERANCE / scale
        );
        if (handle) {
          gestureRef.current = {
            kind: "crop-resize",
            layerId: current.id,
            box,
            handle,
            startCrop: { ...current.crop },
          };
          return;
        }
        gestureRef.current = {
          kind: "crop-move",
          layerId: current.id,
          box,
          startCrop: { ...current.crop },
          startLocal: local,
        };
        return;
      }

      const all = docRef.current.layers;
      const selectedIds = selectedIdsRef.current;

      // Several selected and the press lands on one of them: drag them all.
      if (selectedIds.length > 1 && !e.shiftKey) {
        const onMember = pickLayer(point);
        if (onMember && selectedIds.includes(onMember.id)) {
          gestureRef.current = {
            kind: "move-many",
            starts: all
              .filter((l) => selectedIds.includes(l.id) && !l.locked)
              .map((l) => ({ id: l.id, x: l.x, y: l.y })),
            startDoc: point,
          };
          return;
        }
      }

      // A handle hit only counts on the already-selected layer.
      if (current && !current.locked) {
        // Tolerances are screen px; hit-testing happens in doc px.
        const scale = viewportRef.current.scale;
        const target = hitTestTargets(
          layerBox(current),
          point,
          HANDLE_HIT_TOLERANCE / scale,
          ROTATE_GRIP_OFFSET / scale
        );
        if (target === "rotate") {
          gestureRef.current = {
            kind: "rotate",
            layerId: current.id,
            startBox: layerBox(current),
          };
          return;
        }
        if (target && target !== "body") {
          // Text has no top/bottom grips (see SelectionOverlay) — a hit there is
          // a hit on the words, so fall through to select-and-move.
          if (!(current.kind === "text" && (target === "n" || target === "s"))) {
            gestureRef.current = {
              kind: "resize",
              layerId: current.id,
              target,
              startBox: layerBox(current),
              startFontSize:
                current.kind === "text" ? current.fontSize : undefined,
            };
            return;
          }
        }
      }

      const hit = pickLayer(point);
      if (!hit) {
        // An empty spot starts a rubber band. Shift keeps what was selected.
        if (!e.shiftKey) select(null);
        gestureRef.current = {
          kind: "marquee",
          startDoc: point,
          additive: e.shiftKey,
          base: e.shiftKey ? selectedIds : [],
        };
        return;
      }

      // Shift-click adds a layer (or its whole group) to the selection, or
      // takes it out again.
      if (e.shiftKey) {
        const members = groupOf(all, hit).map((l) => l.id);
        const base = selectedIds.length ? selectedIds : selectedIdRef.current ? [selectedIdRef.current] : [];
        const removing = members.every((id) => base.includes(id));
        selectMany(removing ? base.filter((id) => !members.includes(id)) : [...base, ...members]);
        gestureRef.current = { kind: "none" };
        return;
      }

      // A grouped layer selects its whole group, and the drag moves them all.
      if (hit.groupId) {
        const members = groupOf(all, hit);
        selectMany(members.map((l) => l.id));
        gestureRef.current = {
          kind: "move-many",
          starts: members.filter((l) => !l.locked).map((l) => ({ id: l.id, x: l.x, y: l.y })),
          startDoc: point,
        };
        return;
      }

      select(hit.id);
      if (hit.locked) {
        gestureRef.current = { kind: "none" };
        return;
      }
      gestureRef.current = {
        kind: "move",
        layerId: hit.id,
        startBox: layerBox(hit),
        startDoc: point,
        candidates: candidatesFor(hit.id),
      };
    },
    [
      apply,
      candidatesFor,
      docRef,
      endGesture,
      layerBox,
      pickLayer,
      select,
      selectMany,
      showSnapLines,
      toDoc,
      eraseStrokesAt,
    ]
  );

  /** Open a group scale from one of the joint selection's corner handles. */
  const beginGroupScale = useCallback(
    (handle: HandleId, e: React.PointerEvent<Element>) => {
      if (e.button !== 0) return;
      const ids = selectedIdsRef.current;
      const start = docRef.current.layers.filter((l) => ids.includes(l.id));
      const bounds = selectionBounds(start);
      if (!bounds || start.some((l) => l.locked)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      gestureRef.current = { kind: "scale-many", start, bounds, handle };
    },
    [docRef]
  );

  /**
   * Open a resize or rotate from the DOM selection chrome.
   *
   * The handles are real elements — that's what gives them cursors, hover and
   * focus — so their pointerdown lands on the span, never on the canvas beneath,
   * and the canvas's own handle hit-test can't see it. They call this instead,
   * then capture the pointer themselves so the rest of the drag keeps arriving
   * even once it leaves the handle. Everything after the first event is the
   * ordinary gesture path.
   */
  const beginHandleGesture = useCallback(
    (target: Exclude<GrabTarget, "body">, e: React.PointerEvent<Element>) => {
      if (e.button !== 0) return;
      const layer = selectedIdRef.current
        ? (docRef.current.layers.find((l) => l.id === selectedIdRef.current) ??
          null)
        : null;
      if (!layer || layer.locked) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const startBox = layerBox(layer);
      gestureRef.current =
        target === "rotate"
          ? { kind: "rotate", layerId: layer.id, startBox }
          : {
              kind: "resize",
              layerId: layer.id,
              target,
              startBox,
              startFontSize: layer.kind === "text" ? layer.fontSize : undefined,
            };
    },
    [docRef, layerBox]
  );

  /** The same, for the crop window's own handles. */
  const beginCropHandleGesture = useCallback(
    (handle: HandleId, e: React.PointerEvent<Element>) => {
      if (e.button !== 0) return;
      const layer = selectedIdRef.current
        ? (docRef.current.layers.find((l) => l.id === selectedIdRef.current) ??
          null)
        : null;
      if (!isImageLayer(layer) || layer.locked) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      gestureRef.current = {
        kind: "crop-resize",
        layerId: layer.id,
        box: layerBox(layer),
        handle,
        startCrop: { ...layer.crop },
      };
    },
    [docRef, layerBox]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<Element>) => {
      const gesture = gestureRef.current;
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (gesture.kind === "none") return;

      if (gesture.kind === "pinch") {
        const a = pointersRef.current.get(gesture.idA);
        const b = pointersRef.current.get(gesture.idB);
        const canvas = canvasRef.current;
        if (!a || !b || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mid = {
          x: (a.x + b.x) / 2 - rect.left,
          y: (a.y + b.y) / 2 - rect.top,
        };
        const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        // Zoom about where the fingers started, then slide by however far the
        // pair has travelled since — so a two-finger drag pans and a spread
        // zooms, from one gesture, with no mode to switch between.
        const zoomed = zoomBy(
          gesture.startViewport,
          distance / gesture.startDistance,
          gesture.startMid
        );
        setViewport({
          ...zoomed,
          offsetX: zoomed.offsetX + (mid.x - gesture.startMid.x),
          offsetY: zoomed.offsetY + (mid.y - gesture.startMid.y),
        });
        return;
      }

      if (gesture.kind === "pan") {
        setViewport({
          ...gesture.startViewport,
          offsetX: gesture.startViewport.offsetX + (e.clientX - gesture.startX),
          offsetY: gesture.startViewport.offsetY + (e.clientY - gesture.startY),
        });
        return;
      }

      const point = toDoc(e);

      if (gesture.kind === "marquee") {
        setMarquee(rectFromPoints(gesture.startDoc, point));
        return;
      }

      if (gesture.kind === "pen") {
        // One sample per screen pixel or so: enough for a smooth line.
        const next = appendPoint(gesture.points, [point.x, point.y], 1.5 / viewportRef.current.scale);
        if (next === gesture.points) return;
        const points = next as [number, number][];
        gestureRef.current = { ...gesture, points };
        apply(
          {
            type: "replaceLayer",
            layer: drawLayerFromPoints({ id: gesture.id, points, color: gesture.color, width: gesture.width, pen: gesture.pen }),
          },
          { transient: true, label: `pen:${gesture.id}` }
        );
        return;
      }

      if (gesture.kind === "pen-erase") {
        eraseStrokesAt(point);
        return;
      }

      if (gesture.kind === "move-many") {
        const dx = Math.round(point.x - gesture.startDoc.x);
        const dy = Math.round(point.y - gesture.startDoc.y);
        for (const start of gesture.starts) {
          apply(
            { type: "setLayerBox", layerId: start.id, box: { x: start.x + dx, y: start.y + dy } },
            { transient: true, label: "move-many" }
          );
        }
        return;
      }

      if (gesture.kind === "scale-many") {
        for (const patch of scaleLayers(gesture.start, gesture.bounds, gesture.handle, point)) {
          apply(
            { type: "setLayerBox", layerId: patch.id, box: patch.box, fontSize: patch.fontSize },
            { transient: true, label: "scale-many" }
          );
        }
        return;
      }

      if (gesture.kind === "move") {
        // Rounded so a slow drag emits one action per document pixel, not per
        // sub-pixel move; the reducer then no-ops and React skips the render.
        const dx = Math.round(point.x - gesture.startDoc.x);
        const dy = Math.round(point.y - gesture.startDoc.y);
        const dragged = {
          ...gesture.startBox,
          x: gesture.startBox.x + dx,
          y: gesture.startBox.y + dy,
        };
        // Alt is the escape hatch, matching its meaning elsewhere in the app
        // (resize-from-centre): "do exactly what I say". Ctrl/⌘ is taken by
        // wheel-zoom and shift by the aspect locks.
        const snap = e.altKey
          ? NO_SNAP
          : snapBox(
              dragged,
              gesture.candidates,
              SNAP_TOLERANCE / viewportRef.current.scale
            );
        showSnapLines(snap.lines);
        apply(
          {
            type: "setLayerBox",
            layerId: gesture.layerId,
            // The nudge is added *after* the rounding, not rounded with it: the
            // whole promise of a snap is that the edge sits exactly on the
            // guide being drawn, and half a pixel out is visible at 800%.
            box: { x: dragged.x + snap.dx, y: dragged.y + snap.dy },
          },
          { transient: true, label: `move:${gesture.layerId}` }
        );
        return;
      }

      if (gesture.kind === "resize") {
        const layer =
          docRef.current.layers.find((l) => l.id === gesture.layerId) ?? null;
        const text = layer?.kind === "text" ? layer : null;
        const axes = handleAxes(gesture.target);
        const isCorner = axes.sx !== 0 && axes.sy !== 0;
        const ratio = gesture.startBox.width / gesture.startBox.height;
        const next = resizeFromHandle(gesture.startBox, gesture.target, point, {
          // Corner drags preserve the aspect ratio — the usual intent for a
          // photo. Edge drags stretch one axis. Shift inverts either.
          //
          // Not for text, where the two axes mean different things: a corner
          // scales the type (so the ratio must hold, shift or not) and a side
          // rewraps the words at the same size.
          aspect: text
            ? isCorner
              ? ratio
              : null
            : isCorner === e.shiftKey
              ? null
              : ratio,
          fromCentre: e.altKey,
        });

        const box = {
          x: Math.round(next.x),
          y: Math.round(next.y),
          width: Math.round(next.width),
          height: Math.round(next.height),
        };
        let fontSize: number | undefined;

        if (text) {
          if (isCorner) {
            // Under the aspect lock both axes scaled by the same factor, so the
            // width ratio is the type's scale factor.
            const factor = next.width / gesture.startBox.width;
            fontSize = (gesture.startFontSize ?? text.fontSize) * factor;
          } else {
            // Width-only: the words rewrap, so the box's height is whatever they
            // now need rather than whatever the drag geometry produced.
            const measured = textLayerHeight(text, { width: box.width });
            if (measured !== undefined) box.height = Math.round(measured);
          }
        }

        apply(
          {
            type: "setLayerBox",
            layerId: gesture.layerId,
            box,
            fontSize,
          },
          { transient: true, label: `resize:${gesture.layerId}` }
        );
        return;
      }

      if (gesture.kind === "rotate") {
        const raw = rotationFromPointer(gesture.startBox, point);
        apply(
          {
            type: "setLayerBox",
            layerId: gesture.layerId,
            box: { rotation: snapRotation(raw, e.shiftKey) },
          },
          { transient: true, label: `rotate:${gesture.layerId}` }
        );
        return;
      }

      if (gesture.kind === "crop-move") {
        const crop = cropFromPan(
          gesture.startCrop,
          gesture.startLocal,
          docToLocal(gesture.box, point),
          gesture.box.width,
          gesture.box.height
        );
        apply(
          { type: "setCrop", layerId: gesture.layerId, crop },
          { transient: true, label: `crop:${gesture.layerId}` }
        );
        return;
      }

      if (gesture.kind === "crop-resize") {
        const axes = handleAxes(gesture.handle);
        const isCorner = axes.sx !== 0 && axes.sy !== 0;
        const crop = cropFromHandle(
          gesture.startCrop,
          gesture.handle,
          docToLocal(gesture.box, point),
          gesture.box.width,
          gesture.box.height,
          // Shift locks the crop's current shape — the point is often to reframe
          // rather than reshape. Free by default, the inverse of layer resize.
          { lockAspect: e.shiftKey && isCorner }
        );
        apply(
          { type: "setCrop", layerId: gesture.layerId, crop },
          { transient: true, label: `crop:${gesture.layerId}` }
        );
        return;
      }

      if (gesture.kind === "paint") {
        const local = docToLocal(gesture.box, point);
        const next = extendStroke(gesture.stroke, {
          x: local.x / gesture.box.width,
          y: local.y / gesture.box.height,
        });
        if (next === gesture.stroke) return; // too close to the last point
        gestureRef.current = { ...gesture, stroke: next };
        apply(
          { type: "updateStroke", layerId: gesture.layerId, stroke: next },
          { transient: true, label: `paint:${next.id}` }
        );
      }
    },
    [apply, docRef, eraseStrokesAt, setViewport, showSnapLines, toDoc]
  );

  const finishGesture = useCallback(
    (e: React.PointerEvent<Element>) => {
      pointersRef.current.delete(e.pointerId);
      const gesture = gestureRef.current;

      // A pinch outlives the finger that ends first: lifting one of two leaves
      // the other one still down, and treating that as the end of the gesture
      // would jump the view.
      if (gesture.kind === "pinch" && pointersRef.current.size >= 2) return;

      if (gesture.kind === "none") return;
      gestureRef.current = { kind: "none" };
      showSnapLines([]);

      if (gesture.kind === "marquee") {
        setMarquee(null);
        const rect = rectFromPoints(gesture.startDoc, toDoc(e));
        // A click, not a drag: the deselect already happened on the way down.
        const scale = viewportRef.current.scale;
        if (rect.width * scale < 4 && rect.height * scale < 4) return;
        const all = docRef.current.layers;
        const swept = withGroups(all, layersInRect(all, rect)).map((l) => l.id);
        selectMany([...gesture.base, ...swept]);
        return;
      }
      try {
        // Whichever element opened the drag is the one holding capture — the
        // canvas for a body drag, the handle span for a resize or rotate.
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      endGesture();
    },
    [docRef, endGesture, selectMany, showSnapLines, toDoc]
  );

  // Ctrl/⌘+wheel zooms about the cursor; plain wheel pans. Non-passive so the
  // browser's own page zoom can be prevented.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      const rect = canvas!.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        setViewport((v) => zoomBy(v, factor, anchor));
        return;
      }
      if (e.shiftKey) return; // let horizontal scroll through
      e.preventDefault();
      setViewport((v) => ({
        ...v,
        offsetX: v.offsetX - e.deltaX,
        offsetY: v.offsetY - e.deltaY,
      }));
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  // Space is a modifier, not a shortcut: held = pan mode. Ignored while typing.
  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA"
      );
    }
    function onDown(e: KeyboardEvent) {
      if (e.code === "Space" && !isTyping(e.target)) {
        spaceRef.current = true;
        e.preventDefault();
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code === "Space") spaceRef.current = false;
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const cursor =
    tool === "eraser" || tool === "draw" || tool === "pen" || tool === "pen-eraser"
      ? "crosshair"
      : // Crop's own handles carry resize cursors; the window itself is dragged,
        // so "move" is the honest default for the rest of the surface.
        tool === "crop"
        ? "move"
        : "default";

  return (
    <div
      ref={wrapRef}
      className="studio-canvas-grid relative h-full w-full overflow-hidden"
      onDragOver={(e) => {
        if (!onDropUpload || !e.dataTransfer.types.includes(UPLOAD_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const id = dropTargetAt(e)?.id ?? null;
        if (id !== dropTargetId) setDropTargetId(id);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTargetId(null);
      }}
      onDrop={(e) => {
        const src = e.dataTransfer.getData(UPLOAD_DRAG_MIME);
        setDropTargetId(null);
        if (!onDropUpload || !src) return;
        e.preventDefault();
        onDropUpload(src, toDoc(e), dropTargetAt(e)?.id ?? null);
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onDoubleClick={(e) => {
          // Double-click is how every editor opens text for typing. Harmless on
          // a photo, which is why it isn't gated on the active tool.
          const hit = pickLayer(toDoc(e));
          if (hit?.kind !== "text" || hit.locked) return;
          select(hit.id);
          setEditingId(hit.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const hit = pickLayer(toDoc(e));
          // Right-clicking inside a multi-selection keeps it.
          if (hit && !selectedIdsRef.current.includes(hit.id)) select(hit.id);
          onContextMenu?.(e.clientX, e.clientY, hit?.id ?? null);
        }}
        className="block h-full w-full"
        style={{ touchAction: "none", cursor }}
        aria-label={`Design canvas, ${doc.width} by ${doc.height} pixels`}
      />

      {/* Under the selection chrome deliberately: the guides are the page's
          property, the handles are the user's current business. */}
      {showGuides && guides && (
        <PrintGuides
          guides={guides}
          viewport={viewport}
          page={{ width: doc.width, height: doc.height }}
        />
      )}

      {/* Above the print guides, below the selection chrome: a snap guide is
          feedback about the drag happening right now. */}
      <SnapGuides
        lines={snapLines}
        viewport={viewport}
        page={{ width: doc.width, height: doc.height }}
      />

      {marquee && <MarqueeOverlay rect={marquee} viewport={viewport} />}

      {dropTargetId && (() => {
        const target = doc.layers.find((l) => l.id === dropTargetId);
        return target ? <LayerOutline layer={target} viewport={viewport} /> : null;
      })()}

      {onFillSlot && tool === "select" && (
        <SlotPrompts layers={unfilledSlots(doc)} viewport={viewport} onFill={onFillSlot} />
      )}

      {selectedLayers.length > 1 && (
        <GroupSelectionOverlay
          layers={selectedLayers}
          viewport={viewport}
          onHandleDown={beginGroupScale}
          onHandleMove={onPointerMove}
          onHandleUp={finishGesture}
        />
      )}

      {selectedLayer &&
        (isImageLayer(selectedLayer) && tool === "crop" ? (
          // Crop replaces the selection box entirely — two sets of handles on
          // one layer would be ambiguous about which one a drag grabs.
          <CropOverlay
            layer={selectedLayer}
            viewport={viewport}
            onHandleDown={beginCropHandleGesture}
            onHandleMove={onPointerMove}
            onHandleUp={finishGesture}
          />
        ) : !compact && editingId === selectedLayer.id && selectedLayer.kind === "text" ? (
          // Likewise for typing: the caret is the only grab target that makes
          // sense while the words are being edited.
          <TextEditOverlay
            key={selectedLayer.id}
            layer={selectedLayer}
            viewport={viewport}
          />
        ) : (
          <SelectionOverlay
            layer={selectedLayer}
            viewport={viewport}
            onHandleDown={beginHandleGesture}
            onHandleMove={onPointerMove}
            onHandleUp={finishGesture}
          />
        ))}
    </div>
  );
}

/** A dashed box over a layer — the drop target while an upload is dragged. */
function LayerOutline({ layer, viewport }: { layer: Layer; viewport: Viewport }) {
  const p = docToScreen(viewport, { x: layer.x, y: layer.y });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 border-2 border-dashed border-[var(--studio-accent)] bg-[var(--studio-accent)]/10"
      style={{
        width: layer.width * viewport.scale,
        height: layer.height * viewport.scale,
        transform: `translate(${p.x}px, ${p.y}px) rotate(${layer.rotation}deg)`,
        transformOrigin: "center",
      }}
    />
  );
}

/**
 * "Add your photo" on every photo slot still holding the template's sample —
 * the customer's to-do list, drawn where the work is.
 */
function SlotPrompts({
  layers,
  viewport,
  onFill,
}: {
  layers: ImageLayer[];
  viewport: Viewport;
  onFill: (layerId: string) => void;
}) {
  return (
    <>
      {layers.map((layer) => {
        const c = docToScreen(viewport, { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 });
        return (
          <button
            key={layer.id}
            type="button"
            data-r="full"
            onClick={() => onFill(layer.id)}
            className="absolute left-0 top-0 z-10 inline-flex items-center gap-1.5 whitespace-nowrap bg-[var(--studio-chrome)]/95 px-3 py-1.5 text-[12px] font-semibold text-[var(--studio-ink)] shadow-md ring-1 ring-[var(--studio-border)] hover:ring-[var(--studio-accent)]"
            style={{ transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)` }}
          >
            <Icon name="add_photo_alternate" className="text-[16px]" />
            Add your photo
          </button>
        );
      })}
    </>
  );
}
