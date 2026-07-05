"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/#frames", label: "Shop", icon: "grid_view", match: "/shop" },
  { href: "/orders", label: "Orders", icon: "receipt_long" },
  { href: "/login", label: "Profile", icon: "person" },
] as const;

/**
 * Fixed mobile bottom navigation from the mockup. Inverted (black) bar,
 * neon-accent active item. Hidden on large screens.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pb-safe fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t-2 border-border-high-contrast bg-on-background px-4 md:hidden">
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center pt-1 transition-colors ${
              active
                ? "text-neon-accent"
                : "text-surface hover:text-neon-accent"
            }`}
          >
            <Icon name={item.icon} fill={active} />
            <span className="label-caps mt-1 text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
