/**
 * Where a user goes once they are authenticated.
 *
 * Pure and client-safe, so `LoginForm` and its unit test share one answer rather
 * than the rule living inline in an event handler.
 */

const HOME = "/";

/** Paths nobody should be returned *to* after authenticating. */
const TRANSIT_PATHS = new Set(["/login"]);

/**
 * Signing up is not a way of asking for the account page. A brand-new account
 * has no orders, no addresses and nothing to manage, so `/account` is a dead end
 * for it — new accounts land on the storefront, where the header carries their
 * profile. Signing *in* still honours `/account`: a returning user who tapped
 * "Account" meant it.
 */
const SIGNUP_DEAD_ENDS = new Set(["/account"]);

export type AuthMode = "signin" | "signup";

/** The pathname of a relative target, without its query or hash. */
function pathnameOf(target: string): string {
  return target.split(/[?#]/)[0];
}

/**
 * Coerce a `?next=` parameter into a same-origin path.
 *
 * `next` arrives from the URL, so it is attacker-controlled: anything that is
 * not a plain absolute path (`//evil.example`, `https://…`, `javascript:…`,
 * and `/\evil.example` which some URL parsers treat as protocol-relative)
 * collapses to the home page instead of becoming an open redirect.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return HOME;
  if (!raw.startsWith("/")) return HOME;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return HOME;
  return raw;
}

/** The destination for a completed sign-in or sign-up. */
export function postAuthDestination(
  mode: AuthMode,
  raw: string | null | undefined
): string {
  const next = safeNextPath(raw);
  const pathname = pathnameOf(next);
  if (TRANSIT_PATHS.has(pathname)) return HOME;
  if (mode === "signup" && SIGNUP_DEAD_ENDS.has(pathname)) return HOME;
  return next;
}
