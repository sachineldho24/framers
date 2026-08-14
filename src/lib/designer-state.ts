/**
 * Client-side working state for the designer flow, persisted in sessionStorage.
 * Keyed by sessionId so multiple tabs/sessions don't collide. The DB
 * design_sessions row is the durable record; this is the fast UX layer.
 */

export interface DesignerState {
  sessionId: string;
  designSource: "upload";
  frameId: string | null; // chosen size SKU
  frameStyleId: string | null;
  finishId: string | null;
  uploadPath: string | null; // storage path of original upload
  previewPath?: string | null;
  printPath?: string | null;
  previewObjectUrl?: string | null; // ephemeral, not persisted across reload
  imageWidth: number | null; // natural px of the uploaded image
  imageHeight: number | null;
  cropX: number;
  cropY: number;
  cropScale: number;
}

function key(sessionId: string) {
  return `framers_designer_${sessionId}`;
}

/* ------------------------------------------------------------------ reactive */

const listeners = new Set<() => void>();

/**
 * The parsed snapshot per session, cached against the exact string it came from.
 *
 * `useSyncExternalStore` re-reads on every render and compares by identity, so
 * parsing afresh each time would be an infinite loop. Keyed by session rather
 * than one slot: two sessions on screen at once would otherwise evict each
 * other's cache on every read, which is the same infinite loop wearing a hat.
 */
const cache = new Map<string, { raw: string | null; state: DesignerState | null }>();

/** Subscribe to writes made through this module. Returns the unsubscribe. */
export function subscribeDesignerState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Stable-identity read, for `useSyncExternalStore`. */
export function designerStateSnapshot(sessionId: string): DesignerState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key(sessionId));
  const hit = cache.get(sessionId);
  if (hit && hit.raw === raw) return hit.state;
  const state = raw ? parse(raw) : null;
  cache.set(sessionId, { raw, state });
  return state;
}

function parse(raw: string): DesignerState | null {
  try {
    return JSON.parse(raw) as DesignerState;
  } catch {
    return null;
  }
}

export function loadDesignerState(sessionId: string): DesignerState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key(sessionId));
  return raw ? parse(raw) : null;
}

export function saveDesignerState(state: DesignerState): void {
  if (typeof window === "undefined") return;
  // Never persist the ephemeral object URL — it's invalid after reload.
  const { previewObjectUrl: _drop, ...persistable } = state;
  void _drop;
  sessionStorage.setItem(key(state.sessionId), JSON.stringify(persistable));
  for (const l of listeners) l();
}

/**
 * Merge into the stored state, creating it if this browser has none.
 *
 * The upsert matters: sessionStorage is per-tab, so a session resumed in a fresh
 * tab (or after the store was cleared) has no record even though the DB row
 * exists. Returning null there would silently drop whatever the caller was
 * trying to save — which is how an upload's pixel dimensions went missing and
 * the size step lost its DPI figures.
 */
export function patchDesignerState(
  sessionId: string,
  patch: Partial<DesignerState>
): DesignerState {
  const current = loadDesignerState(sessionId) ?? blankState(sessionId, null);
  const next = { ...current, ...patch, sessionId };
  saveDesignerState(next);
  return next;
}

function blankState(
  sessionId: string,
  frameId: string | null
): DesignerState {
  return {
    sessionId,
    designSource: "upload",
    frameId,
    frameStyleId: null,
    finishId: null,
    uploadPath: null,
    previewObjectUrl: null,
    imageWidth: null,
    imageHeight: null,
    cropX: 0,
    cropY: 0,
    cropScale: 1,
  };
}

export function initDesignerState(
  sessionId: string,
  designSource: "upload",
  frameId: string | null
): DesignerState {
  const existing = loadDesignerState(sessionId);
  if (existing) return existing;
  const fresh: DesignerState = { ...blankState(sessionId, frameId), designSource };
  saveDesignerState(fresh);
  return fresh;
}
