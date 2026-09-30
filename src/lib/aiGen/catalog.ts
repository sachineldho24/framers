/**
 * Generative image models the studio can call, and what each is for.
 *
 * Shared by the browser (the Generate panel lists these) and the server (the
 * route validates a request against them). Pure data: provider-specific request
 * building lives in `server/adapters/*`, keyed by the same ids, so this file
 * never holds a key or an endpoint.
 *
 * Prices are per image at about 1024×1024 (1 MP), in US dollars, from each
 * provider's published price list (September 2026). They are estimates shown
 * to the customer as "≈" and used for the daily budget — the provider's bill is
 * the truth. A model appears in the studio only when its provider's key is set
 * on the server (`server/providers.ts`).
 */

/** What the customer is trying to do. */
export type AiTask =
  /** Text → a new picture. */
  | "create"
  /** The selected photo, changed as the prompt says (and optionally other pictures as references). */
  | "edit"
  /** Only the selected object/area changes; the rest of the photo is kept pixel for pixel. */
  | "replace"
  /** The selected object is removed and the space filled. */
  | "erase"
  /** The photo grows past its edges. */
  | "expand"
  /** Text → an object on a transparent background. */
  | "sticker"
  /** More pixels, for print. */
  | "upscale"
  /** The subject on a transparent background. */
  | "removeBg"
  /** CapCut's "Separate layers": a flat picture becomes a background and its objects as layers. */
  | "layerize";

export type ProviderId = "openai" | "google" | "ideogram" | "bfl" | "xai" | "fal" | "kie";

/** A model's quality/speed tiers, from cheapest up. Mapped per model by the adapter. */
export type QualityId = "low" | "medium" | "high" | "xhigh" | "max";
export type ResolutionId = "0.5K" | "1K" | "2K" | "4K" | "8K";
export type Badge = "best" | "cheap" | "fast" | "text" | "photo" | "4k" | "design";

/** Picture shapes offered in the studio. Adapters map to the nearest a model supports. */
export const ASPECTS = ["1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "1:2", "2:1", "21:9"] as const;
export type AspectId = (typeof ASPECTS)[number];

export interface AiModel {
  /** `provider:model`, stable — stored in the generation log. */
  id: string;
  provider: ProviderId;
  /** Who made the model (the provider may just be hosting it). */
  vendor: string;
  label: string;
  /** One line: what it's good at. */
  blurb: string;
  tasks: AiTask[];
  badges?: Badge[];
  /** Price per image at 1K for each tier. Absent → `usd`. */
  qualities?: Partial<Record<QualityId, number>>;
  /** Tier labels where the provider's names differ (Ideogram's Turbo/Default/Quality…). */
  qualityLabels?: Partial<Record<QualityId, string>>;
  /** Flat price per image (or per call, for tools) at 1K. */
  usd?: number;
  /** Output tiers, each a price multiplier over 1K. Absent → the model picks its size. */
  resolutions?: Partial<Record<ResolutionId, number>>;
  /** Images per request the customer may ask for. */
  maxImages: number;
  /** Extra reference pictures accepted alongside the prompt (0 = none). */
  maxRefs: number;
  /** Replace: `native` takes a mask; `composite` is an instruction edit we paste back through the mask. */
  mask?: "native" | "composite";
  /**
   * How a native mask marks the area to change: `white` on black (most),
   * `black` on white (Ideogram inpaint), or `alpha` — transparent where it
   * changes (OpenAI, which also wants the picture as a PNG of the same size).
   */
  maskStyle?: "white" | "black" | "alpha";
  /** Expand: `native` takes the padding; `mask` is a masked edit of a padded canvas. */
  expandMode?: "native" | "mask";
  /** Accepts a picture shape. */
  aspect?: boolean;
  /** Upscale factors offered. */
  upscale?: number[];
  /** Price is per separated layer (layerize), and a typical photo gives about this many. */
  perLayer?: number;
}

const GPT_QUALITIES = { low: 0.006, medium: 0.013, high: 0.053, xhigh: 0.094, max: 0.211 };
/** GPT Image is billed by output tokens, which grow with pixels: ~4 MP costs ~4× 1 MP. */
const GPT_RES = { "1K": 1, "2K": 3.5, "4K": 7.5 };
const IDEO_LABELS = { low: "Turbo", medium: "Default", high: "Quality" };

export const MODELS: AiModel[] = [
  /* ---------------------------------------------------------------- OpenAI */
  {
    id: "openai:gpt-image-2.5-sunburst",
    provider: "openai",
    vendor: "OpenAI",
    label: "GPT Image 2.5 Sunburst",
    blurb: "#1 for precise edits and prompt following. Transparent backgrounds.",
    tasks: ["create", "edit", "replace", "expand", "sticker"],
    badges: ["best", "text"],
    qualities: GPT_QUALITIES,
    resolutions: GPT_RES,
    maxImages: 4,
    maxRefs: 15,
    mask: "native",
    maskStyle: "alpha",
    expandMode: "mask",
    aspect: true,
  },
  {
    id: "openai:gpt-image-2.5-flare",
    provider: "openai",
    vendor: "OpenAI",
    label: "GPT Image 2.5 Flare",
    blurb: "Top-ranked text → image, fast. Best value at medium quality.",
    tasks: ["create", "edit", "replace", "expand", "sticker"],
    badges: ["best", "fast"],
    qualities: GPT_QUALITIES,
    resolutions: GPT_RES,
    maxImages: 4,
    maxRefs: 15,
    mask: "native",
    maskStyle: "alpha",
    expandMode: "mask",
    aspect: true,
  },
  {
    id: "openai:gpt-image-2",
    provider: "openai",
    vendor: "OpenAI",
    label: "GPT Image 2",
    blurb: "The previous flagship. Strong text and layouts.",
    tasks: ["create", "edit", "replace", "expand", "sticker"],
    qualities: { low: 0.006, medium: 0.053, high: 0.211 },
    resolutions: GPT_RES,
    maxImages: 4,
    maxRefs: 15,
    mask: "native",
    maskStyle: "alpha",
    expandMode: "mask",
    aspect: true,
  },
  {
    id: "openai:gpt-image-1-mini",
    provider: "openai",
    vendor: "OpenAI",
    label: "GPT Image 1 Mini",
    blurb: "Cheapest OpenAI model. Fine for drafts.",
    tasks: ["create", "edit", "replace", "sticker"],
    badges: ["cheap"],
    qualities: { low: 0.005, medium: 0.011, high: 0.036 },
    maxImages: 4,
    maxRefs: 15,
    mask: "native",
    maskStyle: "alpha",
    aspect: true,
  },

  /* ---------------------------------------------------------------- Google */
  {
    id: "google:gemini-3.1-flash-image",
    provider: "google",
    vendor: "Google",
    label: "Nano Banana 2",
    blurb: "Versatile editor, great with several reference pictures. Up to 4K.",
    tasks: ["create", "edit", "replace"],
    badges: ["4k"],
    usd: 0.067,
    resolutions: { "1K": 1, "2K": 1.5, "4K": 2.25 },
    maxImages: 4,
    maxRefs: 13,
    mask: "composite",
    aspect: true,
  },
  {
    id: "google:gemini-3-pro-image",
    provider: "google",
    vendor: "Google",
    label: "Nano Banana Pro",
    blurb: "Google's best: world knowledge, text and native 4K for print.",
    tasks: ["create", "edit", "replace"],
    badges: ["4k", "text"],
    usd: 0.134,
    resolutions: { "1K": 1, "2K": 1, "4K": 1.8 },
    maxImages: 4,
    maxRefs: 10,
    mask: "composite",
    aspect: true,
  },
  {
    id: "google:gemini-3.1-flash-lite-image",
    provider: "google",
    vendor: "Google",
    label: "Nano Banana 2 Lite",
    blurb: "Fastest and cheapest Google model. 1K only.",
    tasks: ["create", "edit", "replace"],
    badges: ["cheap", "fast"],
    usd: 0.034,
    maxImages: 4,
    maxRefs: 13,
    mask: "composite",
    aspect: true,
  },

  /* -------------------------------------------------------------- Ideogram */
  {
    id: "ideogram:v4",
    provider: "ideogram",
    vendor: "Ideogram",
    label: "Ideogram 4.0",
    blurb: "Best for posters and anything with words in it.",
    tasks: ["create", "edit", "sticker"],
    badges: ["text", "design"],
    qualities: { low: 0.03, medium: 0.06, high: 0.1 },
    qualityLabels: IDEO_LABELS,
    resolutions: { "1K": 1, "2K": 1 },
    maxImages: 4,
    maxRefs: 0,
    aspect: true,
  },
  {
    id: "ideogram:edit",
    provider: "ideogram",
    vendor: "Ideogram",
    label: "Ideogram Edit",
    blurb: "Edit with a prompt, using up to 10 pictures together.",
    tasks: ["edit", "replace"],
    badges: ["text"],
    usd: 0.06,
    maxImages: 4,
    maxRefs: 9,
    mask: "composite",
    aspect: false,
  },
  {
    id: "ideogram:inpaint-v3",
    provider: "ideogram",
    vendor: "Ideogram",
    label: "Ideogram 3.0 Inpaint",
    blurb: "Redraws just the selected area. Good with lettering.",
    tasks: ["replace"],
    qualities: { low: 0.03, medium: 0.06, high: 0.09 },
    qualityLabels: IDEO_LABELS,
    maxImages: 4,
    maxRefs: 0,
    mask: "native",
    maskStyle: "black",
  },
  {
    id: "ideogram:remove-object",
    provider: "ideogram",
    vendor: "Ideogram",
    label: "Ideogram Object Remover",
    blurb: "Removes the selected object and rebuilds what was behind it.",
    tasks: ["erase"],
    badges: ["cheap"],
    usd: 0.03,
    maxImages: 1,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "ideogram:remove-background",
    provider: "ideogram",
    vendor: "Ideogram",
    label: "Ideogram Background Remover",
    blurb: "Clean cut-outs for a cent.",
    tasks: ["removeBg"],
    badges: ["cheap"],
    usd: 0.01,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "ideogram:upscale",
    provider: "ideogram",
    vendor: "Ideogram",
    label: "Ideogram Upscale",
    blurb: "2× with added detail.",
    tasks: ["upscale"],
    usd: 0.06,
    maxImages: 1,
    maxRefs: 0,
    upscale: [2],
  },

  /* ---------------------------------------------------- Black Forest Labs */
  {
    id: "bfl:flux-2-max",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX.2 [max]",
    blurb: "The most photorealistic FLUX. Edits with up to 8 references.",
    tasks: ["create", "edit", "replace"],
    badges: ["photo"],
    usd: 0.07,
    resolutions: { "1K": 1, "2K": 2.3 },
    maxImages: 1,
    maxRefs: 7,
    mask: "composite",
    aspect: true,
  },
  {
    id: "bfl:flux-2-pro",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX.2 [pro]",
    blurb: "Photoreal generation and editing at a good price.",
    tasks: ["create", "edit", "replace"],
    badges: ["photo"],
    usd: 0.03,
    resolutions: { "1K": 1, "2K": 2.5 },
    maxImages: 1,
    maxRefs: 7,
    mask: "composite",
    aspect: true,
  },
  {
    id: "bfl:flux-2-flex",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX.2 [flex]",
    blurb: "Tuned for typography and fine detail.",
    tasks: ["create", "edit"],
    badges: ["text"],
    usd: 0.06,
    resolutions: { "1K": 1, "2K": 2.5 },
    maxImages: 1,
    maxRefs: 7,
    aspect: true,
  },
  {
    id: "bfl:flux-2-klein-9b",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX.2 [klein] 9B",
    blurb: "Small and fast. Cheap drafts.",
    tasks: ["create", "edit"],
    badges: ["cheap", "fast"],
    usd: 0.015,
    maxImages: 1,
    maxRefs: 3,
    aspect: true,
  },
  {
    id: "bfl:flux-fill",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX.1 Fill [pro]",
    blurb: "Classic masked inpainting: redraws only the selection.",
    tasks: ["replace"],
    usd: 0.05,
    maxImages: 1,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "bfl:flux-erase",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX Erase",
    blurb: "Removes the selection, edges included.",
    tasks: ["erase"],
    usd: 0.03,
    maxImages: 1,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "bfl:flux-outpaint",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX Outpaint",
    blurb: "Grows the photo past its edges, matching the scene.",
    tasks: ["expand"],
    usd: 0.03,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "bfl:flux-expand",
    provider: "bfl",
    vendor: "Black Forest Labs",
    label: "FLUX.1 Expand [pro]",
    blurb: "The older expander. Takes a prompt for the new area.",
    tasks: ["expand"],
    usd: 0.05,
    maxImages: 1,
    maxRefs: 0,
  },

  /* -------------------------------------------------------------------- xAI */
  {
    id: "xai:grok-imagine-image-2.0",
    provider: "xai",
    vendor: "xAI",
    label: "Grok Imagine 2.0",
    blurb: "Top-5 text → image; edits with up to 5 pictures.",
    tasks: ["create", "edit", "replace"],
    usd: 0.06,
    resolutions: { "1K": 1, "2K": 1.35 },
    maxImages: 4,
    maxRefs: 4,
    mask: "composite",
    aspect: true,
  },

  /* ------------------------------------------------------------------- fal */
  {
    id: "fal:gpt-image-2.5-sunburst",
    provider: "fal",
    vendor: "OpenAI",
    label: "GPT Image 2.5 Sunburst",
    blurb: "#1 editor, via fal. Takes a mask for Replace.",
    tasks: ["create", "edit", "replace", "sticker"],
    badges: ["best"],
    qualities: GPT_QUALITIES,
    resolutions: GPT_RES,
    maxImages: 4,
    maxRefs: 15,
    mask: "native",
    maskStyle: "alpha",
    aspect: true,
  },
  {
    id: "fal:gpt-image-2.5-flare",
    provider: "fal",
    vendor: "OpenAI",
    label: "GPT Image 2.5 Flare",
    blurb: "Top-ranked text → image, via fal.",
    tasks: ["create", "edit", "replace", "sticker"],
    badges: ["best", "fast"],
    qualities: GPT_QUALITIES,
    resolutions: GPT_RES,
    maxImages: 4,
    maxRefs: 15,
    mask: "native",
    maskStyle: "alpha",
    aspect: true,
  },
  {
    id: "fal:nano-banana-2",
    provider: "fal",
    vendor: "Google",
    label: "Nano Banana 2",
    blurb: "Versatile editor with references, up to 4K.",
    tasks: ["create", "edit", "replace"],
    badges: ["4k"],
    usd: 0.08,
    resolutions: { "0.5K": 0.75, "1K": 1, "2K": 1.5, "4K": 2 },
    maxImages: 4,
    maxRefs: 13,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:nano-banana-pro",
    provider: "fal",
    vendor: "Google",
    label: "Nano Banana Pro",
    blurb: "Google's best, native 4K.",
    tasks: ["create", "edit", "replace"],
    badges: ["4k", "text"],
    usd: 0.15,
    resolutions: { "1K": 1, "2K": 1, "4K": 2 },
    maxImages: 4,
    maxRefs: 10,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:seedream-5-pro",
    provider: "fal",
    vendor: "ByteDance",
    label: "Seedream 5.0 Pro",
    blurb: "Strong editor and 2K photoreal output.",
    tasks: ["create", "edit", "replace"],
    badges: ["photo"],
    usd: 0.0675,
    resolutions: { "1K": 1, "2K": 2 },
    maxImages: 4,
    maxRefs: 9,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:seedream-5-lite",
    provider: "fal",
    vendor: "ByteDance",
    label: "Seedream 5.0 Lite",
    blurb: "Good quality for less.",
    tasks: ["create", "edit", "replace"],
    badges: ["cheap"],
    usd: 0.035,
    resolutions: { "1K": 1, "2K": 1 },
    maxImages: 4,
    maxRefs: 9,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:seedream-5-flash",
    provider: "fal",
    vendor: "ByteDance",
    label: "Seedream 5.0 Flash",
    blurb: "Fast and cheap generation and edits.",
    tasks: ["create", "edit", "replace"],
    badges: ["cheap", "fast"],
    usd: 0.027,
    resolutions: { "1K": 1, "2K": 1 },
    maxImages: 4,
    maxRefs: 9,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:ideogram-v4",
    provider: "fal",
    vendor: "Ideogram",
    label: "Ideogram 4.0",
    blurb: "Posters and lettering, via fal.",
    tasks: ["create", "edit"],
    badges: ["text", "design"],
    qualities: { low: 0.0075, medium: 0.015, high: 0.025 },
    qualityLabels: { low: "Turbo", medium: "Balanced", high: "Quality" },
    resolutions: { "1K": 1, "2K": 4 },
    maxImages: 4,
    maxRefs: 0,
    aspect: true,
  },
  {
    id: "fal:flux-2-max",
    provider: "fal",
    vendor: "Black Forest Labs",
    label: "FLUX.2 [max]",
    blurb: "Most photoreal FLUX, via fal.",
    tasks: ["create", "edit", "replace"],
    badges: ["photo"],
    usd: 0.07,
    resolutions: { "1K": 1, "2K": 2.3 },
    maxImages: 1,
    maxRefs: 7,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:flux-2-pro",
    provider: "fal",
    vendor: "Black Forest Labs",
    label: "FLUX.2 [pro]",
    blurb: "Photoreal at a good price, via fal.",
    tasks: ["create", "edit", "replace"],
    badges: ["photo"],
    usd: 0.03,
    resolutions: { "1K": 1, "2K": 2.5 },
    maxImages: 1,
    maxRefs: 7,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:flux-2-flash",
    provider: "fal",
    vendor: "Black Forest Labs",
    label: "FLUX.2 Flash",
    blurb: "Half a cent a picture. For quick ideas.",
    tasks: ["create", "edit"],
    badges: ["cheap", "fast"],
    usd: 0.005,
    resolutions: { "1K": 1, "2K": 4 },
    maxImages: 4,
    maxRefs: 3,
    aspect: true,
  },
  {
    id: "fal:grok-imagine-2",
    provider: "fal",
    vendor: "xAI",
    label: "Grok Imagine 2.0",
    blurb: "Top-5 text → image, via fal.",
    tasks: ["create", "edit", "replace"],
    qualities: { low: 0.04, medium: 0.06 },
    resolutions: { "1K": 1, "2K": 1.4 },
    maxImages: 4,
    maxRefs: 4,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:qwen-image-3",
    provider: "fal",
    vendor: "Alibaba",
    label: "Qwen Image 3",
    blurb: "Strong at text in images and precise edits.",
    tasks: ["create", "edit", "replace"],
    badges: ["text"],
    usd: 0.04,
    resolutions: { "1K": 1, "2K": 1.9 },
    maxImages: 4,
    maxRefs: 2,
    mask: "composite",
    aspect: true,
  },
  {
    id: "fal:recraft-v4.1-pro",
    provider: "fal",
    vendor: "Recraft",
    label: "Recraft V4.1 Pro",
    blurb: "Designer-grade illustrations and brand-style graphics.",
    tasks: ["create"],
    badges: ["design"],
    usd: 0.21,
    maxImages: 1,
    maxRefs: 0,
    aspect: true,
  },
  {
    id: "fal:flux-fill",
    provider: "fal",
    vendor: "Black Forest Labs",
    label: "FLUX.1 Fill [pro]",
    blurb: "Masked inpainting, via fal.",
    tasks: ["replace"],
    usd: 0.05,
    maxImages: 4,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "fal:flux-erase",
    provider: "fal",
    vendor: "Black Forest Labs",
    label: "FLUX Erase",
    blurb: "Removes the selection, via fal.",
    tasks: ["erase"],
    usd: 0.03,
    maxImages: 1,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "fal:bria-eraser",
    provider: "fal",
    vendor: "Bria",
    label: "Bria Eraser",
    blurb: "Licensed-data eraser; clean fills.",
    tasks: ["erase"],
    usd: 0.04,
    maxImages: 1,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "fal:ideogram-object-removal",
    provider: "fal",
    vendor: "Ideogram",
    label: "Ideogram Object Remover",
    blurb: "Removes the selection, via fal.",
    tasks: ["erase"],
    badges: ["cheap"],
    usd: 0.03,
    maxImages: 1,
    maxRefs: 0,
    mask: "native",
  },
  {
    id: "fal:flux-2-pro-outpaint",
    provider: "fal",
    vendor: "Black Forest Labs",
    label: "FLUX.2 Outpaint",
    blurb: "Grows the photo past its edges.",
    tasks: ["expand"],
    usd: 0.045,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:bria-expand",
    provider: "fal",
    vendor: "Bria",
    label: "Bria Expand",
    blurb: "Expands onto a larger canvas, prompt optional.",
    tasks: ["expand"],
    usd: 0.04,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:ideogram-v3-transparent",
    provider: "fal",
    vendor: "Ideogram",
    label: "Ideogram 3.0 Transparent",
    blurb: "Stickers and logos with a real transparent background.",
    tasks: ["sticker"],
    badges: ["design"],
    qualities: { low: 0.03, medium: 0.06, high: 0.09 },
    qualityLabels: { low: "Turbo", medium: "Balanced", high: "Quality" },
    maxImages: 4,
    maxRefs: 0,
    aspect: true,
  },
  {
    id: "fal:topaz-precision",
    provider: "fal",
    vendor: "Topaz",
    label: "Topaz Precision",
    blurb: "Faithful upscaling with face recovery. The print shop's choice.",
    tasks: ["upscale"],
    badges: ["best", "photo"],
    usd: 0.08,
    maxImages: 1,
    maxRefs: 0,
    upscale: [2, 4],
  },
  {
    id: "fal:crystal-upscaler",
    provider: "fal",
    vendor: "Clarity AI",
    label: "Crystal Upscaler",
    blurb: "Sharp portraits and products.",
    tasks: ["upscale"],
    usd: 0.064,
    maxImages: 1,
    maxRefs: 0,
    upscale: [2, 4],
  },
  {
    id: "fal:seedvr-upscale",
    provider: "fal",
    vendor: "ByteDance",
    label: "SeedVR2 Upscale",
    blurb: "Near-free, faithful upscaling.",
    tasks: ["upscale"],
    badges: ["cheap"],
    usd: 0.004,
    maxImages: 1,
    maxRefs: 0,
    upscale: [2, 4],
  },
  {
    id: "fal:recraft-crisp-upscale",
    provider: "fal",
    vendor: "Recraft",
    label: "Recraft Crisp Upscale",
    blurb: "Crisp edges for graphics and text.",
    tasks: ["upscale"],
    badges: ["cheap", "design"],
    usd: 0.004,
    maxImages: 1,
    maxRefs: 0,
    upscale: [4],
  },
  {
    id: "fal:birefnet",
    provider: "fal",
    vendor: "BiRefNet",
    label: "BiRefNet v2",
    blurb: "The full BiRefNet — hair and fine edges. Almost free.",
    tasks: ["removeBg"],
    badges: ["cheap"],
    usd: 0.001,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:bria-rmbg",
    provider: "fal",
    vendor: "Bria",
    label: "Bria RMBG 2.0",
    blurb: "Commercially safe background removal.",
    tasks: ["removeBg"],
    usd: 0.018,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:pixelcut-rmbg",
    provider: "fal",
    vendor: "Pixelcut",
    label: "Pixelcut Background Removal",
    blurb: "Product-photo cut-outs.",
    tasks: ["removeBg"],
    usd: 0.016,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:ideogram-rmbg",
    provider: "fal",
    vendor: "Ideogram",
    label: "Ideogram Background Remover",
    blurb: "Clean cut-outs, via fal.",
    tasks: ["removeBg"],
    badges: ["cheap"],
    usd: 0.01,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:seedream-5-pro-layerize",
    provider: "fal",
    vendor: "ByteDance",
    label: "Seedream 5.0 Pro Layerize",
    blurb: "Splits a flat picture into a clean background and up to 16 object layers.",
    tasks: ["layerize"],
    badges: ["best"],
    usd: 0.03375,
    perLayer: 6,
    maxImages: 1,
    maxRefs: 0,
  },
  {
    id: "fal:seedream-5-flash-layerize",
    provider: "fal",
    vendor: "ByteDance",
    label: "Seedream 5.0 Flash Layerize",
    blurb: "Faster, cheaper layer separation.",
    tasks: ["layerize"],
    badges: ["cheap", "fast"],
    usd: 0.027,
    perLayer: 6,
    maxImages: 1,
    maxRefs: 0,
  },

  /* ------------------------------------------------------------------- Kie */
  {
    id: "kie:nano-banana-2",
    provider: "kie",
    vendor: "Google",
    label: "Nano Banana 2",
    blurb: "About 40% under Google's price, via Kie.",
    tasks: ["create", "edit", "replace"],
    badges: ["cheap", "4k"],
    usd: 0.04,
    resolutions: { "1K": 1, "2K": 1.5, "4K": 2.25 },
    maxImages: 1,
    maxRefs: 13,
    mask: "composite",
    aspect: true,
  },
  {
    id: "kie:nano-banana-pro",
    provider: "kie",
    vendor: "Google",
    label: "Nano Banana Pro",
    blurb: "Google's best for less, via Kie.",
    tasks: ["create", "edit", "replace"],
    badges: ["4k"],
    usd: 0.09,
    resolutions: { "1K": 1, "2K": 1, "4K": 1.33 },
    maxImages: 1,
    maxRefs: 7,
    mask: "composite",
    aspect: true,
  },
  {
    id: "kie:seedream-5-pro",
    provider: "kie",
    vendor: "ByteDance",
    label: "Seedream 5.0 Pro",
    blurb: "Photoreal edits, cheaper via Kie.",
    tasks: ["create", "edit", "replace"],
    badges: ["cheap"],
    qualities: { medium: 0.035, high: 0.05 },
    qualityLabels: { medium: "Basic", high: "High" },
    maxImages: 1,
    maxRefs: 9,
    mask: "composite",
    aspect: true,
  },
  {
    id: "kie:gpt-image-2.5-flare",
    provider: "kie",
    vendor: "OpenAI",
    label: "GPT Image 2.5 Flare",
    blurb: "GPT Image via Kie. Transparent backgrounds.",
    tasks: ["create", "edit", "replace", "sticker"],
    usd: 0.03,
    resolutions: { "1K": 1, "2K": 1.6, "4K": 2.7 },
    maxImages: 1,
    maxRefs: 15,
    mask: "composite",
    aspect: true,
  },
  {
    id: "kie:gpt-image-2.5-sunburst",
    provider: "kie",
    vendor: "OpenAI",
    label: "GPT Image 2.5 Sunburst",
    blurb: "The precision editor via Kie.",
    tasks: ["create", "edit", "replace", "sticker"],
    usd: 0.03,
    resolutions: { "1K": 1, "2K": 1.6, "4K": 2.7 },
    maxImages: 1,
    maxRefs: 15,
    mask: "composite",
    aspect: true,
  },
  {
    id: "kie:topaz-upscale",
    provider: "kie",
    vendor: "Topaz",
    label: "Topaz Upscale",
    blurb: "Topaz upscaling via Kie.",
    tasks: ["upscale"],
    usd: 0.05,
    maxImages: 1,
    maxRefs: 0,
    upscale: [2, 4],
  },
];

export const TASK_LABELS: Record<AiTask, { title: string; hint: string; needsImage: boolean; needsMask: boolean; needsPrompt: boolean }> = {
  create: { title: "Create", hint: "Describe a picture and add it to your design.", needsImage: false, needsMask: false, needsPrompt: true },
  sticker: { title: "Sticker", hint: "An object on a transparent background — ready to place anywhere.", needsImage: false, needsMask: false, needsPrompt: true },
  edit: { title: "Edit photo", hint: "Change the selected photo by describing what you want.", needsImage: true, needsMask: false, needsPrompt: true },
  replace: { title: "Replace", hint: "Select an object, then describe what goes there. Everything else stays exactly as it is.", needsImage: true, needsMask: true, needsPrompt: true },
  erase: { title: "Erase", hint: "Select an object and it is removed, with the space rebuilt.", needsImage: true, needsMask: true, needsPrompt: false },
  expand: { title: "Expand", hint: "Grow the photo past its edges to a new shape.", needsImage: true, needsMask: false, needsPrompt: false },
  upscale: { title: "Upscale", hint: "More pixels for a sharper print.", needsImage: true, needsMask: false, needsPrompt: false },
  removeBg: { title: "Remove BG", hint: "Keep the subject on a transparent background.", needsImage: true, needsMask: false, needsPrompt: false },
  layerize: { title: "Separate layers", hint: "Split the photo into a background and each object as its own layer.", needsImage: true, needsMask: false, needsPrompt: false },
};

export const TASK_ORDER: AiTask[] = ["create", "sticker", "edit", "replace", "erase", "expand", "upscale", "removeBg", "layerize"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  google: "Google Gemini",
  ideogram: "Ideogram",
  bfl: "Black Forest Labs",
  xai: "xAI",
  fal: "fal.ai",
  kie: "Kie.ai",
};

export function findModel(id: string): AiModel | undefined {
  return MODELS.find((m) => m.id === id);
}

/** The models that can do `task`, among the providers configured. */
export function modelsFor(task: AiTask, providers: ReadonlySet<ProviderId> | readonly ProviderId[]): AiModel[] {
  const set = providers instanceof Set ? providers : new Set(providers as readonly ProviderId[]);
  return MODELS.filter((m) => m.tasks.includes(task) && set.has(m.provider));
}

export const QUALITY_ORDER: QualityId[] = ["low", "medium", "high", "xhigh", "max"];
export const RESOLUTION_ORDER: ResolutionId[] = ["0.5K", "1K", "2K", "4K", "8K"];

/** The tier offered first: the cheapest that isn't a draft. */
export function defaultQuality(model: AiModel): QualityId | undefined {
  if (!model.qualities) return undefined;
  const tiers = QUALITY_ORDER.filter((q) => model.qualities![q] !== undefined);
  return tiers.includes("medium") ? "medium" : tiers[0];
}

export function defaultResolution(model: AiModel): ResolutionId | undefined {
  if (!model.resolutions) return undefined;
  return model.resolutions["1K"] !== undefined ? "1K" : RESOLUTION_ORDER.find((r) => model.resolutions![r] !== undefined);
}

export interface CostOptions {
  quality?: QualityId;
  resolution?: ResolutionId;
  count?: number;
}

/** Estimated US dollars for one request. */
export function estimateCost(model: AiModel, options: CostOptions = {}): number {
  const quality = options.quality ?? defaultQuality(model);
  const base = (quality && model.qualities?.[quality]) ?? model.usd ?? 0;
  const resolution = options.resolution ?? defaultResolution(model);
  const mult = (resolution && model.resolutions?.[resolution]) ?? 1;
  const each = base * mult * (model.perLayer ?? 1);
  const count = Math.max(1, Math.min(model.maxImages, Math.round(options.count ?? 1)));
  return Math.round(each * count * 10000) / 10000;
}

/** "≈ $0.05" / "≈ ₹4" — prices shown in the studio. */
export function formatCost(usd: number, currency: "USD" | "INR" = "USD", inrPerUsd = 88): string {
  if (currency === "INR") {
    const inr = usd * inrPerUsd;
    return `≈ ₹${inr < 1 ? inr.toFixed(2) : inr < 10 ? inr.toFixed(1) : Math.round(inr)}`;
  }
  return `≈ $${usd < 0.01 ? usd.toFixed(4) : usd < 1 ? usd.toFixed(3) : usd.toFixed(2)}`;
}
