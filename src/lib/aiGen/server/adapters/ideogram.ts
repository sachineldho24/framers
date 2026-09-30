import "server-only";

import { providerKey } from "../providers";
import { ProviderError, postForm } from "../http";
import { TIER_MEGAPIXELS, nearestAspect, nearestPreset, ratioOf } from "../../sizing";
import type { Adapter, AdapterInput, InputImage } from "../types";
import { fileName, highlightPrompt, toBlob } from "../types";

/**
 * Ideogram's API: multipart forms, results as short-lived URLs. 4.0 makes one
 * picture per call, so several run side by side.
 */

const BASE = "https://api.ideogram.ai";

const V4_RESOLUTIONS = [
  "2048x2048", "1440x2880", "2880x1440", "1664x2496", "2496x1664", "1792x2240", "2240x1792", "1440x2560", "2560x1440",
  "1600x2560", "2560x1600", "1728x2304", "2304x1728", "1296x3168", "3168x1296", "1152x2944", "2944x1152", "1248x3328",
  "3328x1248", "1280x3072", "3072x1280", "1024x3072", "3072x1024", "1024x1024", "896x1120", "1120x896", "864x1152",
  "1152x864", "832x1248", "1248x832", "800x1280", "1280x800", "720x1280", "1280x720", "720x1440", "1440x720",
  "512x1536", "1536x512",
];
const TRANSPARENT_ASPECTS = ["1x4", "1x3", "1x2", "9x16", "10x16", "2x3", "3x4", "4x5", "1x1", "5x4", "4x3", "3x2", "16x10", "16x9", "2x1", "3x1", "4x1"];

interface IdeogramResponse {
  data?: { url?: string | null; is_image_safe?: boolean }[];
}

const SPEED: Record<string, string> = { low: "TURBO", medium: "DEFAULT", high: "QUALITY" };

function speed(input: AdapterInput): string {
  return SPEED[input.quality ?? "medium"] ?? "DEFAULT";
}

function collect(res: IdeogramResponse) {
  const data = res.data ?? [];
  const images = data.filter((d) => d.url).map((d) => ({ url: d.url! }));
  if (images.length === 0 && data.some((d) => d.is_image_safe === false)) {
    throw new ProviderError("Ideogram’s safety check blocked this picture. Try a different prompt or photo.", 422, true);
  }
  return images;
}

function addFile(form: FormData, field: string, image: InputImage) {
  form.append(field, toBlob(image), fileName(image, field));
}

async function call(path: string, form: FormData) {
  return collect(await postForm<IdeogramResponse>(`${BASE}${path}`, form, { "Api-Key": providerKey("ideogram") }, "Ideogram"));
}

/** Several one-picture calls side by side; one failure doesn't sink the rest. */
async function repeat(count: number, make: () => Promise<{ url: string }[]>) {
  const results = await Promise.allSettled(Array.from({ length: count }, make));
  const images = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (images.length === 0) throw (results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason;
  return images;
}

export const ideogram: Adapter = async (input) => {
  const name = input.model.id.slice("ideogram:".length);
  const count = Math.max(1, Math.min(input.model.maxImages, input.count));
  const ratio = ratioOf(input.aspect ?? "1:1");

  switch (name) {
    case "v4": {
      if (input.task === "sticker") {
        return {
          images: await repeat(count, () => {
            const form = new FormData();
            form.set("text_prompt", input.prompt);
            form.set("aspect_ratio", nearestAspect(ratio, TRANSPARENT_ASPECTS));
            form.set("output_resolution", input.resolution === "2K" ? "2K" : "1K");
            form.set("rendering_speed", speed(input));
            return call("/v1/ideogram-v4/generate-transparent", form);
          }),
        };
      }
      if (input.task === "edit" && input.image) {
        return {
          images: await repeat(count, () => {
            const form = new FormData();
            addFile(form, "image", input.image!);
            form.set("text_prompt", input.prompt);
            form.set("rendering_speed", speed(input));
            return call("/v1/ideogram-v4/remix", form);
          }),
        };
      }
      const resolution = nearestPreset(V4_RESOLUTIONS, ratio, TIER_MEGAPIXELS[input.resolution === "2K" ? "2K" : "1K"]);
      return {
        images: await repeat(count, () => {
          const form = new FormData();
          form.set("text_prompt", input.prompt);
          form.set("resolution", resolution);
          form.set("rendering_speed", speed(input));
          return call("/v1/ideogram-v4/generate", form);
        }),
      };
    }

    case "edit": {
      const form = new FormData();
      if ((input.task === "replace" || input.task === "erase") && input.image && input.highlight) {
        form.set("prompt", highlightPrompt(input.prompt, input.task));
        addFile(form, "images", input.image);
        addFile(form, "images", input.highlight);
      } else {
        form.set("prompt", input.prompt);
        for (const p of [input.image, ...input.refs]) if (p) addFile(form, "images", p);
      }
      form.set("num_images", String(count));
      return { images: await call("/v1/edit", form) };
    }

    case "inpaint-v3": {
      if (!input.image || !input.mask) throw new ProviderError("Select the area to change first.", 400);
      const form = new FormData();
      addFile(form, "image", input.image);
      addFile(form, "mask", input.mask);
      form.set("prompt", input.prompt);
      form.set("rendering_speed", speed(input));
      form.set("num_images", String(count));
      return { images: await call("/v1/ideogram-v3/inpaint", form) };
    }

    case "remove-object": {
      if (!input.image || !input.mask) throw new ProviderError("Select the object to remove first.", 400);
      const form = new FormData();
      addFile(form, "image", input.image);
      addFile(form, "mask", input.mask);
      return { images: await call("/v1/remove-object", form) };
    }

    case "remove-background": {
      if (!input.image) throw new ProviderError("Select a photo first.", 400);
      const form = new FormData();
      addFile(form, "image", input.image);
      return { images: await call("/v1/remove-background", form) };
    }

    case "upscale": {
      if (!input.image) throw new ProviderError("Select a photo first.", 400);
      const form = new FormData();
      form.set("image_request", JSON.stringify({ resemblance: 85, detail: 50, ...(input.prompt ? { prompt: input.prompt } : {}) }));
      addFile(form, "image_file", input.image);
      return { images: await call("/upscale", form) };
    }
  }
  throw new ProviderError(`Unknown Ideogram model ${name}.`, 400);
};
