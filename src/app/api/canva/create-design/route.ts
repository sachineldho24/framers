import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCanvaConfigured } from "@/lib/env";
import { getFrameById } from "@/lib/data/frames";
import { getValidAccessToken } from "@/lib/data/canva-tokens";
import {
  buildAuthorizeUrl,
  createDesign,
  withCorrelationState,
} from "@/lib/canva";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/pkce";
import {
  CANVA_OAUTH_COOKIES,
  oauthCookieOptions,
} from "@/lib/canva-oauth";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/canva/create-design  { frameId }
 *
 * - Not signed in            → 401
 * - No valid Canva token     → 200 { authUrl }  (client redirects to OAuth)
 * - Token OK                 → 200 { designId, editUrl }
 *
 * See plan/06-user-flows.md Flow 1 & 2.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("unauthorized", "Please sign in.", 401);

  let frameId: string;
  let sessionId: string | null = null;
  try {
    const body = (await request.json()) as {
      frameId?: string;
      sessionId?: string;
    };
    if (!body.frameId) throw new Error("missing frameId");
    frameId = body.frameId;
    sessionId = body.sessionId ?? null;
  } catch {
    return errorResponse("bad_request", "Missing frameId.", 400);
  }

  const frame = await getFrameById(frameId);
  if (!frame || !frame.is_active) {
    return errorResponse("not_found", "Frame not found.", 404);
  }

  // Canva integration not set up yet (no client id/secret) — fail clearly.
  if (!isCanvaConfigured()) {
    return errorResponse(
      "canva_unconfigured",
      "Designing in Canva isn't available yet. Please use the upload option for now.",
      503
    );
  }

  // Do we have a usable Canva token?
  const accessToken = await getValidAccessToken(user.id);

  if (!accessToken) {
    // Start OAuth. Stash PKCE verifier, state, and frameId in cookies.
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = generateState();
    const authUrl = buildAuthorizeUrl({ codeChallenge: challenge, state });

    const res = NextResponse.json({ authUrl });
    const opts = oauthCookieOptions();
    res.cookies.set(CANVA_OAUTH_COOKIES.verifier, verifier, opts);
    res.cookies.set(CANVA_OAUTH_COOKIES.state, state, opts);
    res.cookies.set(CANVA_OAUTH_COOKIES.frameId, frameId, opts);
    // Carry the designer session id (if any) so return navigation can land back
    // on the designer review step. correlation_state only fits ~50 chars, so we
    // stash it server-side via a cookie for the OAuth round-trip.
    if (sessionId) {
      res.cookies.set(CANVA_OAUTH_COOKIES.sessionId, sessionId, opts);
    }
    return res;
  }

  // We have a token → create the design directly.
  try {
    const design = await createDesign({
      accessToken,
      widthPx: frame.width_px,
      heightPx: frame.height_px,
      title: `${frame.name} — Framers`,
    });
    return NextResponse.json({
      designId: design.id,
      // Carry the session id (preferred) or frame id back via correlation_state.
      editUrl: withCorrelationState(design.editUrl, sessionId ?? frame.id),
    });
  } catch (e) {
    return errorResponse(
      "canva_error",
      e instanceof Error ? e.message : "Could not create design.",
      502
    );
  }
}
