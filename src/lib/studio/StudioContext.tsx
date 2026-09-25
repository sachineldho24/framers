"use client";

/**
 * Studio state: the document plus everything around it the UI needs (selection,
 * active tool, viewport, save status).
 *
 * The document lives in a `useReducer` over `HistoryState`, so undo/redo are
 * free. Selection/tool/viewport are deliberately *not* in the document — they're
 * view state, and putting them in history would make undo step through
 * selections instead of edits.
 *
 * Drag performance: `commit` with `transient: true` collapses a gesture into one
 * undo entry, and the reducer returns the identical state object when nothing
 * changed, so a pointermove landing on the same rounded pixel costs no render.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";

import type { Layer, StudioDocument } from "./document";
import { createId, findLayer, idPrefixFor } from "./document";
import {
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  commit,
  createHistory,
  endGesture,
  redo as redoOf,
  reset as resetOf,
  undo as undoOf,
  type CommitOptions,
  type HistoryState,
} from "./history";
import type { StudioAction } from "./reducer";
import { DEFAULT_PEN_SETTINGS, type PenSettings } from "./drawing";
import { fitViewport, type Viewport } from "./geometry";
import { printGuides, type PrintGuideSet, type PrintSize } from "./print";

export type ToolId =
  | "effects"
  /** Freehand drawing on the page — Tools → Draw. */
  | "pen"
  /** Rubs out whole drawn strokes. */
  | "pen-eraser"
  /** The Pen tool proper: anchors and Bézier curves (`penPath.ts`). */
  | "path"
  | "select"
  | "draw"
  | "eraser"
  | "crop"
  | "frames"
  | "adjust"
  | "border"
  | "layers";

/**
 * Tools that only open a side panel. The canvas still selects, moves and resizes
 * while they're open, so the object toolbars stay up too — as in Canva, where
 * Position or Adjust sits beside the selection rather than replacing it. Crop,
 * erase and restore take over the pointer, so they hide the toolbars.
 */
export function keepsObjectToolbars(tool: ToolId): boolean {
  return (
    tool === "select" ||
    tool === "layers" ||
    tool === "adjust" ||
    tool === "frames" ||
    tool === "border" ||
    tool === "effects"
  );
}

/** Which rail entry is open. `null` = flyout closed. */
export type RailId =
  | "templates"
  | "elements"
  | "text"
  | "brand"
  | "uploads"
  | "tools"
  | "projects"
  | "apps";

/**
 * Save status is shown verbatim in the top bar, so it has to be able to say
 * "local only" — the editor works before migration 0008 is run, and claiming
 * "All changes saved" then would be a lie.
 */
export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "saved-local"
  | "error";

export interface BrushSettings {
  /** Fraction of the layer's shorter edge. */
  size: number;
  /** 0–1. */
  feather: number;
  mode: "erase" | "restore";
}

type HistoryAction =
  | { kind: "commit"; action: StudioAction; options?: CommitOptions }
  | { kind: "endGesture" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "reset"; doc: StudioDocument };

function historyReducer(
  state: HistoryState,
  action: HistoryAction
): HistoryState {
  switch (action.kind) {
    case "commit":
      return commit(state, action.action, action.options);
    case "endGesture":
      return endGesture(state);
    case "undo":
      return undoOf(state);
    case "redo":
      return redoOf(state);
    case "reset":
      return resetOf(action.doc);
    default:
      return state;
  }
}

export interface StudioContextValue {
  doc: StudioDocument;
  /** The one selected layer. `null` when nothing — or several — are selected. */
  selectedId: string | null;
  selectedLayer: Layer | null;
  /**
   * Everything selected, bottom-first: one layer, several (a marquee, shift-
   * clicks, a group), or none. Two or more is a multi-selection, and the
   * single-layer UI (`selectedLayer`) stands down for it.
   */
  selectedLayers: Layer[];
  /**
   * The text layer whose words are being typed, if any. View state like the
   * selection: the canvas skips drawing this layer (the `<textarea>` overlay is
   * showing the same glyphs) and the keyboard shortcuts stand down.
   */
  editingId: string | null;
  tool: ToolId;
  rail: RailId | null;
  viewport: Viewport;
  brush: BrushSettings;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;

  /**
   * Physical size of the finished print: the document's own `printMm` if it was
   * sized by hand, else the frame. `null` when the studio was opened without a
   * frame and nobody has set a size — everything print-related then falls back
   * to the authored 300 DPI rather than guessing a frame.
   */
  printSize: PrintSize | null;
  /** Lip and safe-area rects in document pixels. `null` without a `printSize`. */
  guides: PrintGuideSet | null;
  /**
   * Whether the lip overlay is drawn. View state, like the tool — and **off by
   * default**: the canvas should show the artwork and nothing else.
   */
  showGuides: boolean;
  setShowGuides: (show: boolean) => void;

  /**
   * Canva's "Copy style" (the paint roller): the layer whose style is waiting to
   * be pasted onto the next layer the user clicks. View state, not document.
   */
  styleSource: Layer | null;
  setStyleSource: (layer: Layer | null) => void;

  /** The Draw tool's pen, colours and thicknesses. */
  pen: PenSettings;
  setPen: (patch: Partial<PenSettings>) => void;

  /** Apply an action. Pass `{ transient, label }` for in-flight gestures. */
  apply: (action: StudioAction, options?: CommitOptions) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  replaceDocument: (doc: StudioDocument) => void;

  select: (layerId: string | null) => void;
  /**
   * Duplicate a layer and select the copy — as every editor does. Leaving the
   * original selected meant Delete removed the layer *under* the copy.
   */
  duplicate: (layerId: string, offset?: number) => void;
  /** Select several layers at once. One id is an ordinary selection. */
  selectMany: (layerIds: string[]) => void;
  /** Start (or, with `null`, stop) editing a text layer in place. */
  setEditingId: (layerId: string | null) => void;
  setTool: (tool: ToolId) => void;
  setRail: (rail: RailId | null) => void;
  setViewport: Dispatch<React.SetStateAction<Viewport>>;
  setBrush: (patch: Partial<BrushSettings>) => void;
  setSaveStatus: (status: SaveStatus) => void;

  /**
   * Fit the page to a container. Called on mount and on resize; kept here so
   * the bottom bar's "fit" button and the canvas agree on what fit means.
   */
  fitTo: (containerWidth: number, containerHeight: number) => void;

  /**
   * True while the viewport is still exactly what `fitTo` last made it — nobody
   * has panned or zoomed since. The canvas re-fits on a container resize while
   * this holds and only re-centres once it doesn't, so opening a panel mid-edit
   * slides the page over instead of re-zooming work in progress.
   */
  viewportPristineRef: React.RefObject<boolean>;

  /** Latest document without subscribing — for autosave and export callbacks. */
  docRef: React.RefObject<StudioDocument>;
}

const StudioCtx = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioCtx);
  if (!ctx) throw new Error("useStudio must be used inside <StudioProvider>");
  return ctx;
}

export function StudioProvider({
  initialDocument,
  printSize = null,
  children,
}: {
  initialDocument: StudioDocument;
  /** The frame's physical size, when the studio was opened with one. */
  printSize?: PrintSize | null;
  children: ReactNode;
}) {
  const [history, dispatch] = useReducer(
    historyReducer,
    initialDocument,
    createHistory
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setToolState] = useState<ToolId>("select");
  const [rail, setRail] = useState<RailId | null>("tools");
  const [viewport, setViewportState] = useState<Viewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  // Set by `fitTo`, cleared by every other viewport write. See the field's doc
  // on StudioContextValue for what the distinction buys.
  const viewportPristineRef = useRef(true);
  const [brush, setBrushState] = useState<BrushSettings>({
    size: 0.12,
    feather: 0.5,
    mode: "erase",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Off by default: the workspace should show the artwork and nothing else. The
  // lip is still a fact about the print, so the bottom bar's toggle and the
  // stray-text warning's "Show guides" both turn it on the moment it matters.
  const [showGuides, setShowGuides] = useState(false);
  const [styleSource, setStyleSource] = useState<Layer | null>(null);
  const [pen, setPenState] = useState<PenSettings>(DEFAULT_PEN_SETTINGS);
  const setPen = useCallback((patch: Partial<PenSettings>) => setPenState((p) => ({ ...p, ...patch })), []);

  const doc = history.present;

  // Normalised so a fresh `{ widthMm, heightMm }` literal from the caller each
  // render doesn't invalidate the guides — the numbers are what matter.
  //
  // A paper size set by hand wins over the frame's: the document is then the
  // only record of what it is, and the guides, the DPI readout and the PDF must
  // all describe the page in front of the user rather than the frame row the
  // session started from.
  const widthMm = doc.printMm?.widthMm ?? printSize?.widthMm ?? null;
  const heightMm = doc.printMm?.heightMm ?? printSize?.heightMm ?? null;
  const size = useMemo<PrintSize | null>(
    () => (widthMm && heightMm ? { widthMm, heightMm } : null),
    [widthMm, heightMm]
  );

  const { width: docWidth, height: docHeight } = doc;
  const guides = useMemo(
    () => printGuides({ width: docWidth, height: docHeight }, size),
    [docWidth, docHeight, size]
  );

  // Mirrors the document for callbacks that must not re-subscribe (autosave
  // timers, export handlers) — reading `.current` there avoids stale closures
  // without adding the document to every dependency array. Only ever read from
  // event handlers and timers, both of which run after effects have flushed.
  const docRef = useRef<StudioDocument>(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const apply = useCallback((action: StudioAction, options?: CommitOptions) => {
    dispatch({ kind: "commit", action, options });
  }, []);

  const endGestureCb = useCallback(() => {
    dispatch({ kind: "endGesture" });
  }, []);

  const undo = useCallback(() => dispatch({ kind: "undo" }), []);
  const redo = useCallback(() => dispatch({ kind: "redo" }), []);

  const replaceDocument = useCallback((next: StudioDocument) => {
    dispatch({ kind: "reset", doc: next });
  }, []);

  const select = useCallback((layerId: string | null) => {
    setSelectedId(layerId);
    setMultiIds([]);
    // Selecting anything else ends the text edit — otherwise the textarea would
    // hang over the canvas belonging to a layer that is no longer selected.
    setEditingId((editing) => (editing === layerId ? editing : null));
    // Crop and the brushes act *on* a layer. Left active with nothing selected
    // they'd swallow clicks on the canvas and appear broken, so deselecting
    // returns to Select. Tools that read as panels (adjust, frames, layers) stay
    // put — their flyout simply shows its empty state.
    if (!layerId) {
      setToolState((t) =>
        t === "crop" || t === "eraser" || t === "draw" ? "select" : t
      );
    }
  }, []);

  const duplicate = useCallback(
    (layerId: string, offset?: number) => {
      const source = docRef.current.layers.find((l) => l.id === layerId);
      if (!source) return;
      const newId = createId(idPrefixFor(source.kind));
      apply({ type: "duplicateLayer", layerId, offset, newId });
      select(newId);
    },
    [apply, select]
  );

  const selectMany = useCallback(
    (layerIds: string[]) => {
      const ids = [...new Set(layerIds)];
      if (ids.length <= 1) {
        select(ids[0] ?? null);
        return;
      }
      setSelectedId(null);
      setMultiIds(ids);
      setEditingId(null);
      // Crop and the brushes act on one layer; they have nothing to do here.
      setToolState((t) => (t === "crop" || t === "eraser" || t === "draw" ? "select" : t));
    },
    [select]
  );

  const setTool = useCallback((next: ToolId) => {
    setToolState(next);
  }, []);

  const setBrush = useCallback((patch: Partial<BrushSettings>) => {
    setBrushState((b) => ({ ...b, ...patch }));
  }, []);

  const setViewport = useCallback<Dispatch<React.SetStateAction<Viewport>>>(
    (next) => {
      viewportPristineRef.current = false;
      setViewportState(next);
    },
    []
  );

  const fitTo = useCallback(
    (containerWidth: number, containerHeight: number) => {
      // A fit is the neutral state, not an adjustment — including when the user
      // asks for one from the bottom bar.
      viewportPristineRef.current = true;
      setViewportState(
        fitViewport(
          docRef.current.width,
          docRef.current.height,
          containerWidth,
          containerHeight,
          containerWidth < 600 || containerHeight < 400 ? 24 : 48
        )
      );
    },
    []
  );

  // A selection pointing at a deleted layer must read as "nothing selected",
  // not as a stale id — undo can also bring the layer back, and then it should
  // simply be selected again.
  // Members can be deleted (or undone away) under a multi-selection too; what
  // is left decides whether it is still one — a single survivor is simply the
  // selection.
  const multiLayers = useMemo(
    () => doc.layers.filter((layer) => multiIds.includes(layer.id)),
    [doc.layers, multiIds]
  );
  const singleId = multiLayers.length === 1 ? multiLayers[0].id : multiIds.length ? null : selectedId;
  const selectedLayer = singleId ? (findLayer(doc, singleId) ?? null) : null;
  const selectedLayers = useMemo(
    () => (multiLayers.length > 1 ? multiLayers : selectedLayer ? [selectedLayer] : []),
    [multiLayers, selectedLayer]
  );

  // Derived rather than trusted, for the same reason: undo can remove the layer
  // being typed into, and a lock can arrive from the layers panel mid-edit. Both
  // must read as "not editing" without a cleanup effect racing the render.
  const editing =
    editingId !== null &&
    selectedLayer?.id === editingId &&
    // Text is typed into; a pen path has its points edited.
    (selectedLayer.kind === "text" || selectedLayer.kind === "path") &&
    !selectedLayer.locked
      ? editingId
      : null;

  const value = useMemo<StudioContextValue>(
    () => ({
      doc,
      selectedId: selectedLayer ? selectedLayer.id : null,
      selectedLayer,
      selectedLayers,
      editingId: editing,
      tool,
      rail,
      viewport,
      brush,
      saveStatus,
      canUndo: canUndoOf(history),
      canRedo: canRedoOf(history),
      printSize: size,
      guides,
      showGuides,
      setShowGuides,
      styleSource,
      setStyleSource,
      pen,
      setPen,
      apply,
      endGesture: endGestureCb,
      undo,
      redo,
      replaceDocument,
      select,
      duplicate,
      selectMany,
      setEditingId,
      setTool,
      setRail,
      setViewport,
      setBrush,
      setSaveStatus,
      fitTo,
      viewportPristineRef,
      docRef,
    }),
    [
      doc,
      setPen,
      selectedLayer,
      selectedLayers,
      editing,
      tool,
      rail,
      viewport,
      brush,
      saveStatus,
      size,
      guides,
      showGuides,
      styleSource,
      pen,
      history,
      apply,
      endGestureCb,
      undo,
      redo,
      replaceDocument,
      select,
      duplicate,
      selectMany,
      setTool,
      setViewport,
      setBrush,
      fitTo,
    ]
  );

  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}
