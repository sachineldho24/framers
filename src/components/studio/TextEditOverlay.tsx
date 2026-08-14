"use client";

/**
 * Typing directly on the page.
 *
 * A `<textarea>` laid over the layer's own box, styled to match what the canvas
 * will draw: same family, weight, size, line height, letter spacing and case
 * transform, positioned in the layer's rotated frame. The canvas skips drawing
 * the layer while this is open (`skipLayerId`), so there is exactly one set of
 * glyphs on screen and no doubled ghost behind the caret.
 *
 * It is a text-entry affordance, not a second renderer: the browser breaks lines
 * with its own algorithm and `layoutText` breaks them with ours, so a pathological
 * unbreakable word can wrap differently for the moment the caret is in the box.
 * Everything durable — the print, the export, the selection box — comes from the
 * canvas path, and on blur the two agree again.
 *
 * Edits commit transiently under one label, so a burst of typing is a single undo
 * step rather than one per character, and `endGesture` closes it on the way out.
 */

import { useCallback, useEffect, useRef } from "react";

import type { TextLayer } from "@/lib/studio/document";
import { fontStack, getFont } from "@/lib/studio/fonts";
import type { Viewport } from "@/lib/studio/geometry";
import { useStudio } from "@/lib/studio/StudioContext";
import { alignOffsetY } from "@/lib/studio/text";
import { layoutTextLayer, textLayerHeight } from "@/lib/studio/textMeasure";

export function TextEditOverlay({
  layer,
  viewport,
}: {
  layer: TextLayer;
  viewport: Viewport;
}) {
  const { apply, endGesture, setEditingId } = useStudio();
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Selected, not just focused: the box arrives holding placeholder text, and
  // the next keystroke should replace it rather than append to it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  // Clicking another layer unmounts this without a blur, so the close has to
  // happen here too — otherwise the typing gesture stays open and the next edit
  // would coalesce into it. `endGesture` is a no-op when nothing is pending.
  useEffect(() => endGesture, [endGesture]);

  const stop = useCallback(() => {
    endGesture();
    setEditingId(null);
  }, [endGesture, setEditingId]);

  const font = getFont(layer.fontId);
  const scale = viewport.scale;
  const fontSizePx = layer.fontSize * scale;

  // Vertical alignment is a property of the box, so the overlay has to reproduce
  // it — measured through the same layout the renderer uses, and clamped because
  // padding can't be negative (text taller than its box overflows upward on the
  // canvas; here it simply starts at the top).
  const layout = layoutTextLayer(layer);
  const blockTop = layout
    ? alignOffsetY(layout.totalHeight, layer.height, layer.verticalAlign)
    : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute"
        style={{
          left: viewport.offsetX + layer.x * scale,
          top: viewport.offsetY + layer.y * scale,
          width: layer.width * scale,
          height: layer.height * scale,
          transform: `rotate(${layer.rotation}deg)`,
          transformOrigin: "center",
          outline: "1.5px dashed var(--studio-accent)",
        }}
      >
        <textarea
          ref={ref}
          value={layer.text}
          spellCheck={false}
          aria-label="Edit text"
          onChange={(e) => {
            const text = e.target.value;
            apply(
              {
                type: "setText",
                layerId: layer.id,
                text,
                height: textLayerHeight(layer, { text }),
              },
              { transient: true, label: `text:${layer.id}` }
            );
          }}
          onBlur={stop}
          onKeyDown={(e) => {
            // Escape and ⌘/Ctrl+Enter finish. Enter alone is a line break — this
            // is a paragraph of poster copy, not a form field.
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              e.stopPropagation();
              ref.current?.blur();
            }
          }}
          className="pointer-events-auto absolute inset-0 m-0 block w-full resize-none overflow-hidden border-0 bg-transparent outline-none"
          style={{
            fontFamily: fontStack(font),
            fontWeight: layer.fontWeight,
            fontStyle: layer.italic && font.italic ? "italic" : "normal",
            fontSize: fontSizePx,
            // Unitless, so CSS half-leading matches `lineTop`'s.
            lineHeight: layer.lineHeight,
            letterSpacing: `${layer.letterSpacing * fontSizePx}px`,
            textTransform: layer.uppercase ? "uppercase" : "none",
            textAlign: layer.align,
            color: layer.color,
            caretColor: layer.color,
            padding: 0,
            paddingTop: Math.max(0, blockTop) * scale,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        />
      </div>
    </div>
  );
}
