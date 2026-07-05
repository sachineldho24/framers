import { NextResponse, type NextRequest } from "next/server";
import * as jose from "jose";
import { serverEnv, isCanvaConfigured } from "@/lib/env";
import { CANVA_JWKS_URL } from "@/lib/canva";
import {
  getDesignSession,
  updateDesignSession,
} from "@/lib/data/design-sessions";

/**
 * GET /api/canva/return?correlation_jwt=...
 *
 * Canva's "Return to Framers" button (return navigation) sends the user here
 * after they finish designing. The correlation_jwt is signed by Canva and
 * carries the design_id + the correlation_state we set (the frame id).
 *
 * We verify the JWT against Canva's public keys, then forward the user to the
 * export screen. See docs/canva-connect-api-docs.md §12.
 */

// Cache Canva's JWKS across requests.
const JWKS = jose.createRemoteJWKSet(new URL(CANVA_JWKS_URL));

export async function GET(request: NextRequest) {
  const jwt = request.nextUrl.searchParams.get("correlation_jwt");

  function fail(code: string) {
    return NextResponse.redirect(new URL(`/?error=${code}`, request.url));
  }

  if (!isCanvaConfigured()) return fail("canva_unconfigured");
  if (!jwt) return fail("return_failed");

  try {
    const { payload } = await jose.jwtVerify(jwt, JWKS, {
      audience: serverEnv.canvaClientId,
    });

    // type "rti" = return-to-integration. Reject anything else.
    if (payload.type !== "rti") return fail("return_failed");

    const designId = payload.design_id as string | undefined;
    const correlation = payload.correlation_state as string | undefined;
    if (!designId) return fail("return_failed");

    // Designer flow: correlation_state is a design_sessions id. Record the Canva
    // design id on the session and land the user on the review step.
    if (correlation) {
      const session = await getDesignSession(correlation).catch(() => null);
      if (session) {
        await updateDesignSession(correlation, {
          canva_design_id: designId,
        }).catch(() => null);
        return NextResponse.redirect(
          new URL(`/design/${correlation}/review`, request.url)
        );
      }
    }

    // Legacy flow: correlation_state is a frame id → old export screen.
    const dest = new URL(`/design/export/${designId}`, request.url);
    if (correlation) dest.searchParams.set("frameId", correlation);
    return NextResponse.redirect(dest);
  } catch (e) {
    console.error("[canva/return] JWT verification failed:", e);
    return fail("return_failed");
  }
}
