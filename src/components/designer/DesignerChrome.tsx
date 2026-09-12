"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";

export type DesignerStep = "upload" | "size" | "frame" | "edit" | "review";

// `edit` is the studio. It renders full-screen without this chrome (it owns its
// own top bar), but it still belongs in the breadcrumb so the other steps show
// the right position and can link back to it.
const STEPS: { key: DesignerStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "size", label: "Size" },
  { key: "frame", label: "Frame" },
  { key: "edit", label: "Edit" },
  { key: "review", label: "Review" },
];

/**
 * Fixed top bar for the designer flow: black background, contrasting bottom border
 * (DESIGN.md Nav rule), position + always-visible EXIT.
 *
 * Three things are load-bearing here:
 *
 * - The whole header is exactly 56px, because every step pads its own `<main>`
 *   with `pt-14` to clear it. The progress rail is therefore absolutely
 *   positioned *on* the bottom border rather than laid out below it.
 * - Five crumbs and four separators do not fit at 375px, so below `sm` the
 *   trail collapses to "Step 5 of 5 · Review" and the rail carries the
 *   progress. A trail that wraps or scrolls sideways is worse than a readout.
 * - A readout is not navigation, though, and the crumbs were the flow's *only*
 *   way back — so below `sm` there is also a back arrow to the previous step.
 *   Without it a phone could reach Review and then only Exit: the studio was
 *   unreachable from the last screen before payment, which is exactly where
 *   someone wants one more look at their artwork.
 * - The current step is marked three ways — weight, colour and a red underline
 *   — because on a screen this dense a single 12px colour shift is invisible.
 */
export function DesignerChrome({
  current,
  sessionId,
}: {
  current: DesignerStep;
  sessionId?: string;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  const pct = ((currentIdx + 1) / STEPS.length) * 100;
  // Only ever one step back: the crumb trail is the way to jump, and it is on
  // screen wherever there is room for it.
  const prev = currentIdx > 0 ? STEPS[currentIdx - 1] : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border-high-contrast bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-margin-mobile">
        {/* Compact position readout + the only way back — mobile only. */}
        <div className="flex items-center gap-1 sm:hidden">
          {prev && sessionId && (
            <Link
              href={`/design/${sessionId}/${prev.key}`}
              aria-label={`Back to ${prev.label}`}
              title={`Back to ${prev.label}`}
              className="-ml-2 grid h-11 w-11 shrink-0 place-items-center text-on-background transition-colors hover:bg-surface-container hover:text-white"
            >
              <Icon name="arrow_back" className="text-[22px]" />
            </Link>
          )}
          <p className="flex items-baseline gap-2">
            <span className="label-caps text-[11px] text-on-surface-variant">
              Step {currentIdx + 1} of {STEPS.length}
            </span>
            <span className="label-caps text-[14px] text-on-background">
              {STEPS[currentIdx]?.label}
            </span>
          </p>
        </div>

        <nav
          aria-label="Progress"
          className="hidden items-center gap-2 sm:flex md:gap-3"
        >
          {STEPS.map((s, i) => {
            const done = i < currentIdx;
            const isCurrent = i === currentIdx;
            const stepHref =
              sessionId && i <= currentIdx
                ? `/design/${sessionId}/${s.key}`
                : undefined;
            const content = (
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`label-caps text-[13px] ${
                  isCurrent
                    ? "border-b-2 border-action-red pb-1 text-on-background"
                    : done
                      ? "text-on-surface-variant transition-colors hover:text-on-background"
                      : "text-outline"
                }`}
              >
                {s.label}
              </span>
            );
            return (
              <span key={s.key} className="flex items-center gap-2 md:gap-3">
                {stepHref ? <Link href={stepHref}>{content}</Link> : content}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="label-caps text-[11px] text-outline-variant"
                  >
                    /
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        <Link
          href="/"
          className="label-caps border-b-2 border-transparent text-on-background transition-colors hover:border-border-high-contrast"
        >
          Exit
        </Link>
      </div>

      {/* Progress rail, sitting on the header's own bottom border so the bar
          stays 56px tall and every step's `pt-14` still clears it. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px]">
        <div className="h-full bg-action-red" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}
