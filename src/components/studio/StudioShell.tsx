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

import type { Layer, StudioDocument } from "@/lib/studio/document";
import { cloneLayer, createId, createImageLayer, docSizeForFrame } from "@/lib/studio/document";
import { containBox } from "@/lib/studio/geometry";
import { waitForFonts } from "@/lib/studio/fontLoader";
import {
  downloadBlob,
  exportFilename,
  loadDocumentImages,
  renderToBlob,
  renderToPdfBlob,
  type DownloadFormat,
  type ExportType,
} from "@/lib/studio/export";
import { StudioProvider, useStudio } from "@/lib/studio/StudioContext";
import { layersOutsideSafeArea } from "@/lib/studio/print";
import {
  useStudioImages,
  type SrcResolver,
} from "@/lib/studio/useStudioImages";

import { Icon } from "@/components/Icon";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { ContextualToolbar } from "./ContextualToolbar";
import { CustomSizeDialog } from "./CustomSizeDialog";
import { LayerInfoSheet } from "./LayerInfoSheet";
import { MobileTextEditor } from "./MobileTextEditor";
import { ObjectToolbar } from "./ObjectToolbar";
import { useCompactStudio } from "./useCompactStudio";
import { StudioBottomBar } from "./StudioBottomBar";
import { StudioCanvas } from "./StudioCanvas";
import { StudioFlyout, StudioToolPanel } from "./StudioFlyout";
import { StudioRail } from "./StudioRail";
import { StudioTopBar, type FrameSizeOption } from "./StudioTopBar";
import { useInsertText } from "./useInsertText";
import { IconButton, StudioButton } from "./ui";

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
  sizes: FrameSizeOption[];
  currentSizeId: string | null;
  uploads: StudioShellUpload[];
  resolveSrc: SrcResolver;
  /** Open the file picker and resolve with the stored upload, or null. */
  onPickImage: () => Promise<StudioShellUpload | null>;
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
  sizes,
  currentSizeId,
  uploads: initialUploads,
  resolveSrc,
  onPickImage,
  persist,
  onDone,
  onResize,
}: StudioShellProps) {
  const {
    doc,
    docRef,
    selectedLayer,
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
  } = useStudio();

  const { images, pending, failed, registerLocal, retry } = useStudioImages(
    doc,
    resolveSrc
  );

  const [uploads, setUploads] = useState<StudioShellUpload[]>(initialUploads);
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Images in the saved document also belong in Uploads after a reload.
  const availableUploads = useMemo(() => {
    const entries = new Map(uploads.map((entry) => [entry.src, entry]));
    for (const layer of doc.layers) {
      if (layer.kind !== "image" || entries.has(layer.src)) continue;
      const image = images.get(layer.src);
      if (image && "src" in image) entries.set(layer.src, {
        src: layer.src, name: layer.name, url: image.src,
        naturalWidth: layer.naturalWidth, naturalHeight: layer.naturalHeight,
      });
    }
    return [...entries.values()];
  }, [uploads, doc.layers, images]);
  const insertText = useInsertText();
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [infoLayer, setInfoLayer] = useState<Layer | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
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
      apply({ type: "duplicateLayer", layerId: source.id, offset: 16 });
      return;
    }
    apply({
      type: "addLayer",
      // A fresh id and a deep copy: pasting the same snapshot twice must not
      // put two layers with one id (or one shared crop) into the document.
      layer: {
        ...cloneLayer(source),
        id: createId(
          source.kind === "text" ? "txt" : source.kind === "shape" ? "shp" : "img"
        ),
        x: source.x + 16,
        y: source.y + 16,
      },
    });
  }, [apply, docRef]);

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

      if (!layer) return;

      if (mod && key === "c") {
        e.preventDefault();
        copyLayer(layer);
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        apply({ type: "duplicateLayer", layerId: layer.id });
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
    copyLayer,
    insertText,
    pasteLayer,
    redo,
    select,
    selectedLayer,
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
      setUploads((list) => [...list.filter((u) => u.src !== entry.src), entry]);
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
    tool === "select" &&
    editingId !== selectedLayer.id;

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
    <div ref={rootRef} data-editing={mobileEditing || undefined} className="studio-root flex h-screen w-full flex-col overflow-hidden">
      <StudioTopBar
        userInitial={userInitial}
        sizes={sizes}
        currentSizeId={currentSizeId}
        onResize={handleResize}
        onCustomSize={() => setSizeDialogOpen(true)}
        onDownload={handleDownload}
        onDone={handleDone}
        onShowShortcuts={() => setShortcutsOpen(true)}
        busy={busy}
      />

      <div className="studio-workspace flex min-h-0 flex-1">
        <StudioRail panelId="studio-flyout" />
        <StudioFlyout
          panelId="studio-flyout"
          onAddImage={() => void handlePickImage()}
          uploads={availableUploads}
          uploading={uploading}
          uploadError={uploadError}
        />
        <StudioToolPanel />

        <main className="studio-main flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={surfaceRef} className="studio-surface relative min-h-0 flex-1 overflow-hidden">
            <StudioCanvas
              images={images}
              onContextMenu={(x, y, layerId) => setCtxMenu({ x, y, layerId })}
            />

            {/* Contextual pill, centred above the selection. */}
            {!compact && showContextual && selectedLayer && (
              <div
                className="pointer-events-none absolute z-20 flex justify-center"
                style={{
                  left: viewport.offsetX + selectedLayer.x * viewport.scale,
                  top:
                    viewport.offsetY +
                    selectedLayer.y * viewport.scale -
                    52,
                  width: selectedLayer.width * viewport.scale,
                }}
              >
                <ContextualToolbar
                  layer={selectedLayer}
                  onBgRemover={() => setBgNoteOpen(true)}
                />
              </div>
            )}

            {/* The mockup's AI circle. It opens the same honest notice. */}
            <button
              type="button"
              onClick={() => setBgNoteOpen(true)}
              data-r="full"
              aria-label="AI tools — not available yet"
              title="AI tools"
              className="studio-canvas-extra studio-shadow absolute bottom-4 left-4 z-20 flex h-11 w-11 items-center justify-center bg-[#16161a] text-white transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              <Icon name="auto_awesome" className="text-[20px]" />
            </button>

            <IconButton
              icon="help"
              label="Keyboard shortcuts"
              tooltipSide="top"
              onClick={() => setShortcutsOpen(true)}
              className="studio-canvas-extra studio-shadow-sm absolute bottom-4 right-4 z-20 bg-[var(--studio-chrome)]"
            />

            {pending > 0 && (
              <p
                role="status"
                data-r="full"
                className="studio-shadow-sm absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1.5 bg-[var(--studio-chrome)] px-3 py-1.5 text-[12px] text-[var(--studio-ink-muted)]"
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
                className="studio-shadow-sm absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 bg-[#30230f] px-3 py-1.5 text-[12px] text-[#f3c779]"
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
                className="studio-shadow absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 bg-[#16161a] px-3 py-2 text-[12px] text-white"
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
                className="studio-shadow absolute left-1/2 top-3 z-30 flex max-w-[min(92%,460px)] -translate-x-1/2 items-start gap-2 border border-[#f2b8b5] bg-[#35100e] px-3 py-2 text-[12.5px] text-[#ffb4ab]"
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
              {showContextual && <ContextualToolbar layer={selectedLayer} onBgRemover={() => setBgNoteOpen(true)} />}
              <ObjectToolbar layer={selectedLayer} />
            </div>
          )}
          {mobileEditing && selectedLayer?.kind === "text" && <MobileTextEditor key={selectedLayer.id} layer={selectedLayer} />}
          <StudioBottomBar surfaceRef={surfaceRef} />
        </main>
      </div>

      {ctxMenu && (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onCopy={copyLayer}
          onPaste={pasteLayer}
          canPaste={canPaste}
          onDownloadSelection={handleDownloadSelection}
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
    </div>
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
      className="studio-shadow fixed bottom-20 left-4 z-[65] w-[304px] border border-[var(--studio-border)] bg-[var(--studio-chrome)] p-4"
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
        className="studio-shadow w-full max-w-[440px] border border-[var(--studio-border)] bg-[var(--studio-chrome)] p-5"
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
