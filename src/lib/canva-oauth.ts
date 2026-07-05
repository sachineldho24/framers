/** Cookie names + options for carrying OAuth state across the Canva redirect. */
export const CANVA_OAUTH_COOKIES = {
  verifier: "canva_pkce_verifier",
  state: "canva_oauth_state",
  frameId: "canva_oauth_frame_id",
  sessionId: "canva_oauth_session_id",
} as const;

export const OAUTH_COOKIE_MAX_AGE = 600; // 10 minutes

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}
