import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/server";
import { DESIGN_BUCKET } from "@/lib/storage-shared";

import { EXTENSION_FOR, type ImageInfo } from "../imageInfo";
import type { GeneratedImage } from "../protocol";
import { generationLimits } from "./providers";

/**
 * Where generated pictures go, and the ledger that keeps spending in check.
 *
 * Results are stored like the customer's own uploads: content-addressed in
 * their folder of the design bucket. Finished pictures (a new creation, an
 * upscale…) also get a `user_uploads` row, so they're listed in Uploads next
 * time. Intermediate ones the studio still has to finish (a Replace it pastes
 * back through the mask) go to `ai/` without a row — the studio saves the
 * finished picture itself.
 *
 * `ai_generations` (migration 0016) is the ledger: one row per request, with
 * the estimated cost, which the daily limits are checked against.
 */

// Not in the generated `Database` types yet; the columns are listed in 0016.
function db(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient;
}

const SIGNED_URL_SECONDS = 60 * 60;

export class QuotaError extends Error {
  readonly status: number;
  constructor(message: string, status = 429) {
    super(message);
    this.status = status;
  }
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function upload(path: string, bytes: Uint8Array, mime: string) {
  const { error } = await db().storage.from(DESIGN_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  // Content-addressed: "already exists" is the very file we'd have written.
  if (error && !/exist|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ""}`)) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

async function sign(path: string, seconds: number) {
  const { data, error } = await db().storage.from(DESIGN_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) throw new Error(`Couldn’t sign the picture: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

/** Store a result for `userId`. `keep` also lists it in their photo library. */
export async function saveResult(
  userId: string,
  bytes: Uint8Array,
  info: ImageInfo,
  options: { keep: boolean; name: string }
): Promise<GeneratedImage> {
  const hash = sha256(bytes);
  const ext = EXTENSION_FOR[info.mime];
  const path = options.keep ? `${userId}/library/${hash}.${ext}` : `${userId}/ai/${hash}.${ext}`;
  await upload(path, bytes, info.mime);

  if (options.keep) {
    const { error } = await db()
      .from("user_uploads")
      .upsert(
        {
          user_id: userId,
          path,
          sha256: hash,
          name: options.name.slice(0, 120) || "AI image",
          width: info.width,
          height: info.height,
          bytes: bytes.byteLength,
          content_type: info.mime,
        },
        { onConflict: "user_id,sha256", ignoreDuplicates: true }
      );
    if (error) console.warn("[aiGen] stored but not listed:", error.message);
  }
  return { src: path, url: await sign(path, SIGNED_URL_SECONDS), width: info.width, height: info.height, contentType: info.mime };
}

/** A short-lived public link to an input picture, for providers that only take URLs. */
export async function inputUrl(userId: string, bytes: Uint8Array, mime: ImageInfo["mime"]): Promise<string> {
  const path = `${userId}/ai-input/${sha256(bytes)}.${EXTENSION_FOR[mime]}`;
  await upload(path, bytes, mime);
  return sign(path, 30 * 60);
}

/* ---------------------------------------------------------------- ledger */

interface LedgerRow {
  user_id: string;
  status: string;
  cost_usd: number | string;
  created_at: string;
}

const MISSING_TABLE = /relation .*ai_generations.* does not exist|Could not find the table|schema cache/i;

/**
 * Refuse the request if it would go over a limit; otherwise say how many
 * requests the user has left today (null for admins). Throws `QuotaError`.
 */
export async function checkQuota(userId: string, isAdmin: boolean, estimateUsd: number): Promise<number | null> {
  const limits = generationLimits();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from("ai_generations")
    .select("user_id, status, cost_usd, created_at")
    .gte("created_at", since)
    .neq("status", "error")
    .limit(10_000);
  if (error) {
    if (MISSING_TABLE.test(error.message)) {
      throw new QuotaError("AI generation isn’t set up yet: apply migration 0016_ai_generations.sql.", 503);
    }
    throw new QuotaError("Couldn’t check your AI allowance. Please try again.", 503);
  }
  const rows = (data ?? []) as LedgerRow[];
  const cost = (r: LedgerRow) => Number(r.cost_usd) || 0;

  const globalSpend = rows.reduce((sum, r) => sum + cost(r), 0);
  if (globalSpend + estimateUsd > limits.globalDailyUsd) {
    throw new QuotaError("AI tools have reached today’s limit. Please try again tomorrow.");
  }
  if (isAdmin) return null;

  const mine = rows.filter((r) => r.user_id === userId);
  const running = mine.some((r) => r.status === "running" && Date.now() - Date.parse(r.created_at) < 5 * 60 * 1000);
  if (running) throw new QuotaError("One AI request at a time — wait for the current one to finish.");
  if (mine.length >= limits.perUserDaily) {
    throw new QuotaError(`You’ve used today’s ${limits.perUserDaily} AI requests. They reset over the next 24 hours.`);
  }
  if (mine.reduce((sum, r) => sum + cost(r), 0) + estimateUsd > limits.perUserDailyUsd) {
    throw new QuotaError("That would go over today’s AI allowance. Try a cheaper model or quality, or come back tomorrow.");
  }
  return limits.perUserDaily - mine.length - 1;
}

export async function remainingToday(userId: string, isAdmin: boolean): Promise<number | null> {
  if (isAdmin) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db()
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since)
    .neq("status", "error");
  return Math.max(0, generationLimits().perUserDaily - (count ?? 0));
}

export async function logStart(row: { userId: string; task: string; model: string; estimateUsd: number }): Promise<string | null> {
  const { data, error } = await db()
    .from("ai_generations")
    .insert({ user_id: row.userId, task: row.task, model: row.model, cost_usd: row.estimateUsd, status: "running" })
    .select("id")
    .single();
  if (error) console.warn("[aiGen] ledger insert failed:", error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function logFinish(id: string | null, result: { ok: boolean; images?: number; costUsd?: number; error?: string }) {
  if (!id) return;
  const { error } = await db()
    .from("ai_generations")
    .update({
      status: result.ok ? "ok" : "error",
      images: result.images ?? 0,
      ...(result.costUsd !== undefined ? { cost_usd: result.costUsd } : {}),
      error: result.error?.slice(0, 500) ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.warn("[aiGen] ledger update failed:", error.message);
}
