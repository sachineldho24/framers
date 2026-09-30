"use client";

/**
 * The studio's side of `/api/studio/ai/*`: which models are available, and
 * one generation request. Pictures are prepared by `prepare.ts` first.
 */

import type { AiErrorBody, AiGenerateRequest, AiGenerateResponse, AiModelsResponse } from "./protocol";

export class AiGenError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AiGenError";
    this.code = code;
  }
}

let modelsPromise: Promise<AiModelsResponse> | null = null;

/** Cached for the session; `refresh` asks again (after a request, for the count left). */
export function fetchAiModels(refresh = false): Promise<AiModelsResponse> {
  if (!modelsPromise || refresh) {
    modelsPromise = fetch("/api/studio/ai/models", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<AiModelsResponse>) : Promise.reject(new Error(String(res.status)))))
      .catch(() => {
        modelsPromise = null;
        return { enabled: false, reason: "Couldn’t reach the AI service. Check your connection.", models: [], remaining: null };
      });
  }
  return modelsPromise;
}

export interface AiFiles {
  image?: Blob;
  refs?: Blob[];
  mask?: Blob;
  highlight?: Blob;
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const name = (blob: Blob, base: string) => `${base}.${EXT[blob.type] ?? "png"}`;

export async function requestGeneration(request: AiGenerateRequest, files: AiFiles, signal?: AbortSignal): Promise<AiGenerateResponse> {
  const form = new FormData();
  form.set("request", JSON.stringify(request));
  if (files.image) form.set("image", files.image, name(files.image, "image"));
  for (const [i, ref] of (files.refs ?? []).entries()) form.append("ref", ref, name(ref, `ref-${i}`));
  if (files.mask) form.set("mask", files.mask, name(files.mask, "mask"));
  if (files.highlight) form.set("highlight", files.highlight, name(files.highlight, "highlight"));

  let res: Response;
  try {
    res = await fetch("/api/studio/ai/generate", { method: "POST", body: form, signal });
  } catch {
    if (signal?.aborted) throw new AiGenError("Stopped.", "aborted");
    throw new AiGenError("Couldn’t reach the AI service. Check your connection and try again.", "network");
  }
  if (res.status === 413) throw new AiGenError("The photo is too large to send. Try a smaller one.", "too_large");
  const body = (await res.json().catch(() => null)) as AiGenerateResponse | AiErrorBody | null;
  if (!res.ok || !body || "error" in body) {
    const error = body && "error" in body ? body.error : null;
    throw new AiGenError(error?.message ?? "Something went wrong while generating. Please try again.", error?.code ?? "server_error");
  }
  return body;
}
