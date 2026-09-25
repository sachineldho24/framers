"use client";

/**
 * Effects — Canva's text effects panel: a grid of tiles, each drawn by the real
 * renderer in the selected text's own font, and the chosen effect's controls
 * underneath.
 *
 * Slider drags commit transiently under one label, so a drag is one undo step.
 */

import { useCallback } from "react";

import type { TextLayer } from "@/lib/studio/document";
import { createDocument, createTextLayer } from "@/lib/studio/document";
import { useStudio } from "@/lib/studio/StudioContext";
import {
  EFFECT_CONTROLS,
  EFFECT_DEFAULTS,
  EFFECT_HAS_COLOR,
  EFFECT_LABELS,
  EFFECT_ORDER,
  switchEffect,
  type TextEffect,
  type TextEffectKind,
} from "@/lib/studio/textEffects";

import { STUDIO_SWATCHES } from "../palette";
import { PhotoColourSwatches } from "../StudioAssets";
import { TextPreview } from "../TextPreview";
import { EmptyState, PanelSection, Slider, cx } from "../ui";

export function EffectsPanel() {
  const { selectedLayer } = useStudio();
  if (!selectedLayer || selectedLayer.kind !== "text") {
    return (
      <EmptyState
        icon="auto_awesome"
        title="Select some text"
        body="Effects like Shadow, Neon and Hollow apply to text. Select a text box on the page."
      />
    );
  }
  return <EffectsControls key={selectedLayer.id} layer={selectedLayer} />;
}

function EffectsControls({ layer }: { layer: TextLayer }) {
  const { apply, endGesture } = useStudio();
  const current = layer.effect;
  const kind: TextEffectKind = current?.kind ?? "none";

  const setEffect = (effect: TextEffect | undefined, gesture?: string) =>
    apply(
      { type: "setTextStyle", layerId: layer.id, patch: { effect: effect ?? null } },
      gesture ? { transient: true, label: `${gesture}:${layer.id}` } : undefined
    );
  const patch = (values: Partial<TextEffect>, gesture?: string) =>
    current && setEffect({ ...current, ...values }, gesture);

  return (
    <div>
      <PanelSection title="Style">
        <div className="grid grid-cols-3 gap-2">
          {EFFECT_ORDER.map((id) => (
            <EffectTile
              key={id}
              kind={id}
              fontId={layer.fontId}
              fontWeight={layer.fontWeight}
              active={kind === id}
              onClick={() => setEffect(switchEffect(current, id))}
            />
          ))}
        </div>
      </PanelSection>

      {current && (
        <PanelSection title={EFFECT_LABELS[kind]}>
          <div className="flex flex-col gap-3.5">
            {EFFECT_CONTROLS[kind].map((control) => (
              <Slider
                key={control.key}
                label={control.label}
                value={current[control.key]}
                min={control.min}
                max={control.max}
                suffix={control.suffix}
                onChange={(v) => patch({ [control.key]: v }, `effect-${control.key}`)}
                onCommit={endGesture}
                onReset={() => patch({ [control.key]: EFFECT_DEFAULTS[kind][control.key] })}
              />
            ))}

            {kind === "glitch" && (
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-[var(--studio-ink)]">Colour</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      ["blue-red", "Blue / red", "#00a8ff", "#ff1744"],
                      ["cyan-magenta", "Cyan / magenta", "#00fff0", "#ff00e6"],
                    ] as const
                  ).map(([pair, label, a, b]) => (
                    <button
                      key={pair}
                      type="button"
                      aria-pressed={current.glitchPair === pair}
                      onClick={() => patch({ glitchPair: pair })}
                      data-r="sm"
                      className={cx(
                        "flex h-9 items-center gap-2 border px-2 text-[12px] transition-colors",
                        current.glitchPair === pair
                          ? "border-[var(--studio-accent)] text-[var(--studio-accent)]"
                          : "border-[#2e2e2e] text-[var(--studio-ink)] hover:bg-[#282828]"
                      )}
                    >
                      <span className="flex">
                        <span data-r="full" className="h-3.5 w-3.5" style={{ backgroundColor: a }} />
                        <span data-r="full" className="-ml-1 h-3.5 w-3.5" style={{ backgroundColor: b }} />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {EFFECT_HAS_COLOR[kind] && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-[var(--studio-ink)]">Colour</p>
                  <label
                    data-r="sm"
                    className="relative flex h-6 w-10 cursor-pointer overflow-hidden border border-[#353534]"
                    style={{ backgroundColor: current.color }}
                  >
                    <span className="sr-only">Pick an effect colour</span>
                    <input
                      type="color"
                      value={current.color}
                      onChange={(e) => patch({ color: e.target.value }, "effect-colour")}
                      onBlur={endGesture}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      data-r="full"
                      aria-label={`Effect colour ${swatch}`}
                      aria-pressed={current.color.toLowerCase() === swatch}
                      onClick={() => patch({ color: swatch })}
                      style={{ backgroundColor: swatch }}
                      className={cx(
                        "h-6 w-6 border transition-transform hover:scale-110",
                        current.color.toLowerCase() === swatch
                          ? "border-[var(--studio-accent)] ring-2 ring-[var(--studio-accent)]/40"
                          : "border-[#353534]"
                      )}
                    />
                  ))}
                </div>
                <PhotoColourSwatches className="mt-2.5" value={current.color} onPick={(color) => patch({ color })} />
              </div>
            )}
          </div>
        </PanelSection>
      )}
    </div>
  );
}

/** One tile: "Ag" in the selected font, drawn with that effect. */
function EffectTile({
  kind,
  fontId,
  fontWeight,
  active,
  onClick,
}: {
  kind: TextEffectKind;
  fontId: string;
  fontWeight: number;
  active: boolean;
  onClick: () => void;
}) {
  const build = useCallback(() => {
    const neon = kind === "neon";
    const doc = createDocument({ width: 300, height: 220, background: neon ? "#141414" : "#f1f1f1" });
    const text = createTextLayer({
      text: "Ag",
      x: 0,
      y: 0,
      width: 300,
      height: 220,
      fontSize: 120,
      fontId,
      fontWeight,
      align: "center",
      color: neon ? "#ff2bd6" : "#1b1b1b",
    });
    const effect = kind === "none" ? undefined : { ...EFFECT_DEFAULTS[kind] };
    doc.layers.push({ ...text, verticalAlign: "middle", ...(effect ? { effect } : {}) });
    return doc;
  }, [kind, fontId, fontWeight]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        data-r="sm"
        className={cx(
          "block overflow-hidden border-2 transition-colors",
          active ? "border-[var(--studio-accent)]" : "border-transparent hover:border-white/30"
        )}
      >
        <TextPreview build={build} width={88} height={64} label={EFFECT_LABELS[kind]} className="block" />
      </span>
      <span className={cx("text-[11.5px]", active ? "font-medium text-[var(--studio-ink)]" : "text-[var(--studio-ink-muted)]")}>
        {EFFECT_LABELS[kind]}
      </span>
    </button>
  );
}
