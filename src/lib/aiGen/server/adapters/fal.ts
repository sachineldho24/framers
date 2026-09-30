import "server-only";

import { providerKey } from "../providers";
import { ProviderError, getJson, poll, postJson } from "../http";
import { TIER_MEGAPIXELS, nearestAspect, ratioOf, sizeFor } from "../../sizing";
import type { Adapter, AdapterInput, AdapterOutput, InputImage } from "../types";
import { dataUrl, highlightPrompt } from "../types";

/**
 * fal.ai: one queue API in front of most of the market — GPT Image, Nano
 * Banana, Seedream, Ideogram, FLUX, Grok, Qwen, Recraft, plus the utility
 * models (erasers, outpainters, upscalers, background removers, layerize).
 * Submit to `queue.fal.run/<endpoint>`, poll the status URL, fetch the result.
 * Pictures go in as data URIs.
 */

const QUEUE = "https://queue.fal.run";

interface Queued {
  request_id?: string;
  status_url?: string;
  response_url?: string;
}
interface Status {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  error?: string | null;
}
interface FalFile {
  url?: string;
}
interface FalOutput {
  images?: FalFile[];
  image?: FalFile;
  layers?: { image?: FalFile; name?: string | null; z_index?: number; bounding_box?: { absolute?: number[] } | null }[];
  has_nsfw_concepts?: boolean[];
}

interface Call {
  endpoint: string;
  body: Record<string, unknown>;
}

async function run(call: Call, deadline: number): Promise<FalOutput> {
  const headers = { Authorization: `Key ${providerKey("fal")}` };
  const queued = await postJson<Queued>(`${QUEUE}/${call.endpoint}`, call.body, headers, "fal", 60_000);
  if (!queued.status_url || !queued.response_url) throw new ProviderError("fal didn’t accept the request.", 502);
  await poll(
    async () => {
      const s = await getJson<Status>(queued.status_url!, headers, "fal");
      if (s.status === "COMPLETED") return true;
      return undefined;
    },
    "fal",
    deadline,
    1000
  );
  return getJson<FalOutput>(queued.response_url, headers, "fal");
}

/* ------------------------------------------------------------- helpers */

const url = (image: InputImage) => dataUrl(image);

function pictures(input: AdapterInput): InputImage[] {
  return [input.image, ...input.refs].filter((p): p is InputImage => !!p);
}

/** Replace/Erase on a model without a mask: the photo, a tinted copy, and the instruction. */
function composite(input: AdapterInput): { prompt: string; images: InputImage[] } | null {
  if ((input.task === "replace" || input.task === "erase") && input.image && input.highlight) {
    return { prompt: highlightPrompt(input.prompt, input.task), images: [input.image, input.highlight] };
  }
  return null;
}

function count(input: AdapterInput) {
  return Math.max(1, Math.min(input.model.maxImages, input.count));
}

/** A `{width, height}` image_size for models that take free sizes. */
function freeSize(input: AdapterInput, maxPixels = 4_194_304, maxEdge = 4096) {
  return sizeFor(ratioOf(input.aspect ?? "1:1"), TIER_MEGAPIXELS[input.resolution === "2K" ? "2K" : "1K"], {
    multiple: 16,
    maxEdge,
    maxPixels,
  });
}

const BANANA_ASPECTS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"];
const BANANA_PRO_ASPECTS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"];
const GROK_ASPECTS = ["2:1", "20:9", "19.5:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:19.5", "9:20", "1:2"];
const IDEO3_ASPECTS = ["1:3", "3:1", "1:2", "2:1", "9:16", "16:9", "10:16", "16:10", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "1:1"];
const IDEO_SPEED: Record<string, string> = { low: "TURBO", medium: "BALANCED", high: "QUALITY" };

/** Text → image or picture → picture, for the families that have both endpoints. */
function pair(input: AdapterInput, create: string, edit: string, build: (isEdit: boolean, images: InputImage[], prompt: string) => Record<string, unknown>): Call {
  const c = composite(input);
  const images = c ? c.images : pictures(input);
  const prompt = c ? c.prompt : input.prompt;
  return images.length ? { endpoint: edit, body: build(true, images, prompt) } : { endpoint: create, body: build(false, [], prompt) };
}

/* --------------------------------------------------------------- models */

function callFor(input: AdapterInput): Call {
  const name = input.model.id.slice("fal:".length);
  const n = count(input);
  const needImage = () => {
    if (!input.image) throw new ProviderError("Select a photo first.", 400);
    return input.image;
  };
  const needMask = () => {
    if (!input.mask) throw new ProviderError("Select the area first.", 400);
    return input.mask;
  };

  switch (name) {
    case "gpt-image-2.5-sunburst":
    case "gpt-image-2.5-flare": {
      const variant = name.endsWith("sunburst") ? "sunburst" : "flare";
      const common = {
        quality: input.quality ?? "medium",
        num_images: n,
        output_format: "png",
        ...(input.task === "sticker" ? { background: "transparent" } : {}),
      };
      const images = pictures(input);
      if (images.length === 0) {
        const size = sizeFor(Math.min(3, Math.max(1 / 3, ratioOf(input.aspect ?? "1:1"))), TIER_MEGAPIXELS[input.resolution ?? "1K"], {
          multiple: 16,
          maxEdge: 3840,
          minPixels: 655_360,
          maxPixels: 8_294_400,
        });
        return { endpoint: `openai/gpt-image-2.5/${variant}/text-to-image`, body: { ...common, prompt: input.prompt, image_size: size } };
      }
      const prompt =
        input.task === "erase" ? "Remove the object in the masked area and fill it naturally with what would be behind it." : input.prompt;
      return {
        endpoint: `openai/gpt-image-2.5/${variant}/edit`,
        body: {
          ...common,
          prompt,
          image_urls: images.map(url),
          image_size: "auto",
          ...(input.mask && (input.task === "replace" || input.task === "erase") ? { mask_url: url(input.mask) } : {}),
        },
      };
    }

    case "nano-banana-2":
    case "nano-banana-pro": {
      const base = name === "nano-banana-2" ? "fal-ai/nano-banana-2" : "fal-ai/nano-banana-pro";
      const aspects = name === "nano-banana-2" ? BANANA_ASPECTS : BANANA_PRO_ASPECTS;
      return pair(input, base, `${base}/edit`, (isEdit, images, prompt) => ({
        prompt,
        num_images: n,
        output_format: "png",
        resolution: input.resolution ?? "1K",
        aspect_ratio: input.aspect && (!isEdit || input.task === "edit") ? nearestAspect(ratioOf(input.aspect), aspects) : "auto",
        ...(isEdit ? { image_urls: images.map(url) } : {}),
      }));
    }

    case "seedream-5-pro":
    case "seedream-5-lite":
    case "seedream-5-flash": {
      const v = name.slice("seedream-5-".length);
      return pair(input, `bytedance/seedream/v5/${v}/text-to-image`, `bytedance/seedream/v5/${v}/edit`, (isEdit, images, prompt) => ({
        prompt,
        num_images: n,
        output_format: "png",
        image_size: isEdit && input.task !== "edit" ? (input.resolution === "2K" ? "auto_2K" : "auto_1K") : isEdit && !input.aspect ? "auto_2K" : freeSize(input),
        ...(isEdit ? { image_urls: images.map(url) } : {}),
      }));
    }

    case "ideogram-v4": {
      const common = { rendering_speed: IDEO_SPEED[input.quality ?? "medium"] ?? "BALANCED", num_images: n, output_format: "png" };
      if (input.image) {
        return { endpoint: "ideogram/v4/image-to-image", body: { ...common, prompt: input.prompt, image_url: url(input.image), strength: 0.7, image_size: "auto" } };
      }
      return { endpoint: "ideogram/v4", body: { ...common, prompt: input.prompt, image_size: freeSize(input) } };
    }

    case "flux-2-max":
    case "flux-2-pro":
    case "flux-2-flash": {
      const base = name === "flux-2-flash" ? "fal-ai/flux-2/flash" : `fal-ai/${name}`;
      return pair(input, base, `${base}/edit`, (isEdit, images, prompt) => ({
        prompt,
        output_format: "png",
        ...(name === "flux-2-flash" ? { num_images: n } : { safety_tolerance: "2" }),
        image_size: isEdit && input.task !== "edit" ? "auto" : isEdit && !input.aspect ? "auto" : freeSize(input),
        ...(isEdit ? { image_urls: images.map(url) } : {}),
      }));
    }

    case "grok-imagine-2":
      return pair(input, "xai/grok-imagine-image/v2.0/text-to-image", "xai/grok-imagine-image/v2.0/edit", (isEdit, images, prompt) => ({
        prompt,
        num_images: n,
        output_format: "png",
        quality: input.quality === "low" ? "low" : "medium",
        resolution: input.resolution === "2K" ? "2k" : "1k",
        aspect_ratio: input.aspect && (!isEdit || input.task === "edit") ? nearestAspect(ratioOf(input.aspect), GROK_ASPECTS) : isEdit ? "auto" : "1:1",
        ...(isEdit ? { image_urls: images.map(url) } : {}),
      }));

    case "qwen-image-3":
      return pair(input, "alibaba/qwen-image-3/text-to-image", "alibaba/qwen-image-3/edit", (isEdit, images, prompt) => ({
        prompt,
        num_images: n,
        output_format: "png",
        ...(isEdit ? { image_urls: images.map(url), ...(input.aspect && input.task === "edit" ? { image_size: freeSize(input) } : {}) } : { image_size: freeSize(input) }),
      }));

    case "recraft-v4.1-pro":
      return { endpoint: "fal-ai/recraft/v4.1/pro/text-to-image", body: { prompt: input.prompt, image_size: freeSize(input) } };

    case "flux-fill":
      return {
        endpoint: "fal-ai/flux-pro/v1/fill",
        body: { prompt: input.prompt, image_url: url(needImage()), mask_url: url(needMask()), num_images: n, output_format: "png", safety_tolerance: "2" },
      };
    case "flux-erase":
      return { endpoint: "fal-ai/flux-pro/v1/erase", body: { image_url: url(needImage()), mask_url: url(needMask()), dilate_pixels: 8, output_format: "png" } };
    case "bria-eraser":
      return { endpoint: "fal-ai/bria/eraser", body: { image_url: url(needImage()), mask_url: url(needMask()), mask_type: "manual" } };
    case "ideogram-object-removal":
      return { endpoint: "fal-ai/ideogram/object-removal", body: { image_url: url(needImage()), mask_url: url(needMask()) } };

    case "flux-2-pro-outpaint": {
      const p = input.padding ?? { left: 0, top: 0, right: 0, bottom: 0 };
      const cap = (v: number) => Math.min(2048, Math.max(0, v));
      return {
        endpoint: "fal-ai/flux-2-pro/outpaint",
        body: { image_url: url(needImage()), expand_left: cap(p.left), expand_top: cap(p.top), expand_right: cap(p.right), expand_bottom: cap(p.bottom), output_format: "png", mode: "high" },
      };
    }
    case "bria-expand": {
      const image = needImage();
      const p = input.padding ?? { left: 0, top: 0, right: 0, bottom: 0 };
      return {
        endpoint: "fal-ai/bria/expand",
        body: {
          image_url: url(image),
          canvas_size: [image.width + p.left + p.right, image.height + p.top + p.bottom],
          original_image_size: [image.width, image.height],
          original_image_location: [p.left, p.top],
          prompt: input.prompt ?? "",
        },
      };
    }

    case "ideogram-v3-transparent":
      return {
        endpoint: "fal-ai/ideogram/v3/generate-transparent",
        body: {
          prompt: input.prompt,
          aspect_ratio: nearestAspect(ratioOf(input.aspect ?? "1:1"), IDEO3_ASPECTS),
          rendering_speed: IDEO_SPEED[input.quality ?? "medium"] ?? "BALANCED",
          num_images: n,
        },
      };

    case "topaz-precision":
      return { endpoint: "topaz/upscale/image/precision", body: { image_url: url(needImage()), upscale_factor: input.factor ?? 2, output_format: "png", model: "Standard V2" } };
    case "crystal-upscaler":
      return { endpoint: "clarityai/crystal-upscaler", body: { image_url: url(needImage()), scale_factor: input.factor ?? 2, output_format: "png" } };
    case "seedvr-upscale":
      return { endpoint: "fal-ai/seedvr/upscale/image", body: { image_url: url(needImage()), upscale_mode: "factor", upscale_factor: input.factor ?? 2, output_format: "png" } };
    case "recraft-crisp-upscale":
      return { endpoint: "fal-ai/recraft/upscale/crisp", body: { image_url: url(needImage()) } };

    case "birefnet":
      return {
        endpoint: "fal-ai/birefnet/v2",
        body: { image_url: url(needImage()), model: "General Use (Heavy)", operating_resolution: "2048x2048", output_format: "png", refine_foreground: true },
      };
    case "bria-rmbg":
      return { endpoint: "fal-ai/bria/background/remove", body: { image_url: url(needImage()) } };
    case "pixelcut-rmbg":
      return { endpoint: "pixelcut/background-removal", body: { image_url: url(needImage()), output_format: "rgba" } };
    case "ideogram-rmbg":
      return { endpoint: "fal-ai/ideogram/remove-background", body: { image_url: url(needImage()) } };

    case "seedream-5-pro-layerize":
    case "seedream-5-flash-layerize": {
      const v = name.includes("flash") ? "flash" : "pro";
      return {
        endpoint: `bytedance/seedream/v5/${v}/layerize`,
        body: { image_url: url(needImage()), image_size: "auto_2K", ...(input.prompt ? { prompt: input.prompt } : {}) },
      };
    }
  }
  throw new ProviderError(`Unknown fal model ${name}.`, 400);
}

export const fal: Adapter = async (input): Promise<AdapterOutput> => {
  const out = await run(callFor(input), input.deadline);

  if (input.task === "layerize" && out.layers?.length) {
    const sorted = [...out.layers].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
    const images = sorted.filter((l) => l.image?.url).map((l) => ({ url: l.image!.url! }));
    return {
      images,
      layers: sorted
        .filter((l) => l.image?.url)
        .slice(1)
        .map((l) => {
          const b = l.bounding_box?.absolute;
          return { name: l.name ?? undefined, box: b && b.length === 4 ? (b as [number, number, number, number]) : undefined, z: l.z_index ?? 0 };
        }),
    };
  }

  const files = out.images ?? (out.image ? [out.image] : []);
  const images = files.filter((f) => f.url).map((f) => ({ url: f.url! }));
  if (images.length === 0 && out.has_nsfw_concepts?.some(Boolean)) {
    throw new ProviderError("The safety check blocked this picture. Try a different prompt or photo.", 422, true);
  }
  return { images };
};
