import { createHash, randomBytes } from "node:crypto";

/**
 * PKCE (RFC 7636) + state helpers for the Canva OAuth flow.
 * Server-only (uses node:crypto). See plan/01-canva-api-reality.md.
 */

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** High-entropy code verifier (43–128 chars). */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(64));
}

/** S256 challenge derived from the verifier. */
export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** Random CSRF state token for the authorize request. */
export function generateState(): string {
  return base64url(randomBytes(24));
}
