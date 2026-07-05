import type { DesignSource } from "@/lib/supabase/types";

/** Payload handed from the design/upload step to checkout via sessionStorage. */
export interface CheckoutHandoff {
  designSource: DesignSource;
  frameId: string;
  printPath: string;
  previewPath: string | null;
  designId: string | null;
  // Designer-flow additions (optional for backwards compatibility).
  sessionId?: string | null;
  frameStyleId?: string | null;
  finishId?: string | null;
  mockupPath?: string | null;
}

export const CHECKOUT_STORAGE_KEY = "framers_checkout";

/** Read + validate the handoff from sessionStorage. Returns null if missing/bad. */
export function readCheckoutHandoff(): CheckoutHandoff | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<CheckoutHandoff>;
    if (!data.frameId || !data.printPath || !data.designSource) return null;
    return {
      designSource: data.designSource,
      frameId: data.frameId,
      printPath: data.printPath,
      previewPath: data.previewPath ?? null,
      designId: data.designId ?? null,
      sessionId: data.sessionId ?? null,
      frameStyleId: data.frameStyleId ?? null,
      finishId: data.finishId ?? null,
      mockupPath: data.mockupPath ?? null,
    };
  } catch {
    return null;
  }
}

export function clearCheckoutHandoff(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
  }
}
