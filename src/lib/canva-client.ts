/** Client-safe Canva helpers (no secrets, no server imports). */

/** Editor URL for a design id — deterministic, safe to build in the browser. */
export function editorUrlClient(designId: string): string {
  return `https://www.canva.com/design/${designId}/edit`;
}
