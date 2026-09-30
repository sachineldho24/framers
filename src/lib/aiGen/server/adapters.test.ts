/**
 * Provider adapters against a stubbed `fetch`: the requests they send (URL,
 * auth header, body fields) and how they read each provider's answer. No
 * network, no keys — the shapes are the ones in each provider's API reference.
 */

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { findModel, type AiTask } from "../catalog.ts";
import type { AdapterInput, InputImage } from "./types.ts";
import { openai } from "./adapters/openai.ts";
import { google } from "./adapters/google.ts";
import { ideogram } from "./adapters/ideogram.ts";
import { bfl } from "./adapters/bfl.ts";
import { xai } from "./adapters/xai.ts";
import { fal } from "./adapters/fal.ts";
import { kie } from "./adapters/kie.ts";

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  json?: Record<string, unknown>;
  form?: Map<string, unknown[]>;
}

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let seen: Seen[] = [];
let replies: ((req: Seen) => unknown)[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  seen = [];
  replies = [];
  for (const k of ["OPENAI_API_KEY", "GEMINI_API_KEY", "IDEOGRAM_API_KEY", "BFL_API_KEY", "XAI_API_KEY", "FAL_KEY", "KIE_API_KEY"]) {
    process.env[k] = `test-${k}`;
  }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const req: Seen = { url, method: init?.method ?? "GET", headers };
    if (typeof init?.body === "string") req.json = JSON.parse(init.body);
    else if (init?.body instanceof FormData) {
      req.form = new Map();
      for (const [k, v] of init.body.entries()) req.form.set(k, [...(req.form.get(k) ?? []), v]);
    }
    seen.push(req);
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected request ${url}`);
    const body = reply(req);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function img(width = 64, height = 48, mime: InputImage["mime"] = "image/png"): InputImage {
  return { mime, width, height, bytes: new Uint8Array([1, 2, 3]) };
}

function input(model: string, task: AiTask, extra: Partial<AdapterInput> = {}): AdapterInput {
  return {
    model: findModel(model)!,
    task,
    prompt: "a red bicycle",
    count: 1,
    refs: [],
    deadline: Date.now() + 5000,
    publicUrl: async () => "https://storage.test/signed/in.png",
    ...extra,
  };
}

test("OpenAI: generations with a free size, then edits with image[] and an alpha mask", async () => {
  replies.push(() => ({ data: [{ b64_json: PNG_B64 }] }));
  const out = await openai(input("openai:gpt-image-2.5-flare", "create", { aspect: "16:9", quality: "high" }));
  assert.equal(seen[0].url, "https://api.openai.com/v1/images/generations");
  assert.equal(seen[0].headers.authorization, "Bearer test-OPENAI_API_KEY");
  assert.equal(seen[0].json!.model, "gpt-image-2.5-flare");
  assert.equal(seen[0].json!.quality, "high");
  const [w, h] = String(seen[0].json!.size).split("x").map(Number);
  assert.ok(w % 16 === 0 && h % 16 === 0 && Math.abs(w / h - 16 / 9) < 0.02);
  assert.equal(out.images.length, 1);
  assert.ok(out.images[0].bytes!.length > 0);

  replies.push(() => ({ data: [{ b64_json: PNG_B64 }] }));
  await openai(input("openai:gpt-image-2.5-sunburst", "replace", { image: img(), mask: img() }));
  assert.equal(seen[1].url, "https://api.openai.com/v1/images/edits");
  assert.equal(seen[1].form!.get("image[]")!.length, 1);
  assert.ok(seen[1].form!.has("mask"));
  assert.equal(seen[1].form!.get("size")![0], "auto");

  replies.push(() => ({ data: [{ b64_json: PNG_B64 }] }));
  await openai(input("openai:gpt-image-2.5-flare", "sticker"));
  assert.equal(seen[2].json!.background, "transparent");
});

test("Google: one Interactions call per picture, tinted copy for Replace, images found in steps", async () => {
  const answer = () => ({ steps: [{ type: "model_output", content: [{ type: "text", text: "ok" }, { type: "image", mime_type: "image/png", data: PNG_B64 }] }] });
  replies.push(answer, answer);
  const out = await google(input("google:gemini-3.1-flash-image", "create", { count: 2, aspect: "4:5", resolution: "2K" }));
  assert.equal(seen.length, 2);
  assert.equal(seen[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(seen[0].headers["x-goog-api-key"], "test-GEMINI_API_KEY");
  const format = seen[0].json!.response_format as Record<string, string>;
  assert.deepEqual([format.aspect_ratio, format.image_size], ["4:5", "2K"]);
  assert.equal(seen[0].json!.store, false);
  assert.equal(out.images.length, 2);

  replies.push(answer);
  await google(input("google:gemini-3-pro-image", "replace", { image: img(), highlight: img() }));
  const parts = seen[2].json!.input as { type: string; text?: string }[];
  assert.deepEqual(parts.map((p) => p.type), ["text", "image", "image"]);
  assert.match(parts[0].text!, /tinted red/);
});

test("Ideogram: 4.0 generate with a preset resolution and speed; inpaint and remove-object with masks", async () => {
  replies.push(() => ({ data: [{ url: "https://ideogram.test/a.png", is_image_safe: true }] }));
  const out = await ideogram(input("ideogram:v4", "create", { aspect: "16:9", quality: "high" }));
  assert.equal(seen[0].url, "https://api.ideogram.ai/v1/ideogram-v4/generate");
  assert.equal(seen[0].headers["api-key"], "test-IDEOGRAM_API_KEY");
  assert.equal(seen[0].form!.get("resolution")![0], "1280x720");
  assert.equal(seen[0].form!.get("rendering_speed")![0], "QUALITY");
  assert.equal(out.images[0].url, "https://ideogram.test/a.png");

  replies.push(() => ({ data: [{ url: "https://ideogram.test/b.png" }] }));
  await ideogram(input("ideogram:v4", "sticker", { aspect: "4:5" }));
  assert.equal(seen[1].url, "https://api.ideogram.ai/v1/ideogram-v4/generate-transparent");
  assert.equal(seen[1].form!.get("aspect_ratio")![0], "4x5");

  replies.push(() => ({ data: [{ url: "https://ideogram.test/c.png" }] }));
  await ideogram(input("ideogram:remove-object", "erase", { image: img(), mask: img() }));
  assert.equal(seen[2].url, "https://api.ideogram.ai/v1/remove-object");
  assert.ok(seen[2].form!.has("mask"));

  replies.push(() => ({ data: [{ url: null, is_image_safe: false }] }));
  await assert.rejects(ideogram(input("ideogram:v4", "create")), /safety/i);
});

test("FLUX: submit, poll the polling URL until Ready, report the cost", async () => {
  replies.push(() => ({ id: "job1", polling_url: "https://api.bfl.test/poll?id=job1", cost: 4.5 }));
  replies.push(() => ({ status: "Pending" }));
  replies.push(() => ({ status: "Ready", result: { sample: "https://bfl.test/out.png" } }));
  const out = await bfl(input("bfl:flux-2-pro", "edit", { image: img(), refs: [img()] }));
  assert.equal(seen[0].url, "https://api.bfl.ai/v1/flux-2-pro");
  assert.equal(seen[0].headers["x-key"], "test-BFL_API_KEY");
  assert.ok(seen[0].json!.input_image && seen[0].json!.input_image_2);
  assert.equal(seen[1].url, "https://api.bfl.test/poll?id=job1");
  assert.equal(out.images[0].url, "https://bfl.test/out.png");
  assert.equal(out.costUsd, 0.045);

  replies.push(() => ({ id: "job2", polling_url: "https://api.bfl.test/poll?id=job2" }));
  replies.push(() => ({ status: "Content Moderated" }));
  await assert.rejects(bfl(input("bfl:flux-fill", "replace", { image: img(), mask: img() })), /safety/i);
  assert.equal(seen[3].url, "https://api.bfl.ai/v1/flux-pro-1.0-fill");
});

test("xAI: generations with b64 output; edits send the picture as a data URL", async () => {
  replies.push(() => ({ data: [{ b64_json: PNG_B64 }] }));
  await xai(input("xai:grok-imagine-image-2.0", "create", { aspect: "3:2", resolution: "2K" }));
  assert.equal(seen[0].url, "https://api.x.ai/v1/images/generations");
  assert.deepEqual([seen[0].json!.aspect_ratio, seen[0].json!.resolution, seen[0].json!.response_format], ["3:2", "2k", "b64_json"]);

  replies.push(() => ({ data: [{ b64_json: PNG_B64 }] }));
  await xai(input("xai:grok-imagine-image-2.0", "edit", { image: img() }));
  assert.equal(seen[1].url, "https://api.x.ai/v1/images/edits");
  assert.match((seen[1].json!.image as { url: string }).url, /^data:image\/png;base64,/);
});

test("fal: queue submit → status → result, per-model endpoints and fields", async () => {
  const queue = (id: string, out: unknown) => {
    replies.push(() => ({ request_id: id, status_url: `https://queue.fal.test/${id}/status`, response_url: `https://queue.fal.test/${id}` }));
    replies.push(() => ({ status: "COMPLETED" }));
    replies.push(() => out);
  };

  queue("r1", { images: [{ url: "https://fal.test/1.png" }] });
  const out = await fal(input("fal:nano-banana-2", "create", { aspect: "9:16", resolution: "4K", count: 2 }));
  assert.equal(seen[0].url, "https://queue.fal.run/fal-ai/nano-banana-2");
  assert.equal(seen[0].headers.authorization, "Key test-FAL_KEY");
  assert.deepEqual([seen[0].json!.aspect_ratio, seen[0].json!.resolution, seen[0].json!.num_images], ["9:16", "4K", 2]);
  assert.equal(out.images[0].url, "https://fal.test/1.png");

  queue("r2", { image: { url: "https://fal.test/2.png" } });
  await fal(input("fal:flux-2-pro-outpaint", "expand", { image: img(), padding: { left: 10, top: 0, right: 30, bottom: 5 } }));
  assert.equal(seen[3].url, "https://queue.fal.run/fal-ai/flux-2-pro/outpaint");
  assert.deepEqual([seen[3].json!.expand_left, seen[3].json!.expand_right, seen[3].json!.expand_bottom], [10, 30, 5]);

  queue("r3", { images: [{ url: "https://fal.test/3.png" }] });
  await fal(input("fal:gpt-image-2.5-sunburst", "replace", { image: img(), mask: img() }));
  assert.equal(seen[6].url, "https://queue.fal.run/openai/gpt-image-2.5/sunburst/edit");
  assert.match(String(seen[6].json!.mask_url), /^data:image\/png;base64,/);

  queue("r4", {
    layers: [
      { image: { url: "https://fal.test/base.png" }, z_index: 0 },
      { image: { url: "https://fal.test/cup.png" }, z_index: 2, name: "Cup", bounding_box: { absolute: [10, 20, 110, 220] } },
      { image: { url: "https://fal.test/plant.png" }, z_index: 1, name: "Plant", bounding_box: { absolute: [0, 0, 50, 50] } },
    ],
    images: [],
  });
  const layered = await fal(input("fal:seedream-5-pro-layerize", "layerize", { image: img() }));
  assert.equal(seen[9].url, "https://queue.fal.run/bytedance/seedream/v5/pro/layerize");
  assert.deepEqual(layered.images.map((i) => i.url), ["https://fal.test/base.png", "https://fal.test/plant.png", "https://fal.test/cup.png"]);
  assert.deepEqual(layered.layers!.map((l) => [l.name, l.z]), [["Plant", 1], ["Cup", 2]]);
  assert.deepEqual(layered.layers![1].box, [10, 20, 110, 220]);
});

test("Kie: createTask with URL inputs, poll recordInfo, read resultUrls", async () => {
  replies.push(() => ({ code: 200, data: { taskId: "t1" } }));
  replies.push(() => ({ code: 200, data: { state: "generating" } }));
  replies.push(() => ({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://kie.test/a.png"] }) } }));
  const out = await kie(input("kie:nano-banana-2", "edit", { image: img(), resolution: "2K" }));
  assert.equal(seen[0].url, "https://api.kie.ai/api/v1/jobs/createTask");
  assert.equal(seen[0].headers.authorization, "Bearer test-KIE_API_KEY");
  assert.equal(seen[0].json!.model, "nano-banana-2");
  const taskInput = seen[0].json!.input as Record<string, unknown>;
  assert.deepEqual(taskInput.image_input, ["https://storage.test/signed/in.png"]);
  assert.equal(taskInput.resolution, "2K");
  assert.match(String(seen[0].json!.callBackUrl), /\/api\/studio\/ai\/callback$/);
  assert.equal(seen[1].url, "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=t1");
  assert.equal(out.images[0].url, "https://kie.test/a.png");

  replies.push(() => ({ code: 402, msg: "Insufficient credits" }));
  await assert.rejects(kie(input("kie:seedream-5-pro", "create")), /Insufficient credits/);
});
