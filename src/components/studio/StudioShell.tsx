"use client";

/**
 * The full-screen studio: provider, layout, and the chrome that doesn't belong
 * to any single region — context menu, shortcuts sheet, the BG-remover notice,
 * the clipboard, autosave, and the keyboard map.
 *
 * Everything below the top bar is one flex row: rail, the rail's flyout, the
 * active tool's panel, then the canvas column. Panels are siblings of the
 * canvas rather than floating over it, so the artwork is never hidden behind UI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ImageLayer, Layer, StudioDocument } from "@/lib/studio/document";
import { asFreshCopy, createId, createImageLayer, docSizeForFrame, idPrefixFor, unfilledSlots } from "@/lib/studio/document";
import { fromFramersTemplate, toFramersTemplate } from "@/lib/studio/templateFormat";
import { boundingRect, containBox } from "@/lib/studio/geometry";
import { isWholeGroup, selectionBounds as selectionBoundsOf } from "@/lib/studio/multiSelect";
import { registerDocumentFonts, waitForFonts } from "@/lib/studio/fontLoader";
import {
  downloadBlob,
  exportFilename,
  loadDocumentImages,
  renderToBlob,
  renderToPdfBlob,
  THUMBNAIL_MAX_EDGE,
  type DownloadFormat,
  type ExportType,
} from "@/lib/studio/export";
import { keepsObjectToolbars, StudioProvider, useStudio } from "@/lib/studio/StudioContext";
import { layersOutsideSafeArea } from "@/lib/studio/print";
import { pasteStyleActions } from "@/lib/studio/copyStyle";
import { textLayerHeight } from "@/lib/studio/textMeasure";
import {
  useStudioImages,
  type SrcResolver,
} from "@/lib/studio/useStudioImages";

import { Icon } from "@/components/Icon";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { ContextualToolbar, MultiToolbar, PageToolbar } from "./ContextualToolbar";
import { CustomSizeDialog } from "./CustomSizeDialog";
import { LayerInfoSheet } from "./LayerInfoSheet";
import { MobileTextEditor } from "./MobileTextEditor";
import { ObjectToolbar } from "./ObjectToolbar";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { useCompactStudio } from "./useCompactStudio";
import { StudioBottomBar } from "./StudioBottomBar";
import { StudioCanvas } from "./StudioCanvas";
import { StudioFlyout, StudioToolPanel } from "./StudioFlyout";
import { StudioAssetsProvider } from "./StudioAssets";
import { StudioRail } from "./StudioRail";
import { StudioTopBar, type FrameSizeOption } from "./StudioTopBar";
import { useInsertText } from "./useInsertText";
import { IconButton, StudioButton, cx } from "./ui";

export interface StudioShellUpload {
  /** Storage path — what the layer stores. */
  src: string;
  name: string;
  /** Signed or object URL for display. */
  url: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface StudioShellProps {
  initialDocument: StudioDocument;
  userInitial: string;
  /** Shows the admin-only "Save as template" action in the File menu. */
  isAdmin?: boolean;
  sizes: FrameSizeOption[];
  currentSizeId: string | null;
  uploads: StudioShellUpload[];
  resolveSrc: SrcResolver;
  /** Open the file picker and resolve with the stored upload, or null. */
  onPickImage: () => Promise<StudioShellUpload | null>;
  /** Take a photo out of the user's library. Absent = no remove control. */
  onRemoveUpload?: (src: string) => Promise<void>;
  /** Persist a snapshot. `false` means it only reached this browser. */
  persist: (doc: StudioDocument) => Promise<boolean>;
  /** Commit and move on. Receives the flattened print file and a thumbnail. */
  onDone: (payload: {
    doc: StudioDocument;
    print: Blob;
    thumbnail: Blob;
  }) => Promise<void>;
  onResize: (size: FrameSizeOption) => void;
}

const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "T", what: "Add a heading" },
  { keys: "P", what: "Pen tool: click for corners, drag for curves" },
  { keys: "Double-click", what: "Edit a text layer in place" },
  { keys: "Ctrl+Z / Ctrl+Y", what: "Undo / redo" },
  { keys: "Ctrl+C / Ctrl+V", what: "Copy / paste a layer" },
  { keys: "Ctrl+D", what: "Duplicate the selection" },
  { keys: "Delete", what: "Delete the selection" },
  { keys: "Arrows", what: "Nudge 1 px (Shift: 10 px)" },
  { keys: "Ctrl+] / Ctrl+[", what: "Bring to front / send to back" },
  { keys: "Alt+Shift+L", what: "Lock or unlock" },
  { keys: "Space + drag", what: "Pan the canvas" },
  { keys: "Ctrl + wheel", what: "Zoom about the cursor" },
  { keys: "Esc", what: "Deselect, or close a panel" },
];

const AUTOSAVE_DELAY_MS = 1200;

export function StudioShell(props: StudioShellProps) {
  // The frame's physical size is what makes "300 DPI" checkable, so it goes in
  // at the provider rather than being threaded to the two places that ask.
  const size = props.sizes.find((s) => s.id === props.currentSizeId) ?? null;

  return (
    <StudioProvider
      initialDocument={props.initialDocument}
      printSize={
        size ? { widthMm: size.widthMm, heightMm: size.heightMm } : null
      }
    >
      <ShellInner {...props} />
    </StudioProvider>
  );
}

function ShellInner({
  userInitial,
  isAdmin = false,
  sizes,
  currentSizeId,
  uploads: initialUploads,
  resolveSrc,
  onPickImage,
  onRemoveUpload,
  persist,
  onDone,
  onResize,
}: StudioShellProps) {
  const {
    doc,
    docRef,
    selectedLayer,
    selectedLayers,
    selectMany,
    tool,
    viewport,
    editingId,
    apply,
    endGesture,
    undo,
    redo,
    select,
    setTool,
    setRail,
    setSaveStatus,
    printSize,
    guides,
    showGuides,
    setShowGuides,
    styleSource,
    setStyleSource,
    replaceDocument,
    duplicate,
  } = useStudio();

  const { images, pending, failed, registerLocal, retry } = useStudioImages(
    doc,
    resolveSrc
  );

  // Uploaded fonts are stored as paths, like images: sign and register them so
  // text set in them draws in the real face (and the print file waits for it).
  useEffect(() => {
    void registerDocumentFonts(doc.fonts, resolveSrc);
  }, [doc.fonts, resolveSrc]);

  // Copy style: the next layer selected takes the waiting style, as one undo
  // step, and the roller is put down.
  useEffect(() => {
    if (!styleSource || !selectedLayer || selectedLayer.id === styleSource.id) return;
    const target = selectedLayer;
    const actions = pasteStyleActions(styleSource, target, (patch) =>
      target.kind === "text" ? textLayerHeight(target, patch) : undefined
    );
    if (!target.locked) {
      for (const action of actions) apply(action, { transient: true, label: `paste-style:${target.id}` });
      endGesture();
    }
    setStyleSource(null);
  }, [selectedLayer, styleSource, apply, endGesture, setStyleSource]);

  // Derived, not copied: the photo library can arrive after mount, so the list
  // is what was picked here, then everything the loader handed us, minus
  // whatever was taken out of the library in this session.
  const [picked, setPicked] = useState<StudioShellUpload[]>([]);
  const [removedUploads, setRemovedUploads] = useState<ReadonlySet<string>>(() => new Set());
  const uploads = useMemo(() => {
    const seen = new Set<string>();
    return [...picked, ...initialUploads].filter((u) => {
      if (seen.has(u.src) || removedUploads.has(u.src)) return false;
      seen.add(u.src);
      return true;
    });
  }, [picked, initialUploads, removedUploads]);

  /** A photo just picked goes to the top of the list, and back in if removed. */
  function addPicked(entry: StudioShellUpload) {
    setPicked((list) => [entry, ...list.filter((u) => u.src !== entry.src)]);
    setRemovedUploads((set) => {
      if (!set.has(entry.src)) return set;
      const next = new Set(set);
      next.delete(entry.src);
      return next;
    });
  }
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Images in the saved document also belong in Uploads after a reload.
  const availableUploads = useMemo(() => {
    const entries = new Map(uploads.map((entry) => [entry.src, entry]));
    for (const layer of doc.layers) {
      if (layer.kind !== "image" || entries.has(layer.src) || removedUploads.has(layer.src)) continue;
      const image = images.get(layer.src);
      if (image && "src" in image) entries.set(layer.src, {
        src: layer.src, name: layer.name, url: image.src,
        naturalWidth: layer.naturalWidth, naturalHeight: layer.naturalHeight,
      });
    }
    return [...entries.values()];
  }, [uploads, doc.layers, images, removedUploads]);
  const insertText = useInsertText();
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [infoLayer, setInfoLayer] = useState<Layer | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [bgNoteOpen, setBgNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Surfaced to the user. Export and Done must never fail silently. */
  const [error, setError] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compact = useCompactStudio();
  const mobileEditing = compact && selectedLayer?.kind === "text" && editingId === selectedLayer.id;
  // Browser chrome and the software keyboard change the *visible* viewport.
  // Reserve that space in layout so neither can cover the bottom controls.
  useEffect(() => {
    if (!compact) return;
    const visible = window.visualViewport;
    const update = () => {
      if (visible && visible.scale !== 1) return;
      rootRef.current?.style.setProperty("--studio-visible-height", `${visible?.height ?? window.innerHeight}px`);
      rootRef.current?.style.setProperty("--studio-visible-top", `${visible?.offsetTop ?? 0}px`);
    };
    update();
    visible?.addEventListener("resize", update);
    visible?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      visible?.removeEventListener("resize", update);
      visible?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [compact]);
  const clipboardRef = useRef<Layer | null>(null);
  const [canPaste, setCanPaste] = useState(false);

  /* ---------------------------------------------------------------- images */

  /** Resolve a src for export: reuse the already-decoded URL where we have one. */
  const srcForExport = useCallback(
    (src: string) => {
      const known = images.get(src) as HTMLImageElement | undefined;
      return known?.src ?? src;
    },
    [images]
  );

  const flatten = useCallback(
    async (options: { type?: ExportType; maxEdge?: number } = {}) => {
      const current = docRef.current;
      // Canvas substitutes a fallback face for a font it hasn't loaded, silently
      // and without failing — so the print file has to wait for the real faces
      // even though the on-screen paint could carry on without them.
      const loaded = await loadDocumentImages(current, srcForExport);
      await waitForFonts(current);
      return renderToBlob(current, loaded.images, options);
    },
    [docRef, srcForExport]
  );

  /**
   * The same render, wrapped in a PDF that states the paper size. Only the mm
   * differ from `flatten` — and they are the whole point, so they come from the
   * frame the user actually chose rather than from the pixel grid.
   */
  const flattenPdf = useCallback(async () => {
    const current = docRef.current;
    const loaded = await loadDocumentImages(current, srcForExport);
    await waitForFonts(current);
    return renderToPdfBlob(current, loaded.images, {
      widthMm: printSize?.widthMm,
      heightMm: printSize?.heightMm,
      title: current.title,
    });
  }, [docRef, srcForExport, printSize]);

  /* ------------------------------------------------------------- autosave */

  useEffect(() => {
    const timer = setTimeout(() => {
      setSaveStatus("saving");
      void persist(docRef.current)
        .then((toServer) => setSaveStatus(toServer ? "saved" : "saved-local"))
        .catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [doc, persist, docRef, setSaveStatus]);

  /* ------------------------------------------------------------ clipboard */

  const copyLayer = useCallback((layer: Layer) => {
    clipboardRef.current = layer;
    setCanPaste(true);
  }, []);

  const pasteLayer = useCallback(() => {
    const source = clipboardRef.current;
    if (!source) return;
    // The copy is placed from the stored snapshot, so pasting still works after
    // the original has been deleted.
    const exists = docRef.current.layers.some((l) => l.id === source.id);
    if (exists) {
      duplicate(source.id, 16);
      return;
    }
    // A fresh id and a deep copy: pasting the same snapshot twice must not put
    // two layers with one id (or one shared crop) into the document.
    const id = createId(idPrefixFor(source.kind));
    apply({
      type: "addLayer",
      layer: { ...asFreshCopy(source), id, x: source.x + 16, y: source.y + 16 },
    });
    select(id);
  }, [apply, docRef, duplicate, select]);

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA"
      );
    }

    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const layer = selectedLayer;
      const key = e.key.toLowerCase();

      if (e.key === "Escape") {
        setStyleSource(null);
        setCtxMenu(null);
        setShortcutsOpen(false);
        setBgNoteOpen(false);
        setInfoLayer(null);
        setError(null);
        if (tool !== "select") setTool("select");
        else select(null);
        return;
      }
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      // Canva's key, and it's free here: no other single letter is bound.
      if (key === "t" && !mod && !e.altKey) {
        e.preventDefault();
        insertText("heading");
        return;
      }
      // P for the Pen tool, as in Photoshop, Illustrator and Photopea.
      if (key === "p" && !mod && !e.altKey) {
        e.preventDefault();
        select(null);
        setTool("path");
        return;
      }

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "v") {
        e.preventDefault();
        pasteLayer();
        return;
      }

      if (mod && key === "a") {
        e.preventDefault();
        selectMany(docRef.current.layers.filter((l) => l.visible).map((l) => l.id));
        return;
      }

      // Several selected: the keys act on all of them, as one undo step.
      if (selectedLayers.length > 1) {
        const unlocked = selectedLayers.filter((l) => !l.locked);
        if (mod && key === "g") {
          e.preventDefault();
          apply({
            type: "setGroup",
            layerIds: selectedLayers.map((l) => l.id),
            groupId: e.shiftKey ? null : createId("grp"),
          });
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          for (const l of unlocked) apply({ type: "removeLayer", layerId: l.id }, { transient: true, label: "delete-many" });
          endGesture();
          select(null);
          return;
        }
        const arrows: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const dir = arrows[e.key];
        if (dir) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          for (const l of unlocked) {
            apply(
              { type: "nudgeLayer", layerId: l.id, dx: dir[0] * step, dy: dir[1] * step },
              { transient: true, label: "nudge-many" }
            );
          }
          endGesture();
        }
        return;
      }

      // Ctrl+Shift+G on one member of a group ungroups the whole group.
      if (mod && key === "g" && e.shiftKey && layer?.groupId) {
        e.preventDefault();
        apply({
          type: "setGroup",
          layerIds: docRef.current.layers.filter((l) => l.groupId === layer.groupId).map((l) => l.id),
          groupId: null,
        });
        return;
      }

      if (!layer) return;

      if (mod && key === "c") {
        e.preventDefault();
        copyLayer(layer);
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicate(layer.id);
        return;
      }
      if (mod && e.key === "]") {
        e.preventDefault();
        apply({ type: "bringToFront", layerId: layer.id });
        return;
      }
      if (mod && e.key === "[") {
        e.preventDefault();
        apply({ type: "sendToBack", layerId: layer.id });
        return;
      }
      if (e.altKey && e.shiftKey && key === "l") {
        e.preventDefault();
        apply({
          type: "setLayerLocked",
          layerId: layer.id,
          locked: !layer.locked,
        });
        return;
      }
      // A locked layer stays put: no deleting, no nudging, until it's unlocked.
      if (layer.locked) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        apply({ type: "removeLayer", layerId: layer.id });
        select(null);
        return;
      }

      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const direction = nudge[e.key];
      if (direction) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        apply({
          type: "nudgeLayer",
          layerId: layer.id,
          dx: direction[0] * step,
          dy: direction[1] * step,
        });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    apply,
    duplicate,
    copyLayer,
    insertText,
    pasteLayer,
    redo,
    select,
    selectedLayer,
    selectedLayers,
    selectMany,
    docRef,
    endGesture,
    setStyleSource,
    setTool,
    tool,
    undo,
  ]);

  /* --------------------------------------------------------------- actions */

  async function handlePickImage() {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const entry = await onPickImage();
      if (!entry) return;
      registerLocal(entry.src, entry.url);
      addPicked(entry);
      const current = docRef.current;
      const naturalWidth = entry.naturalWidth ?? current.width;
      const naturalHeight = entry.naturalHeight ?? current.height;
      const box = containBox(current.width, current.height, naturalWidth, naturalHeight);
      const layer = createImageLayer({ ...entry, naturalWidth, naturalHeight, ...box });
      apply({ type: "addLayer", layer });
      select(layer.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  }

  /** Out of the library list. The file stays, so designs using it still open. */
  async function handleRemoveUpload(src: string) {
    if (!onRemoveUpload) return;
    setUploadError(null);
    try {
      await onRemoveUpload(src);
      setRemovedUploads((set) => new Set(set).add(src));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not remove that photo.");
    }
  }

  /** Swap a picture in place — same box, mask and filters, just a new source. */
  async function handleReplaceImage(layer: ImageLayer) {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const entry = await onPickImage();
      if (!entry) return;
      registerLocal(entry.src, entry.url);
      addPicked(entry);
      const naturalWidth = entry.naturalWidth ?? layer.naturalWidth;
      const naturalHeight = entry.naturalHeight ?? layer.naturalHeight;
      apply({
        type: "replaceLayerImage",
        layerId: layer.id,
        src: entry.src,
        naturalWidth,
        naturalHeight,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  }

  /**
   * An upload dropped on the canvas. Onto a photo it swaps the picture in place
   * (Canva's drop-into-frame: same box, mask and filters); onto bare page it
   * lands as a new layer centred on the drop.
   */
  function handleDropUpload(src: string, point: { x: number; y: number }, targetId: string | null) {
    const entry = availableUploads.find((u) => u.src === src);
    if (!entry) return;
    registerLocal(entry.src, entry.url);
    const current = docRef.current;
    const naturalWidth = entry.naturalWidth ?? current.width;
    const naturalHeight = entry.naturalHeight ?? current.height;
    if (targetId) {
      apply({ type: "replaceLayerImage", layerId: targetId, src, naturalWidth, naturalHeight });
      select(targetId);
      // The "fill your photo slots" banner is about slots, and one just changed.
      setError(null);
      return;
    }
    const fit = containBox(current.width / 2, current.height / 2, naturalWidth, naturalHeight);
    const layer = createImageLayer({
      src,
      name: entry.name,
      naturalWidth,
      naturalHeight,
      x: point.x - fit.width / 2,
      y: point.y - fit.height / 2,
      width: fit.width,
      height: fit.height,
    });
    apply({ type: "addLayer", layer });
    select(layer.id);
  }

  function handleFillSlot(layerId: string) {
    const layer = docRef.current.layers.find((l) => l.id === layerId);
    if (layer?.kind !== "image") return;
    select(layer.id);
    setError(null);
    void handleReplaceImage(layer);
  }

  /** Staff: the design as a `framers-template` 1.0 file. */
  function handleExportTemplate() {
    const { template, warnings } = toFramersTemplate(docRef.current);
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${template.id}.template.json`);
    if (warnings.length) setError(`Exported. Not carried over: ${warnings.join(" ")}`);
  }

  /** Staff: open a `framers-template` 1.0 file in place of the current design. */
  function handleImportTemplate(file: File) {
    void (async () => {
      setError(null);
      try {
        const result = fromFramersTemplate(JSON.parse(await file.text()));
        if (!result) throw new Error("not a template");
        if (
          docRef.current.layers.length > 0 &&
          !window.confirm(`Replace your current design with "${result.doc.title}"?`)
        ) {
          return;
        }
        replaceDocument(result.doc);
        if (result.warnings.length) setError(`Opened with changes: ${result.warnings.join(" ")}`);
      } catch {
        setError("That file isn’t a Framers template (schema 1.0).");
      }
    })();
  }

  function handleDownload(format: DownloadFormat) {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const blob =
          format === "application/pdf"
            ? await flattenPdf()
            : await flatten({ type: format });
        downloadBlob(blob, exportFilename(docRef.current.title, format));
      } catch {
        setError("That download didn’t finish. Please try again.");
      } finally {
        setBusy(false);
      }
    })();
  }

  function handleDone() {
    // A template's photo slot still showing its sample would print someone
    // else's picture. Point at the first one instead of sending it to checkout.
    const empty = unfilledSlots(docRef.current);
    if (empty.length > 0) {
      select(empty[0].id);
      setError(
        empty.length === 1
          ? "Add your photo to the highlighted photo slot before you continue."
          : `Add your photos to the ${empty.length} photo slots before you continue.`
      );
      return;
    }
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const [print, thumbnail] = await Promise.all([
          flatten({ type: "image/png" }),
          flatten({ type: "image/jpeg", maxEdge: 800 }),
        ]);
        await onDone({ doc: docRef.current, print, thumbnail });
      } catch (e) {
        // The work is still here — the document is saved and the canvas is
        // untouched — so say what failed and let them press Done again.
        setError(
          e instanceof Error && e.message
            ? e.message
            : "Your artwork couldn’t be saved. Please try Done again."
        );
      } finally {
        setBusy(false);
      }
    })();
  }

  async function handleSaveAsTemplate(name: string) {
    const current = docRef.current;
    const loaded = await loadDocumentImages(current, srcForExport);
    await waitForFonts(current);
    const thumbnail = await renderToBlob(current, loaded.images, {
      type: "image/jpeg",
      maxEdge: THUMBNAIL_MAX_EDGE,
    });

    const form = new FormData();
    form.append("name", name);
    form.append("document", JSON.stringify(current));
    form.append("thumbnail", thumbnail, "thumbnail.jpg");

    const response = await fetch("/api/admin/templates", { method: "POST", body: form });
    const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "Could not save this template.");
    }
  }

  function handleDownloadSelection(layer: Layer) {
    void (async () => {
      setError(null);
      try {
        const current = docRef.current;
        const loaded = await loadDocumentImages(current, srcForExport);
        await waitForFonts(current);
        const blob = await renderToBlob(current, loaded.images, {
          type: "image/png",
          layerId: layer.id,
        });
        downloadBlob(blob, exportFilename(layer.name, "image/png"));
      } catch {
        setError("That download didn’t finish. Please try again.");
      }
    })();
  }

  // Text gets the pill too, but not while the caret is in it — the textarea is
  // already sitting where the toolbar's own "Edit text" would lead.
  const showContextual =
    !!selectedLayer &&
    !selectedLayer.locked &&
    keepsObjectToolbars(tool) &&
    editingId !== selectedLayer.id;
  const showQuickActions =
    !!selectedLayer && keepsObjectToolbars(tool) && editingId !== selectedLayer.id;
  // Rotated layers are placed by their on-screen bounds, so the pill never
  // lands on top of a turned corner.
  const selectionBounds = selectedLayer ? boundingRect(selectedLayer) : null;
  const multi = selectedLayers.length > 1;
  // Nothing selected: the page's own toolbar (background colour, border).
  const showPageToolbar = selectedLayers.length === 0 && keepsObjectToolbars(tool) && !editingId;
  const multiBounds = multi ? selectionBoundsOf(selectedLayers) : null;
  // Status banners drop below the docked toolbar while it is showing.
  const bannerTop =
    !compact && (showContextual || multi || showPageToolbar) ? "top-[60px]" : "top-3";

  // Only ever asked about the selection: a warning about a layer nobody is
  // touching is noise, and the moment that matters is while the words are being
  // dragged. `layersOutsideSafeArea` ignores photos by design — those are meant
  // to run under the lip.
  const strays = useMemo(
    () => new Set(layersOutsideSafeArea(doc, printSize)),
    [doc, printSize]
  );
  const selectionStrays = !!selectedLayer && strays.has(selectedLayer.id);

  /**
   * Picking a frame size resizes the page as well as the session. The document's
   * proportions *are* the frame's, so changing one without the other leaves the
   * user editing an A4 page while checkout charges for an A3 print. `printMm:
   * null` hands authority back to the frame row — a catalogue size is not a
   * custom size, and storing it twice invites the two copies to disagree.
   */
  const handleResize = useCallback(
    (size: FrameSizeOption) => {
      const grid = docSizeForFrame(size.widthMm, size.heightMm);
      endGesture();
      apply({
        type: "resizeDocument",
        width: grid.width,
        height: grid.height,
        printMm: null,
      });
      onResize(size);
    },
    [apply, endGesture, onResize]
  );

  return (
    <StudioAssetsProvider doc={doc} images={images}>
    <div ref={rootRef} data-editing={mobileEditing || undefined} className="studio-root flex h-screen w-full flex-col overflow-clip">
      <StudioTopBar
        userInitial={userInitial}
        sizes={sizes}
        currentSizeId={currentSizeId}
        onResize={handleResize}
        onCustomSize={() => setSizeDialogOpen(true)}
        onDownload={isAdmin ? handleDownload : undefined}
        onDone={handleDone}
        onShowShortcuts={() => setShortcutsOpen(true)}
        busy={busy}
        isAdmin={isAdmin}
        onSaveAsTemplate={() => setSaveTemplateOpen(true)}
        onExportTemplate={isAdmin ? handleExportTemplate : undefined}
        onImportTemplate={isAdmin ? handleImportTemplate : undefined}
      />

      <div className="studio-workspace flex min-h-0 flex-1">
        <StudioRail panelId="studio-flyout" />
        <StudioFlyout
          panelId="studio-flyout"
          onAddImage={() => void handlePickImage()}
          uploads={availableUploads}
          onRemoveUpload={onRemoveUpload ? handleRemoveUpload : undefined}
          uploading={uploading}
          uploadError={uploadError}
          isAdmin={isAdmin}
        />
        <StudioToolPanel isAdmin={isAdmin} />

        <main className="studio-main flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={surfaceRef} className="studio-surface relative min-h-0 flex-1 overflow-hidden">
            <StudioCanvas
              images={images}
              onContextMenu={(x, y, layerId) => setCtxMenu({ x, y, layerId })}
              onDropUpload={handleDropUpload}
              onFillSlot={handleFillSlot}
            />

            {/* Contextual toolbar, docked to the top of the workspace so it
                never covers the artwork it edits. */}
            {!compact && showContextual && selectedLayer && (
              <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 flex max-w-[calc(100%-16px)] -translate-x-1/2 justify-center">
                <ContextualToolbar
                  layer={selectedLayer}
                  onBgRemover={() => setBgNoteOpen(true)}
                  onReplace={
                    selectedLayer.kind === "image"
                      ? () => void handleReplaceImage(selectedLayer)
                      : undefined
                  }
                />
              </div>
            )}

            {!compact && multi && keepsObjectToolbars(tool) && (
              <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 flex max-w-[calc(100%-16px)] -translate-x-1/2 justify-center">
                <MultiToolbar layers={selectedLayers} />
              </div>
            )}

            {!compact && showPageToolbar && (
              <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 flex max-w-[calc(100%-16px)] -translate-x-1/2 justify-center">
                <PageToolbar />
              </div>
            )}

            {/* Under a multi-selection: the count, so it's obvious what a
                delete or a drag will take with it. */}
            {!compact && multi && multiBounds && keepsObjectToolbars(tool) && (
              <div
                className="pointer-events-none absolute z-20 flex justify-center"
                style={{
                  left: viewport.offsetX + multiBounds.x * viewport.scale,
                  top: viewport.offsetY + (multiBounds.y + multiBounds.height) * viewport.scale + 14,
                  width: multiBounds.width * viewport.scale,
                }}
              >
                <span
                  data-r="full"
                  className="studio-shadow border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] px-3 py-1 text-[12px] font-medium text-[var(--studio-ink)]"
                >
                  {isWholeGroup(doc.layers, selectedLayers) ? "Group" : `${selectedLayers.length} selected`}
                  <span className="ml-2 text-[var(--studio-ink-muted)]">double-click to edit one</span>
                </span>
              </div>
            )}

            {/* Quick-actions pill, centred below the selection — lock,
                duplicate, delete and the overflow menu. Shown for a locked layer
                too, since this is where it gets unlocked. */}
            {!compact && showQuickActions && selectedLayer && selectionBounds && (
              <div
                className="pointer-events-none absolute z-20 flex justify-center"
                style={{
                  left: viewport.offsetX + selectionBounds.x * viewport.scale,
                  top:
                    viewport.offsetY +
                    (selectionBounds.y + selectionBounds.height) * viewport.scale +
                    14,
                  width: selectionBounds.width * viewport.scale,
                }}
              >
                <div className="pointer-events-auto">
                  <ObjectToolbar layer={selectedLayer} />
                </div>
              </div>
            )}

            {/* The mockup's AI circle. It opens the same honest notice. */}
            <button
              type="button"
              onClick={() => setBgNoteOpen(true)}
              data-r="full"
              aria-label="AI tools — not available yet"
              title="AI tools"
              className="studio-canvas-extra studio-shadow absolute bottom-4 left-4 z-20 flex h-11 w-11 items-center justify-center bg-[var(--studio-elevated)] text-white transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              <Icon name="auto_awesome" className="text-[20px]" />
            </button>


            {pending > 0 && (
              <p
                role="status"
                data-r="full"
                className={cx("studio-shadow-sm absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 bg-[var(--studio-elevated)] px-3 py-1.5 text-[12px] text-[var(--studio-ink-muted)]", bannerTop)}
              >
                <Icon
                  name="progress_activity"
                  className="animate-spin text-[15px] motion-reduce:animate-none"
                />
                Loading images…
              </p>
            )}

            {/* The one warning worth interrupting for: text that will be under
                the moulding is not "close to the edge", it is missing from the
                finished frame. The canvas draws no guides by default, so this
                offers them — seeing where the lip lands is what fixes it. */}
            {pending === 0 && selectionStrays && (
              <div
                role="status"
                data-r="full"
                className={cx("studio-shadow-sm absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 bg-[#30230f] px-3 py-1.5 text-[12px] text-[#f3c779]", bannerTop)}
              >
                <Icon name="warning" className="text-[15px]" />
                <span>Too close to the edge — the frame may cover this</span>
                {!showGuides && guides && (
                  <button
                    type="button"
                    onClick={() => setShowGuides(true)}
                    className="font-semibold underline decoration-1 underline-offset-2"
                  >
                    Show frame edge
                  </button>
                )}
              </div>
            )}

            {failed.length > 0 && (
              <p
                role="status"
                data-r="md"
                className="studio-shadow absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 bg-[var(--studio-elevated)] px-3 py-2 text-[12px] text-white"
              >
                {failed.length === 1
                  ? "An image couldn’t be loaded."
                  : `${failed.length} images couldn’t be loaded.`}
                <button
                  type="button"
                  onClick={retry}
                  className="font-semibold underline"
                >
                  Try again
                </button>
              </p>
            )}

            {error && (
              <div
                role="alert"
                data-r="md"
                className={cx("studio-shadow absolute left-1/2 z-30 flex max-w-[min(92%,460px)] -translate-x-1/2 items-start gap-2 border border-[#f2b8b5] bg-[#35100e] px-3 py-2 text-[12.5px] text-[#ffb4ab]", bannerTop)}
              >
                <Icon name="error" className="mt-px shrink-0 text-[16px]" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Dismiss"
                  className="shrink-0 font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {compact && selectedLayer && !mobileEditing && (
            <div className="studio-mobile-actions" aria-label="Selected object controls">
              {showContextual && (
                <ContextualToolbar
                  layer={selectedLayer}
                  onBgRemover={() => setBgNoteOpen(true)}
                  onReplace={
                    selectedLayer.kind === "image"
                      ? () => void handleReplaceImage(selectedLayer)
                      : undefined
                  }
                />
              )}
              <ObjectToolbar layer={selectedLayer} />
            </div>
          )}
          {mobileEditing && selectedLayer?.kind === "text" && <MobileTextEditor key={selectedLayer.id} layer={selectedLayer} />}
          <StudioBottomBar surfaceRef={surfaceRef} onShowShortcuts={() => setShortcutsOpen(true)} />
        </main>
      </div>

      {ctxMenu && (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onCopy={copyLayer}
          onPaste={pasteLayer}
          canPaste={canPaste}
          onDownloadSelection={isAdmin ? handleDownloadSelection : undefined}
          onShowInfo={setInfoLayer}
        />
      )}

      {infoLayer && (
        <LayerInfoSheet
          layer={infoLayer}
          doc={doc}
          onClose={() => setInfoLayer(null)}
        />
      )}

      {bgNoteOpen && (
        <BgRemoverNotice
          onClose={() => setBgNoteOpen(false)}
          onUseEraser={() => {
            setRail("tools");
            setTool("eraser");
            setBgNoteOpen(false);
          }}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsSheet onClose={() => setShortcutsOpen(false)} />
      )}

      {/* Mounted only while open, so it seeds its fields from the page at mount
          instead of writing state in an effect every time it appears. */}
      {sizeDialogOpen && (
        <CustomSizeDialog onClose={() => setSizeDialogOpen(false)} />
      )}

      {saveTemplateOpen && (
        <SaveTemplateDialog onClose={() => setSaveTemplateOpen(false)} onSave={handleSaveAsTemplate} />
      )}
    </div>
    </StudioAssetsProvider>
  );
}

/**
 * Shared by BG Remover and the AI circle. Says plainly that automatic removal
 * isn't built, then routes to the tool that does the job — a dead end becomes a
 * signpost.
 */
function BgRemoverNotice({
  onClose,
  onUseEraser,
}: {
  onClose: () => void;
  onUseEraser: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Background remover"
      data-r="lg"
      className="studio-shadow fixed bottom-20 left-4 z-[65] w-[304px] border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-4"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-[var(--studio-ink)]">
          Automatic removal isn&apos;t ready
        </h2>
        <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--studio-ink-muted)]">
        One-click background removal isn&apos;t available yet. The Eraser does the
        same job by hand: pick a brush size, rub the background out, and use
        Restore to paint anything back.
      </p>
      <div className="mt-3 flex justify-end">
        <StudioButton
          variant="solid"
          size="sm"
          icon="ink_eraser"
          onClick={onUseEraser}
        >
          Open the Eraser
        </StudioButton>
      </div>
    </div>
  );
}

function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-shortcuts-title"
        data-r="lg"
        className="studio-shadow w-full max-w-[440px] border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="studio-shortcuts-title"
            className="text-[15px] font-semibold text-[var(--studio-ink)]"
          >
            Keyboard shortcuts
          </h2>
          <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
        </div>
        <ul className="flex flex-col gap-1.5">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between gap-3 text-[12.5px]"
            >
              <span className="text-[var(--studio-ink)]">{s.what}</span>
              <kbd
                data-r="sm"
                className="shrink-0 border border-[var(--studio-border)] bg-[var(--studio-canvas-bg)] px-1.5 py-0.5 text-[11px] text-[var(--studio-ink-muted)]"
              >
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
