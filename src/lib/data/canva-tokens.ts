import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { refreshTokens, type CanvaTokenResponse } from "@/lib/canva";
import type { CanvaToken } from "@/lib/supabase/types";

/** Refresh a token this many seconds before its real expiry, to avoid races. */
const EXPIRY_BUFFER_SECONDS = 120;

/** Read the stored Canva token row for a user (service role — bypasses RLS). */
export async function getCanvaToken(
  userId: string
): Promise<CanvaToken | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("canva_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to read Canva token: ${error.message}`);
  return data;
}

/** Persist tokens from an OAuth exchange or refresh. */
export async function upsertCanvaToken(params: {
  userId: string;
  tokens: CanvaTokenResponse;
  canvaUserId?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const expiresAt = new Date(
    Date.now() + params.tokens.expires_in * 1000
  ).toISOString();

  const { error } = await supabase.from("canva_tokens").upsert(
    {
      user_id: params.userId,
      access_token: params.tokens.access_token,
      refresh_token: params.tokens.refresh_token,
      expires_at: expiresAt,
      canva_user_id: params.canvaUserId ?? null,
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(`Failed to store Canva token: ${error.message}`);
}

/**
 * Return a valid access token for the user, refreshing if needed.
 * Returns null if there is no token or the refresh token is invalid
 * (caller should then start the OAuth flow).
 */
export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const token = await getCanvaToken(userId);
  if (!token) return null;

  const expiresMs = new Date(token.expires_at).getTime();
  const stillValid = expiresMs - EXPIRY_BUFFER_SECONDS * 1000 > Date.now();
  if (stillValid) return token.access_token;

  // Access token expired → try to refresh.
  try {
    const refreshed = await refreshTokens(token.refresh_token);
    await upsertCanvaToken({
      userId,
      tokens: refreshed,
      canvaUserId: token.canva_user_id,
    });
    return refreshed.access_token;
  } catch {
    return null; // refresh token invalid/revoked → re-auth required
  }
}
