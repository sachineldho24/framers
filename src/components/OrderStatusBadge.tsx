import type { OrderStatus } from "@/lib/supabase/types";

const STATUS_STYLES: Record<OrderStatus, { label: string; className: string }> =
  {
    pending: { label: "Pending", className: "bg-primary text-on-primary" },
    processing: {
      label: "Processing",
      className: "bg-surface-container text-on-primary",
    },
    shipped: {
      label: "Shipped",
      className: "bg-action-red text-on-primary",
    },
    delivered: {
      label: "Delivered",
      className: "bg-neon-accent text-primary",
    },
    cancelled: {
      label: "Cancelled",
      className: "border-2 border-border-high-contrast text-on-background",
    },
  };

/** Brutalist status pill. Sharp corners, solid fills, label-caps type. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span className={`label-caps inline-block px-2 py-1 ${className}`}>
      {label}
    </span>
  );
}
