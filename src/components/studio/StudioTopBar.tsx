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
import { useStudio, type SaveStatus } from "@/lib/studio/StudioContext";
import type { DownloadFormat } from "@/lib/studio/export";

import {
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  StudioButton,
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
  error: { icon: "cloud_off", text: "Not saved — download to keep your work" },
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
}: {
  userInitial: string;
  sizes: FrameSizeOption[];
  currentSizeId: string | null;
  onResize: (size: FrameSizeOption) => void;
  /** Open the custom-size dialog. Owned by the shell, which can `apply`. */
  onCustomSize: () => void;
  onDownload: (format: DownloadFormat) => void;
  onDone: () => void;
  onShowShortcuts: () => void;
  doneLabel?: string;
  busy?: boolean;
}) {
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
      className="studio-topbar flex h-14 shrink-0 items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-chrome)] px-3"
      style={{ zIndex: 30 }}
    >
      <Link
        href="/"
        className="studio-wordmark mr-1 shrink-0 px-1 text-[15px] font-extrabold tracking-tight text-[var(--studio-ink)]"
        aria-label="Framers home"
      >
        FRAMERS
        <span className="ml-1 align-super text-[10px] font-semibold text-[var(--studio-ink-muted)]">
          v1
        </span>
      </Link>

      <Menu label="File">
        {(close) => (
          <>
            {/* First, and worded as the print option: a PDF is the only one of
                the three that carries the paper size, so it is the file a print
                shop should be sent. */}
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

      <Menu label="Editing">
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

      {save.text && (
        <span
          className="ml-1 hidden items-center gap-1.5 text-[12px] text-[var(--studio-ink-muted)] lg:flex"
          role="status"
        >
          <Icon
            name={save.icon}
            className={cx(
              "text-[18px]",
              saveStatus === "error" && "text-[#c8322b]"
            )}
          />
          {save.text}
        </span>
      )}

      {/* Title. Centred on wide screens, but it's a real input, not a label. */}
      <div className="studio-title mx-auto min-w-0 flex-1 px-2">
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
          data-r="md"
          className="mx-auto block w-full max-w-[420px] truncate bg-transparent px-2 py-1 text-center text-[13.5px] font-semibold text-[var(--studio-ink)] hover:bg-black/[0.04] focus:bg-black/[0.04] focus:outline-none"
        />
      </div>

      <span
        data-r="full"
        className="hidden h-8 w-8 shrink-0 select-none items-center justify-center bg-[var(--studio-accent)] text-[13px] font-semibold text-white sm:inline-flex"
        title="Your account"
      >
        {userInitial}
      </span>

      <StudioButton
        variant="solid"
        onClick={onDone}
        disabled={busy}
        className="ml-1 shrink-0 px-4"
      >
        {busy ? "Working…" : doneLabel}
      </StudioButton>
    </header>
  );
}
