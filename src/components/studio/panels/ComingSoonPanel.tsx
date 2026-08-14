"use client";

/**
 * Honest empty state for rail entries with no model behind them yet.
 *
 * The rail matches the mockup, but rendering dead controls would be worse than
 * saying plainly what isn't built — and each one points at the tool that does
 * the nearest useful thing today.
 */

import { useStudio } from "@/lib/studio/StudioContext";

import { EmptyState, StudioButton } from "../ui";

export function ComingSoonPanel({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  const { setRail } = useStudio();

  return (
    <EmptyState
      icon={icon}
      title={title}
      body={body}
      action={
        <StudioButton
          variant="outline"
          icon="cloud_upload"
          onClick={() => setRail("uploads")}
        >
          Go to Uploads
        </StudioButton>
      }
    />
  );
}
