"use client";

import { useEffect, useRef } from "react";
import type { TextLayer } from "@/lib/studio/document";
import { useStudio } from "@/lib/studio/StudioContext";
import { textLayerHeight } from "@/lib/studio/textMeasure";
import { StudioButton } from "./ui";

/** The keyboard edits a docked field while the canvas keeps rendering the words. */
export function MobileTextEditor({ layer }: { layer: TextLayer }) {
  const { apply, endGesture, setEditingId } = useStudio();
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  useEffect(() => endGesture, [endGesture]);
  const finish = () => {
    endGesture();
    setEditingId(null);
  };

  return (
    <div className="studio-text-entry flex shrink-0 items-center gap-2 border-t border-[var(--studio-border)] bg-[var(--studio-chrome)] p-2">
      <textarea
        ref={input}
        aria-label="Edit text"
        value={layer.text}
        rows={2}
        className="min-w-0 flex-1 resize-none border border-[var(--studio-border)] p-2 text-base"
        onChange={(event) => {
          const text = event.target.value;
          apply({ type: "setText", layerId: layer.id, text, height: textLayerHeight(layer, { text }) },
            { transient: true, label: `text:${layer.id}` });
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
            event.preventDefault();
            event.stopPropagation();
            finish();
          }
        }}
      />
      <StudioButton variant="solid" onClick={finish}>Done typing</StudioButton>
    </div>
  );
}
