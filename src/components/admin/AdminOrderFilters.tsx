"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Icon } from "@/components/Icon";
import { ADMIN_ORDER_TABS, type AdminOrderTab } from "@/lib/orders/tabs";

/**
 * Tabs + search. Both live in the URL rather than in component state, so a
 * filtered queue is a link an operator can bookmark or send to someone else, and
 * the server component below re-renders with real data instead of the page
 * filtering a list it already fetched.
 *
 * The box is deliberately **uncontrolled**, keyed on `q`: the committed query
 * already lives in the URL, so mirroring it into state buys nothing and costs a
 * `setState`-in-an-effect to resync after a back/forward navigation — which
 * React 19 rejects outright. `key={q}` remounts the input with the new value for
 * free, and Clear works the same way rather than reaching for the DOM node.
 */
export function AdminOrderFilters({
  tab,
  q,
  total,
}: {
  tab: AdminOrderTab;
  q: string;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(next: { tab?: AdminOrderTab; q?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.tab !== undefined) sp.set("tab", next.tab);
    if (next.q !== undefined) {
      if (next.q) sp.set("q", next.q);
      else sp.delete("q");
    }
    // Any filter change invalidates the page number.
    sp.delete("page");
    router.push(`/admin?${sp.toString()}`);
  }

  return (
    <div className="mt-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          go({ q: typeof value === "string" ? value.trim() : "" });
        }}
        className="flex items-stretch gap-0 border-2 border-border-high-contrast bg-surface-lowest"
      >
        <span className="grid w-12 shrink-0 place-items-center border-r-2 border-border-high-contrast">
          <Icon name="search" className="text-[18px]" />
        </span>
        <input
          key={q}
          name="q"
          defaultValue={q}
          placeholder="Reference, name, phone, pincode"
          aria-label="Search orders"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[15px] outline-none placeholder:text-outline"
        />
        {q ? (
          <button
            type="button"
            onClick={() => go({ q: "" })}
            className="label-caps border-l-2 border-border-high-contrast px-4 text-[11px] transition-colors hover:bg-surface-muted"
          >
            Clear
          </button>
        ) : null}
        <button
          type="submit"
          className="label-caps brutalist-press border-l-2 border-border-high-contrast bg-primary px-5 text-[11px] text-on-primary transition-colors hover:bg-action-red"
        >
          Find
        </button>
      </form>

      {q ? (
        <p className="label-caps mt-3 text-[11px] text-on-surface-variant">
          {total} {total === 1 ? "match" : "matches"} for “{q}” · searching every
          status
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {ADMIN_ORDER_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go({ tab: t.id })}
                aria-current={active ? "page" : undefined}
                className={`label-caps border-2 border-border-high-contrast px-4 py-2 text-[11px] transition-colors ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-surface-lowest hover:bg-surface-muted"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
