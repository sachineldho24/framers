"use client";

/**
 * Tools → Signature: sign with the pointer, or type a name in a signature
 * script. A drawn signature becomes pen strokes (grouped), a typed one a text
 * layer — both ordinary layers, so they print, move and recolour like the rest.
 */

import { useRef, useState } from "react";

import type { Layer } from "@/lib/studio/document";
import { getFont, fontStack } from "@/lib/studio/fonts";
import { useStudio } from "@/lib/studio/StudioContext";
import { createSignature, createTypedSignature } from "@/lib/studio/toolInserts";

import { StudioButton, cx } from "./ui";
import { IconButton } from "./ui";

const INKS = ["#111111", "#1c3faa", "#b3261e"];
const SCRIPTS = ["mrs-saint-delafield", "allura", "great-vibes", "homemade-apple"];
const PAD_W = 520;
const PAD_H = 200;

export function SignatureDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (layers: Layer[]) => void;
}) {
  const { docRef } = useStudio();
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [ink, setInk] = useState(INKS[0]);
  const [strokes, setStrokes] = useState<[number, number][][]>([]);
  const [name, setName] = useState("");
  const [script, setScript] = useState(SCRIPTS[0]);
  const drawing = useRef(false);

  const point = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * PAD_W, ((e.clientY - rect.top) / rect.height) * PAD_H];
  };

  const path = (s: [number, number][]) =>
    s.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  const canAdd = mode === "draw" ? strokes.length > 0 : name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-title"
        data-r="lg"
        className="studio-shadow w-full max-w-[580px] border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="signature-title" className="text-[15px] font-semibold text-[var(--studio-ink)]">
            Add your signature
          </h2>
          <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
        </div>

        <div role="tablist" data-r="sm" className="mb-3 grid grid-cols-2 gap-1 bg-[#1a1a1a] p-1">
          {(["draw", "type"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              data-r="sm"
              className={cx(
                "h-8 text-[13px] font-medium capitalize",
                mode === m ? "bg-[#2a2a2a] text-[var(--studio-ink)]" : "text-[var(--studio-ink-muted)]"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "draw" ? (
          <div data-r="md" className="relative overflow-hidden border border-[#2e2e2e] bg-white">
            <svg
              viewBox={`0 0 ${PAD_W} ${PAD_H}`}
              className="block h-[200px] w-full cursor-crosshair touch-none"
              aria-label="Signature pad — draw your signature"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drawing.current = true;
                // Read the position now: React clears `currentTarget` once the
                // handler returns, before the state updater below runs.
                const start = point(e);
                setStrokes((s) => [...s, [start]]);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const p = point(e);
                setStrokes((s) => {
                  const last = s[s.length - 1];
                  const prev = last[last.length - 1];
                  if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) < 1.5) return s;
                  return [...s.slice(0, -1), [...last, p]];
                });
              }}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
            >
              <line x1="30" x2={PAD_W - 30} y1={PAD_H - 45} y2={PAD_H - 45} stroke="#d0d0d0" strokeDasharray="4 4" />
              {strokes.map((s, i) => (
                <path key={i} d={path(s)} fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
            {strokes.length === 0 && (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[13px] text-[#9e9e9e]">
                Sign here
              </p>
            )}
          </div>
        ) : (
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your name"
              aria-label="Your name"
              data-r="md"
              className="mb-2 h-10 w-full border border-[#2e2e2e] bg-[#181818] px-3 text-[14px] text-[var(--studio-ink)] outline-none focus:border-[var(--studio-accent)]"
            />
            <div className="grid grid-cols-2 gap-2">
              {SCRIPTS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={script === id}
                  onClick={() => setScript(id)}
                  data-r="md"
                  className={cx(
                    "h-16 overflow-hidden border bg-white px-2 text-[26px]",
                    script === id ? "border-[var(--studio-accent)]" : "border-[#2e2e2e]"
                  )}
                  style={{ fontFamily: fontStack(getFont(id)), color: ink }}
                >
                  {name.trim() || "Your Name"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {INKS.map((c) => (
              <button
                key={c}
                type="button"
                data-r="full"
                aria-label={`Ink ${c}`}
                aria-pressed={ink === c}
                onClick={() => setInk(c)}
                className={cx("h-6 w-6 border-2", ink === c ? "border-[var(--studio-accent)]" : "border-[#4a4a4a]")}
                style={{ backgroundColor: c }}
              />
            ))}
            {mode === "draw" && strokes.length > 0 && (
              <StudioButton size="sm" onClick={() => setStrokes([])}>
                Clear
              </StudioButton>
            )}
          </div>
          <div className="flex gap-2">
            <StudioButton variant="outline" onClick={onClose}>
              Cancel
            </StudioButton>
            <StudioButton
              variant="solid"
              disabled={!canAdd}
              onClick={() =>
                onAdd(
                  mode === "draw"
                    ? createSignature(docRef.current, strokes, ink)
                    : [createTypedSignature(docRef.current, name.trim(), script, ink)]
                )
              }
              className="px-4"
            >
              Add to design
            </StudioButton>
          </div>
        </div>
      </div>
    </div>
  );
}
