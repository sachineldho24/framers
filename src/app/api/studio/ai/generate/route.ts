/**
 * POST /api/studio/ai/generate — run one generative request for the studio.
 *
 * Multipart (see `src/lib/aiGen/protocol.ts`): the request as JSON plus the
 * pictures the studio prepared. In order: same-origin and sign-in, the
 * AI_GENERATION switch, the request checked against the model catalogue, the
 * pictures measured, the daily limits checked against the ledger, then the
 * provider call. Results are stored in the user's own storage folder and come
 * back as paths plus signed URLs — never as bytes, which keeps responses small.
 *
 * Provider keys stay on this side; the browser never sees them.
 */

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-server";
import {
  ASPECTS,
  TASK_LABELS,
  estimateCost,
  findModel,
  type AiTask,
  type QualityId,
  type ResolutionId,
} from "@/lib/aiGen/catalog";
import { imageInfo } from "@/lib/aiGen/imageInfo";
import type { AiErrorBody, AiGenerateRequest, AiGenerateResponse } from "@/lib/aiGen/protocol";
import { generationAccess } from "@/lib/aiGen/server/access";
import { DEADLINE_MS, ProviderError } from "@/lib/aiGen/server/http";
import { configuredProviders } from "@/lib/aiGen/server/providers";
import { runGeneration } from "@/lib/aiGen/server/run";
import { QuotaError, checkQuota, inputUrl, logFinish, logStart } from "@/lib/aiGen/server/store";
import type { InputImage } from "@/lib/aiGen/server/types";
import { CrossOriginError, sameOrigin } from "@/lib/sameOrigin";

export const runtime = "nodejs";
/** Generation can take a minute or two; polling providers stop at DEADLINE_MS. */
export const maxDuration = 300;

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT = 4000;

function err(code: string, message: string, status: number) {
  return NextResponse.json<AiErrorBody>({ error: { code, message } }, { status });
}

async function readImage(value: FormDataEntryValue | null, what: string): Promise<InputImage | undefined> {
  if (value === null) return undefined;
  if (typeof value === "string") throw new ProviderError(`The ${what} wasn’t sent as a file.`, 400);
  if (value.size === 0 || value.size > MAX_FILE_BYTES) throw new ProviderError(`The ${what} is empty or too large.`, 400);
  const bytes = new Uint8Array(await value.arrayBuffer());
  const info = imageInfo(bytes);
  if (!info || info.mime === "image/gif") throw new ProviderError(`The ${what} isn’t a PNG, JPEG or WebP picture.`, 400);
  return { ...info, bytes };
}

function parseRequest(raw: FormDataEntryValue | null): AiGenerateRequest {
  if (typeof raw !== "string") throw new ProviderError("Missing request.", 400);
  let body: AiGenerateRequest;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ProviderError("Malformed request.", 400);
  }
  if (!body || typeof body !== "object" || typeof body.model !== "string" || !(body.task in TASK_LABELS)) {
    throw new ProviderError("Malformed request.", 400);
  }
  return body;
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
  } catch (e) {
    if (e instanceof CrossOriginError) return err("forbidden", e.message, 403);
    throw e;
  }

  const user = await getCurrentUser();
  const access = generationAccess(user);
  if (!access.ok) return err("forbidden", access.reason, access.status);
  const userId = user!.id;

  let ledgerId: string | null = null;
  try {
    const form = await request.formData();
    const body = parseRequest(form.get("request"));
    const task = body.task as AiTask;
    const model = findModel(body.model);
    if (!model || !model.tasks.includes(task)) throw new ProviderError("That model can’t do this.", 400);
    if (!configuredProviders().includes(model.provider)) throw new ProviderError("That model isn’t available.", 400);

    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
    const needs = TASK_LABELS[task];
    if (needs.needsPrompt && !prompt) throw new ProviderError("Describe what you want first.", 400);

    const image = await readImage(form.get("image"), "photo");
    const mask = await readImage(form.get("mask"), "selection");
    const highlight = await readImage(form.get("highlight"), "selection preview");
    const refs = (await Promise.all(form.getAll("ref").slice(0, model.maxRefs).map((r, i) => readImage(r, `reference ${i + 1}`)))).filter(
      (r): r is InputImage => !!r
    );
    if (needs.needsImage && !image) throw new ProviderError("Select a photo first.", 400);
    if (needs.needsMask && !mask && !highlight) throw new ProviderError("Select the object first.", 400);

    const quality = body.quality && model.qualities?.[body.quality as QualityId] !== undefined ? (body.quality as QualityId) : undefined;
    const resolution =
      body.resolution && model.resolutions?.[body.resolution as ResolutionId] !== undefined ? (body.resolution as ResolutionId) : undefined;
    const aspect = body.aspect && (ASPECTS as readonly string[]).includes(body.aspect) ? body.aspect : undefined;
    const count = Math.max(1, Math.min(model.maxImages, Math.round(Number(body.count) || 1)));
    const factor = model.upscale?.includes(Number(body.factor)) ? Number(body.factor) : model.upscale?.[0];
    const padding =
      task === "expand" && body.padding
        ? {
            left: Math.max(0, Math.round(Number(body.padding.left) || 0)),
            top: Math.max(0, Math.round(Number(body.padding.top) || 0)),
            right: Math.max(0, Math.round(Number(body.padding.right) || 0)),
            bottom: Math.max(0, Math.round(Number(body.padding.bottom) || 0)),
          }
        : undefined;
    if (task === "expand" && model.expandMode !== "mask" && (!padding || padding.left + padding.top + padding.right + padding.bottom === 0)) {
      throw new ProviderError("Choose a new shape to expand to.", 400);
    }

    const estimateUsd = estimateCost(model, { quality, resolution, count });
    const remaining = await checkQuota(userId, access.admin, estimateUsd);
    ledgerId = await logStart({ userId, task, model: model.id, estimateUsd });

    const result = await runGeneration(
      model,
      {
        model,
        task,
        prompt,
        aspect,
        quality,
        resolution,
        count,
        factor,
        padding,
        image,
        refs,
        mask,
        highlight,
        deadline: Date.now() + DEADLINE_MS,
        publicUrl: (picture) => inputUrl(userId, picture.bytes, picture.mime),
      },
      userId
    );
    const costUsd = result.costUsd ?? estimateUsd;
    await logFinish(ledgerId, { ok: true, images: result.images.length, costUsd });

    return NextResponse.json<AiGenerateResponse>(
      { images: result.images, layers: result.layers, costUsd, remaining },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    await logFinish(ledgerId, { ok: false, error: message });
    if (error instanceof QuotaError) return err("limit", error.message, error.status);
    if (error instanceof ProviderError) return err(error.refused ? "refused" : "provider", error.message, error.status);
    console.error("[aiGen] generate failed:", error);
    return err("server_error", "Something went wrong while generating. Please try again.", 500);
  }
}
