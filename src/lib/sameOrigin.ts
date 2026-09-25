/**
 * Refuse a state-changing request that didn't come from this site. The session
 * cookie rides along on any request, so a mutating route must check where the
 * request was made, not just who is signed in.
 */
export class CrossOriginError extends Error {}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin)
  ) {
    throw new CrossOriginError("This request is not allowed.");
  }
}
