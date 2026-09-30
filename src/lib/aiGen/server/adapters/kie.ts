import "server-only";

import { publicEnv } from "@/lib/env";

import { providerKey } from "../providers";
import { ProviderError, getJson, poll, postJson } from "../http";
import { nearestAspect, ratioOf } from "../../sizing";
import type { Adapter, AdapterInput, InputImage } from "../types";
import { highlightPrompt } from "../types";

/**
 * Kie.ai: a reseller with lower prices on the big models. Every model is a
 * task: `createTask`, then poll `recordInfo` until `state` is success. Inputs
 * must be URLs, so pictures go through a short-lived signed link to a copy in
 * our storage. Kie wants a callback URL; ours is a no-op — we poll.
 */

const BASE = "https://api.kie.ai/api/v1/jobs";

interface KieEnvelope<T> {
  code?: number;
  msg?: string;
  data?: T;
}
interface TaskRecord {
  state?: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson?: string;
  failMsg?: string;
}

const BANANA_ASPECTS = ["1:1", "2:3", "3:2", "1:4", "4:1", "3:4", "4:3", "4:5", "5:4", "1:8", "8:1", "9:16", "16:9", "21:9"];
const BANANA_PRO_ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const SEEDREAM_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"];
const GPT_ASPECTS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];

function unwrap<T>(res: KieEnvelope<T>): T {
  if (res.code !== undefined && res.code !== 200) {
    const refused = res.code === 422 || /safety|nsfw|sensitive|policy/i.test(res.msg ?? "");
    throw new ProviderError(`Kie: ${res.msg ?? `error ${res.code}`}`, res.code === 429 ? 429 : refused ? 422 : 502, refused);
  }
  if (res.data === undefined) throw new ProviderError("Kie returned nothing.", 502);
  return res.data;
}

async function runTask(model: string, taskInput: Record<string, unknown>, deadline: number): Promise<string[]> {
  const headers = { Authorization: `Bearer ${providerKey("kie")}` };
  const created = unwrap(
    await postJson<KieEnvelope<{ taskId?: string }>>(
      `${BASE}/createTask`,
      { model, callBackUrl: `${publicEnv.appUrl.replace(/\/$/, "")}/api/studio/ai/callback`, input: taskInput },
      headers,
      "Kie",
      60_000
    )
  );
  if (!created.taskId) throw new ProviderError("Kie didn’t accept the request.", 502);

  return poll<string[]>(
    async () => {
      const record = unwrap(await getJson<KieEnvelope<TaskRecord>>(`${BASE}/recordInfo?taskId=${encodeURIComponent(created.taskId!)}`, headers, "Kie"));
      if (record.state === "success") {
        const parsed = JSON.parse(record.resultJson || "{}") as { resultUrls?: string[] };
        if (!parsed.resultUrls?.length) throw new ProviderError("Kie finished without a picture.", 502);
        return parsed.resultUrls;
      }
      if (record.state === "fail") {
        const message = record.failMsg || "Kie couldn’t make this picture.";
        throw new ProviderError(message, 502, /safety|nsfw|sensitive|policy/i.test(message));
      }
      return undefined;
    },
    "Kie",
    deadline,
    1500
  );
}

async function inputsFor(input: AdapterInput): Promise<{ prompt: string; urls: string[] }> {
  if ((input.task === "replace" || input.task === "erase") && input.image && input.highlight) {
    return {
      prompt: highlightPrompt(input.prompt, input.task),
      urls: await Promise.all([input.image, input.highlight].map((p) => input.publicUrl(p))),
    };
  }
  const pictures = [input.image, ...input.refs].filter((p): p is InputImage => !!p);
  return { prompt: input.prompt, urls: await Promise.all(pictures.map((p) => input.publicUrl(p))) };
}

export const kie: Adapter = async (input) => {
  const name = input.model.id.slice("kie:".length);
  const aspectOr = (list: string[], fallback: string) =>
    input.aspect && (input.task === "create" || input.task === "sticker" || input.task === "edit") ? nearestAspect(ratioOf(input.aspect), list) : fallback;

  let urls: string[];
  switch (name) {
    case "nano-banana-2":
    case "nano-banana-pro": {
      const { prompt, urls: images } = await inputsFor(input);
      urls = await runTask(
        name,
        {
          prompt,
          image_input: images,
          aspect_ratio: aspectOr(name === "nano-banana-2" ? BANANA_ASPECTS : BANANA_PRO_ASPECTS, images.length ? "auto" : "1:1"),
          resolution: input.resolution ?? "1K",
          output_format: "png",
        },
        input.deadline
      );
      break;
    }
    case "seedream-5-pro": {
      const { prompt, urls: images } = await inputsFor(input);
      const quality = input.quality === "high" ? "high" : "basic";
      urls = images.length
        ? await runTask(
            "seedream/5-pro-image-to-image",
            { prompt, image_urls: images, aspect_ratio: aspectOr(SEEDREAM_ASPECTS, "1:1"), quality, output_format: "png" },
            input.deadline
          )
        : await runTask("seedream/5-pro-text-to-image", { prompt, aspect_ratio: aspectOr(SEEDREAM_ASPECTS, "1:1"), quality, output_format: "png" }, input.deadline);
      break;
    }
    case "gpt-image-2.5-flare":
    case "gpt-image-2.5-sunburst": {
      const v = name.endsWith("flare") ? "flare" : "sunburst";
      const { prompt, urls: images } = await inputsFor(input);
      const resolution = input.resolution ?? "1K";
      urls = images.length
        ? await runTask(`gpt-image-2-5-${v}-image-to-image`, { prompt, input_urls: images, aspect_ratio: aspectOr(GPT_ASPECTS, "auto"), resolution }, input.deadline)
        : await runTask(
            `gpt-image-2-5-${v}-text-to-image`,
            { prompt, aspect_ratio: aspectOr(GPT_ASPECTS, "1:1"), resolution, ...(input.task === "sticker" ? { background: "transparent" } : {}) },
            input.deadline
          );
      break;
    }
    case "topaz-upscale": {
      if (!input.image) throw new ProviderError("Select a photo first.", 400);
      urls = await runTask("topaz/image-upscale", { image_url: await input.publicUrl(input.image), upscale_factor: String(input.factor ?? 2) }, input.deadline);
      break;
    }
    default:
      throw new ProviderError(`Unknown Kie model ${name}.`, 400);
  }
  return { images: urls.map((u) => ({ url: u })) };
};
