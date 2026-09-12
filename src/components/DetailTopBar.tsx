"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";

/**
 * Detail-page top bar: back button (left), wordmark (centre), cart (right).
 * Uses the same high-contrast chrome as the product-options mockup.
 */
export function DetailTopBar() {
  const router = useRouter();
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b-2 border-border-high-contrast bg-surface px-margin-mobile">
      <button
        onClick={() => router.back()}
        aria-label="Go back"
        className="transition-opacity hover:opacity-80 active:translate-y-0.5"
      >
        <Icon name="arrow_back" className="text-on-background" />
      </button>
      <Link
        href="/"
        aria-label="Framers Lab home"
        className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent"
      >
        <BrandLogo preload className="w-[176px] sm:w-[216px]" />
      </Link>
      <Link
        href="/orders"
        aria-label="Your orders"
        className="transition-opacity hover:opacity-80 active:translate-y-0.5"
      >
        <Icon name="shopping_cart" className="text-on-background" />
      </Link>
    </header>
  );
}
