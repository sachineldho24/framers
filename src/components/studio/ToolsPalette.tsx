"use client";

/**
 * Tools — Canva's slim tools palette: Select, Draw, Shapes, Lines, Sticky
 * notes, Text, Signature and Tables, each with its own little flyout.
 *
 * A narrow column rather than a 340px panel, so the page stays in view while
 * drawing. Picking something that *adds* an element returns to Select with the
 * new element selected; Draw stays armed until another tool is chosen.
 */

import { useState } from "react";

import { Icon } from "@/components/Icon";
import type { Layer } from "@/lib/studio/document";
import { penWidth, type PenKind } from "@/lib/studio/drawing";
import { getShape, SHAPE_CATALOG } from "@/lib/studio/shapes";
import { useStudio } from "@/lib/studio/StudioContext";
import { createPresetTextLayer } from "@/lib/studio/textInsert";
import {
  createShapeAtCentre,
  createStickyNote,
  createTable,
  STICKY_COLORS,
} from "@/lib/studio/toolInserts";

import { STUDIO_SWATCHES } from "./palette";
import { SignatureDialog } from "./SignatureDialog";
import { cx } from "./ui";

type ToolKey = "select" | "draw" | "pentool" | "shapes" | "lines" | "sticky" | "text" | "signature" | "table";

const TOOLS: { key: ToolKey; icon: string; label: string }[] = [
  { key: "select", icon: "near_me", label: "Select" },
  { key: "draw", icon: "draw", label: "Draw" },
  { key: "pentool", icon: "conversion_path", label: "Pen tool (P) — click for corners, drag for curves" },
  { key: "shapes", icon: "interests", label: "Shapes" },
  { key: "lines", icon: "pen_size_2", label: "Lines" },
  { key: "sticky", icon: "sticky_note_2", label: "Sticky notes" },
  { key: "text", icon: "title", label: "Text" },
  { key: "signature", icon: "signature", label: "Signature" },
  { key: "table", icon: "table", label: "Tables" },
];

const PENS: { kind: PenKind | "eraser"; icon: string; label: string }[] = [
  { kind: "pen", icon: "ink_pen", label: "Pen" },
  { kind: "marker", icon: "ink_marker", label: "Marker" },
  { kind: "highlighter", icon: "ink_highlighter", label: "Highlighter" },
  { kind: "eraser", icon: "ink_eraser", label: "Eraser — rubs out drawn strokes" },
];

const LINES = ["line", "line-curve", "line-elbow"] as const;
const SHAPE_IDS = SHAPE_CATALOG.filter((d) => d.mode === "fill").map((d) => d.id);

export function ToolsPalette() {
  const { tool, setTool, setRail, doc, docRef, apply, endGesture, select, selectMany, setEditingId, pen, setPen } =
    useStudio();
  const [open, setOpen] = useState<ToolKey | null>(tool === "pen" || tool === "pen-eraser" ? "draw" : null);
  const [signing, setSigning] = useState(false);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const active: ToolKey =
    tool === "pen" || tool === "pen-eraser" ? "draw" : tool === "path" ? "pentool" : open ?? "select";

  /** Add layers, return to Select, and select what was added. */
  const insert = (layers: Layer[]) => {
    if (layers.length === 0) return;
    for (const layer of layers) apply({ type: "addLayer", layer }, { transient: true, label: "tool-insert" });
    endGesture();
    setTool("select");
    setOpen(null);
    selectMany(layers.map((l) => l.id));
  };

  const choose = (key: ToolKey) => {
    if (key === "select") {
      setTool("select");
      setOpen(null);
      return;
    }
    if (key === "text") {
      const layer = createPresetTextLayer(docRef.current, "subheading");
      apply({ type: "addLayer", layer });
      setTool("select");
      setOpen(null);
      select(layer.id);
      setEditingId(layer.id);
      return;
    }
    if (key === "signature") {
      setSigning(true);
      return;
    }
    if (key === "pentool") {
      // Armed until the path is finished; it hands back to Select itself.
      setTool(tool === "path" ? "select" : "path");
      select(null);
      setOpen(null);
      return;
    }
    if (key === "draw") {
      setTool(tool === "pen-eraser" ? "pen-eraser" : "pen");
      select(null);
    } else if (tool === "pen" || tool === "pen-eraser") {
      setTool("select");
    }
    setOpen((current) => (current === key && key !== "draw" ? null : key));
  };

  const shortEdge = Math.min(doc.width, doc.height);

  return (
    <aside
      id="studio-flyout"
      aria-label="Tools"
      className="studio-tools-palette relative z-30 flex shrink-0 items-start gap-2 bg-transparent px-2 pt-3"
    >
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setTool("select");
            setRail(null);
          }}
          aria-label="Close tools"
          data-r="full"
          className="studio-shadow-sm flex h-9 w-9 items-center justify-center border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] text-[var(--studio-ink)] hover:bg-[#282828]"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
        <div
          data-r="lg"
          role="toolbar"
          aria-orientation="vertical"
          aria-label="Tools"
          className="studio-shadow flex flex-col gap-1 border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1.5"
        >
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={active === t.key}
              onClick={() => choose(t.key)}
              data-r="md"
              className={cx(
                "flex h-10 w-10 items-center justify-center transition-colors",
                active === t.key
                  ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                  : "text-[var(--studio-ink)] hover:bg-[#282828]"
              )}
            >
              <Icon name={t.icon} className="text-[22px]" fill={active === t.key} />
            </button>
          ))}
        </div>
      </div>

      {open && open !== "select" && (
        <div
          data-r="lg"
          className="studio-shadow mt-12 flex max-h-[calc(100%-4rem)] flex-col items-center gap-1 overflow-y-auto border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1.5 [scrollbar-width:thin]"
        >
          {open === "draw" && (
            <>
              {PENS.map((p) => {
                const on = p.kind === "eraser" ? tool === "pen-eraser" : tool === "pen" && pen.pen === p.kind;
                return (
                  <button
                    key={p.kind}
                    type="button"
                    title={p.label}
                    aria-label={p.label}
                    aria-pressed={on}
                    onClick={() => {
                      if (p.kind === "eraser") setTool("pen-eraser");
                      else {
                        setPen({ pen: p.kind });
                        setTool("pen");
                      }
                    }}
                    data-r="md"
                    className={cx(
                      "flex h-11 w-11 items-center justify-center transition-colors",
                      on ? "bg-[#2e2e2e]" : "hover:bg-[#282828]"
                    )}
                  >
                    {/* Each pen shows its own ink. */}
                    <span style={{ color: p.kind === "eraser" ? "#f48fb1" : pen.colors[p.kind] }}>
                      <Icon name={p.icon} className="text-[26px]" fill />
                    </span>
                  </button>
                );
              })}
              <div className="my-1 h-px w-8 bg-[var(--studio-border)]" />
              {/* Colour of the current pen. */}
              <label
                title="Pen colour"
                data-r="full"
                className="relative flex h-9 w-9 cursor-pointer items-center justify-center"
              >
                <span
                  data-r="full"
                  className="h-7 w-7 border-2 border-white/80"
                  style={{ backgroundColor: pen.colors[pen.pen] }}
                />
                <input
                  type="color"
                  value={pen.colors[pen.pen]}
                  aria-label="Pen colour"
                  onChange={(e) => setPen({ colors: { ...pen.colors, [pen.pen]: e.target.value } })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <div className="grid grid-cols-2 gap-1">
                {STUDIO_SWATCHES.slice(0, 6).map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    data-r="full"
                    aria-label={`Pen colour ${swatch}`}
                    onClick={() => setPen({ colors: { ...pen.colors, [pen.pen]: swatch } })}
                    className={cx(
                      "h-4 w-4 border",
                      pen.colors[pen.pen].toLowerCase() === swatch ? "border-[var(--studio-accent)]" : "border-[#4a4a4a]"
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              <div className="my-1 h-px w-8 bg-[var(--studio-border)]" />
              {/* Thickness, drawn at relative weight. */}
              {[0, 1, 2, 3].map((step) => (
                <button
                  key={step}
                  type="button"
                  title={`Thickness ${step + 1}`}
                  aria-label={`Thickness ${step + 1}`}
                  aria-pressed={pen.sizes[pen.pen] === step}
                  onClick={() => setPen({ sizes: { ...pen.sizes, [pen.pen]: step } })}
                  data-r="sm"
                  className={cx(
                    "flex h-7 w-11 items-center justify-center",
                    pen.sizes[pen.pen] === step ? "bg-[#2e2e2e]" : "hover:bg-[#282828]"
                  )}
                >
                  <span
                    className="w-7 bg-[var(--studio-ink)]"
                    style={{ height: Math.max(1, Math.round((penWidth(pen.pen, step, shortEdge) / shortEdge) * 300)) }}
                  />
                </button>
              ))}
            </>
          )}

          {open === "shapes" &&
            SHAPE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                title={getShape(id)?.label}
                aria-label={getShape(id)?.label}
                onClick={() => insert([createShapeAtCentre(docRef.current, id, "#111111")])}
                data-r="md"
                className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-[#282828]"
              >
                <ShapeGlyph id={id} />
              </button>
            ))}

          {open === "lines" &&
            LINES.map((id) => (
              <button
                key={id}
                type="button"
                title={getShape(id)?.label}
                aria-label={getShape(id)?.label}
                onClick={() => insert([createShapeAtCentre(docRef.current, id, "#111111")])}
                data-r="md"
                className="flex h-11 w-11 items-center justify-center hover:bg-[#282828]"
              >
                <ShapeGlyph id={id} line />
              </button>
            ))}

          {open === "sticky" &&
            STICKY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title="Sticky note"
                aria-label={`Sticky note ${color}`}
                onClick={() => insert(createStickyNote(docRef.current, color))}
                data-r="md"
                className="flex h-11 w-11 items-center justify-center hover:bg-[#282828]"
              >
                <span
                  data-r="sm"
                  className="relative block h-6 w-6"
                  style={{ backgroundColor: color, clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)" }}
                />
              </button>
            ))}

          {open === "table" && (
            <div className="p-1">
              <p className="mb-1.5 text-center text-[11px] text-[var(--studio-ink-muted)]">
                {hover ? `${hover.r} × ${hover.c}` : "Pick a size"}
              </p>
              <div className="grid grid-cols-6 gap-[3px]" onMouseLeave={() => setHover(null)}>
                {Array.from({ length: 36 }, (_, i) => {
                  const r = Math.floor(i / 6) + 1;
                  const c = (i % 6) + 1;
                  const lit = hover && r <= hover.r && c <= hover.c;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${r} by ${c} table`}
                      onMouseEnter={() => setHover({ r, c })}
                      onFocus={() => setHover({ r, c })}
                      onClick={() => insert(createTable(docRef.current, r, c))}
                      className={cx(
                        "h-4 w-4 border",
                        lit ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)]" : "border-[#4a4a4a]"
                      )}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {signing && (
        <SignatureDialog
          onClose={() => setSigning(false)}
          onAdd={(layers) => {
            setSigning(false);
            insert(layers);
          }}
        />
      )}
    </aside>
  );
}

/** A shape's own outline as a tiny SVG, from the same path the canvas draws. */
function ShapeGlyph({ id, line = false }: { id: string; line?: boolean }) {
  const def = getShape(id);
  if (!def) return null;
  const w = 24;
  const h = line ? 16 : 24;
  const d = def
    .path(w, h)
    .map((c) =>
      c.c === "M" || c.c === "L"
        ? `${c.c}${c.x.toFixed(1)} ${c.y.toFixed(1)}`
        : c.c === "Q"
          ? `Q${c.x1.toFixed(1)} ${c.y1.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
          : c.c === "C"
            ? `C${c.x1.toFixed(1)} ${c.y1.toFixed(1)} ${c.x2.toFixed(1)} ${c.y2.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
            : "Z"
    )
    .join(" ");
  return (
    <svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`} aria-hidden="true">
      <path
        d={d}
        fill={def.mode === "fill" ? "var(--studio-ink)" : "none"}
        stroke={def.mode === "stroke" ? "var(--studio-ink)" : "none"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
