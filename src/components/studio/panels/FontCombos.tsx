"use client";

/**
 * Font combinations — the Text panel's grid of styled lockups, as in Canva.
 *
 * Each tile is drawn by the real renderer (see `TextPreview`), so what you
 * click is what lands. Clicking inserts the combo's lines as ordinary text
 * layers, centred on the page and grouped, as one undo step, with the whole
 * group selected.
 */

import { useCallback, useMemo, useState } from "react";

import { createDocument } from "@/lib/studio/document";
import { loadDocumentFonts } from "@/lib/studio/fontLoader";
import { useStudio } from "@/lib/studio/StudioContext";
import { createComboLayers, TEXT_COMBOS, type TextCombo } from "@/lib/studio/textCombos";

import { Icon } from "@/components/Icon";
import { TextPreview } from "../TextPreview";
import { PanelSection } from "../ui";

/** Tile aspect: the preview document is drawn into this, fitted. */
const TILE_DOC = { width: 1000, height: 700 };

export function FontCombos() {
  const { apply, endGesture, docRef, selectMany } = useStudio();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const combos = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return TEXT_COMBOS;
    return TEXT_COMBOS.filter(
      (c) =>
        c.tags.includes(needle) ||
        c.lines.some((l) => l.text.toLowerCase().includes(needle) || l.fontId.includes(needle))
    );
  }, [query]);

  async function insert(combo: TextCombo) {
    if (busy) return;
    setBusy(combo.id);
    try {
      // Measure with the real faces: a combo measured in the fallback would
      // wrap its words once the font arrived.
      const draft = createComboLayers(docRef.current, combo);
      await loadDocumentFonts({ ...docRef.current, layers: draft });
      const layers = createComboLayers(docRef.current, combo);
      for (const layer of layers) {
        apply({ type: "addLayer", layer }, { transient: true, label: `combo:${combo.id}` });
      }
      endGesture();
      selectMany(layers.map((l) => l.id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PanelSection title="Font combinations">
      <div className="relative mb-2.5">
        <Icon
          name="search"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-[var(--studio-ink-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search combinations — sale, wedding, neon…"
          aria-label="Search font combinations"
          data-r="md"
          className="h-8 w-full border border-[var(--studio-border)] bg-[var(--studio-chrome)] pl-8 pr-2 text-[12.5px] text-[var(--studio-ink)] outline-none placeholder:text-[var(--studio-ink-muted)] focus:border-[var(--studio-accent)]"
        />
      </div>
      {combos.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-[var(--studio-ink-muted)]">
          No combination matches “{query.trim()}”.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {combos.map((combo) => (
            <ComboTile key={combo.id} combo={combo} busy={busy === combo.id} onClick={() => void insert(combo)} />
          ))}
        </div>
      )}
    </PanelSection>
  );
}

function ComboTile({ combo, busy, onClick }: { combo: TextCombo; busy: boolean; onClick: () => void }) {
  const build = useCallback(() => {
    const doc = createDocument({ ...TILE_DOC, background: combo.tile });
    doc.layers = createComboLayers(doc, combo);
    return doc;
  }, [combo]);
  const label = combo.lines.map((l) => l.text).join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={`Add “${label}”`}
      data-r="md"
      className="group relative block overflow-hidden border border-[#2a2a2a] transition-colors hover:border-[var(--studio-accent)] disabled:opacity-60"
      style={{ backgroundColor: combo.tile }}
    >
      <TextPreview build={build} width={142} height={100} label={label} className="block w-full" fitContent />
      <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Icon name={busy ? "progress_activity" : "add"} className="text-[16px]" />
      </span>
    </button>
  );
}
