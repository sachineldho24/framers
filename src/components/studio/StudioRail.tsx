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
  /** Shows the mockup's crown — a paid/unavailable marker. */
  crown?: boolean;
}

export const RAIL_ENTRIES: RailEntry[] = [
  { id: "templates", icon: "dashboard", label: "Templates" },
  { id: "elements", icon: "category", label: "Elements" },
  { id: "text", icon: "title", label: "Text" },
  { id: "brand", icon: "palette", label: "Brand", crown: true },
  { id: "uploads", icon: "cloud_upload", label: "Uploads" },
  { id: "tools", icon: "build", label: "Tools" },
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
      className="studio-rail flex w-[85px] shrink-0 flex-col items-center gap-1 bg-[var(--studio-chrome)] py-3"
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
            data-r="md"
            className={cx(
              "relative flex w-[68px] flex-col items-center gap-1 py-2 transition-colors",
              active
                ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                : "text-[var(--studio-ink-muted)] hover:bg-white/[0.045] hover:text-[var(--studio-ink)]"
            )}
          >
            <Icon name={entry.icon} className="text-[22px]" fill={active} />
            <span className="text-[10.5px] font-medium leading-none">
              {entry.label}
            </span>
            {entry.crown && (
              <Icon
                name="workspace_premium"
                className="absolute right-1.5 top-1 text-[13px] text-[#c9a227]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
