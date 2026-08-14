/**
 * Undo/redo over document snapshots.
 *
 * Snapshots rather than inverse actions: the document is small, plain JSON, and
 * unchanged layers are shared by reference (the reducer never mutates), so a
 * snapshot costs one object plus one array. That buys exact undo with no chance
 * of an inverse-action bug corrupting the document.
 *
 * The interesting part is coalescing. A drag emits ~60 actions a second; each
 * must be visible immediately but must collapse into a single undo entry. A
 * `transient` commit replaces the present without touching the past, and the
 * entry that opened the drag is the one undo returns to.
 */

import type { StudioDocument } from "./document";
import { studioReducer, type StudioAction } from "./reducer";

export const HISTORY_LIMIT = 50;

export interface HistoryState {
  past: StudioDocument[];
  present: StudioDocument;
  future: StudioDocument[];
  /** Set while a transient gesture is open, so we only snapshot once. */
  pendingLabel: string | null;
}

export interface CommitOptions {
  /**
   * Part of an in-flight gesture (drag, slider). The first transient commit of
   * a gesture pushes history; the rest overwrite the present.
   */
  transient?: boolean;
  /** Gesture identity. A different label starts a new undo entry. */
  label?: string;
}

export function createHistory(present: StudioDocument): HistoryState {
  return { past: [], present, future: [], pendingLabel: null };
}

function pushPast(
  past: StudioDocument[],
  doc: StudioDocument
): StudioDocument[] {
  const next = past.length >= HISTORY_LIMIT ? past.slice(1) : past.slice();
  next.push(doc);
  return next;
}

/**
 * Apply an action and record it.
 *
 * Returns the same state object when the reducer was a no-op, so React can skip
 * the render entirely — this matters because pointermove fires constantly and
 * most moves land on the same rounded pixel.
 */
export function commit(
  state: HistoryState,
  action: StudioAction,
  options: CommitOptions = {}
): HistoryState {
  const { transient = false, label = null } = options;
  const next = studioReducer(state.present, action);

  if (next === state.present) {
    // Nothing changed, but a gesture may still need to open so that the *next*
    // move in this drag coalesces against the right history entry.
    if (transient && state.pendingLabel !== label) {
      return { ...state, pendingLabel: label };
    }
    return state;
  }

  // Continuing an open gesture: overwrite the present, leave the past alone.
  if (transient && state.pendingLabel !== null && state.pendingLabel === label) {
    return { ...state, present: next, future: [] };
  }

  return {
    past: pushPast(state.past, state.present),
    present: next,
    future: [],
    pendingLabel: transient ? label : null,
  };
}

/**
 * Close an open gesture. The document is already correct; this just means the
 * next commit starts a fresh undo entry.
 */
export function endGesture(state: HistoryState): HistoryState {
  return state.pendingLabel === null ? state : { ...state, pendingLabel: null };
}

/** Replace the document wholesale (load, or a resize) and clear history. */
export function reset(doc: StudioDocument): HistoryState {
  return createHistory(doc);
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const past = state.past.slice();
  const previous = past.pop()!;
  return {
    past,
    present: previous,
    future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
    pendingLabel: null,
  };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  return {
    past: pushPast(state.past, state.present),
    present: next,
    future: rest,
    pendingLabel: null,
  };
}
