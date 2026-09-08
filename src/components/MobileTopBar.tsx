"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Icon } from "./Icon";
import { isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import {
  DRAWER_ACCOUNT_LINKS,
  DRAWER_DISCOVER_LINKS,
  PROFILE_MENU_LINKS,
  drawerFocusWrapTarget,
} from "./mobile-navigation";

const DRAWER_FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** First letter of the email, for the signed-in avatar tile. */
function initialOf(user: User): string {
  return (user.email ?? "?").trim().charAt(0).toUpperCase() || "?";
}

/**
 * Fixed storefront header with a responsive, truly centred wordmark, an
 * accessible left navigation drawer, and an auth-aware profile menu on the
 * right.
 *
 * The profile menu is why this component talks to Supabase at all: the
 * storefront — not `/account` — is where a signed-in customer lands, so the
 * header has to be able to say who they are. It reflects session state, so it
 * cannot be a server component; `onAuthStateChange` keeps it honest after a
 * sign-out in another tab.
 *
 * The drawer owns focus and page scroll while open, then restores both when it
 * closes.
 */
export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // The menu closes on Escape or on a pointer down anywhere outside it. The ref
  // wraps the trigger as well as the panel, so clicking the trigger to close is
  // the button's own toggle rather than an outside click racing it.
  useEffect(() => {
    if (!profileOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (profileRef.current?.contains(event.target as Node)) return;
      setProfileOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setProfileOpen(false);
      profileTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      // Hard navigation, same reason as `SignOutButton`: the server has to
      // re-render against the cleared cookie, not the cached session.
      window.location.assign("/");
    }
  }

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      drawerRef.current
        ?.querySelector<HTMLElement>(DRAWER_FOCUSABLE)
        ?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE)
      );
      if (focusable.length === 0) return;

      const activeIndex = focusable.indexOf(
        document.activeElement as HTMLElement
      );
      const target = drawerFocusWrapTarget(
        event.shiftKey,
        activeIndex,
        focusable.length - 1
      );
      if (target === null) return;

      event.preventDefault();
      focusable[target]?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  function closeDrawer() {
    setOpen(false);
  }

  return (
    <>
      <header className="fixed top-0 z-50 flex h-16 w-full items-center bg-surface px-3 sm:px-margin-mobile">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-controls="site-navigation-drawer"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center text-on-background transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
        >
          <Icon name="menu" className="text-[26px]" />
        </button>

        <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-[clamp(0.875rem,4vw,1.5rem)] font-black uppercase leading-none tracking-[0.06em] text-on-background sm:tracking-[0.12em] lg:tracking-[0.18em]">
          <Link
            href="/"
            aria-label="Framers Lab home"
            className="pointer-events-auto inline-flex items-baseline"
          >
            <span>Framers</span>
            <span className="ml-[0.3em] text-action-red">Lab</span>
          </Link>
        </h1>

        <div className="ml-auto flex items-center">
          <Link
            href="/orders"
            aria-label="Your orders"
            className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
          >
            <Icon name="shopping_cart" className="text-[24px]" />
          </Link>

          {/* Until `getUser()` answers, neither state is true yet — render the
              slot at its final size so the wordmark and cart do not shift. */}
          {!authReady ? (
            <span className="h-11 w-11" aria-hidden="true" />
          ) : user ? (
            <div ref={profileRef} className="relative">
              <button
                ref={profileTriggerRef}
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label={`Your profile (${user.email ?? "signed in"})`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-controls="storefront-profile-menu"
                className={`flex h-11 min-w-11 items-center gap-1.5 border-2 border-border-high-contrast px-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red ${
                  profileOpen
                    ? "bg-primary text-on-primary"
                    : "bg-surface-lowest hover:bg-primary hover:text-on-primary"
                }`}
              >
                <span className="font-display text-[15px] font-black leading-none">
                  {initialOf(user)}
                </span>
                <Icon name="expand_more" className="text-[18px]" />
              </button>

              <div
                id="storefront-profile-menu"
                role="menu"
                aria-label="Profile"
                hidden={!profileOpen}
                className="absolute right-0 top-[calc(100%+8px)] w-[min(84vw,264px)] border-2 border-border-high-contrast bg-surface-lowest"
              >
                <div className="border-b-2 border-border-high-contrast px-4 py-3">
                  <p className="label-caps text-[10px] text-on-surface-variant">
                    Signed in
                  </p>
                  <p className="mt-1 truncate text-[14px] font-bold">
                    {user.email ?? "Your account"}
                  </p>
                </div>

                {PROFILE_MENU_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="group flex min-h-12 items-center gap-3 border-b border-outline-variant px-4 py-3 text-[15px] font-medium transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
                  >
                    <Icon
                      name={item.icon}
                      className="text-[20px] text-on-surface-variant group-hover:text-action-red"
                    />
                    <span>{item.label}</span>
                  </Link>
                ))}

                {isAdmin(user) && (
                  <Link
                    href="/admin"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="group flex min-h-12 items-center gap-3 border-b border-outline-variant px-4 py-3 text-[15px] font-medium transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
                  >
                    <Icon
                      name="dashboard"
                      className="text-[20px] text-on-surface-variant group-hover:text-action-red"
                    />
                    <span>Operator view</span>
                  </Link>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  disabled={signingOut}
                  className="label-caps flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-[11px] transition-colors hover:bg-action-red hover:text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
                >
                  <Icon name="logout" className="text-[20px]" />
                  <span>{signingOut ? "Signing out…" : "Sign out"}</span>
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              aria-label="Sign in to your account"
              className="label-caps flex h-11 items-center gap-1.5 border-2 border-border-high-contrast bg-surface-lowest px-3 text-[11px] transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
            >
              <Icon name="person" className="text-[20px]" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </header>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-[60] transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={closeDrawer}
          aria-label="Close navigation menu"
          className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        />

        <aside
          ref={drawerRef}
          id="site-navigation-drawer"
          role="dialog"
          aria-modal={open ? true : undefined}
          aria-label="Site navigation"
          inert={!open}
          className={`absolute inset-y-0 left-0 flex h-dvh w-[min(92vw,360px)] flex-col border-r border-outline-variant bg-white transition-transform duration-[250ms] ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex min-h-16 items-center justify-between border-b border-outline-variant px-5">
            <span className="font-display text-[17px] font-extrabold uppercase tracking-[0.06em] text-black">
              Framers <span className="text-action-red">Lab</span>
            </span>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation menu"
              className="flex h-11 w-11 items-center justify-center bg-surface-container-low text-black transition-colors hover:bg-black hover:text-white active:bg-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
            >
              <Icon name="close" className="text-[26px]" />
            </button>
          </div>

          <nav
            aria-label="Primary navigation"
            className="flex-1 overflow-y-auto px-4 py-5"
          >
            <p className="px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
              Explore
            </p>
            <div className="mt-2 space-y-1">
              {DRAWER_DISCOVER_LINKS.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.href === "/gallery" ? false : undefined}
                  onClick={closeDrawer}
                  className={`group flex min-h-14 touch-manipulation items-center gap-3 px-3 py-3 text-[16px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red ${
                    index === 0
                      ? "bg-action-red font-semibold text-white hover:bg-black active:bg-on-surface-variant"
                      : "font-medium text-black hover:bg-surface-container-low active:bg-surface-muted"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className={`text-[21px] ${
                      index === 0
                        ? "text-white"
                        : "text-on-surface-variant group-hover:text-action-red"
                    }`}
                  />
                  <span>{item.label}</span>
                  <Icon
                    name="arrow_forward"
                    className={`ml-auto text-[18px] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none ${
                      index === 0 ? "text-white" : "text-outline"
                    }`}
                  />
                </Link>
              ))}
            </div>

            <div className="mt-6 border-t border-outline-variant pt-5">
              <p className="px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
                Your space
              </p>
              <div className="mt-2 space-y-1">
                {DRAWER_ACCOUNT_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className="group flex min-h-13 touch-manipulation items-center gap-3 px-3 py-3 text-[15px] font-medium text-black transition-colors hover:bg-surface-container-low active:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
                  >
                    <Icon
                      name={item.icon}
                      className="text-[20px] text-on-surface-variant group-hover:text-action-red"
                    />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div className="border-t border-outline-variant bg-surface-container-low px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[12px] font-medium text-on-surface-variant">
            <Link
              href="/"
              onClick={closeDrawer}
              className="mr-5 inline-block min-h-11 py-3 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
            >
              Home
            </Link>
            <Link
              href="/privacy"
              onClick={closeDrawer}
              className="mr-5 inline-block min-h-11 py-3 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              onClick={closeDrawer}
              className="inline-block min-h-11 py-3 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-red"
            >
              Terms
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
