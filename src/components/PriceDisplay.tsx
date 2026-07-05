import { formatPaise } from "@/lib/format";

/** Renders a paise amount as ₹ with the technical label font. */
export function PriceDisplay({
  amountPaise,
  className = "",
}: {
  amountPaise: number;
  className?: string;
}) {
  return (
    <span className={`label-caps text-base tracking-normal ${className}`}>
      {formatPaise(amountPaise)}
    </span>
  );
}
