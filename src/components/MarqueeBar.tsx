import { Icon } from "./Icon";

const ITEMS = [
  { text: "FREE SHIPPING", icon: "local_shipping", accent: false },
  { text: "20% OFF ALL ITEMS", accent: true },
  { text: "NEW RELEASES WEEKLY", icon: "fiber_new", accent: false },
  { text: "COLLECTORS EDITION", accent: true },
] as const;

/** Scrolling promotion bar. Duplicated content for a seamless loop. */
export function MarqueeBar() {
  const track = [...ITEMS, ...ITEMS];
  return (
    <div className="flex items-center overflow-hidden border-y-2 border-border-high-contrast bg-on-background py-4">
      <div className="marquee gap-12">
        {track.map((item, i) => (
          <span
            key={i}
            className={`label-caps flex items-center gap-2 tracking-[0.3em] ${
              item.accent ? "text-neon-accent" : "text-surface"
            }`}
          >
            {item.text}
            {"icon" in item && item.icon && (
              <Icon name={item.icon} className="text-[14px]" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
