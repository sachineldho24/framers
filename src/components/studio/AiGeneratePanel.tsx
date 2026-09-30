"use client";

/**
 * Generate with AI: the studio's front door to the paid generative models.
 *
 * One panel for every job — Create, Sticker, Edit, Replace, Erase, Expand,
 * Upscale, Remove BG, Separate layers. The customer picks the job, a model
 * (only those whose provider is configured on the server are listed, each with
 * what it's good at and what it costs), the options that model understands,
 * and generates. Results come back as pictures in their own library; "Use"
 * puts one into the design as a single undo step, through the shell.
 *
 * The panel owns the picture work in between (`lib/aiGen/prepare.ts`): what
 * the model is sent, and — for Replace, Erase and Expand — pasting the
 * model's answer back into the full-resolution original so nothing outside
 * the change moves.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ASPECTS,
  PROVIDER_LABELS,
  QUALITY_ORDER,
  RESOLUTION_ORDER,
  TASK_LABELS,
  TASK_ORDER,
  defaultQuality,
  defaultResolution,
  estimateCost,
  findModel,
  formatCost,
  type AiModel,
  type AiTask,
  type AspectId,
  type QualityId,
  type ResolutionId,
} from "@/lib/aiGen/catalog";
import { AiGenError, fetchAiModels, requestGeneration, type AiFiles } from "@/lib/aiGen/client";
import {
  contextWindow,
  encodeRegion,
  expandBack,
  highlightBlob,
  loadUrl,
  maskBlob,
  paddedCanvas,
  pasteBack,
  regionCanvas,
  selectionMask,
  type Rect,
} from "@/lib/aiGen/prepare";
import type { AiGenerateRequest, AiModelsResponse, GeneratedImage, GeneratedLayer } from "@/lib/aiGen/protocol";
import { expandPadding, nearestAspect, ratioOf, scalePadding, type Padding } from "@/lib/aiGen/sizing";
import type { ImageLayer } from "@/lib/studio/document";
import type { Ring } from "@/lib/studio/maskTrace";

import { Icon } from "@/components/Icon";
import type { StudioShellUpload } from "./StudioShell";
import { IconButton, Slider, StudioButton, cx } from "./ui";

const TASK_ICONS: Record<AiTask, string> = {
  create: "add_photo_alternate",
  sticker: "sticky_note_2",
  edit: "edit",
  replace: "find_replace",
  erase: "ink_eraser",
  expand: "open_in_full",
  upscale: "high_quality",
  removeBg: "background_replace",
  layerize: "layers",
};

export interface AiSelectionMask {
  rings: Ring[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface AiGeneratePanelProps {
  /** The selected photo, if any. */
  layer: ImageLayer | null;
  /** A URL the photo's full-resolution pixels can be read from. */
  layerUrl: string | null;
  /** A Select-object selection is ready on this photo. */
  hasSelection: boolean;
  /** Trace the current selection at full resolution (source pixels). */
  getSelection: () => Promise<AiSelectionMask | null>;
  uploads: StudioShellUpload[];
  page: { width: number; height: number };
  initialTask?: AiTask;
  onSelectObject: () => void;
  /** Store a finished picture (a pasted-back Replace, a finished Expand). */
  onSave: (blob: Blob, name: string, size: { width: number; height: number }) => Promise<StudioShellUpload>;
  onAddImage: (image: GeneratedImage, placement: "cover" | "contain" | "sticker", name: string) => void;
  onReplace: (layer: ImageLayer, image: { src: string; url: string; width: number; height: number }) => void;
  onExpand: (layer: ImageLayer, image: StudioShellUpload & { naturalWidth: number; naturalHeight: number }, growth: Padding) => void;
  onSeparate: (layer: ImageLayer, base: GeneratedImage, layers: GeneratedLayer[]) => void;
  onClose: () => void;
}

type ShapeChoice = AspectId | "page" | "keep";

/** Remembered per task: the last model and options the customer used. */
const STORE_KEY = "framers.aiGen.v1";
function remembered(): Record<string, { model?: string; quality?: QualityId; resolution?: ResolutionId }> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function remember(task: AiTask, value: { model?: string; quality?: QualityId; resolution?: ResolutionId }) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...remembered(), [task]: value }));
  } catch {
    // Private mode or blocked storage: nothing to remember, nothing breaks.
  }
}

/** What a run left behind that "Use" needs to finish the job. */
interface RunContext {
  task: AiTask;
  model: AiModel;
  layerId?: string;
  src?: string;
  original?: ImageBitmap;
  alpha?: boolean;
  window?: Rect;
  mask?: OffscreenCanvas;
  feather?: number;
  padding?: Padding;
  /** Padding at full resolution, and as fractions of the source, for Expand. */
  fullPadding?: Padding;
  shape?: ShapeChoice;
  prompt: string;
}

interface Results {
  images: GeneratedImage[];
  layers?: GeneratedLayer[];
  costUsd: number;
}

function Select<T extends string>({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-[104px] flex-1 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--studio-ink-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        data-r="sm"
        className="h-8 w-full min-w-0 border border-[var(--studio-border)] bg-[var(--studio-surface,#1b1b1b)] px-2 text-[12.5px] text-[var(--studio-ink)] outline-none focus-visible:border-[var(--studio-accent)]"
      >
        {children}
      </select>
    </label>
  );
}

export function AiGeneratePanel(props: AiGeneratePanelProps) {
  const { layer, layerUrl, hasSelection, uploads, page, onClose } = props;

  const [available, setAvailable] = useState<AiModelsResponse | null>(null);
  const [task, setTask] = useState<AiTask>(props.initialTask ?? (layer ? "edit" : "create"));
  const [modelId, setModelId] = useState<string>("");
  const [qualityPick, setQuality] = useState<QualityId | undefined>();
  const [resolutionPick, setResolution] = useState<ResolutionId | undefined>();
  const [shape, setShape] = useState<ShapeChoice>(props.initialTask === "edit" || (!props.initialTask && layer) ? "keep" : "page");
  const [countPick, setCount] = useState(1);
  const [factorPick, setFactor] = useState(2);
  const [extra, setExtra] = useState(15);
  const [prompt, setPrompt] = useState("");
  const [refsPick, setRefs] = useState<string[]>([]);
  const [pickingRefs, setPickingRefs] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [applying, setApplying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef<RunContext | null>(null);

  useEffect(() => {
    let live = true;
    void fetchAiModels().then((res) => {
      if (!live) return;
      setAvailable(res);
      setRemaining(res.remaining);
    });
    return () => {
      live = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const models = useMemo(
    () => (available?.models ?? []).map(findModel).filter((m): m is AiModel => !!m && m.tasks.includes(task)),
    [available, task]
  );
  const tasksAvailable = useMemo(
    () => new Set(TASK_ORDER.filter((t) => (available?.models ?? []).some((id) => findModel(id)?.tasks.includes(t)))),
    [available]
  );

  // The model: the one picked, else the one remembered for this job, else the first.
  const saved = useMemo(() => (available ? remembered()[task] : undefined), [available, task]);
  const model = models.find((m) => m.id === modelId) ?? models.find((m) => m.id === saved?.model) ?? models[0] ?? null;
  // Options the customer picked, where this model has them; else what was remembered; else its default.
  const pickTier = <T extends string>(picked: T | undefined, remembered: T | undefined, has: (v: T) => boolean, fallback: T | undefined) =>
    picked && has(picked) ? picked : remembered && has(remembered) ? remembered : fallback;
  const quality = model
    ? pickTier(qualityPick, saved?.model === model.id ? saved.quality : undefined, (q) => model.qualities?.[q] !== undefined, defaultQuality(model))
    : undefined;
  const resolution = model
    ? pickTier(resolutionPick, saved?.model === model.id ? saved.resolution : undefined, (r) => model.resolutions?.[r] !== undefined, defaultResolution(model))
    : undefined;
  const needs = TASK_LABELS[task];
  const acceptsPrompt = needs.needsPrompt || task === "expand" || task === "layerize" || (task === "upscale" && model?.provider === "ideogram");
  const acceptsShape = !!model?.aspect && (task === "create" || task === "sticker" || task === "edit");
  const maxRefs = model && (task === "create" || task === "edit") ? model.maxRefs : 0;
  const maxCount = model && task !== "layerize" && task !== "expand" && task !== "upscale" && task !== "removeBg" && task !== "erase" ? model.maxImages : 1;

  const count = Math.min(countPick, maxCount);
  const refs = refsPick.slice(0, maxRefs);
  const factor = model?.upscale ? (model.upscale.includes(factorPick) ? factorPick : model.upscale[0]) : factorPick;

  function changeTask(next: AiTask) {
    setTask(next);
    setModelId("");
    setQuality(undefined);
    setResolution(undefined);
    setShape(next === "edit" ? "keep" : "page");
    // A description carries between the describing jobs; the optional ones start empty.
    if (!TASK_LABELS[next].needsPrompt) setPrompt("");
    setResults(null);
    setError(null);
  }

  function chooseModel(id: string) {
    const next = findModel(id);
    if (!next) return;
    setModelId(id);
    const q = quality && next.qualities?.[quality] !== undefined ? quality : defaultQuality(next);
    const r = resolution && next.resolutions?.[resolution] !== undefined ? resolution : defaultResolution(next);
    setQuality(q);
    setResolution(r);
    remember(task, { model: id, quality: q, resolution: r });
  }

  const pageAspect = nearestAspect(page.width / page.height, ASPECTS);
  const cost = model ? estimateCost(model, { quality, resolution, count }) : 0;
  const blocked =
    !available
      ? "Loading…"
      : !available.enabled
        ? available.reason ?? "AI generation isn’t available."
        : needs.needsImage && !layer
          ? "Select a photo in your design first."
          : needs.needsImage && !layerUrl
            ? "This photo hasn’t finished loading yet."
            : needs.needsMask && !hasSelection
              ? null
              : needs.needsPrompt && !prompt.trim()
                ? null
                : remaining === 0
                  ? "You’ve used today’s AI requests."
                  : null;
  const canRun = !blocked && !!model && !running && (!needs.needsMask || hasSelection) && (!needs.needsPrompt || !!prompt.trim());

  /* ---------------------------------------------------------------- run */

  async function readRef(src: string): Promise<Blob> {
    const entry = uploads.find((u) => u.src === src);
    if (!entry) throw new Error("A reference picture is no longer available.");
    const bitmap = await loadUrl(entry.url);
    const { blob } = await encodeRegion(bitmap, { x: 0, y: 0, width: bitmap.width, height: bitmap.height }, 1024, "image/jpeg");
    bitmap.close();
    return blob;
  }

  async function run() {
    if (!model || !canRun) return;
    setRunning(true);
    setElapsed(0);
    setError(null);
    setResults(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const files: AiFiles = {};
      const request: AiGenerateRequest = { task, model: model.id, prompt: prompt.trim() || undefined, quality, resolution, count };
      const context: RunContext = { task, model, prompt: prompt.trim(), shape };

      if (acceptsShape && shape !== "keep") request.aspect = shape === "page" ? pageAspect : shape;
      if (maxRefs > 0 && refs.length) files.refs = await Promise.all(refs.map(readRef));
      if (task === "upscale") request.factor = factor;

      if (needs.needsImage && layer && layerUrl) {
        const res = await fetch(layerUrl);
        if (!res.ok) throw new Error("Couldn’t read this photo. Please try again.");
        const blob = await res.blob();
        const original = await createImageBitmap(blob);
        const alpha = blob.type === "image/png" || blob.type === "image/webp";
        const full: Rect = { x: 0, y: 0, width: original.width, height: original.height };
        Object.assign(context, { layerId: layer.id, src: layer.src, original, alpha });
        const pngInput = alpha || model.maskStyle === "alpha";

        if (task === "replace" || task === "erase") {
          const selection = await props.getSelection();
          if (!selection) throw new Error("Select the object first.");
          const window = contextWindow(selection.bbox, original.width, original.height);
          const enc = await encodeRegion(original, window, pngInput ? 1536 : 2048, pngInput ? "image/png" : "image/jpeg");
          const diag = Math.hypot(selection.bbox.x1 - selection.bbox.x0, selection.bbox.y1 - selection.bbox.y0);
          const grow = task === "erase" ? Math.max(4, diag * 0.02) : Math.max(3, diag * 0.01);
          const mask = selectionMask(selection.rings, window, enc.scale, grow);
          files.image = enc.blob;
          if (model.mask === "native") files.mask = await maskBlob(mask, model.maskStyle);
          else files.highlight = await highlightBlob(regionCanvas(original, window, enc.width, enc.height), mask);
          Object.assign(context, { window, mask, feather: Math.max(1.5, Math.hypot(window.width, window.height) * 0.003) });
        } else if (task === "expand") {
          const masked = model.expandMode === "mask";
          const enc = await encodeRegion(original, full, masked ? 1280 : 2048, masked || alpha ? "image/png" : "image/jpeg");
          const target = shape === "page" || shape === "keep" ? page.width / page.height : ratioOf(shape);
          const padding = expandPadding(enc.width, enc.height, target, extra / 100);
          if (padding.left + padding.top + padding.right + padding.bottom === 0) {
            throw new Error("The photo already has that shape — add some extra room.");
          }
          if (masked) {
            const padded = await paddedCanvas(regionCanvas(original, full, enc.width, enc.height), padding);
            files.image = padded.image;
            files.mask = padded.mask;
          } else {
            files.image = enc.blob;
          }
          request.padding = padding;
          const fullPadding = scalePadding(padding, 1 / enc.scale);
          Object.assign(context, { padding, fullPadding });
        } else {
          const maxEdge = task === "upscale" ? 2048 : pngInput ? 1536 : 2048;
          files.image = (await encodeRegion(original, full, maxEdge, pngInput ? "image/png" : "image/jpeg")).blob;
        }
      }

      contextRef.current = context;
      const response = await requestGeneration(request, files, controller.signal);
      setResults({ images: response.images, layers: response.layers, costUsd: response.costUsd });
      setRemaining(response.remaining);
      void fetchAiModels(true);
      remember(task, { model: model.id, quality, resolution });
    } catch (e) {
      if (e instanceof AiGenError && e.code === "aborted") setError("Stopped. If the model had already started, it may still be charged.");
      else setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  /* -------------------------------------------------------------- apply */

  async function use(index: number) {
    const context = contextRef.current;
    const image = results?.images[index];
    if (!context || !image || applying !== null) return;
    setApplying(index);
    setError(null);
    try {
      const name = context.prompt ? `AI: ${context.prompt.slice(0, 40)}` : `AI ${TASK_LABELS[context.task].title.toLowerCase()}`;
      if (context.task === "create" || context.task === "sticker") {
        const placement = context.task === "sticker" ? "sticker" : context.shape === "page" ? "cover" : "contain";
        props.onAddImage(image, placement, name);
        return;
      }
      // Everything else changes the photo it was made from — which must still be that photo.
      if (!layer || layer.id !== context.layerId || layer.src !== context.src) {
        throw new Error("The photo changed since this was made. Run it again on the photo as it is now.");
      }
      if (context.task === "layerize") {
        props.onSeparate(layer, results!.images[0], results!.layers ?? []);
        onClose();
        return;
      }
      if (context.task === "edit" || context.task === "upscale" || context.task === "removeBg") {
        props.onReplace(layer, image);
        return;
      }
      const result = await loadUrl(image.url);
      if (context.task === "expand") {
        const done = await expandBack(context.original!, result, context.fullPadding!, !!context.alpha);
        const saved = await props.onSave(done.blob, `${layer.name} (expanded)`, { width: done.width, height: done.height });
        const w = context.original!.width;
        const h = context.original!.height;
        const p = context.fullPadding!;
        props.onExpand(
          layer,
          { ...saved, naturalWidth: done.width, naturalHeight: done.height },
          { left: p.left / w, top: p.top / h, right: p.right / w, bottom: p.bottom / h }
        );
      } else {
        const done = await pasteBack(context.original!, result, context.window!, context.mask!, context.feather ?? 2, !!context.alpha);
        const saved = await props.onSave(done.blob, `${layer.name} (${context.task === "erase" ? "erased" : "edited"})`, {
          width: done.width,
          height: done.height,
        });
        props.onReplace(layer, { src: saved.src, url: saved.url, width: done.width, height: done.height });
      }
      result.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t use that picture. Please try again.");
    } finally {
      setApplying(null);
    }
  }

  /* ------------------------------------------------------------- render */

  const providersInUse = [...new Set(models.map((m) => m.provider))];

  return (
    <div
      role="dialog"
      aria-label="Generate with AI"
      data-r="lg"
      className="studio-shadow fixed bottom-20 left-4 z-[66] flex max-h-[calc(var(--studio-visible-height,100dvh)-120px)] w-[400px] max-w-[calc(100vw-32px)] flex-col border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--studio-border)] px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--studio-ink)]">
          <Icon name="auto_awesome" className="text-[18px] text-[var(--studio-accent)]" />
          Generate with AI
        </h2>
        <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* Jobs */}
        <div role="tablist" aria-label="What to do" className="-mx-1 mb-3 flex flex-wrap gap-1">
          {TASK_ORDER.map((t) => {
            const off = !!available?.enabled && !tasksAvailable.has(t);
            const noPhoto = TASK_LABELS[t].needsImage && !layer;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-label={TASK_LABELS[t].title}
                aria-selected={task === t}
                disabled={off || running}
                title={off ? "No configured model can do this yet" : noPhoto ? "Select a photo first" : TASK_LABELS[t].hint}
                onClick={() => changeTask(t)}
                data-r="full"
                className={cx(
                  "inline-flex h-7 items-center gap-1 px-2.5 text-[12px] font-medium transition-colors disabled:opacity-35",
                  task === t
                    ? "bg-[var(--studio-accent)] text-black"
                    : "border border-[var(--studio-border)] text-[var(--studio-ink)] hover:bg-white/[0.055]",
                  noPhoto && task !== t && "opacity-60"
                )}
              >
                <Icon name={TASK_ICONS[t]} className="text-[15px]" />
                {TASK_LABELS[t].title}
              </button>
            );
          })}
        </div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--studio-ink-muted)]">{needs.hint}</p>

        {available && !available.enabled ? (
          <p className="text-[12.5px] text-[var(--studio-ink)]">{available.reason}</p>
        ) : (
          <>
            {needs.needsImage && !layer && (
              <p className="mb-3 text-[12.5px] text-[#f3c779]">Select a photo in your design first.</p>
            )}

            {needs.needsMask && layer && (
              <div data-r="md" className="mb-3 flex items-center justify-between gap-2 border border-[var(--studio-border)] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--studio-ink)]">
                  <Icon name={hasSelection ? "check_circle" : "ads_click"} className={cx("text-[16px]", hasSelection && "text-[#22c55e]")} />
                  {hasSelection ? "Object selected" : "Nothing selected yet"}
                </span>
                <StudioButton variant="outline" size="sm" onClick={props.onSelectObject} disabled={running}>
                  {hasSelection ? "Change" : "Select the object"}
                </StudioButton>
              </div>
            )}

            {acceptsPrompt && (
              <label className="mb-3 flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[var(--studio-ink-muted)]">
                  {task === "replace" ? "What should be there instead?" : task === "expand" ? "What’s in the new area? (optional)" : task === "layerize" ? "Which parts to separate? (optional)" : task === "upscale" ? "Describe the photo (optional)" : "Describe it"}
                </span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
                    e.stopPropagation();
                  }}
                  rows={3}
                  maxLength={4000}
                  placeholder={
                    task === "create"
                      ? "A watercolour of Kerala backwaters at sunrise, soft pastels, lots of empty sky"
                      : task === "sticker"
                        ? "A cute cartoon elephant with a golden headdress, thick white outline"
                        : task === "edit"
                          ? "Make it a golden-hour photo and add warm fairy lights in the background"
                          : task === "replace"
                            ? "A bouquet of yellow sunflowers"
                            : ""
                  }
                  data-r="md"
                  className="w-full resize-y border border-[var(--studio-border)] bg-[var(--studio-surface,#1b1b1b)] px-2.5 py-2 text-[13px] leading-snug text-[var(--studio-ink)] outline-none placeholder:text-[var(--studio-ink-muted)] focus-visible:border-[var(--studio-accent)]"
                />
              </label>
            )}

            {maxRefs > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-[var(--studio-ink-muted)]">
                    Reference pictures {refs.length ? `(${refs.length}/${maxRefs})` : "(optional)"}
                  </span>
                  <StudioButton variant="ghost" size="sm" icon={pickingRefs ? "expand_less" : "add"} onClick={() => setPickingRefs((v) => !v)} disabled={running}>
                    {pickingRefs ? "Done" : "Add"}
                  </StudioButton>
                </div>
                {(pickingRefs || refs.length > 0) && (
                  <div className="grid grid-cols-5 gap-1.5">
                    {(pickingRefs ? uploads : uploads.filter((u) => refs.includes(u.src))).slice(0, 40).map((u) => {
                      const on = refs.includes(u.src);
                      return (
                        <button
                          key={u.src}
                          type="button"
                          aria-pressed={on}
                          title={u.name}
                          disabled={!on && refs.length >= maxRefs}
                          onClick={() => setRefs((r) => (on ? r.filter((s) => s !== u.src) : [...r, u.src]))}
                          data-r="sm"
                          className={cx(
                            "relative aspect-square overflow-hidden border disabled:opacity-40",
                            on ? "border-[var(--studio-accent)] ring-1 ring-[var(--studio-accent)]" : "border-[var(--studio-border)]"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u.url} alt="" className="h-full w-full object-cover" />
                          {on && <Icon name="check_circle" fill className="absolute right-0.5 top-0.5 text-[15px] text-[var(--studio-accent)]" />}
                        </button>
                      );
                    })}
                    {pickingRefs && uploads.length === 0 && (
                      <p className="col-span-5 text-[12px] text-[var(--studio-ink-muted)]">Upload pictures first — they’ll appear here.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Model */}
            {models.length > 0 && model && (
              <div className="mb-3">
                <Select label="Model" value={model.id} onChange={chooseModel}>
                  {providersInUse.map((p) => (
                    <optgroup key={p} label={PROVIDER_LABELS[p]}>
                      {models
                        .filter((m) => m.provider === p)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                            {m.vendor !== PROVIDER_LABELS[p] ? ` (${m.vendor})` : ""} — {formatCost(estimateCost(m), "INR")}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] leading-snug text-[var(--studio-ink-muted)]">
                  {model.badges?.map((b) => (
                    <span key={b} data-r="full" className="bg-white/[0.07] px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-[var(--studio-ink)]">
                      {b === "4k" ? "4K" : b}
                    </span>
                  ))}
                  <span>{model.blurb}</span>
                </p>
              </div>
            )}
            {available?.enabled && models.length === 0 && (
              <p className="mb-3 text-[12.5px] text-[var(--studio-ink-muted)]">No configured provider offers this yet.</p>
            )}

            {/* Options */}
            {model && (
              <div className="mb-3 flex flex-wrap gap-2">
                {acceptsShape && (
                  <Select label="Shape" value={shape} onChange={setShape}>
                    {task === "edit" && <option value="keep">Keep the photo’s</option>}
                    <option value="page">Fit the page ({pageAspect})</option>
                    {ASPECTS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                )}
                {task === "expand" && (
                  <Select label="New shape" value={shape === "keep" ? "page" : shape} onChange={setShape}>
                    <option value="page">Fit the page ({pageAspect})</option>
                    {ASPECTS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                )}
                {model.qualities && quality && (
                  <Select
                    label="Quality"
                    value={quality}
                    onChange={(q) => {
                      setQuality(q);
                      remember(task, { model: model.id, quality: q, resolution });
                    }}
                  >
                    {QUALITY_ORDER.filter((q) => model.qualities![q] !== undefined).map((q) => (
                      <option key={q} value={q}>
                        {model.qualityLabels?.[q] ?? q[0].toUpperCase() + q.slice(1)}
                      </option>
                    ))}
                  </Select>
                )}
                {model.resolutions && resolution && (
                  <Select
                    label="Size"
                    value={resolution}
                    onChange={(r) => {
                      setResolution(r);
                      remember(task, { model: model.id, quality, resolution: r });
                    }}
                  >
                    {RESOLUTION_ORDER.filter((r) => model.resolutions![r] !== undefined).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                )}
                {maxCount > 1 && (
                  <Select label="Pictures" value={String(count)} onChange={(v) => setCount(Number(v))}>
                    {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
                {task === "upscale" && model.upscale && (
                  <Select label="Enlarge" value={String(factor)} onChange={(v) => setFactor(Number(v))}>
                    {model.upscale.map((f) => (
                      <option key={f} value={f}>
                        {f}×
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            {task === "expand" && model && (
              <div className="mb-3">
                <Slider label="Extra room all round" value={extra} min={0} max={60} suffix="%" onChange={setExtra} />
              </div>
            )}

            {/* Go */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] text-[var(--studio-ink-muted)]">
                {model ? (
                  <>
                    <span className="font-semibold text-[var(--studio-ink)]">{formatCost(cost, "INR")}</span>
                    <span> ({formatCost(cost)}{model.perLayer ? ", varies with layers" : ""})</span>
                  </>
                ) : null}
                {remaining !== null && <span> · {remaining} left today</span>}
              </span>
              {running ? (
                <StudioButton variant="outline" size="md" onClick={() => abortRef.current?.abort()}>
                  Stop ({elapsed}s)
                </StudioButton>
              ) : (
                <StudioButton variant="solid" size="md" icon="auto_awesome" disabled={!canRun} onClick={() => void run()}>
                  Generate
                </StudioButton>
              )}
            </div>
            {blocked && available?.enabled && <p className="text-[12px] text-[var(--studio-ink-muted)]">{blocked}</p>}
            {running && (
              <div data-r="full" className="mt-2 h-1.5 overflow-hidden bg-[var(--studio-border)]" aria-hidden>
                <div data-r="full" className="h-full w-full animate-pulse bg-[var(--studio-accent)] motion-reduce:animate-none" />
              </div>
            )}
            {running && elapsed > 20 && (
              <p className="mt-1 text-[11.5px] text-[var(--studio-ink-muted)]">Bigger pictures and top quality can take a minute or two.</p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-[12.5px] leading-relaxed text-[#ffb4ab]">
                {error}
              </p>
            )}

            {/* Results */}
            {results && (
              <div className="mt-3 border-t border-[var(--studio-border)] pt-3">
                <p className="mb-2 text-[12px] text-[var(--studio-ink-muted)]">
                  {task === "layerize"
                    ? `A clean background and ${results.layers?.length ?? 0} separated layer${results.layers?.length === 1 ? "" : "s"}.`
                    : results.images.length > 1
                      ? "Pick the one you like."
                      : "Here it is."}
                </p>
                <div className={cx("grid gap-2", task === "layerize" ? "grid-cols-4" : results.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {results.images.map((img, i) => (
                    <div key={img.src} data-r="md" className="group relative overflow-hidden border border-[var(--studio-border)] bg-[repeating-conic-gradient(#2a2a2a_0%_25%,#1f1f1f_0%_50%)] bg-[length:16px_16px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Result ${i + 1}`} className="max-h-[260px] w-full object-contain" />
                      {task !== "layerize" && (
                        <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <StudioButton variant="solid" size="sm" disabled={applying !== null} onClick={() => void use(i)}>
                            {applying === i ? "Working…" : task === "create" || task === "sticker" ? "Add to design" : "Use this"}
                          </StudioButton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {task === "layerize" && (
                  <StudioButton variant="solid" size="md" className="mt-2 w-full" disabled={applying !== null || !results.layers?.length} onClick={() => void use(0)}>
                    Separate into layers
                  </StudioButton>
                )}
                <p className="mt-2 text-[11px] text-[var(--studio-ink-muted)]">
                  Cost {formatCost(results.costUsd, "INR")} · saved to your Uploads
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

