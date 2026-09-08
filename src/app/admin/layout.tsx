import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminChrome } from "@/components/admin/AdminChrome";
import { isCurrentUserAdmin } from "@/lib/auth-server";

/**
 * The admin shell.
 *
 * The `isCurrentUserAdmin()` call here is a convenience, not the security
 * boundary — in the App Router a layout does not necessarily re-run for every
 * request that reaches a nested page, and route handlers under `/api/admin/**`
 * never see it at all. So every page and every handler under this tree checks
 * for itself; `src/proxy.ts` gates the `/admin` prefix on top of that.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isCurrentUserAdmin())) redirect("/");

  return (
    <>
      <AdminChrome />
      <main className="mx-auto w-full max-w-6xl flex-1 px-margin-mobile pb-24 pt-24">
        {children}
      </main>
      <footer className="border-t-2 border-border-high-contrast px-margin-mobile py-6">
        <p className="label-caps text-[10px] text-on-surface-variant">
          Operator view ·{" "}
          <Link href="/" className="underline hover:text-black">
            back to the storefront
          </Link>
        </p>
      </footer>
    </>
  );
}
