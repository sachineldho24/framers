/** Formatting helpers for INR currency and order display. */

/** Convert paise (integer) to a display string like "₹1,499". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

/** Short, human order reference from a UUID (first 8 chars, upper). */
export function shortOrderId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Format an ISO timestamp as e.g. "14 Jun 2026". */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
