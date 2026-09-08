"use client";
import { StudioShell } from "@/components/studio/StudioShell";
import { createDocument, createImageLayer } from "@/lib/studio/document";
const doc = createDocument({ width: 1200, height: 1700, title: "Mobile layout check" });
const src = "/storefront/bmw-frame.jpg";
doc.layers.push(createImageLayer({ src, naturalWidth: 1200, naturalHeight: 1700, x: 0, y: 0, width: 1200, height: 1700 }));
export default function Check() {
  return <StudioShell initialDocument={doc} userInitial="T" sizes={[]} currentSizeId={null} uploads={[]} resolveSrc={async () => ({ [src]: src })} onPickImage={async () => null} persist={async () => false} onDone={async () => {}} onResize={() => {}} />;
}
