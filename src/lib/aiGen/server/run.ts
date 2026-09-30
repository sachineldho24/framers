import "server-only";

import type { AiModel, ProviderId } from "../catalog";
import { imageInfo } from "../imageInfo";
import type { GeneratedImage, GeneratedLayer } from "../protocol";
import { bfl } from "./adapters/bfl";
import { fal } from "./adapters/fal";
import { google } from "./adapters/google";
import { ideogram } from "./adapters/ideogram";
import { kie } from "./adapters/kie";
import { openai } from "./adapters/openai";
import { xai } from "./adapters/xai";
import { ProviderError, download } from "./http";
import { saveResult } from "./store";
import type { Adapter, AdapterInput } from "./types";

const ADAPTERS: Record<ProviderId, Adapter> = { openai, google, ideogram, bfl, xai, fal, kie };

/** Tasks whose result is finished as it comes back (the rest the studio pastes back itself). */
const FINISHED_TASKS = new Set(["create", "sticker", "edit", "upscale", "removeBg", "layerize"]);

export interface RunResult {
  images: GeneratedImage[];
  layers?: GeneratedLayer[];
  costUsd?: number;
}

/** Call the model, fetch what it made, and store every picture for `userId`. */
export async function runGeneration(model: AiModel, input: AdapterInput, userId: string): Promise<RunResult> {
  const output = await ADAPTERS[model.provider](input);
  if (output.images.length === 0) throw new ProviderError("The model didn’t return a picture. Try again or reword the prompt.", 502);

  const keep = FINISHED_TASKS.has(input.task);
  const name = (input.prompt || model.label).replace(/\s+/g, " ").trim().slice(0, 60);
  const provider = model.label;

  const images = await Promise.all(
    output.images.map(async (out, i) => {
      const bytes = out.bytes ?? (out.url ? await download(out.url, provider) : null);
      if (!bytes) throw new ProviderError(`${provider} returned an empty result.`, 502);
      const info = imageInfo(bytes);
      if (!info || info.width < 8 || info.height < 8) throw new ProviderError(`${provider} returned something that isn’t a picture.`, 502);
      const label = input.task === "layerize" ? (i === 0 ? `${name} – background` : output.layers?.[i - 1]?.name ?? `${name} – layer ${i}`) : `AI: ${name}`;
      return saveResult(userId, bytes, info, { keep, name: label });
    })
  );

  let layers: GeneratedLayer[] | undefined;
  if (output.layers) {
    layers = output.layers.map((l, i) => ({ image: images[i + 1], name: l.name, box: l.box, z: l.z })).filter((l) => !!l.image);
  }
  return { images, layers, costUsd: output.costUsd };
}
