"use client";

/**
 * Templates: starting points an admin saved from the studio itself (see
 * `SaveTemplateDialog`), picked from `GET /api/templates`. The document is
 * the same one the admin edited — no conversion, no flattening — so it opens
 * with every layer still independently draggable.
 *
 * Mirrors `UploadsPanel`'s thumbnail-grid shape, but picking one *replaces*
 * the whole document (`replaceDocument`, which also resets undo) rather than
 * adding a layer — so an in-progress design gets a confirmation first.
 */

import Image from "next/image";
import { useEffect, useState } from "react";

import { migrateDocument } from "@/lib/studio/document";
import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, IconButton } from "../ui";

interface TemplateEntry {
  id: string;
  name: string;
  thumbnailUrl: string;
}

export function TemplatesPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const { doc, replaceDocument } = useStudio();
  const [templates, setTemplates] = useState<TemplateEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/templates", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ templates: TemplateEntry[] }>) : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) setTemplates(data.templates);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load templates.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pick(entry: TemplateEntry) {
    if (doc.layers.length > 0 && !window.confirm(`Replace your current design with "${entry.name}"? Unsaved changes will be lost.`)) {
      return;
    }
    setLoadingId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${entry.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { document: unknown };
      // Never trust a document straight off the network, even one the server
      // already validated at write time — same boundary every other document
      // source in the studio goes through (see `persistence.ts`).
      const migrated = migrateDocument(data.document);
      if (!migrated) throw new Error("invalid");
      replaceDocument(migrated);
    } catch {
      setError("Could not load this template. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  if (templates === null) {
    return error ? (
      <EmptyState icon="error" title="Couldn't load templates" body={error} />
    ) : (
      <p className="px-1 text-[13px] text-[var(--studio-ink-muted)]">Loading templates…</p>
    );
  }

  if (templates.length === 0) {
    return <EmptyState icon="dashboard" title="No templates yet" body="Check back soon, or start from your own image in Uploads." />;
  }

  async function remove(entry: TemplateEntry) {
    setDeletingId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/templates/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setTemplates((list) => list?.filter((t) => t.id !== entry.id) ?? list);
      setConfirmingId(null);
    } catch {
      setError("Could not delete this template. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {error && <p role="alert" className="mb-3 text-sm text-[#ffb4ab]">{error}</p>}
      <ul className="grid grid-cols-2 gap-2">
        {templates.map((entry) => (
          <li key={entry.id} className="group/tpl relative">
            <button
              type="button"
              onClick={() => pick(entry)}
              disabled={loadingId !== null}
              aria-busy={loadingId === entry.id}
              data-r="md"
              className="group relative block w-full overflow-hidden border border-[var(--studio-border)] bg-[var(--studio-canvas-bg)] transition-shadow hover:shadow-md disabled:opacity-60"
              title={`Start from ${entry.name}`}
            >
              <span className="relative block aspect-square">
                <Image src={entry.thumbnailUrl} alt={entry.name} fill unoptimized sizes="140px" className="object-cover" />
              </span>
              <span className="sr-only">Start from {entry.name}</span>
            </button>

            {isAdmin && confirmingId !== entry.id && (
              // Positioned by this wrapper, not the button: IconButton sits
              // inside its Tooltip's element, so an `absolute` on the button
              // anchors to that (an empty box under the grid), not to the card.
              // Shown on hover/focus like Canva's card actions; always on touch.
              <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover/tpl:opacity-100 group-focus-within/tpl:opacity-100 [@media(hover:none)]:opacity-100">
                <IconButton
                  icon="delete"
                  label={`Delete ${entry.name}`}
                  size="sm"
                  tooltipSide="top"
                  onClick={() => setConfirmingId(entry.id)}
                  className="bg-black/65 text-white shadow-sm backdrop-blur-sm hover:bg-black/80"
                />
              </div>
            )}

            {isAdmin && confirmingId === entry.id && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/70 p-2 text-center">
                <p className="text-[11px] font-medium text-white">Delete this template?</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={deletingId === entry.id}
                    data-r="sm"
                    className="bg-white/15 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/25 disabled:opacity-60"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(entry)}
                    disabled={deletingId === entry.id}
                    data-r="sm"
                    className="bg-[#ff8a80] px-2 py-1 text-[11px] font-medium text-black hover:bg-[#ffb4ab] disabled:opacity-60"
                  >
                    {deletingId === entry.id ? "Deleting…" : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
