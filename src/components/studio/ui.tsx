"use client";

/**
 * Studio UI primitives.
 *
 * Every icon-only control here takes a required `label`, rendered as both
 * `aria-label` and the tooltip — so an accessible name can't be forgotten, and
 * the sighted hint and the screen-reader name never drift apart.
 */

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { Icon } from "@/components/Icon";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Hover/focus tooltip. CSS-only visibility via group-hover so there's no timer
 * state per control, and `pointer-events-none` keeps it from eating the click.
 */
export function Tooltip({
  label,
  side = "bottom",
  align = "center",
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "right";
  /** `end` pins the tip's right edge to the trigger's, for controls at the
   *  right edge of the screen — a centred tip there would overflow the page. */
  align?: "center" | "end";
  children: ReactNode;
}) {
  const across = align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  const pos =
    side === "top"
      ? `bottom-full mb-2 ${across}`
      : side === "right"
        ? "left-full top-1/2 -translate-y-1/2 ml-2"
        : `top-full mt-2 ${across}`;

  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        data-r="sm"
        className={cx(
          "pointer-events-none absolute z-50 whitespace-nowrap px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity duration-100",
          "bg-[#16161a] text-white group-hover:opacity-100 group-focus-within:opacity-100",
          pos
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonBase = ButtonHTMLAttributes<HTMLButtonElement>;

export interface IconButtonProps extends Omit<ButtonBase, "children"> {
  icon: string;
  /** Accessible name and tooltip text. Required by design. */
  label: string;
  active?: boolean;
  fill?: boolean;
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "right";
  tooltipAlign?: "center" | "end";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      active = false,
      fill = false,
      tooltip = true,
      tooltipSide = "bottom",
      tooltipAlign = "center",
      size = "md",
      className,
      ...rest
    },
    ref
  ) {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={rest["aria-pressed"] ?? (active || undefined)}
        data-r="md"
        className={cx(
          "inline-flex shrink-0 items-center justify-center transition-colors",
          size === "sm" ? "h-7 w-7" : "h-9 w-9",
          active
            ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
            : "text-[var(--studio-ink)] hover:bg-white/[0.055]",
          "disabled:pointer-events-none disabled:opacity-35",
          className
        )}
        {...rest}
      >
        <Icon
          name={icon}
          fill={fill}
          className={size === "sm" ? "text-[17px]" : "text-[20px]"}
        />
      </button>
    );

    if (!tooltip) return button;
    return (
      <Tooltip label={label} side={tooltipSide} align={tooltipAlign}>
        {button}
      </Tooltip>
    );
  }
);

export interface StudioButtonProps extends ButtonBase {
  variant?: "ghost" | "solid" | "outline";
  icon?: string;
  trailingIcon?: string;
  size?: "sm" | "md";
}

export const StudioButton = forwardRef<HTMLButtonElement, StudioButtonProps>(
  function StudioButton(
    {
      variant = "ghost",
      icon,
      trailingIcon,
      size = "md",
      className,
      children,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        data-r="sm"
        className={cx(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-colors",
          size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3 text-[13px]",
          variant === "solid" &&
            "bg-[var(--studio-accent)] font-semibold text-black hover:brightness-110 active:scale-[0.98]",
          variant === "outline" &&
            "border border-[#2e2e2e] bg-[var(--studio-elevated)] font-semibold text-[var(--studio-ink)] hover:bg-[#282828]",
          variant === "ghost" &&
            "text-[var(--studio-ink)] hover:bg-white/[0.055]",
          "disabled:pointer-events-none disabled:opacity-40",
          className
        )}
        {...rest}
      >
        {icon && <Icon name={icon} className="text-[18px]" />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} className="text-[18px]" />}
      </button>
    );
  }
);

/* -------------------------------------------------------------------------- */
/* Menu                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Dropdown menu. Closes on outside pointerdown and on Escape, and restores
 * focus to the trigger so keyboard users don't get dropped at the top of the
 * document.
 */
export function Menu({
  label,
  ariaLabel,
  icon,
  trailingIcon = "expand_more",
  children,
  align = "start",
  variant = "ghost",
  className,
  side = "bottom",
}: {
  label?: string;
  /** Required when there's no visible label, so the trigger still has a name. */
  ariaLabel?: string;
  icon?: string;
  trailingIcon?: string;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  variant?: StudioButtonProps["variant"];
  className?: string;
  /** Open upward for triggers that sit low on the screen. */
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <StudioButton
        ref={triggerRef}
        icon={icon}
        trailingIcon={label ? trailingIcon : undefined}
        aria-label={label ? undefined : (ariaLabel ?? "More options")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        variant={variant}
        className={cx(!label && "w-9 px-0", className)}
      >
        {label}
      </StudioButton>

      {open && (
        <div
          id={id}
          role="menu"
          data-r="md"
          className={cx(
            "studio-shadow absolute z-50 min-w-[212px] border border-[var(--studio-elevated-border)] bg-[var(--studio-elevated)] p-1",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  shortcut,
  disabled = false,
  danger = false,
  onSelect,
  submenu = false,
}: {
  icon?: string;
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
  submenu?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      data-r="sm"
      className={cx(
        "flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left text-[13px] transition-colors",
        danger ? "text-[#ff8a80]" : "text-[var(--studio-ink)]",
        "hover:bg-white/[0.055] disabled:pointer-events-none disabled:opacity-35"
      )}
    >
      {icon ? (
        <Icon name={icon} className="text-[18px] opacity-80" />
      ) : (
        <span className="w-[18px]" aria-hidden="true" />
      )}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <kbd
          data-r="sm"
          className="shrink-0 bg-[#2a2a2a] px-1.5 py-0.5 font-sans text-[11px] font-medium tracking-[0.02em] text-[var(--studio-ink-muted)]"
        >
          {shortcut}
        </kbd>
      )}
      {submenu && (
        <Icon name="chevron_right" className="text-[17px] opacity-60" />
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <hr className="my-1 border-t border-[var(--studio-border)]" />;
}

/* -------------------------------------------------------------------------- */
/* Slider                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Labelled range input. `onCommit` fires on release so the caller can close the
 * undo gesture — dragging emits `onChange` transiently, releasing makes it one
 * history entry.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  onCommit,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
  onReset?: () => void;
}) {
  const id = useId();
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[12px] font-medium text-[var(--studio-ink)]"
        >
          {label}
        </label>
        <div className="flex items-center gap-1">
          <span className="text-[12px] tabular-nums text-[var(--studio-ink-muted)]">
            {Math.round(value)}
            {suffix}
          </span>
          {onReset && (
            <IconButton
              icon="refresh"
              label={`Reset ${label.toLowerCase()}`}
              size="sm"
              onClick={onReset}
            />
          )}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="studio-range w-full"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel scaffolding                                                          */
/* -------------------------------------------------------------------------- */

export function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pb-2 text-[15px] font-semibold text-[var(--studio-ink)]">
      {children}
    </h2>
  );
}

export function PanelSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      {title && (
        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-ink-muted)]">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/** Neutral empty state. Used by panels with no model behind them yet. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span
        data-r="full"
        className="mb-3 inline-flex h-12 w-12 items-center justify-center bg-[var(--studio-accent-soft)]"
      >
        <Icon
          name={icon}
          className="text-[24px] text-[var(--studio-accent)]"
        />
      </span>
      <p className="text-[14px] font-semibold text-[var(--studio-ink)]">
        {title}
      </p>
      <p className="mt-1 max-w-[220px] text-[12.5px] leading-relaxed text-[var(--studio-ink-muted)]">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
