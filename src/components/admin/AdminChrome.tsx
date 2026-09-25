"use client";

import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Admin chrome. Same fixed 64px bar as `DetailTopBar`. The wordmark links
 * home like it does everywhere else in the app — `Orders` covers getting
 * back into the operator view, so the logo doesn't have to.
 */
export function AdminChrome() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between gap-4 border-b-2 border-border-high-contrast bg-surface px-margin-mobile">
      <Link
        href="/"
        aria-label="Framers home"
        className="flex min-h-11 items-center gap-2 text-on-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent"
      >
        <BrandLogo preload className="w-[124px] sm:w-[180px]" />
      </Link>

      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="label-caps hidden items-center gap-1 text-[11px] text-on-surface-variant transition-colors hover:text-on-background sm:inline-flex"
        >
          Orders
        </Link>
        <SignOutButton className="px-4 py-2 text-[11px]" />
      </div>
    </header>
  );
}
