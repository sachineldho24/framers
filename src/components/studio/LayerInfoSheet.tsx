"use client";

/**
 * "Info" from the right-click menu.
 *
 * The mockup has the item; a real editor answers a real question with it —
 * how big will this print, and is the source sharp enough. So this shows the
 * placed size, the source pixels actually used after cropping, and the
 * resulting print resolution, with a plain verdict instead of a raw number.
 *
 * Every conversion goes through the page's *real* resolution rather than
 * `PRINT_DPI`: the document grid is capped, so on the larger frames a constant
 * 300 would report a printed size several inches smaller than the wall will show.
 */

import type { ImageLayer, Layer, StudioDocument, TextLayer } from "@/lib/studio/document";
import { FILTER_PRESETS } from "@/lib/studio/filters";
import { getFont, CATEGORY_LABELS } from "@/lib/studio/fonts";
import {
  dpiVerdict,
  imagePrintDpi,
  printedInches,
  documentDpi,
} from "@/lib/studio/print";
import { useStudio } from "@/lib/studio/StudioContext";

import { Icon } from "@/components/Icon";
import { IconButton, cx } from "./ui";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[5px]">
      <dt className="shrink-0 text-[12px] text-[var(--studio-ink-muted)]">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-[12.5px] font-medium tabular-nums text-[var(--studio-ink)]">
        {value}
      </dd>
    </div>
  );
}

export function LayerInfoSheet({
  layer,
  doc,
  onClose,
}: {
  layer: Layer;
  doc: StudioDocument;
  onClose: () => void;
}) {
  const { printSize } = useStudio();
  const dpi = documentDpi(doc, printSize);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-info-title"
        data-r="lg"
        className="studio-shadow w-full max-w-[380px] border border-[var(--studio-border)] bg-[var(--studio-chrome)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2
            id="studio-info-title"
            className="min-w-0 truncate text-[15px] font-semibold text-[var(--studio-ink)]"
          >
            {layer.name}
          </h2>
          <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
        </div>

        <dl className="divide-y divide-[var(--studio-border)]">
          {layer.kind === "image" ? (
            <ImageRows layer={layer} dpi={dpi} />
          ) : (
            <TextRows layer={layer} dpi={dpi} />
          )}
          <Row
            label="Position in stack"
            value={`${doc.layers.findIndex((l) => l.id === layer.id) + 1} of ${
              doc.layers.length
            }`}
          />
        </dl>

        {layer.kind === "image" && <QualityVerdict layer={layer} dpi={dpi} />}
      </div>
    </div>
  );
}

/**
 * Resolution facts, which only exist for a photo: a text layer is vector until
 * the moment it is rasterised, so it is sharp at any print size.
 */
function ImageRows({ layer, dpi }: { layer: ImageLayer; dpi: number }) {
  const cropped =
    layer.crop.w < 0.999 || layer.crop.h < 0.999 || layer.crop.x > 0.001;
  const filter = FILTER_PRESETS.find((f) => f.id === layer.filter);
  const edited =
    layer.adjust.brightness !== 0 ||
    layer.adjust.contrast !== 0 ||
    layer.adjust.saturation !== 0;

  return (
    <>
      <Row
        label="Source image"
        value={`${layer.naturalWidth} × ${layer.naturalHeight} px`}
      />
      {cropped && (
        <Row
          label="Used after crop"
          value={`${Math.round(layer.naturalWidth * layer.crop.w)} × ${Math.round(
            layer.naturalHeight * layer.crop.h
          )} px`}
        />
      )}
      <Row
        label="Placed size"
        value={`${Math.round(layer.width)} × ${Math.round(layer.height)} px`}
      />
      <Row
        label="Prints at"
        value={`${printedInches(layer.width, dpi).toFixed(1)} × ${printedInches(
          layer.height,
          dpi
        ).toFixed(1)} in`}
      />
      <Row
        label="Print resolution"
        value={`${Math.round(imagePrintDpi(layer, dpi))} DPI`}
      />
      <Row label="Rotation" value={`${Math.round(layer.rotation)}°`} />
      <Row label="Opacity" value={`${Math.round(layer.opacity * 100)}%`} />
      <Row
        label="Effects"
        value={[
          filter && filter.id !== "none" ? filter.label : null,
          edited ? "Adjusted" : null,
          layer.mask.kind !== "none" ? "Framed" : null,
          layer.strokes.length > 0
            ? `${layer.strokes.length} erase stroke${
                layer.strokes.length === 1 ? "" : "s"
              }`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "None"}
      />
    </>
  );
}

/**
 * For text the useful facts are typographic, plus the printed cap height —
 * "how big will these letters actually be on the wall" is the question a buyer
 * asks, and font size in document pixels doesn't answer it.
 */
function TextRows({ layer, dpi }: { layer: TextLayer; dpi: number }) {
  const font = getFont(layer.fontId);
  const lines = layer.text.split("\n").length;
  const characters = Array.from(layer.text.replace(/\n/g, "")).length;

  return (
    <>
      <Row
        label="Font"
        value={`${font.family} · ${CATEGORY_LABELS[font.category]}`}
      />
      <Row
        label="Style"
        value={[
          `${layer.fontWeight}`,
          layer.italic ? "italic" : null,
          layer.uppercase ? "uppercase" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <Row
        label="Size"
        value={`${Math.round(layer.fontSize)} px · ${(
          printedInches(layer.fontSize, dpi) * 72
        ).toFixed(0)} pt printed`}
      />
      <Row label="Line height" value={`${layer.lineHeight.toFixed(2)}×`} />
      <Row
        label="Letter spacing"
        value={`${(layer.letterSpacing * 100).toFixed(0)}%`}
      />
      <Row
        label="Text"
        value={`${characters} character${characters === 1 ? "" : "s"} · ${lines} line${
          lines === 1 ? "" : "s"
        }`}
      />
      <Row
        label="Box"
        value={`${Math.round(layer.width)} × ${Math.round(layer.height)} px`}
      />
      <Row label="Rotation" value={`${Math.round(layer.rotation)}°`} />
      <Row label="Opacity" value={`${Math.round(layer.opacity * 100)}%`} />
      <Row
        label="Outline"
        value={
          layer.strokeWidth > 0
            ? `${(layer.strokeWidth * 100).toFixed(0)}% · ${layer.strokeColor}`
            : "None"
        }
      />
    </>
  );
}

function QualityVerdict({ layer, dpi }: { layer: ImageLayer; dpi: number }) {
  const verdict = dpiVerdict(imagePrintDpi(layer, dpi));

  return (
    <p
      className={cx(
        "mt-3 flex items-start gap-2 px-3 py-2.5 text-[12.5px] leading-relaxed",
        verdict.tone === "good" && "bg-[#102b1a] text-[#8edba5]",
        verdict.tone === "ok" && "bg-[#30230f] text-[#f3c779]",
        verdict.tone === "poor" && "bg-[#35100e] text-[#ffb4ab]"
      )}
      data-r="md"
    >
      <Icon
        name={
          verdict.tone === "good"
            ? "check_circle"
            : verdict.tone === "ok"
              ? "info"
              : "warning"
        }
        className="mt-[1px] shrink-0 text-[16px]"
      />
      <span>
        {verdict.label}
        {verdict.tone !== "good" && (
          <> Try scaling it down, or replace it with a larger file.</>
        )}
      </span>
    </p>
  );
}
