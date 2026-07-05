"use client";

import Link from "next/link";

export type DesignerStep = "upload" | "size" | "frame" | "review";

const STEPS: { key: DesignerStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "size", label: "Size" },
  { key: "frame", label: "Frame" },
  { key: "review", label: "Review" },
];

/**
 * Fixed top bar for the designer flow: white bg, 1px black bottom border
 * (DESIGN.md Nav rule), breadcrumb + always-visible EXIT.
 */
export function DesignerChrome({
  current,
  sessionId,
}: {
  current: DesignerStep;
  sessionId?: string;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-margin-mobile">
        <nav aria-label="Progress" className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < currentIdx;
            const isCurrent = i === currentIdx;
            const stepHref =
              sessionId && i <= currentIdx
                ? `/design/${sessionId}/${s.key}`
                : undefined;
            const content = (
              <span
                className={`label-caps ${
                  isCurrent
                    ? "text-black"
                    : done
                      ? "text-on-surface-variant"
                      : "text-outline"
                }`}
              >
                {s.label}
              </span>
            );
            return (
              <span key={s.key} className="flex items-center gap-2">
                {stepHref ? (
                  <Link href={stepHref}>{content}</Link>
                ) : (
                  content
                )}
                {i < STEPS.length - 1 && (
                  <span className="label-caps text-outline">›</span>
                )}
              </span>
            );
          })}
        </nav>

        <Link
          href="/"
          className="label-caps border-b-2 border-transparent text-black hover:border-black"
        >
          Exit
        </Link>
      </div>
    </header>
  );
}
