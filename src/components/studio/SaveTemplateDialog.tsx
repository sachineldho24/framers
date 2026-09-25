"use client";

/**
 * Admin-only: save the current document as a template customers can pick
 * from the studio's Templates tab. Just a name — the document itself is
 * already the template, layer for layer, so there's nothing else to ask.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";

import { StudioButton } from "./ui";

export function SaveTemplateDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  /** Throws with a message worth showing on failure. */
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => fieldRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="studio-root fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save as template"
        data-r="lg"
        className="studio-shadow w-full max-w-[380px] border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-4 text-[var(--studio-ink)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Save as template</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            data-r="full"
            className="grid h-7 w-7 place-items-center hover:bg-white/[0.055] disabled:opacity-50"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--studio-ink-muted)]">
          Customers will see this design, with every layer exactly as it is here, as a starting point in Templates.
        </p>

        <label className="mt-3 block text-[11px] font-medium text-[var(--studio-ink-muted)]">
          Name
          <input
            ref={fieldRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            maxLength={120}
            placeholder="A4 Birthday Poster"
            disabled={busy}
            data-r="md"
            className="mt-1 block w-full border border-[var(--studio-border)] bg-[var(--studio-chrome)] px-2 py-1.5 text-[13px] font-semibold text-[var(--studio-ink)] focus:border-[var(--studio-accent)] focus:outline-none disabled:opacity-60"
          />
        </label>

        {error && (
          <p role="alert" className="mt-2 text-[12px] text-[#ff8a80]">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <StudioButton variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </StudioButton>
          <StudioButton variant="solid" onClick={submit} disabled={!name.trim() || busy} className="px-4">
            {busy ? "Saving…" : "Save"}
          </StudioButton>
        </div>
      </div>
    </div>
  );
}
