import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFrameById } from "@/lib/data/frames";
import { upsertCanvaToken } from "@/lib/data/canva-tokens";
import {
  exchangeCodeForTokens,
  createDesign,
  withCorrelationState,
} from "@/lib/canva";
import { CANVA_OAUTH_COOKIES } from "@/lib/canva-oauth";

/**
 * GET /api/canva/callback?code=&state=  (or ?error=)
 *
 * Completes OAuth, stores tokens, creates the design, then redirects the user to
 * the design page. See plan/06-user-flows.md Flow 1 (steps 11–18).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;

  // Safety net: if a return-navigation token lands here (Return URL misconfigured
  // to point at /callback instead of /return), forward it to the return handler
  // instead of failing the OAuth state check.
  const correlationJwt = url.searchParams.get("correlation_jwt");
  if (correlationJwt && !url.searchParams.get("code")) {
    const returnUrl = new URL("/api/canva/return", request.url);
    returnUrl.searchParams.set("correlation_jwt", correlationJwt);
    return NextResponse.redirect(returnUrl);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const verifier = request.cookies.get(CANVA_OAUTH_COOKIES.verifier)?.value;
  const expectedState = request.cookies.get(CANVA_OAUTH_COOKIES.state)?.value;
  const frameId = request.cookies.get(CANVA_OAUTH_COOKIES.frameId)?.value;
  const sessionId = request.cookies.get(CANVA_OAUTH_COOKIES.sessionId)?.value;

  // Resolve where to send the user back to on error (frame page if we can).
  async function redirectTo(path: string): Promise<NextResponse> {
    const res = NextResponse.redirect(new URL(path, request.url));
    // Clear OAuth cookies.
    for (const name of Object.values(CANVA_OAUTH_COOKIES)) {
      res.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    return res;
  }

  async function frameErrorPath(errCode: string): Promise<string> {
    if (frameId) {
      const frame = await getFrameById(frameId);
      if (frame) return `/frames/${frame.slug}?error=${errCode}`;
    }
    return `/?error=${errCode}`;
  }

  // User denied consent or Canva returned an error. Common in Testing mode:
  // error=access_denied when the Canva account isn't part of the developer team.
  if (oauthError) {
    console.error("[canva/callback] Canva returned an OAuth error", {
      error: oauthError,
      description: url.searchParams.get("error_description"),
      host: request.nextUrl.host,
    });
    return redirectTo(await frameErrorPath("canva_denied"));
  }

  // CSRF / integrity checks. Log which specific part is missing so we can tell
  // a cookie-domain problem (localhost vs 127.0.0.1) from a real CSRF mismatch.
  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    console.error("[canva/callback] integrity check failed", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasVerifierCookie: Boolean(verifier),
      hasStateCookie: Boolean(expectedState),
      stateMatches: state === expectedState,
      host: request.nextUrl.host,
      hint:
        !verifier || !expectedState
          ? "OAuth cookies missing — usually means you started on a DIFFERENT host than the callback (use http://127.0.0.1:3000, not localhost)."
          : "state mismatch",
    });
    return redirectTo(await frameErrorPath("auth_state_failed"));
  }

  // Must still be signed in to associate the token.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectTo("/login?next=/");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier });
    await upsertCanvaToken({ userId: user.id, tokens });
  } catch (e) {
    console.error("[canva/callback] token exchange failed:", e);
    return redirectTo(await frameErrorPath("auth_token_failed"));
  }

  try {
    if (!frameId) return redirectTo(await frameErrorPath("design_failed"));
    const frame = await getFrameById(frameId);
    if (!frame) return redirectTo(await frameErrorPath("design_failed"));

    const design = await createDesign({
      accessToken: tokens.access_token,
      widthPx: frame.width_px,
      heightPx: frame.height_px,
      title: `${frame.name} — Framers`,
    });

    // Send the user into the Canva editor to actually design. They come back via
    // return navigation (the "Return to Framers" button) → /api/canva/return.
    // Carry the designer session id if present, else the frame id.
    const res = NextResponse.redirect(
      withCorrelationState(design.editUrl, sessionId ?? frame.id)
    );
    for (const name of Object.values(CANVA_OAUTH_COOKIES)) {
      res.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    return res;
  } catch (e) {
    console.error("[canva/callback] design creation failed:", e);
    return redirectTo(await frameErrorPath("design_failed"));
  }
}
