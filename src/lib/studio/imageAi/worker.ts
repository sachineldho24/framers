/**
 * The studio's image-AI worker: background removal and Enhance, run on the
 * customer's own device. Nothing is uploaded to be processed and nothing is paid
 * per use; the price is a one-time model download (cached by the browser) and
 * the device's own time.
 *
 * - Remove background: ISNet "general use" (DIS, Apache-2.0), fp16, ~90 MB,
 *   from wherever NEXT_PUBLIC_BG_MODEL_URL points (the client passes it in).
 *   It predicts a 1024² matte, which is stretched back over the photo at full
 *   resolution, so the cutout keeps every original pixel.
 * - Enhance: Real-ESRGAN general x4v3 (BSD-3), served from our own
 *   /models/upscale (see the README there), run tile by tile so a large photo
 *   never needs the whole ×4 image in memory.
 *
 * - Object selection: SlimSAM (see its section) — tap an object, get its mask,
 *   its outline, and optionally the photo with it filled in.
 *
 * All are small enough to run everywhere:
 * on the GPU through WebGPU where the browser has it, otherwise on the CPU
 * through WebAssembly — slower, same result. They run through ONNX Runtime in
 * a worker, so a slow device shows a progress bar rather than a frozen page.
 */

import type { CropRect, Stroke } from "../document";
import { inpaint } from "../inpaint";
import { outlineMask } from "../maskTrace";
import { paintStrokes } from "../strokes";
import type { ImageAiRequest, ImageAiResponse, ImageAiStage, MaskCandidate, SegPrompt } from "./protocol";

type Ort = typeof import("onnxruntime-web/webgpu");
type Session = import("onnxruntime-web").InferenceSession;

/** ISNet's input: its matte is predicted at this square size. */
const BG_SIZE = 1024;

const UPSCALE_MODEL_URL = "/models/upscale/realesr-general-x4v3.onnx";
const UPSCALE_FACTOR = 4;
/**
 * Tiles: `core` pixels are kept from each, `pad` pixels of context on every
 * side are thrown away (the model's edges are unreliable). One fixed input size
 * per device, so the GPU compiles its shaders once.
 */
const TILE = { gpu: { core: 224, pad: 16 }, cpu: { core: 112, pad: 16 } };
/** Extra px drawn past a tile's edge, then clipped, so no seam can show. */
const BLEED = 2;

/**
 * Large models are kept in the Cache API rather than trusted to the HTTP
 * cache, which is free to evict a 90 MB response whenever it likes.
 */
const MODEL_CACHE = "framers-image-ai-v1";

function post(message: ImageAiResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(message, transfer ?? []);
}

/* ----------------------------------------------------------------- device */

/** Set by the client after a GPU failure; this worker is a fresh one. */
let cpuOnly = false;
let gpuAvailable: Promise<boolean> | null = null;

function detectGpu(): Promise<boolean> {
  gpuAvailable ??= (async () => {
    if (cpuOnly) return false;
    try {
      const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      return !!(gpu && (await gpu.requestAdapter()));
    } catch {
      return false;
    }
  })();
  return gpuAvailable;
}

/** The GPU couldn't run a model. The client retries the job on the CPU. */
class GpuFailed extends Error {}

/**
 * Anything that fails while on the GPU is the GPU's fault until shown otherwise.
 * The client starts a fresh worker rather than trusting this one to recover.
 */
async function onGpu<T>(gpu: boolean, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!gpu) throw error;
    console.warn("[imageAi] GPU failed, the client will retry on the CPU:", error);
    throw new GpuFailed(error instanceof Error ? error.message : String(error));
  }
}

/* ---------------------------------------------------------------- runtime */

// The runtime's WebAssembly (~27 MB) is emitted by the bundler as one of our
// own static files and fetched only when a tool is first used.
let ort: Promise<Ort> | null = null;
function loadOrt(): Promise<Ort> {
  ort ??= import("onnxruntime-web/webgpu");
  return ort;
}

/** A session on the GPU when there is one, otherwise on the CPU. */
async function createSession(bytes: Uint8Array): Promise<{ ort: Ort; session: Session; gpu: boolean }> {
  const [o, gpu] = await Promise.all([loadOrt(), detectGpu()]);
  const session = await onGpu(gpu, () =>
    o.InferenceSession.create(bytes, { executionProviders: [gpu ? "webgpu" : "wasm"] })
  );
  return { ort: o, session, gpu };
}

/* --------------------------------------------------------------- progress */

function reporter(id: number, gpu: boolean) {
  let last = 0;
  return (stage: ImageAiStage, fraction?: number) => {
    // A 20-tile job posting per tile is fine; a download posting per chunk isn't.
    const now = performance.now();
    if (fraction !== undefined && fraction < 1 && now - last < 120) return;
    last = now;
    post({ id, type: "progress", stage, fraction, gpu });
  };
}

/* ----------------------------------------------------------------- models */

async function fetchWithProgress(url: string, onFraction: (f: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not download the model (${res.status}).`);
  const total = Number(res.headers.get("Content-Length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) onFraction(loaded / total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * A model from the Cache API, or downloaded and put there. A browser that
 * refuses the cache (private mode) just downloads it each visit.
 */
async function cachedModel(url: string, onFraction: (f: number) => void): Promise<Uint8Array> {
  const key = new URL(url, self.location.origin).href;
  try {
    const hit = await (await caches.open(MODEL_CACHE)).match(key);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    // No cache here; carry on without it.
  }
  const bytes = await fetchWithProgress(url, onFraction);
  try {
    await (await caches.open(MODEL_CACHE)).put(key, new Response(bytes as BlobPart));
  } catch {
    // Full or unavailable: the next visit downloads again, nothing worse.
  }
  return bytes;
}

/* -------------------------------------------------------- remove background */

let bgModel: { url: string; model: Promise<{ ort: Ort; session: Session; gpu: boolean }> } | null = null;

async function removeBackground(id: number, blob: Blob, modelUrl: string) {
  const report = reporter(id, await detectGpu());
  report("download");
  let entry = bgModel;
  if (entry?.url !== modelUrl) {
    const model = cachedModel(modelUrl, (f) => report("download", f)).then(createSession);
    entry = bgModel = { url: modelUrl, model };
    // A failed load isn't kept: the next try downloads again.
    model.catch(() => {
      if (bgModel?.model === model) bgModel = null;
    });
  }
  const { ort: o, session, gpu } = await entry.model;
  reporter(id, gpu)("process");

  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  // The model sees the whole photo squeezed into its square…
  const small = new OffscreenCanvas(BG_SIZE, BG_SIZE);
  const smallCtx = small.getContext("2d", { willReadFrequently: true })!;
  smallCtx.imageSmoothingQuality = "high";
  smallCtx.drawImage(bitmap, 0, 0, BG_SIZE, BG_SIZE);
  const px = smallCtx.getImageData(0, 0, BG_SIZE, BG_SIZE).data;
  const plane = BG_SIZE * BG_SIZE;
  const input = new Float32Array(3 * plane);
  // DIS's own normalisation: 0–1, centred on 0.5, no scaling.
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = px[i * 4 + c] / 255 - 0.5;
  }
  const result = await onGpu(gpu, () =>
    session.run({ input_image: new o.Tensor("float32", input, [1, 3, BG_SIZE, BG_SIZE]) })
  );
  const prediction = result.output_image.data as Float32Array;

  // Stretched to the full 0–1 range, as DIS's inference does: the raw output
  // rarely reaches either end, which would leave the subject faintly see-through.
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of prediction) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo || 1;
  const matte = new ImageData(BG_SIZE, BG_SIZE);
  for (let i = 0; i < plane; i++) matte.data[i * 4 + 3] = ((prediction[i] - lo) / range) * 255;
  result.output_image.dispose?.();
  smallCtx.putImageData(matte, 0, 0);

  // …and its matte is stretched back over the full-size original, smoothly,
  // so the cut edge is soft rather than stair-stepped.
  const out = new OffscreenCanvas(width, height);
  const ctx = out.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, width, height);
  bitmap.close();

  const image = await encode(out, true);
  post({ id, type: "done", result: { kind: "image", image, width, height } });
}

/* ---------------------------------------------------------------- enhance */

interface UpscaleModel {
  gpu: boolean;
  ort: Ort;
  session: Session;
}

let upscaleModel: Promise<UpscaleModel> | null = null;

async function createUpscaleModel(onFraction: (f: number) => void): Promise<UpscaleModel> {
  return createSession(await fetchWithProgress(UPSCALE_MODEL_URL, onFraction));
}

async function enhance(id: number, blob: Blob, scale: number) {
  const report = reporter(id, await detectGpu());
  report("download");
  upscaleModel ??= createUpscaleModel((f) => report("download", f)).catch((error) => {
    upscaleModel = null;
    throw error;
  });
  const { session, ort: o, gpu: sessionOnGpu } = await upscaleModel;
  const progress = reporter(id, sessionOnGpu);
  progress("process", 0);

  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const source = new OffscreenCanvas(w, h);
  const sourceCtx = source.getContext("2d", { willReadFrequently: true })!;
  sourceCtx.drawImage(bitmap, 0, 0);
  const px = sourceCtx.getImageData(0, 0, w, h).data;

  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 255) {
      hasAlpha = true;
      break;
    }
  }

  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  const out = new OffscreenCanvas(W, H);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  const { core, pad } = sessionOnGpu ? TILE.gpu : TILE.cpu;
  const size = core + pad * 2;
  const input = new Float32Array(3 * size * size);
  const plane = size * size;
  const cols = Math.ceil(w / core);
  const rows = Math.ceil(h / core);
  const tileCanvas = new OffscreenCanvas(1, 1);
  const tileCtx = tileCanvas.getContext("2d")!;
  const edge = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * core;
      const y0 = row * core;
      const cw = Math.min(core, w - x0);
      const ch = Math.min(core, h - y0);

      // Every tile is the same size: past the photo's edge the border pixels
      // repeat, which the model reads as "more of the same" rather than a line.
      for (let ty = 0; ty < size; ty++) {
        const sy = edge(y0 - pad + ty, h - 1);
        for (let tx = 0; tx < size; tx++) {
          const sx = edge(x0 - pad + tx, w - 1);
          const s = (sy * w + sx) * 4;
          const d = ty * size + tx;
          input[d] = px[s] / 255;
          input[plane + d] = px[s + 1] / 255;
          input[plane * 2 + d] = px[s + 2] / 255;
        }
      }

      const result = await onGpu(sessionOnGpu, () =>
        session.run({ input: new o.Tensor("float32", input, [1, 3, size, size]) })
      );
      const output = result.output.data as Float32Array;
      result.output.dispose?.();

      // Keep the core plus a little bleed; clip to the core when drawing.
      const outSize = size * UPSCALE_FACTOR;
      const outPlane = outSize * outSize;
      const keepW = (cw + BLEED * 2) * UPSCALE_FACTOR;
      const keepH = (ch + BLEED * 2) * UPSCALE_FACTOR;
      const from = (pad - BLEED) * UPSCALE_FACTOR;
      const tile = new ImageData(keepW, keepH);
      for (let y = 0; y < keepH; y++) {
        for (let x = 0; x < keepW; x++) {
          const s = (from + y) * outSize + from + x;
          const d = (y * keepW + x) * 4;
          tile.data[d] = output[s] * 255;
          tile.data[d + 1] = output[outPlane + s] * 255;
          tile.data[d + 2] = output[outPlane * 2 + s] * 255;
          tile.data[d + 3] = 255;
        }
      }
      tileCanvas.width = keepW;
      tileCanvas.height = keepH;
      tileCtx.putImageData(tile, 0, 0);

      const left = Math.round(x0 * scale);
      const top = Math.round(y0 * scale);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, Math.round((x0 + cw) * scale) - left, Math.round((y0 + ch) * scale) - top);
      ctx.clip();
      ctx.drawImage(
        tileCanvas,
        (x0 - BLEED) * scale,
        (y0 - BLEED) * scale,
        (cw + BLEED * 2) * scale,
        (ch + BLEED * 2) * scale
      );
      ctx.restore();

      progress("process", (row * cols + col + 1) / (rows * cols));
    }
  }

  // The model only sees colour. A cutout's transparency is carried across by
  // stretching the original's alpha over the result.
  if (hasAlpha) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(bitmap, 0, 0, W, H);
  }
  bitmap.close();

  const image = await encode(out, hasAlpha);
  post({ id, type: "done", result: { kind: "image", image, width: W, height: H } });
}

/* ------------------------------------------------------------ erase object */

/**
 * Content-aware fill under the customer's brush strokes. No model to fetch —
 * `inpaint.ts` borrows texture from the rest of the photo — so it is ready at
 * once, on any device.
 */
async function eraseObject(
  id: number,
  blob: Blob,
  strokes: Stroke[],
  crop: CropRect,
  flipX: boolean,
  flipY: boolean
) {
  // Not a GPU job, but not a slow one either: no "this device is slow" warning.
  const progress = reporter(id, true);
  progress("process", 0);

  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, width, height);

  // The strokes were painted over the layer's box, which shows the crop window
  // of the source, mirrored as the layer is (the same mapping `render.ts` draws
  // with). Replayed through that mapping, they land on the source pixels.
  const maskCanvas = new OffscreenCanvas(width, height);
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  const cropX = (flipX ? 1 - crop.x - crop.w : crop.x) * width;
  const cropY = (flipY ? 1 - crop.y - crop.h : crop.y) * height;
  const cropW = crop.w * width;
  const cropH = crop.h * height;
  maskCtx.translate(cropX + (flipX ? cropW : 0), cropY + (flipY ? cropH : 0));
  maskCtx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  paintStrokes(maskCtx, strokes, cropW, cropH);
  const painted = maskCtx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = painted[i * 4 + 3] > 16 ? 255 : 0;

  const filled = inpaint(pixels, mask, { onProgress: (f) => progress("process", f) });

  let hasAlpha = false;
  for (let i = 3; i < filled.length; i += 4) {
    if (filled[i] < 255) {
      hasAlpha = true;
      break;
    }
  }
  ctx.putImageData(new ImageData(filled, width, height), 0, 0);
  const image = await encode(canvas, hasAlpha);
  post({ id, type: "done", result: { kind: "image", image, width, height } });
}

/* --------------------------------------------------------- object selection */

/**
 * SlimSAM (Apache-2.0), a slimmed Segment Anything, fetched from the Hugging
 * Face hub at a pinned revision. Two parts: an image encoder run once per photo
 * (seconds), and a small prompt decoder run per click (a tenth of a second).
 *
 * Precision was chosen by testing: the quantized *decoder* picked a car's chrome
 * strip where the fp16/fp32 ones picked the car, so it is never used; the
 * quantized *encoder* chose the same objects as the full one, and is the CPU's.
 */
const SAM_BASE = "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/5850ab45f587c112167512ffef949107115e26a0/onnx/";
const SAM_SIZE = 1024;
const SAM_GRID = 256;
const SAM_MEAN = [0.485, 0.456, 0.406];
const SAM_STD = [0.229, 0.224, 0.225];

interface SamModels {
  ort: Ort;
  encoder: Session;
  decoder: Session;
  gpu: boolean;
}

let samModels: Promise<SamModels> | null = null;

async function gpuHasFp16(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as {
      gpu?: { requestAdapter(): Promise<{ features: ReadonlySet<string> } | null> };
    }).gpu;
    return !!(await gpu?.requestAdapter())?.features.has("shader-f16");
  } catch {
    return false;
  }
}

async function loadSam(onFraction: (f: number) => void): Promise<SamModels> {
  const gpu = await detectGpu();
  const fp16 = gpu && (await gpuHasFp16());
  const names = gpu
    ? fp16
      ? ["vision_encoder_fp16", "prompt_encoder_mask_decoder_fp16"]
      : ["vision_encoder", "prompt_encoder_mask_decoder"]
    : ["vision_encoder_quantized", "prompt_encoder_mask_decoder"];
  // Two downloads, one progress bar: the encoder is roughly two-thirds of it.
  const [encBytes, decBytes] = await Promise.all([
    cachedModel(`${SAM_BASE}${names[0]}.onnx`, (f) => onFraction(f * 0.6)),
    cachedModel(`${SAM_BASE}${names[1]}.onnx`, (f) => onFraction(0.6 + f * 0.4)),
  ]);
  const encoder = await createSession(encBytes);
  const decoder = await createSession(decBytes);
  return { ort: encoder.ort, encoder: encoder.session, decoder: decoder.session, gpu: encoder.gpu };
}

function getSam(report: (stage: ImageAiStage, fraction?: number) => void): Promise<SamModels> {
  samModels ??= loadSam((f) => report("download", f)).catch((error) => {
    samModels = null;
    throw error;
  });
  return samModels;
}

/** A region of the photo, analysed by the encoder. */
interface Embedding {
  image: import("onnxruntime-web").Tensor;
  positions: import("onnxruntime-web").Tensor;
  /** Source px of the region this embedding covers. */
  region: { x0: number; y0: number; x1: number; y1: number };
  /** Encoder px per source px. */
  scale: number;
  /** The unpadded part of SAM's 256² output grid. */
  gridW: number;
  gridH: number;
}

/** The photo being selected in, analysed. One at a time; a new `src` replaces it. */
let selection: {
  src: string;
  width: number;
  height: number;
  canvas: OffscreenCanvas;
  whole: Embedding;
  /** The last decode, so a commit can reuse the candidate the customer saw. */
  last?: { key: string; logits: Float32Array };
} | null = null;

async function embedRegion(
  models: SamModels,
  canvas: OffscreenCanvas,
  region: Embedding["region"]
): Promise<Embedding> {
  const rw0 = region.x1 - region.x0;
  const rh0 = region.y1 - region.y0;
  const scale = SAM_SIZE / Math.max(rw0, rh0);
  const rw = Math.max(1, Math.round(rw0 * scale));
  const rh = Math.max(1, Math.round(rh0 * scale));
  const small = new OffscreenCanvas(rw, rh);
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, region.x0, region.y0, rw0, rh0, 0, 0, rw, rh);
  const px = ctx.getImageData(0, 0, rw, rh).data;
  // Resized to 1024 on the long side, padded bottom/right with zeros (after
  // normalisation), exactly as SAM's own processor does.
  const plane = SAM_SIZE * SAM_SIZE;
  const input = new Float32Array(3 * plane);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const s = (y * rw + x) * 4;
      const d = y * SAM_SIZE + x;
      for (let c = 0; c < 3; c++) input[c * plane + d] = (px[s + c] / 255 - SAM_MEAN[c]) / SAM_STD[c];
    }
  }
  const out = await onGpu(models.gpu, () =>
    models.encoder.run({ pixel_values: new models.ort.Tensor("float32", input, [1, 3, SAM_SIZE, SAM_SIZE]) })
  );
  return {
    image: out.image_embeddings,
    positions: out.image_positional_embeddings,
    region,
    scale,
    gridW: Math.max(1, Math.round((rw / SAM_SIZE) * SAM_GRID)),
    gridH: Math.max(1, Math.round((rh / SAM_SIZE) * SAM_GRID)),
  };
}

/** Points in source px, labelled 1 (include) or 0 (exclude). */
type PxPrompt = [number, number, 0 | 1];

/** SAM's three candidates as raw logits, 3 × 256². */
async function decode(models: SamModels, emb: Embedding, prompts: PxPrompt[]) {
  const n = prompts.length;
  const points = new Float32Array(n * 2);
  const labels = new BigInt64Array(n);
  prompts.forEach(([x, y, label], i) => {
    points[i * 2] = (x - emb.region.x0) * emb.scale;
    points[i * 2 + 1] = (y - emb.region.y0) * emb.scale;
    labels[i] = BigInt(label);
  });
  const out = await onGpu(models.gpu, () =>
    models.decoder.run({
      input_points: new models.ort.Tensor("float32", points, [1, 1, n, 2]),
      input_labels: new models.ort.Tensor("int64", labels, [1, 1, n]),
      image_embeddings: emb.image,
      image_positional_embeddings: emb.positions,
    })
  );
  return {
    logits: Float32Array.from(out.pred_masks.data as Float32Array),
    scores: Array.from(out.iou_scores.data as Float32Array),
  };
}

/**
 * Candidate `k`'s logits, bilinearly resampled over the embedding's region and
 * thresholded: a full-resolution mask of the region (region width × height).
 */
function upsample(emb: Embedding, logits: Float32Array, k: number): Uint8Array {
  const { region, gridW, gridH } = emb;
  const w = region.x1 - region.x0;
  const h = region.y1 - region.y0;
  const grid = logits.subarray(k * SAM_GRID * SAM_GRID, (k + 1) * SAM_GRID * SAM_GRID);
  const out = new Uint8Array(w * h);
  const max = SAM_GRID - 1;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(max, Math.max(0, ((y + 0.5) / h) * gridH - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(max, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(max, Math.max(0, ((x + 0.5) / w) * gridW - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(max, x0 + 1);
      const tx = fx - x0;
      const v =
        (grid[y0 * SAM_GRID + x0] * (1 - tx) + grid[y0 * SAM_GRID + x1] * tx) * (1 - ty) +
        (grid[y1 * SAM_GRID + x0] * (1 - tx) + grid[y1 * SAM_GRID + x1] * tx) * ty;
      if (v > 0) out[y * w + x] = 1;
    }
  }
  return out;
}

const pxPrompts = (prompts: SegPrompt[], width: number, height: number): PxPrompt[] =>
  prompts.map((p) => [p.x * width, p.y * height, p.include ? 1 : 0]);

async function segPrepare(id: number, src: string, blob: Blob) {
  const report = reporter(id, await detectGpu());
  report("download");
  const models = await getSam(report);
  if (selection?.src === src) {
    post({ id, type: "done", result: { kind: "prepared", width: selection.width, height: selection.height } });
    return;
  }
  reporter(id, models.gpu)("process");
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const whole = await embedRegion(models, canvas, { x0: 0, y0: 0, x1: width, y1: height });
  selection = { src, width, height, canvas, whole };
  post({ id, type: "done", result: { kind: "prepared", width, height } });
}

function requireSelection(src: string) {
  // A worker released while idle loses this; the studio prepares again.
  if (selection?.src !== src) throw new Error("The photo needs to be analysed again. Please try once more.");
  return selection;
}

async function segSegment(id: number, src: string, prompts: SegPrompt[]) {
  const sel = requireSelection(src);
  const models = await getSam(() => {});
  const { logits, scores } = await decode(models, sel.whole, pxPrompts(prompts, sel.width, sel.height));
  sel.last = { key: JSON.stringify(prompts), logits };
  const { gridW, gridH } = sel.whole;
  const candidates: MaskCandidate[] = [0, 1, 2].map((k) => {
    const grid = logits.subarray(k * SAM_GRID * SAM_GRID, (k + 1) * SAM_GRID * SAM_GRID);
    const mask = new Uint8Array(gridW * gridH);
    let area = 0;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (grid[y * SAM_GRID + x] > 0) {
          mask[y * gridW + x] = 1;
          area++;
        }
      }
    }
    return { mask, width: gridW, height: gridH, score: scores[k], area };
  });
  let best = 0;
  for (let k = 1; k < 3; k++) if (scores[k] > scores[best]) best = k;
  post(
    { id, type: "done", result: { kind: "candidates", candidates, best } },
    candidates.map((c) => c.mask.buffer as ArrayBuffer)
  );
}

function maskBounds(mask: Uint8Array, w: number, h: number) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/**
 * Extra prompts for the zoomed pass, derived from the first-pass mask: its
 * deepest point in each quadrant (include) and background just beyond each side
 * of its box (exclude). With only the original click, the zoomed pass often
 * settled on a different part of the object.
 */
function derivedPrompts(mask: Uint8Array, w: number, h: number, b: { x0: number; y0: number; x1: number; y1: number }): PxPrompt[] {
  const out: PxPrompt[] = [];
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const step = Math.max(2, Math.round(Math.min(bw, bh) / 60));
  const depth = (x: number, y: number) => {
    let r = 0;
    for (;;) {
      r += step;
      if (x - r < 0 || y - r < 0 || x + r >= w || y + r >= h) return r;
      if (!mask[y * w + x - r] || !mask[y * w + x + r] || !mask[(y - r) * w + x] || !mask[(y + r) * w + x]) return r;
    }
  };
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const deepest: ([number, number, number] | null)[] = [null, null, null, null];
  for (let y = b.y0; y < b.y1; y += step) {
    for (let x = b.x0; x < b.x1; x += step) {
      if (!mask[y * w + x]) continue;
      const q = (x < cx ? 0 : 1) + (y < cy ? 0 : 2);
      const d = depth(x, y);
      if (!deepest[q] || d > deepest[q]![2]) deepest[q] = [x, y, d];
    }
  }
  for (const q of deepest) if (q && q[2] > step * 2) out.push([q[0] + 0.5, q[1] + 0.5, 1]);
  const pad = Math.round(Math.max(bw, bh) * 0.06);
  for (const [x, y] of [
    [cx, b.y0 - pad],
    [cx, b.y1 + pad],
    [b.x0 - pad, cy],
    [b.x1 + pad, cy],
  ]) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && yi >= 0 && xi < w && yi < h && !mask[yi * w + xi]) out.push([xi + 0.5, yi + 0.5, 0]);
  }
  return out;
}

async function segCommit(id: number, src: string, prompts: SegPrompt[], candidate: number, repair: boolean) {
  const sel = requireSelection(src);
  const models = await getSam(() => {});
  const progress = reporter(id, models.gpu);
  progress("process", 0);
  const { width, height } = sel;
  const px = pxPrompts(prompts, width, height);

  // The candidate the customer saw, at full resolution.
  const key = JSON.stringify(prompts);
  const logits = sel.last?.key === key ? sel.last.logits : (await decode(models, sel.whole, px)).logits;
  const first = upsample(sel.whole, logits, candidate);
  const box = maskBounds(first, width, height);
  if (!box) throw new Error("Nothing is selected. Tap the object you want.");

  // Zoomed second pass: the object's box (+15%) re-analysed on its own gives a
  // grid several times finer — crisper edges for print — and the extra prompts
  // plus the IoU check keep it on the same object.
  const margin = Math.round(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.15);
  const region = {
    x0: Math.max(0, box.x0 - margin),
    y0: Math.max(0, box.y0 - margin),
    x1: Math.min(width, box.x1 + margin),
    y1: Math.min(height, box.y1 + margin),
  };
  const rw = region.x1 - region.x0;
  const rh = region.y1 - region.y0;
  const firstInRegion = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    firstInRegion.set(first.subarray((region.y0 + y) * width + region.x0, (region.y0 + y) * width + region.x1), y * rw);
  }
  let objectMask: Uint8Array = firstInRegion;
  // Worth it unless the object already fills most of the photo.
  if (rw * rh < width * height * 0.8) {
    const zoom = await embedRegion(models, sel.canvas, region);
    progress("process", 0.35);
    const extra = derivedPrompts(first, width, height, box);
    const { logits: zl } = await decode(models, zoom, [...px, ...extra]);
    let bestIou = -1;
    for (let k = 0; k < 3; k++) {
      const m = upsample(zoom, zl, k);
      let inter = 0;
      let union = 0;
      for (let i = 0; i < m.length; i++) {
        if (m[i] && firstInRegion[i]) inter++;
        if (m[i] || firstInRegion[i]) union++;
      }
      const iou = union ? inter / union : 0;
      if (iou > bestIou) {
        bestIou = iou;
        objectMask = m;
      }
    }
    // A zoomed pass that wandered off to something else is worse than none.
    if (bestIou < 0.6) objectMask = firstInRegion;
  }
  progress("process", 0.45);

  const local = outlineMask(objectMask, rw, rh, { minArea: Math.max(4, rw * rh * 0.0002) });
  const rings = local.map((ring) => ring.map(([x, y]) => [x + region.x0, y + region.y0] as [number, number]));
  const bounds = maskBounds(objectMask, rw, rh);
  if (!bounds || rings.length === 0) throw new Error("Nothing is selected. Tap the object you want.");
  const bbox = {
    x0: bounds.x0 + region.x0,
    y0: bounds.y0 + region.y0,
    x1: bounds.x1 + region.x0,
    y1: bounds.y1 + region.y0,
  };

  let repaired: { image: Blob; width: number; height: number } | undefined;
  if (repair) {
    // Fill a little wider than the object: its soft edge and any halo go too.
    const full = new Uint8Array(width * height);
    for (let y = 0; y < rh; y++) full.set(objectMask.subarray(y * rw, (y + 1) * rw), (region.y0 + y) * width + region.x0);
    const grow = Math.max(3, Math.round(Math.hypot(bbox.x1 - bbox.x0, bbox.y1 - bbox.y0) * 0.015));
    const ctx = sel.canvas.getContext("2d", { willReadFrequently: true })!;
    const pixels = ctx.getImageData(0, 0, width, height);
    const filled = inpaint(pixels, full, { grow, onProgress: (f) => progress("process", 0.45 + f * 0.55) });
    const out = new OffscreenCanvas(width, height);
    out.getContext("2d")!.putImageData(new ImageData(filled, width, height), 0, 0);
    let hasAlpha = false;
    for (let i = 3; i < filled.length; i += 4) {
      if (filled[i] < 255) {
        hasAlpha = true;
        break;
      }
    }
    repaired = { image: await encode(out, hasAlpha), width, height };
  }
  post({ id, type: "done", result: { kind: "object", rings, bbox, repaired } });
}

/* ----------------------------------------------------------------- output */

/**
 * WebP keeps transparency at a fraction of PNG's size; Safari can't encode it
 * and hands back PNG instead, which is still correct. Opaque results are JPEG.
 */
async function encode(canvas: OffscreenCanvas, alpha: boolean): Promise<Blob> {
  if (!alpha) return canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  const webp = await canvas.convertToBlob({ type: "image/webp", quality: 0.92 });
  return webp.type === "image/webp" ? webp : canvas.convertToBlob({ type: "image/png" });
}

/* --------------------------------------------------------------- dispatch */

self.onmessage = async (event: MessageEvent<ImageAiRequest>) => {
  const request = event.data;
  cpuOnly ||= !!request.cpuOnly;
  try {
    if (request.kind === "removeBackground") await removeBackground(request.id, request.image, request.modelUrl);
    else if (request.kind === "eraseObject") {
      await eraseObject(request.id, request.image, request.strokes, request.crop, request.flipX, request.flipY);
    } else if (request.kind === "enhance") await enhance(request.id, request.image, request.scale);
    else if (request.kind === "segPrepare") await segPrepare(request.id, request.src, request.image);
    else if (request.kind === "segSegment") await segSegment(request.id, request.src, request.prompts);
    else await segCommit(request.id, request.src, request.prompts, request.candidate, request.repair);
  } catch (error) {
    post({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      gpuFailed: error instanceof GpuFailed,
    });
  }
};
