import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/format";
import type { OrderStatus } from "@/lib/supabase/types";

/**
 * Fulfilment timeline for one order.
 *
 * Vertical rather than horizontal on purpose: this is a phone-first screen, four
 * horizontal labels at 375px either wrap or shrink to unreadable, and each stage
 * carries a line of copy explaining what is actually happening to the print.
 *
 * `cancelled` is not a stage in this flow — it leaves the sequence rather than
 * advancing through it — so the caller renders its own notice and doesn't mount
 * this at all.
 */
const FLOW: { key: Exclude<OrderStatus, "cancelled">; label: string; blurb: string }[] = [
  {
    key: "pending",
    label: "Placed",
    blurb: "Payment received. Your order is queued for print.",
  },
  {
    key: "processing",
    label: "Printing",
    blurb: "Printed on 300 GSM archival paper, then framed by hand.",
  },
  {
    key: "shipped",
    label: "Shipped",
    blurb: "On its way in protective packaging.",
  },
  {
    key: "delivered",
    label: "Delivered",
    blurb: "Arrived. Anything wrong with it, tell us within 48 hours.",
  },
];

export type StepperTimestamps = Partial<
  Record<Exclude<OrderStatus, "cancelled">, string>
>;

/**
 * `timestamps` is optional: it comes from `order_events` (migration 0009), so an
 * order with no history — or a database where 0009 hasn't been run — renders
 * exactly as before rather than showing blanks.
 */
export function OrderStatusStepper({
  status,
  timestamps,
}: {
  status: OrderStatus;
  timestamps?: StepperTimestamps;
}) {
  // A status outside the flow (only `cancelled` today) would give -1; treat it
  // as the first stage rather than rendering an empty rail.
  const currentIdx = Math.max(
    0,
    FLOW.findIndex((s) => s.key === status)
  );

  return (
    <ol className="flex flex-col">
      {FLOW.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        const last = i === FLOW.length - 1;
        // Only date a stage the order has actually reached: a timestamp under a
        // future stage would read as a promise, and we don't make one.
        const reachedAt =
          done || current ? timestamps?.[step.key] : undefined;

        return (
          <li key={step.key} className="flex gap-4">
            {/* Rail: marker + the connector down to the next stage. The
                connector is a child of this stage so it stretches to whatever
                height the copy beside it needs. */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`grid h-7 w-7 shrink-0 place-items-center border-2 border-border-high-contrast ${
                  current
                    ? "bg-action-red text-on-primary"
                    : done
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-outline"
                }`}
              >
                {done ? (
                  <Icon name="check" className="text-[16px]" />
                ) : (
                  <span className="label-caps text-[11px] leading-none">
                    {i + 1}
                  </span>
                )}
              </span>
              {!last && (
                <span
                  aria-hidden="true"
                  className={`w-0.5 flex-1 ${
                    done ? "bg-neon-accent" : "bg-outline-variant"
                  }`}
                />
              )}
            </div>

            <div className={last ? "pb-0 pt-0.5" : "pb-6 pt-0.5"}>
              <p
                className={`label-caps text-[13px] ${
                  current || done ? "text-on-background" : "text-outline"
                }`}
              >
                {step.label}
                {current && (
                  <span className="ml-2 text-[11px] text-action-red">
                    — now
                  </span>
                )}
              </p>
              <p
                className={`mt-1 text-[13px] leading-[1.5] ${
                  current || done ? "text-on-surface-variant" : "text-outline"
                }`}
              >
                {step.blurb}
              </p>
              {reachedAt && (
                <p className="label-caps mt-1 text-[10px] text-on-surface-variant">
                  {formatDate(reachedAt)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
