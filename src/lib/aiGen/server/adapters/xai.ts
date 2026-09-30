import "server-only";

import { providerKey } from "../providers";
import { fromBase64, postJson } from "../http";
import { nearestAspect, ratioOf } from "../../sizing";
import type { Adapter, InputImage } from "../types";
import { dataUrl, highlightPrompt } from "../types";

/**
 * xAI Grok Imagine: OpenAI-style JSON endpoints. Edits take pictures as data
 * URLs (up to five for multi-image edits). No mask, so Replace goes through
 * the tinted-copy instruction.
 */

const BASE = "https://api.x.ai/v1/images";
const ASPECTS = ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "9:19.5", "19.5:9", "9:20", "20:9", "1:2", "2:1", "21:9", "5:2"];

interface XaiResponse {
  data?: { b64_json?: string | null; url?: string | null }[];
}

export const xai: Adapter = async (input) => {
  const headers = { Authorization: `Bearer ${providerKey("xai")}` };
  const common: Record<string, unknown> = {
    model: input.model.id.slice("xai:".length),
    n: Math.max(1, Math.min(input.model.maxImages, input.count)),
    response_format: "b64_json",
    resolution: input.resolution === "2K" ? "2k" : "1k",
  };

  let prompt = input.prompt;
  let pictures = [input.image, ...input.refs].filter((p): p is InputImage => !!p);
  if ((input.task === "replace" || input.task === "erase") && input.image && input.highlight) {
    prompt = highlightPrompt(input.prompt, input.task);
    pictures = [input.image, input.highlight];
  }
  if (input.aspect && (pictures.length === 0 || input.task === "edit")) {
    common.aspect_ratio = nearestAspect(ratioOf(input.aspect), ASPECTS);
  }

  const res =
    pictures.length === 0
      ? await postJson<XaiResponse>(`${BASE}/generations`, { ...common, prompt }, headers, "xAI", input.deadline - Date.now())
      : await postJson<XaiResponse>(
          `${BASE}/edits`,
          {
            ...common,
            prompt,
            ...(pictures.length === 1
              ? { image: { url: dataUrl(pictures[0]), type: "image_url" } }
              : { images: pictures.slice(0, 5).map((p) => ({ url: dataUrl(p), type: "image_url" })) }),
          },
          headers,
          "xAI",
          input.deadline - Date.now()
        );
  return {
    images: (res.data ?? []).map((d) => (d.b64_json ? { bytes: fromBase64(d.b64_json) } : { url: d.url ?? undefined })).filter((i) => i.bytes || i.url),
  };
};
