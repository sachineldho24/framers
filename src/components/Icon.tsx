/** Material Symbols icon. `fill` toggles the filled variant. */
export function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? "fill" : ""} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
