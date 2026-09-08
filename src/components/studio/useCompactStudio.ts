"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 1023px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(QUERY).matches;
const serverSnapshot = () => false;

/** Keep the interaction layout in step with the studio's CSS breakpoint. */
export function useCompactStudio() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
