"use client";

/**
 * The studio top bar: wordmark, File/Resize/Editing menus, undo/redo, an honest
 * save indicator, the document title, and the primary commit action.
 *
 * The save indicator says what actually happened — "Saved on this device" when
 * the document is only in localStorage (migration 0008 not yet run) rather than
 * claiming it reached the server.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { useStudio, type SaveStatus } from "@/lib/studio/StudioContext";
import type { DownloadFormat } from "@/lib/studio/export";

import {
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  StudioButton,
  Tooltip,
  cx,
} from "./ui";

export interface FrameSizeOption {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

const SAVE_COPY: Record<SaveStatus, { icon: string; text: string }> = {
  idle: { icon: "cloud_queue", text: "" },
  saving: { icon: "cloud_sync", text: "Saving…" },
  saved: { icon: "cloud_done", text: "All changes saved" },
  // Deliberately different wording: the work exists only in this browser.
  "saved-local": { icon: "computer", text: "Saved on this device" },
  error: { icon: "cloud_off", text: "Not saved — check your connection" },
};

export function StudioTopBar({
  userInitial,
  sizes,
  currentSizeId,
  onResize,
  onCustomSize,
  onDownload,
  onDone,
  onShowShortcuts,
  doneLabel = "Done",
  busy = false,
  isAdmin = false,
  onSaveAsTemplate,
  onExportTemplate,
  onImportTemplate,
}: {
  userInitial: string;
  sizes: FrameSizeOption[];
  currentSizeId: string | null;
  onResize: (size: FrameSizeOption) => void;
  /** Open the custom-size dialog. Owned by the shell, which can `apply`. */
  onCustomSize: () => void;
  /** Staff only. Omitted for customers, whose artwork leaves via Done → checkout. */
  onDownload?: (format: DownloadFormat) => void;
  onDone: () => void;
  onShowShortcuts: () => void;
  doneLabel?: string;
  busy?: boolean;
  /** Shows "Save as template" in the File menu. */
  isAdmin?: boolean;
  onSaveAsTemplate?: () => void;
  /** Staff: download the design as a `framers-template` 1.0 JSON file. */
  onExportTemplate?: () => void;
  /** Staff: open a `framers-template` 1.0 JSON file. */
  onImportTemplate?: (file: File) => void;
}) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const { doc, apply, undo, redo, canUndo, canRedo, saveStatus } = useStudio();
  const [title, setTitle] = useState(doc.title);
  const editingRef = useRef(false);

  // Follow the document unless the user is mid-edit, so undo/redo and a
  // remote load both show up in the field without stealing the caret.
  useEffect(() => {
    if (!editingRef.current) setTitle(doc.title);
  }, [doc.title]);

  const save = SAVE_COPY[saveStatus];

  return (
    <header
      className="studio-topbar flex h-12 shrink-0 items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-chrome)] px-3"
      style={{ zIndex: 30 }}
    >
      <Link
        href="/"
        className="studio-wordmark mr-1 inline-flex min-h-10 shrink-0 items-center px-1"
        aria-label="Framers home"
      >
        <BrandLogo preload className="w-[104px] sm:w-[124px]" />
      </Link>

      {onImportTemplate && (
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onImportTemplate(file);
          }}
        />
      )}

      <Menu label="File">
        {(close) => (
          <>
            {/* Downloads are staff-only: a customer's artwork leaves the studio
                as a print order (Done → checkout), never as a file. */}
            {onDownload && (
              <>
                <MenuItem
                  icon="picture_as_pdf"
                  onSelect={() => {
                    onDownload("application/pdf");
                    close();
                  }}
                >
                  Download PDF — print-ready
                </MenuItem>
                <MenuItem
                  icon="download"
                  onSelect={() => {
                    onDownload("image/png");
                    close();
                  }}
                >
                  Download PNG
                </MenuItem>
                <MenuItem
                  icon="image"
                  onSelect={() => {
                    onDownload("image/jpeg");
                    close();
                  }}
                >
                  Download JPG
                </MenuItem>
                <MenuSeparator />
              </>
            )}
            <MenuItem
              icon="keyboard"
              shortcut="?"
              onSelect={() => {
                onShowShortcuts();
                close();
              }}
            >
              Keyboard shortcuts
            </MenuItem>
            {isAdmin && onSaveAsTemplate && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon="dashboard"
                  onSelect={() => {
                    onSaveAsTemplate();
                    close();
                  }}
                >
                  Save as template…
                </MenuItem>
                {onExportTemplate && (
                  <MenuItem
                    icon="data_object"
                    onSelect={() => {
                      onExportTemplate();
                      close();
                    }}
                  >
                    Export template file (.json)
                  </MenuItem>
                )}
                {onImportTemplate && (
                  <MenuItem
                    icon="upload_file"
                    onSelect={() => {
                      importRef.current?.click();
                      close();
                    }}
                  >
                    Open template file…
                  </MenuItem>
                )}
              </>
            )}
            <MenuSeparator />
            <MenuItem icon="arrow_back" onSelect={close}>
              <Link href="/" className="block w-full">
                Exit to Framers
              </Link>
            </MenuItem>
          </>
        )}
      </Menu>

      <Menu label="Resize">
        {(close) => (
          <>
            {/* Frame sizes first: they are the ones you can actually buy, and
                picking one changes the session, not just the page. */}
            {sizes.length === 0 && (
              <p className="px-2.5 py-3 text-[12.5px] text-[var(--studio-ink-muted)]">
                No frame sizes available.
              </p>
            )}
            {sizes.map((size) => (
              <MenuItem
                key={size.id}
                icon={size.id === currentSizeId ? "check" : undefined}
                onSelect={() => {
                  onResize(size);
                  close();
                }}
              >
                {size.label}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem
              icon="straighten"
              onSelect={() => {
                onCustomSize();
                close();
              }}
            >
              Custom size…
            </MenuItem>
          </>
        )}
      </Menu>

      <Menu label="Editing" icon="edit">
        {(close) => (
          <>
            <MenuItem
              icon="undo"
              shortcut="Ctrl+Z"
              disabled={!canUndo}
              onSelect={() => {
                undo();
                close();
              }}
            >
              Undo
            </MenuItem>
            <MenuItem
              icon="redo"
              shortcut="Ctrl+Y"
              disabled={!canRedo}
              onSelect={() => {
                redo();
                close();
              }}
            >
              Redo
            </MenuItem>
          </>
        )}
      </Menu>

      <span className="mx-1 h-6 w-px bg-[var(--studio-border)]" aria-hidden="true" />

      <IconButton
        icon="undo"
        label="Undo"
        disabled={!canUndo}
        onClick={undo}
      />
      <IconButton
        icon="redo"
        label="Redo"
        disabled={!canRedo}
        onClick={redo}
      />

      <span className="mx-1 h-6 w-px bg-[var(--studio-border)]" aria-hidden="true" />

      {/* Icon-only, as in the mockup — except when saving failed, which has
          to be read, not hovered for. */}
      {save.text && (
        <span className="studio-save flex items-center" role="status">
          <Tooltip label={save.text}>
            <span
              className={cx(
                "flex h-8 items-center gap-1.5 px-1.5 text-[12px]",
                saveStatus === "error" ? "text-[#ff8a80]" : "text-[var(--studio-ink-muted)]"
              )}
            >
              <Icon name={save.icon} className="text-[20px]" />
              {saveStatus === "error" ? save.text : <span className="sr-only">{save.text}</span>}
            </span>
          </Tooltip>
        </span>
      )}

      <div className="studio-topbar-right ml-auto flex min-w-0 items-center gap-1.5">
        {/* Title. A real input, not a label — click to rename. */}
        <div className="studio-title min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => {
              editingRef.current = true;
            }}
            onBlur={() => {
              editingRef.current = false;
              const next = title.trim();
              if (next && next !== doc.title) {
                apply({ type: "setTitle", title: next });
              } else {
                setTitle(doc.title);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitle(doc.title);
                e.currentTarget.blur();
              }
            }}
            aria-label="Design title"
            data-r="sm"
            size={Math.min(40, Math.max(12, title.length + 1))}
            className="block max-w-[320px] truncate bg-transparent px-3 py-1 text-right text-[13px] text-[var(--studio-ink-muted)] hover:bg-white/[0.04] hover:text-[var(--studio-ink)] focus:bg-white/[0.04] focus:text-left focus:text-[var(--studio-ink)] focus:outline-none"
          />
        </div>

        <span
          data-r="full"
          className="hidden h-8 w-8 shrink-0 select-none items-center justify-center border border-[#353534] bg-[#2a2a2a] text-[12px] font-semibold text-[#e5e2e1] sm:inline-flex"
          title="Your account"
        >
          {userInitial}
        </span>

        {onDownload && (
        <Menu label="Export" variant="outline" trailingIcon="expand_more" align="end" className="h-8">
          {(close) => (
            <>
              <MenuItem
                icon="picture_as_pdf"
                onSelect={() => {
                  onDownload("application/pdf");
                  close();
                }}
              >
                PDF — print-ready
              </MenuItem>
              <MenuItem
                icon="download"
                onSelect={() => {
                  onDownload("image/png");
                  close();
                }}
              >
                PNG image
              </MenuItem>
              <MenuItem
                icon="image"
                onSelect={() => {
                  onDownload("image/jpeg");
                  close();
                }}
              >
                JPG image
              </MenuItem>
            </>
          )}
        </Menu>
        )}

        <StudioButton
          variant="solid"
          onClick={onDone}
          disabled={busy}
          className="h-8 shrink-0 px-4"
        >
          {busy ? "Working…" : doneLabel}
        </StudioButton>
      </div>
    </header>
  );
}
