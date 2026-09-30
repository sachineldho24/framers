import "server-only";

import { providerKey } from "../providers";
import { ProviderError, getJson, poll, postJson } from "../http";
import { TIER_MEGAPIXELS, ratioOf, sizeFor } from "../../sizing";
import type { Adapter, AdapterInput, InputImage } from "../types";
import { highlightPrompt } from "../types";

/**
 * Black Forest Labs (FLUX). Every endpoint is asynchronous: submit, get a
 * polling URL, poll until the result's `sample` URL is ready. Pictures go in
 * as base64. The submit answer includes the cost in credits (1 credit = 1¢).
 */

const BASE = "https://api.bfl.ai/v1";

interface Submitted {
  id?: string;
  polling_url?: string;
  cost?: number | null;
}
interface Result {
  status?: string;
  result?: { sample?: string } | null;
  details?: unknown;
}

const b64 = (image: InputImage) => Buffer.from(image.bytes).toString("base64");

async function run(endpoint: string, body: Record<string, unknown>, deadline: number) {
  const headers = { "x-key": providerKey("bfl") };
  const job = await postJson<Submitted>(`${BASE}/${endpoint}`, { output_format: "png", ...body }, headers, "FLUX", 60_000);
  const pollUrl = job.polling_url ?? (job.id ? `${BASE}/get_result?id=${encodeURIComponent(job.id)}` : null);
  if (!pollUrl) throw new ProviderError("FLUX didn’t accept the request.", 502);

  const sample = await poll<string>(
    async () => {
      const r = await getJson<Result>(pollUrl, headers, "FLUX");
      if (r.status === "Ready") {
        if (!r.result?.sample) throw new ProviderError("FLUX finished without a picture.", 502);
        return r.result.sample;
      }
      if (r.status === "Request Moderated" || r.status === "Content Moderated") {
        throw new ProviderError("FLUX’s safety check blocked this request. Try a different prompt or photo.", 422, true);
      }
      if (r.status === "Error" || r.status === "Task not found") throw new ProviderError("FLUX couldn’t make this picture.", 502);
      return undefined;
    },
    "FLUX",
    deadline,
    1200
  );
  return { images: [{ url: sample }], costUsd: typeof job.cost === "number" ? job.cost / 100 : undefined };
}

function flux2Size(input: AdapterInput) {
  const mp = input.resolution === "2K" ? 4 : TIER_MEGAPIXELS["1K"];
  return sizeFor(ratioOf(input.aspect ?? "1:1"), mp, { multiple: 16, maxEdge: 4096, maxPixels: 4_194_304 });
}

export const bfl: Adapter = async (input) => {
  const name = input.model.id.slice("bfl:".length);

  if (name.startsWith("flux-2-")) {
    const body: Record<string, unknown> = { prompt: input.prompt, safety_tolerance: 2 };
    let pictures = [input.image, ...input.refs].filter((p): p is InputImage => !!p);
    if ((input.task === "replace" || input.task === "erase") && input.image && input.highlight) {
      body.prompt = highlightPrompt(input.prompt, input.task);
      pictures = [input.image, input.highlight];
    }
    pictures.slice(0, 8).forEach((p, i) => (body[i === 0 ? "input_image" : `input_image_${i + 1}`] = b64(p)));
    // A new picture gets the asked-for shape; an edit keeps its own unless one was asked for.
    if (pictures.length === 0 || (input.aspect && input.task === "edit")) Object.assign(body, flux2Size(input));
    return run(name, body, input.deadline);
  }

  if (!input.image) throw new ProviderError("Select a photo first.", 400);
  switch (name) {
    case "flux-fill":
      if (!input.mask) throw new ProviderError("Select the area to change first.", 400);
      return run("flux-pro-1.0-fill", { image: b64(input.image), mask: b64(input.mask), prompt: input.prompt, safety_tolerance: 2 }, input.deadline);
    case "flux-erase":
      if (!input.mask) throw new ProviderError("Select the object to remove first.", 400);
      return run("flux-tools/erase-v1", { image: b64(input.image), mask: b64(input.mask), dilate_pixels: 8 }, input.deadline);
    case "flux-outpaint": {
      const p = input.padding ?? { left: 0, top: 0, right: 0, bottom: 0 };
      return run(
        "flux-tools/outpainting-v1",
        {
          input_image: b64(input.image),
          width: input.image.width + p.left + p.right,
          height: input.image.height + p.top + p.bottom,
          reference_offset_x: p.left,
          reference_offset_y: p.top,
          ...(input.prompt ? { prompt: input.prompt } : {}),
          mode: "high",
        },
        input.deadline
      );
    }
    case "flux-expand": {
      const p = input.padding ?? { left: 0, top: 0, right: 0, bottom: 0 };
      const cap = (n: number) => Math.min(2048, Math.max(0, n));
      return run(
        "flux-pro-1.0-expand",
        { image: b64(input.image), left: cap(p.left), top: cap(p.top), right: cap(p.right), bottom: cap(p.bottom), prompt: input.prompt || undefined },
        input.deadline
      );
    }
  }
  throw new ProviderError(`Unknown FLUX model ${name}.`, 400);
};
