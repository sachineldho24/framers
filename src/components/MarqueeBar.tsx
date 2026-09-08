import { Icon } from "./Icon";
import { MARQUEE_ITEMS } from "@/lib/storefront-messaging";

/** Scrolling service bar. Duplicated content for a seamless loop. */
export function MarqueeBar() {
  const track = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="flex items-center overflow-hidden bg-on-background py-4">
      <div className="marquee gap-12">
        {track.map((item, i) => (
          <span
            key={i}
            className={`label-caps flex items-center gap-2 tracking-[0.3em] ${
              item.accent ? "text-neon-accent" : "text-surface"
            }`}
          >
            {item.text}
            <Icon name={item.icon} className="text-[14px]" />
          </span>
        ))}
      </div>
    </div>
  );
}
