import { Icon } from "@/components/Icon";
import { formatDateTime } from "@/lib/format";
import type { OrderEvent, OrderEventKind } from "@/lib/supabase/types";

const KIND_ICON: Record<OrderEventKind, string> = {
  status: "flag",
  payment: "payments",
  tracking: "local_shipping",
  note: "sticky_note_2",
};

function line(event: OrderEvent): string {
  if (event.kind === "status") {
    if (event.note) return event.note;
    return event.from_status
      ? `${event.from_status} → ${event.to_status}`
      : `Marked ${event.to_status}`;
  }
  return event.note ?? event.kind;
}

/**
 * The audit trail (migration 0009). Newest first, because the last thing that
 * happened is the thing an operator is checking.
 *
 * Rows are append-only, so a corrected mistake shows up as two entries rather
 * than as one rewritten one — that is the point of the table. `actor_id` being
 * null is not missing data: it means the system wrote the row (the Razorpay
 * webhook, or order creation), and the log says so in words.
 */
export function OrderEventLog({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="mt-6 border-2 border-border-high-contrast bg-surface-lowest p-5">
        <h2 className="label-caps text-[12px] text-on-surface-variant">
          History
        </h2>
        <p className="mt-3 text-[14px] text-on-surface-variant">
          Nothing logged yet. If this order predates migration 0009 and the
          backfill has not run, its history starts from the next change.
        </p>
      </section>
    );
  }

  const newestFirst = [...events].reverse();

  return (
    <section className="mt-6 border-2 border-border-high-contrast bg-surface-lowest p-5 md:p-6">
      <h2 className="label-caps text-[12px] text-on-surface-variant">History</h2>

      <ol className="mt-4 flex flex-col">
        {newestFirst.map((event, i) => (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-border-high-contrast bg-surface">
                <Icon name={KIND_ICON[event.kind]} className="text-[15px]" />
              </span>
              {i < newestFirst.length - 1 && (
                <span
                  aria-hidden
                  className="w-0.5 flex-1 bg-border-high-contrast"
                />
              )}
            </div>

            <div className={i < newestFirst.length - 1 ? "pb-5" : ""}>
              <p className="text-[15px] leading-snug">{line(event)}</p>
              <p className="label-caps mt-1 text-[10px] text-on-surface-variant">
                {formatDateTime(event.created_at)} ·{" "}
                {event.actor_id ? "operator" : "system"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
