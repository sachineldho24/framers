import "server-only";

import { providerKey } from "../providers";
import { fromBase64, postForm, postJson } from "../http";
import { TIER_MEGAPIXELS, nearestAspect, ratioOf, sizeFor } from "../../sizing";
import type { Adapter, AdapterInput } from "../types";
import { fileName, toBlob } from "../types";

/**
 * OpenAI Images API: `generations` for text → image, `edits` for everything
 * that starts from a picture (references as `image[]`, the mask as an
 * alpha-channel PNG where transparent means "change this").
 */

const BASE = "https://api.openai.com/v1/images";
const LEGACY_SIZES = ["1024x1024", "1536x1024", "1024x1536"];

interface ImagesResponse {
  data?: { b64_json?: string; url?: string }[];
}

function modelName(input: AdapterInput) {
  return input.model.id.slice("openai:".length);
}

/** GPT Image 2.x takes any size on a 16 px grid, 1:3 to 3:1, up to 3840 px and 8.3 MP. */
function sizeParam(input: AdapterInput, ratio: number | null): string {
  if (ratio === null) return "auto";
  if (modelName(input) === "gpt-image-1-mini") {
    return LEGACY_SIZES[["1:1", "3:2", "2:3"].indexOf(nearestAspect(ratio, ["1:1", "3:2", "2:3"]))];
  }
  const clamped = Math.min(3, Math.max(1 / 3, ratio));
  const mp = TIER_MEGAPIXELS[input.resolution ?? "1K"];
  const { width, height } = sizeFor(clamped, mp, { multiple: 16, maxEdge: 3840, minPixels: 655_360, maxPixels: 8_294_400 });
  return `${width}x${height}`;
}

function quality(input: AdapterInput): string | undefined {
  return input.quality && input.model.qualities?.[input.quality] !== undefined ? input.quality : undefined;
}

function collect(res: ImagesResponse) {
  return (res.data ?? []).map((d) => (d.b64_json ? { bytes: fromBase64(d.b64_json) } : { url: d.url }));
}

export const openai: Adapter = async (input) => {
  const headers = { Authorization: `Bearer ${providerKey("openai")}` };
  const transparent = input.task === "sticker";
  const common = {
    model: modelName(input),
    n: Math.max(1, Math.min(input.model.maxImages, input.count)),
    quality: quality(input),
    background: transparent ? "transparent" : undefined,
    output_format: transparent ? "png" : "png",
  };

  const pictures = [input.image, ...input.refs].filter((p) => !!p);
  if (pictures.length === 0) {
    const ratio = ratioOf(input.aspect ?? "1:1");
    const res = await postJson<ImagesResponse>(
      `${BASE}/generations`,
      { ...common, prompt: input.prompt, size: sizeParam(input, ratio) },
      headers,
      "OpenAI",
      input.deadline - Date.now()
    );
    return { images: collect(res) };
  }

  const form = new FormData();
  form.set("model", common.model);
  form.set("n", String(common.n));
  if (common.quality) form.set("quality", common.quality);
  if (common.background) form.set("background", common.background);
  form.set("output_format", common.output_format);

  let prompt = input.prompt;
  if (input.task === "expand") {
    prompt =
      prompt.trim() ||
      "Extend the scene naturally into the transparent areas around the picture, continuing the setting, lighting and perspective. Do not change the existing picture.";
  } else if (input.task === "erase") {
    prompt = "Remove the object in the masked area and fill it naturally with what would be behind it.";
  }
  form.set("prompt", prompt);
  // Edits keep the picture's own shape unless a new one was asked for.
  form.set("size", input.aspect && input.task !== "replace" && input.task !== "expand" ? sizeParam(input, ratioOf(input.aspect)) : "auto");

  pictures.forEach((p, i) => form.append("image[]", toBlob(p), fileName(p, `image-${i}`)));
  if (input.mask && (input.task === "replace" || input.task === "erase" || input.task === "expand")) {
    form.set("mask", toBlob(input.mask), fileName(input.mask, "mask"));
  }
  const res = await postForm<ImagesResponse>(`${BASE}/edits`, form, headers, "OpenAI");
  return { images: collect(res) };
};
