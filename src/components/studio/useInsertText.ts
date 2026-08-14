"use client";

/**
 * "Add text", in one place.
 *
 * Three entry points reach for it — the Text panel's buttons, the Tools rail and
 * the `T` shortcut — and they must all produce the same thing: a preset-sized
 * box, selected, with the caret already in it so the placeholder can be typed
 * over rather than deleted first.
 */

import { useCallback } from "react";

import { useStudio } from "@/lib/studio/StudioContext";
import { createPresetTextLayer, type TextPreset } from "@/lib/studio/textInsert";

export function useInsertText(): (preset?: TextPreset) => void {
  const { doc, apply, select, setEditingId, setRail } = useStudio();

  return useCallback(
    (preset: TextPreset = "heading") => {
      const layer = createPresetTextLayer(doc, preset);
      apply({ type: "addLayer", layer });
      select(layer.id);
      // After `select`, which clears editing when the id changes — the later
      // write wins, so the box opens for typing.
      setEditingId(layer.id);
      setRail("text");
    },
    [doc, apply, select, setEditingId, setRail]
  );
}
