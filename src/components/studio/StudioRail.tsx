"use client";

/**
 * The left icon rail. Eight entries, as in the mockup; clicking one opens its
 * flyout, clicking the open one closes it.
 *
 * A `tablist` rather than a set of buttons: the flyout is a panel whose content
 * is selected by the rail, which is exactly what tabs describe. Screen-reader
 * users get "tab 6 of 8, selected" instead of eight unrelated buttons.
 */

import { Icon } from "@/components/Icon";
import { useStudio, type RailId } from "@/lib/studio/StudioContext";

import { cx } from "./ui";
import { useCompactStudio } from "./useCompactStudio";

interface RailEntry {
  id: RailId;
  icon: string;
  label: string;
  /** Shows the lightning-bolt badge — a paid/unavailable marker. */
  pro?: boolean;
}

export const RAIL_ENTRIES: RailEntry[] = [
  { id: "templates", icon: "space_dashboard", label: "Templates" },
  { id: "elements", icon: "category", label: "Elements" },
  { id: "text", icon: "title", label: "Text" },
  { id: "brand", icon: "verified", label: "Brand", pro: true },
  { id: "uploads", icon: "cloud_upload", label: "Uploads" },
  { id: "tools", icon: "draw", label: "Tools" },
  { id: "projects", icon: "folder", label: "Projects" },
  { id: "apps", icon: "apps", label: "Apps" },
];

export function StudioRail({ panelId }: { panelId: string }) {
  const { rail, setRail, tool, setTool, setEditingId } = useStudio();
  const compact = useCompactStudio();
  const entries = compact
    ? ["uploads", "text", "tools", "templates", "elements", "brand", "projects", "apps"].map(
        (id) => RAIL_ENTRIES.find((entry) => entry.id === id)!
      )
    : RAIL_ENTRIES;

  return (
    <nav
      role="tablist"
      aria-label="Studio panels"
      aria-orientation={compact ? "horizontal" : "vertical"}
      className="studio-rail flex w-[72px] shrink-0 flex-col items-center gap-0.5 border-r border-[var(--studio-border)] bg-[var(--studio-chrome)] py-2"
    >
      {entries.map((entry) => {
        const active = rail === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`studio-rail-${entry.id}`}
            aria-selected={active}
            aria-controls={active ? panelId : undefined}
            onClick={() => {
              setTool("select");
              setEditingId(null);
              setRail(active && tool === "select" ? null : entry.id);
            }}
            data-r="sm"
            className="group relative flex w-16 flex-col items-center gap-1 pb-1.5 pt-2 transition-colors hover:bg-[#1c1c1c]"
          >
            <span
              data-r="sm"
              className={cx(
                "flex h-7 w-9 items-center justify-center transition-colors",
                active
                  ? "bg-[#242424] text-[var(--studio-accent)]"
                  : "text-[var(--studio-ink-muted)] group-hover:text-[var(--studio-ink)]"
              )}
            >
              <Icon name={entry.icon} className="text-[20px]" fill={active} />
            </span>
            <span
              className={cx(
                "text-[11px] font-medium leading-none tracking-[0.02em]",
                active ? "text-white" : "text-[var(--studio-ink-muted)]"
              )}
            >
              {entry.label}
            </span>
            {entry.pro && (
              <Icon
                name="bolt"
                className="absolute right-2.5 top-1 text-[12px] text-[var(--studio-accent)]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
