"use client";

/**
 * Keeps the webfonts a document needs loaded, and tells the canvas when one
 * arrives.
 *
 * The parallel of `useStudioImages`: text layers store a font *id*, and the
 * renderer can only draw a face the browser has fetched. The returned revision
 * changes whenever a face lands, which is what re-runs the canvas's draw effect
 * — otherwise a document opened before its fonts arrived would sit there in
 * Helvetica until the next unrelated edit.
 */

import { useEffect, useState } from "react";

import type { StudioDocument } from "./document";
import { isTextLayer } from "./document";
import {
  loadDocumentFonts,
  onFontsChanged,
  textSubsetKey,
} from "./fontLoader";

export function useStudioFonts(doc: StudioDocument): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => onFontsChanged(() => setRevision((n) => n + 1)), []);

  // The set of faces the document needs, not the document itself: typing a
  // character must not re-run the load pass, but switching script must, because
  // css2 serves Malayalam and Latin as separate subsets of the same family.
  const faceKey = doc.layers
    .filter(isTextLayer)
    .map(
      (layer) =>
        `${layer.fontId}:${layer.fontWeight}:${layer.italic ? "i" : "n"}:${textSubsetKey(
          layer.text
        )}`
    )
    .join(" ");

  useEffect(() => {
    void loadDocumentFonts(doc);
    // Keyed by the faces rather than `doc` for the reason above. `loadFont` is
    // idempotent, so a redundant run costs a Map lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceKey]);

  return revision;
}
