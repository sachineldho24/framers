/**
 * Client-side working state for the designer flow, persisted in sessionStorage.
 * Keyed by sessionId so multiple tabs/sessions don't collide. The DB
 * design_sessions row is the durable record; this is the fast UX layer.
 */

export interface DesignerState {
  sessionId: string;
  designSource: "canva" | "upload";
  frameId: string | null; // chosen size SKU
  frameStyleId: string | null;
  finishId: string | null;
  uploadPath: string | null; // storage path of original upload
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

export function loadDesignerState(sessionId: string): DesignerState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DesignerState;
  } catch {
    return null;
  }
}

export function saveDesignerState(state: DesignerState): void {
  if (typeof window === "undefined") return;
  // Never persist the ephemeral object URL — it's invalid after reload.
  const { previewObjectUrl: _drop, ...persistable } = state;
  void _drop;
  sessionStorage.setItem(key(state.sessionId), JSON.stringify(persistable));
}

export function patchDesignerState(
  sessionId: string,
  patch: Partial<DesignerState>
): DesignerState | null {
  const current = loadDesignerState(sessionId);
  if (!current) return null;
  const next = { ...current, ...patch };
  saveDesignerState(next);
  return next;
}

export function initDesignerState(
  sessionId: string,
  designSource: "canva" | "upload",
  frameId: string | null
): DesignerState {
  const existing = loadDesignerState(sessionId);
  if (existing) return existing;
  const fresh: DesignerState = {
    sessionId,
    designSource,
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
  saveDesignerState(fresh);
  return fresh;
}
