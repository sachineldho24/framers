import Link from "next/link";

import { Icon } from "@/components/Icon";
import { formatPaise } from "@/lib/format";
import type { AdminOrderCounts } from "@/lib/data/orders";

/**
 * The tile row above the queue. Numbers link to the tab that shows the rows
 * behind them — a count you cannot open is a count you cannot act on.
 */
export function AdminMetrics({ counts }: { counts: AdminOrderCounts }) {
  const tiles = [
    {
      label: "Needs action",
      value: String(counts.needsAction),
      tab: "needs_action",
      icon: "bolt",
      urgent: counts.needsAction > 0,
    },
    {
      label: "Printing",
      value: String(counts.printing),
      tab: "printing",
      icon: "print",
      urgent: false,
    },
    {
      label: "In transit",
      value: String(counts.shipped),
      tab: "shipped",
      icon: "local_shipping",
      urgent: false,
    },
    {
      label: "Delivered",
      value: String(counts.delivered),
      tab: "delivered",
      icon: "check_circle",
      urgent: false,
    },
    {
      label: "Unpaid",
      value: String(counts.unpaid),
      tab: "unpaid",
      icon: "schedule",
      urgent: false,
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <Link
          key={tile.tab}
          href={`/admin?tab=${tile.tab}`}
          className={`flex flex-col justify-between gap-4 border-2 border-border-high-contrast p-4 transition-colors hover:bg-surface-muted ${
            tile.urgent ? "bg-neon-accent" : "bg-surface-lowest"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="label-caps text-[10px] text-on-surface-variant">
              {tile.label}
            </span>
            <Icon name={tile.icon} className="text-[16px]" />
          </div>
          <span className="font-display text-[30px] font-black leading-none">
            {tile.value}
          </span>
        </Link>
      ))}

      {/* Not a filter — money has no tab, so this one does not pretend to. */}
      <div className="flex flex-col justify-between gap-4 border-2 border-border-high-contrast bg-primary p-4 text-on-primary">
        <div className="flex items-start justify-between gap-2">
          <span className="label-caps text-[10px] opacity-70">Paid · 7d</span>
          <Icon name="payments" className="text-[16px]" />
        </div>
        <span className="font-display text-[22px] font-black leading-none">
          {formatPaise(counts.revenue7dPaise)}
        </span>
      </div>
    </div>
  );
}
