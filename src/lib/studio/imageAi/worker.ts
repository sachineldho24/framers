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
 * Both are plain convolutional networks, chosen because they run everywhere:
 * on the GPU through WebGPU where the browser has it, otherwise on the CPU
 * through WebAssembly — slower, same result. They run through ONNX Runtime in
 * a worker, so a slow device shows a progress bar rather than a frozen page.
 */

import type { CropRect, Stroke } from "../document";
import { inpaint } from "../inpaint";
import { paintStrokes } from "../strokes";
import type { ImageAiRequest, ImageAiResponse, ImageAiStage } from "./protocol";

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
  post({ id, type: "done", image, width, height });
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
  post({ id, type: "done", image, width: W, height: H });
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
  post({ id, type: "done", image, width, height });
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
    } else await enhance(request.id, request.image, request.scale);
  } catch (error) {
    post({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      gpuFailed: error instanceof GpuFailed,
    });
  }
};
