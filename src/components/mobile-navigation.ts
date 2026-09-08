export type DrawerLink = {
  href: string;
  label: string;
  icon: string;
};

export const DRAWER_DISCOVER_LINKS: readonly DrawerLink[] = [
  { href: "/design/start", label: "Start framing", icon: "add_photo_alternate" },
  { href: "/#shop", label: "Shop frames", icon: "grid_view" },
  { href: "/gallery", label: "Explore the gallery", icon: "view_in_ar" },
  {
    href: "/#latest-creations-title",
    label: "Latest creations",
    icon: "collections",
  },
];

export const DRAWER_ACCOUNT_LINKS: readonly DrawerLink[] = [
  { href: "/orders", label: "Your orders", icon: "receipt_long" },
  { href: "/account", label: "Account", icon: "person" },
];

/**
 * The signed-in profile menu in the storefront header. Separate from
 * `DRAWER_ACCOUNT_LINKS` because this list only ever renders behind a session:
 * the drawer's copy has to make sense to a visitor who has not signed in yet.
 */
export const PROFILE_MENU_LINKS: readonly DrawerLink[] = [
  { href: "/orders", label: "Your orders", icon: "receipt_long" },
  { href: "/account", label: "Account settings", icon: "manage_accounts" },
];

export function drawerFocusWrapTarget(
  shiftKey: boolean,
  activeIndex: number,
  lastIndex: number
): number | null {
  if (shiftKey && activeIndex === 0) return lastIndex;
  if (!shiftKey && activeIndex === lastIndex) return 0;
  return null;
}
