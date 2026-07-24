import Link from "next/link";
import { Icon } from "./Icon";

/**
 * Fixed top app bar for the Framers Lab storefront.
 * White surface, 2px black bottom border, centred wordmark.
 * The left button is a placeholder menu; the right holds orders (cart) and
 * account links. /account redirects to /login when signed out.
 */
export function MobileTopBar() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b-2 border-border-high-contrast bg-surface px-margin-mobile">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center justify-center transition-opacity hover:opacity-80"
        >
          <Icon name="menu" className="text-on-background" />
        </Link>
      </div>

      <Link
        href="/"
        className="font-display text-[24px] uppercase tracking-[0.15em] text-on-background"
      >
        FRAMERS LAB
      </Link>

      <div className="flex items-center gap-4">
        <Link
          href="/orders"
          aria-label="Your orders"
          className="relative flex items-center justify-center transition-opacity hover:opacity-80"
        >
          <Icon name="shopping_cart" className="text-on-background" />
        </Link>
        <Link
          href="/account"
          aria-label="Your account"
          className="relative flex items-center justify-center transition-opacity hover:opacity-80"
        >
          <Icon name="person" className="text-on-background" />
        </Link>
      </div>
    </header>
  );
}
