"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Admin chrome. Same fixed 64px bar as `DetailTopBar`, but the wordmark carries
 * an OPS tag so nobody mistakes an operator view for the storefront, and the
 * right-hand side leaves rather than shops.
 */
export function AdminChrome() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between gap-4 border-b-2 border-border-high-contrast bg-surface px-margin-mobile">
      <Link
        href="/admin"
        className="flex items-baseline gap-2 text-on-background"
      >
        <span className="font-display text-[24px] uppercase tracking-tighter">
          FRAMERS
        </span>
        <span className="label-caps bg-primary px-1.5 py-0.5 text-[10px] text-on-primary">
          OPS
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="label-caps hidden items-center gap-1 text-[11px] text-on-surface-variant transition-colors hover:text-black sm:inline-flex"
        >
          <Icon name="storefront" className="text-[16px]" />
          Storefront
        </Link>
        <SignOutButton className="px-4 py-2 text-[11px]" />
      </div>
    </header>
  );
}
