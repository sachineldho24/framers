import "server-only";

import { providerKey } from "../providers";
import { ProviderError, fromBase64, postJson } from "../http";
import { nearestAspect, ratioOf } from "../../sizing";
import type { Adapter, AdapterInput, InputImage, OutputImage } from "../types";
import { highlightPrompt } from "../types";

/**
 * Gemini image models ("Nano Banana") through the Interactions API. One
 * picture per call, so a request for several runs them side by side. They take
 * no mask: Replace/Erase send the photo and a tinted copy marking the area.
 */

const URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const ASPECTS: Record<string, readonly string[]> = {
  "gemini-3.1-flash-image": ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"],
  "gemini-3-pro-image": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
  "gemini-3.1-flash-lite-image": ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
};

function imagePart(image: InputImage) {
  return { type: "image", mime_type: image.mime, data: Buffer.from(image.bytes).toString("base64") };
}

/** Every generated picture in the response's steps, however deeply nested. */
function findImages(value: unknown, out: OutputImage[] = []): OutputImage[] {
  if (Array.isArray(value)) {
    for (const v of value) findImages(v, out);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.type === "image" && typeof o.data === "string") out.push({ bytes: fromBase64(o.data) });
    else if (o.type === "image" && typeof o.uri === "string") out.push({ url: o.uri });
    else for (const v of Object.values(o)) findImages(v, out);
  }
  return out;
}

function buildInput(input: AdapterInput) {
  const parts: unknown[] = [];
  if ((input.task === "replace" || input.task === "erase") && input.image && input.highlight) {
    parts.push({ type: "text", text: highlightPrompt(input.prompt, input.task) });
    parts.push(imagePart(input.image), imagePart(input.highlight));
    return parts;
  }
  const pictures = [input.image, ...input.refs].filter((p): p is InputImage => !!p);
  const text =
    input.task === "edit" && pictures.length > 1
      ? `${input.prompt}\n\n(The first image is the one to edit; the others are references.)`
      : input.prompt;
  parts.push({ type: "text", text });
  for (const p of pictures) parts.push(imagePart(p));
  return parts;
}

export const google: Adapter = async (input) => {
  const model = input.model.id.slice("google:".length);
  const headers = { "x-goog-api-key": providerKey("google") };
  const responseFormat: Record<string, string> = { type: "image", mime_type: "image/png" };
  // An edit keeps the photo's own shape unless asked otherwise.
  if (input.aspect && (input.task === "create" || input.task === "edit")) {
    responseFormat.aspect_ratio = nearestAspect(ratioOf(input.aspect), ASPECTS[model] ?? ASPECTS["gemini-3-pro-image"]);
  }
  if (input.resolution && input.model.resolutions?.[input.resolution] !== undefined) {
    responseFormat.image_size = input.resolution;
  }
  const body = { model, input: buildInput(input), response_format: responseFormat, store: false };

  const count = Math.max(1, Math.min(input.model.maxImages, input.count));
  const results = await Promise.allSettled(
    Array.from({ length: count }, () => postJson<{ steps?: unknown }>(URL, body, headers, "Google", input.deadline - Date.now()))
  );
  const images = results.flatMap((r) => (r.status === "fulfilled" ? findImages(r.value.steps ?? r.value) : []));
  if (images.length === 0) {
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failure) throw failure.reason;
    throw new ProviderError("Google didn’t return a picture — it may have declined the prompt. Try rewording it.", 422, true);
  }
  return { images };
};
