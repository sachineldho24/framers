/**
 * GET /api/studio/ai/models — which generative models this user can use.
 *
 * Only ids: the catalogue itself (labels, prices, abilities) ships with the
 * studio. A model is listed when its provider's key is set on the server.
 */

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-server";
import { MODELS } from "@/lib/aiGen/catalog";
import type { AiModelsResponse } from "@/lib/aiGen/protocol";
import { generationAccess } from "@/lib/aiGen/server/access";
import { configuredProviders } from "@/lib/aiGen/server/providers";
import { remainingToday } from "@/lib/aiGen/server/store";

export async function GET() {
  const user = await getCurrentUser();
  const access = generationAccess(user);
  const noStore = { headers: { "Cache-Control": "no-store" } };
  if (!access.ok) {
    return NextResponse.json<AiModelsResponse>({ enabled: false, reason: access.reason, models: [], remaining: null }, noStore);
  }
  const providers = new Set(configuredProviders());
  const models = MODELS.filter((m) => providers.has(m.provider)).map((m) => m.id);
  if (models.length === 0) {
    return NextResponse.json<AiModelsResponse>(
      { enabled: false, reason: "No AI provider is set up yet (add an API key on the server).", models: [], remaining: null },
      noStore
    );
  }
  const remaining = await remainingToday(user!.id, access.admin).catch(() => null);
  return NextResponse.json<AiModelsResponse>({ enabled: true, models, remaining }, noStore);
}
