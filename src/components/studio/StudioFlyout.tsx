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
import { EffectsPanel } from "./panels/EffectsPanel";
import { ElementsPanel } from "./panels/ElementsPanel";
import { ErasePanel } from "./panels/ErasePanel";
import { FramesPanel } from "./panels/FramesPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { TextPanel } from "./panels/TextPanel";
import { ToolsPalette } from "./ToolsPalette";
import { UploadsPanel } from "./panels/UploadsPanel";
import { Icon } from "@/components/Icon";
import { IconButton } from "./ui";
import { CropControls } from "./CropOverlay";
import { useCompactStudio } from "./useCompactStudio";
import { useStudio, type RailId } from "@/lib/studio/StudioContext";

/**
 * The mockup's collapse tab: a slim handle hanging off the panel's right edge.
 * The compact layout has no edge to hang it on, so it keeps the close button.
 */
function CollapseTab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="studio-panel-tab absolute -right-[13px] top-1/2 z-30 flex h-14 w-[13px] -translate-y-1/2 items-center justify-center border border-l-0 border-[var(--studio-border)] bg-[var(--studio-chrome)] text-[var(--studio-ink-muted)] transition-colors hover:text-[var(--studio-accent)]"
    >
      <Icon name="chevron_left" className="text-[14px]" />
    </button>
  );
}

const COMING_SOON: Partial<
  Record<RailId, { icon: string; title: string; body: string }>
> = {
  brand: {
    icon: "verified",
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
  uploading,
  uploadError,
  onRemoveUpload,
  isAdmin = false,
}: {
  panelId: string;
  onAddImage: () => void;
  uploads: import("./panels/UploadsPanel").UploadEntry[];
  uploading?: boolean;
  uploadError?: string | null;
  onRemoveUpload?: (src: string) => void;
  /** Shows a delete control on each template — admins can clean up their own catalogue. */
  isAdmin?: boolean;
}) {
  const { rail, setRail, tool } = useStudio();
  const compact = useCompactStudio();
  // Tools is Canva's slim palette, not a panel; it stays up while drawing.
  if (rail === "tools" && (tool === "select" || tool === "pen" || tool === "pen-eraser" || tool === "path")) {
    return <ToolsPalette />;
  }
  // A subtool replaces the tool list instead of opening a second 300px panel.
  if (!rail || (compact && tool === "crop") || (tool !== "select" && tool !== "crop" && tool !== "draw")) return null;

  const entry = RAIL_ENTRIES.find((e) => e.id === rail);
  const empty = COMING_SOON[rail];

  return (
    <aside
      id={panelId}
      role="tabpanel"
      aria-labelledby={`studio-rail-${rail}`}
      className="studio-panel relative flex min-h-0 w-[340px] shrink-0 flex-col border-r border-[var(--studio-border)] bg-[var(--studio-chrome)]"
    >
      <CollapseTab label="Hide panel" onClick={() => setRail(null)} />
      <div className="flex shrink-0 items-center justify-between px-4 pt-4">
        <h2 className="text-[15px] font-semibold text-[var(--studio-ink)]">
          {entry?.label}
        </h2>
        <IconButton
          icon="close"
          label="Close panel"
          size="sm"
          className="lg:hidden"
          onClick={() => setRail(null)}
        />
      </div>

      <div className="studio-panel-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 pt-3">
        {rail === "elements" && <ElementsPanel />}
        {rail === "text" && <TextPanel />}
        {rail === "templates" && <TemplatesPanel isAdmin={isAdmin} />}
        {rail === "uploads" && (
          <UploadsPanel uploads={uploads} onAddImage={onAddImage} onRemove={onRemoveUpload} uploading={uploading} error={uploadError} />
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
export function StudioToolPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const { tool, setTool, selectedLayer } = useStudio();
  const compact = useCompactStudio();
  if (
    tool === "select" ||
    (tool === "crop" && !compact) ||
    tool === "draw" ||
    tool === "pen" ||
    tool === "pen-eraser" ||
    tool === "path"
  )
    return null;

  const titles: Record<string, string> = {
    adjust: "Adjust",
    frames: "Frames",
    layers: "Position",
    effects: "Effects",
    eraser: "Eraser",
    border: "Border",
    crop: "Crop",
  };

  return (
    <aside
      id="studio-flyout"
      aria-label={titles[tool]}
      className="studio-panel relative flex min-h-0 w-[340px] shrink-0 flex-col border-r border-[var(--studio-border)] bg-[var(--studio-chrome)]"
    >
      <CollapseTab label={`Close ${titles[tool]}`} onClick={() => setTool("select")} />
      <div className="flex shrink-0 items-center justify-between px-4 pt-4">
        <h2 className="text-[15px] font-semibold text-[var(--studio-ink)]">
          {titles[tool]}
        </h2>
        <IconButton
          icon="close"
          label={`Close ${titles[tool]}`}
          size="sm"
          className="lg:hidden"
          onClick={() => setTool("select")}
        />
      </div>
      <div className="studio-panel-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 pt-3">
        {tool === "crop" && selectedLayer?.kind === "image" && <CropControls layer={selectedLayer} />}
        {tool === "adjust" && <AdjustPanel />}
        {tool === "frames" && <FramesPanel isAdmin={isAdmin} />}
        {tool === "layers" && <LayersPanel />}
        {tool === "effects" && <EffectsPanel />}
        {tool === "eraser" && <ErasePanel />}
        {tool === "border" && <BorderPanel />}
      </div>
    </aside>
  );
}
