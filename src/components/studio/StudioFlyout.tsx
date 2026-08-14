"use client";

/**
 * The panel that slides in beside the rail. One instance, whose content is
 * chosen by the active rail entry — so panel state (scroll position, an open
 * sub-section) resets on switch, which is what users expect from this pattern.
 */

import { RAIL_ENTRIES } from "./StudioRail";
import { AdjustPanel } from "./panels/AdjustPanel";
import { BorderPanel } from "./panels/BorderPanel";
import { ComingSoonPanel } from "./panels/ComingSoonPanel";
import { ErasePanel } from "./panels/ErasePanel";
import { FramesPanel } from "./panels/FramesPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { TextPanel } from "./panels/TextPanel";
import { ToolsPanel } from "./panels/ToolsPanel";
import { UploadsPanel } from "./panels/UploadsPanel";
import { IconButton } from "./ui";
import { useStudio, type RailId } from "@/lib/studio/StudioContext";

const COMING_SOON: Partial<
  Record<RailId, { icon: string; title: string; body: string }>
> = {
  templates: {
    icon: "dashboard",
    title: "Templates are coming",
    body: "Ready-made layouts for common frame sizes. For now, start from your own image in Uploads.",
  },
  elements: {
    icon: "category",
    title: "Elements are coming",
    body: "Shapes, lines and graphics you can drop onto the page. Your uploaded images work today.",
  },
  brand: {
    icon: "palette",
    title: "Brand kits are coming",
    body: "Save colours, fonts and logos to reuse across designs.",
  },
  projects: {
    icon: "folder",
    title: "Projects are coming",
    body: "Every design you save will be listed here. This design autosaves as you work.",
  },
  apps: {
    icon: "apps",
    title: "Apps are coming",
    body: "Integrations with other tools. Nothing to connect yet.",
  },
};

export function StudioFlyout({
  panelId,
  onAddImage,
  uploads,
}: {
  panelId: string;
  onAddImage: () => void;
  uploads: { src: string; name: string; url: string }[];
}) {
  const { rail, setRail } = useStudio();
  if (!rail) return null;

  const entry = RAIL_ENTRIES.find((e) => e.id === rail);
  const empty = COMING_SOON[rail];

  return (
    <aside
      id={panelId}
      role="tabpanel"
      aria-labelledby={`studio-rail-${rail}`}
      className="flex w-[300px] shrink-0 flex-col border-r border-[var(--studio-border)] bg-[var(--studio-chrome)]"
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <h2 className="px-1 text-[15px] font-semibold text-[var(--studio-ink)]">
          {entry?.label}
        </h2>
        <IconButton
          icon="close"
          label="Close panel"
          size="sm"
          onClick={() => setRail(null)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {rail === "tools" && <ToolsPanel />}
        {rail === "text" && <TextPanel />}
        {rail === "uploads" && (
          <UploadsPanel uploads={uploads} onAddImage={onAddImage} />
        )}
        {empty && (
          <ComingSoonPanel
            icon={empty.icon}
            title={empty.title}
            body={empty.body}
          />
        )}
      </div>
    </aside>
  );
}

/**
 * Tool-specific panels open in the same slot as the rail flyout but are driven
 * by the active tool, not the rail — picking "Adjust" in Tools should show the
 * sliders without the rail selection changing under the user.
 */
export function StudioToolPanel() {
  const { tool, setTool } = useStudio();
  if (tool === "select" || tool === "crop" || tool === "draw") return null;

  const titles: Record<string, string> = {
    adjust: "Adjust",
    frames: "Frames",
    layers: "Layers",
    eraser: "Eraser",
    border: "Border",
  };

  return (
    <aside
      aria-label={titles[tool]}
      className="flex w-[300px] shrink-0 flex-col border-r border-[var(--studio-border)] bg-[var(--studio-chrome)]"
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <h2 className="px-1 text-[15px] font-semibold text-[var(--studio-ink)]">
          {titles[tool]}
        </h2>
        <IconButton
          icon="close"
          label={`Close ${titles[tool]}`}
          size="sm"
          onClick={() => setTool("select")}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {tool === "adjust" && <AdjustPanel />}
        {tool === "frames" && <FramesPanel />}
        {tool === "layers" && <LayersPanel />}
        {tool === "eraser" && <ErasePanel />}
        {tool === "border" && <BorderPanel />}
      </div>
    </aside>
  );
}
