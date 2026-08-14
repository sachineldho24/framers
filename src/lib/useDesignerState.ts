"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  designerStateSnapshot,
  subscribeDesignerState,
  type DesignerState,
} from "@/lib/designer-state";

/**
 * The designer's sessionStorage working state, as a reactive value.
 *
 * `useSyncExternalStore` rather than a read during render or a restore effect:
 * sessionStorage is genuinely external, and this is the one form React gives us
 * that is safe on both sides of hydration. The server snapshot is `null`, so the
 * server and the first client render agree — a step whose slider position came
 * from the store would otherwise render one size on the server and another in
 * the browser — and the real value arrives in the commit right after.
 *
 * Every write goes through `saveDesignerState`, which notifies, so a step that
 * measures something and patches it back re-renders with the new figure without
 * holding a second copy in component state.
 */
export function useDesignerState(sessionId: string): DesignerState | null {
  const snapshot = useCallback(
    () => designerStateSnapshot(sessionId),
    [sessionId]
  );
  return useSyncExternalStore(subscribeDesignerState, snapshot, () => null);
}
