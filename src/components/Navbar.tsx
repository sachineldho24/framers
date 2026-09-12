"use client";

import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/auth";

/**
 * Fixed top bar. Black surface, 1px contrasting bottom border (DESIGN.md: Navigation).
 * Shows auth-aware links. Client component because it reflects session state.
 */
export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border-high-contrast bg-surface-lowest">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Framers Lab home" className="inline-flex min-h-11 shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent">
          <BrandLogo preload className="w-[116px] sm:w-[176px]" />
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/works" className="label-caps hidden hover:text-neon-accent md:inline-flex">
            Our Works
          </Link>
          {!loading && user && isAdmin(user) && (
            <Link href="/admin" className="label-caps hover:text-action-red">
              Admin
            </Link>
          )}
          {!loading && user && (
            <Link href="/orders" className="label-caps hover:text-action-red">
              My Orders
            </Link>
          )}
          {!loading && user && (
            <Link href="/account" className="label-caps hover:text-action-red">
              Account
            </Link>
          )}
          {!loading && user ? (
            <button
              onClick={handleSignOut}
              className="label-caps cursor-pointer hover:text-action-red"
            >
              Sign Out
            </button>
          ) : (
            !loading && (
              <Link href="/login" className="label-caps hover:text-action-red">
                Sign In
              </Link>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
