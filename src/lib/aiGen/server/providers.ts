import "server-only";

import type { ProviderId } from "../catalog";

/**
 * Which providers this deployment can call — one server-only key each — and
 * the switches around generation. Keys never leave the server: the studio
 * only learns which *models* are available.
 */

const KEY_VARS: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  ideogram: "IDEOGRAM_API_KEY",
  bfl: "BFL_API_KEY",
  xai: "XAI_API_KEY",
  fal: "FAL_KEY",
  kie: "KIE_API_KEY",
};

export function providerKey(provider: ProviderId): string {
  const value = process.env[KEY_VARS[provider]];
  if (!value) throw new Error(`${KEY_VARS[provider]} is not set.`);
  return value;
}

export function configuredProviders(): ProviderId[] {
  return (Object.keys(KEY_VARS) as ProviderId[]).filter((p) => !!process.env[KEY_VARS[p]]);
}

/**
 * `AI_GENERATION`: `off` hides it, `admin` (the default) limits it to admins —
 * so keys can be added and everything tried before customers see a paid
 * feature — and `on` opens it to every signed-in customer.
 */
export type GenerationMode = "off" | "admin" | "on";

export function generationMode(): GenerationMode {
  const value = process.env.AI_GENERATION?.trim().toLowerCase();
  return value === "on" || value === "off" ? value : "admin";
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function generationLimits() {
  return {
    /** Requests per customer per rolling 24 h (admins are not limited). */
    perUserDaily: numberEnv("AI_GEN_DAILY_LIMIT", 25),
    /** Estimated US dollars per customer per rolling 24 h. */
    perUserDailyUsd: numberEnv("AI_GEN_USER_DAILY_USD", 1),
    /** Estimated US dollars across everyone per rolling 24 h — the wallet's backstop. */
    globalDailyUsd: numberEnv("AI_GEN_DAILY_BUDGET_USD", 10),
  };
}
