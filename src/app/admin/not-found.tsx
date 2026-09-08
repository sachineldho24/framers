import Link from "next/link";

import { Icon } from "@/components/Icon";

/**
 * `notFound()` from the order detail page lands here — a mistyped or deleted
 * order id, which for an operator is a normal typo rather than an error.
 */
export default function AdminNotFound() {
  return (
    <div className="border-2 border-border-high-contrast bg-surface-lowest p-8">
      <div className="grid h-14 w-14 place-items-center border-2 border-border-high-contrast">
        <Icon name="search_off" className="text-[24px]" />
      </div>
      <h1 className="mt-5 text-[24px] uppercase leading-tight">No such order</h1>
      <p className="mt-3 text-[15px] text-on-surface-variant">
        Nothing in the database has that id. If you pasted a reference, search
        for it on the queue instead — the queue matches the{" "}
        <span className="font-label uppercase tracking-wider">#A1B2C3D4</span>{" "}
        form customers quote.
      </p>
      <Link
        href="/admin"
        className="label-caps brutalist-press mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-[11px] text-on-primary"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Back to queue
      </Link>
    </div>
  );
}
