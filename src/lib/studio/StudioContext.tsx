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
import { findLayer } from "./document";
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
import { fitViewport, type Viewport } from "./geometry";
import { printGuides, type PrintGuideSet, type PrintSize } from "./print";

export type ToolId =
  | "select"
  | "draw"
  | "eraser"
  | "crop"
  | "frames"
  | "adjust"
  | "border"
  | "layers";

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
  selectedId: string | null;
  selectedLayer: Layer | null;
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

  /** Apply an action. Pass `{ transient, label }` for in-flight gestures. */
  apply: (action: StudioAction, options?: CommitOptions) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  replaceDocument: (doc: StudioDocument) => void;

  select: (layerId: string | null) => void;
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
          48
        )
      );
    },
    []
  );

  // A selection pointing at a deleted layer must read as "nothing selected",
  // not as a stale id — undo can also bring the layer back, and then it should
  // simply be selected again.
  const selectedLayer = selectedId ? (findLayer(doc, selectedId) ?? null) : null;

  // Derived rather than trusted, for the same reason: undo can remove the layer
  // being typed into, and a lock can arrive from the layers panel mid-edit. Both
  // must read as "not editing" without a cleanup effect racing the render.
  const editing =
    editingId !== null &&
    selectedLayer?.id === editingId &&
    selectedLayer.kind === "text" &&
    !selectedLayer.locked
      ? editingId
      : null;

  const value = useMemo<StudioContextValue>(
    () => ({
      doc,
      selectedId: selectedLayer ? selectedId : null,
      selectedLayer,
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
      apply,
      endGesture: endGestureCb,
      undo,
      redo,
      replaceDocument,
      select,
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
      selectedId,
      selectedLayer,
      editing,
      tool,
      rail,
      viewport,
      brush,
      saveStatus,
      size,
      guides,
      showGuides,
      history,
      apply,
      endGestureCb,
      undo,
      redo,
      replaceDocument,
      select,
      setTool,
      setViewport,
      setBrush,
      fitTo,
    ]
  );

  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}
