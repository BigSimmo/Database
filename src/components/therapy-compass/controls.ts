import { cn } from "@/components/ui-primitives";

/**
 * Therapy control recipes — token-backed Tailwind only (Clinical White / Sky Graphite).
 * Selected / pressed states use aria-pressed / aria-current so call sites do not need a
 * parallel `tc-is-*` class. Hover states use `hover:enabled:` so disabled controls stay quiet.
 *
 * Focus ring is local (same token string as ui-primitives `searchFocusRing`) because the
 * shared export was renamed away from `focusRing` on main; therapy buttons are not search chrome.
 */
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export const therapyBtn = cn(
  "cursor-pointer font-[inherit] transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-quick)]",
  "hover:enabled:-translate-y-px active:enabled:translate-y-px",
  "disabled:cursor-not-allowed disabled:opacity-55",
  focusRing,
);

const controlBase = cn(
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-md text-sm-minus font-semibold",
  therapyBtn,
);

export const accentControl = cn(
  controlBase,
  "border-0 bg-[color:var(--clinical-accent)] px-[18px] text-[color:var(--clinical-accent-contrast)]",
  "hover:enabled:bg-[color:var(--clinical-accent-hover)] hover:enabled:shadow-[var(--shadow-hover)]",
);

export const commandControl = cn(
  controlBase,
  "gap-[9px] border-0 bg-[color:var(--command)] px-5 text-sm text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)]",
  "hover:enabled:bg-[color:var(--command-hover)] hover:enabled:shadow-[var(--shadow-hover)]",
);

export const outlineControl = cn(
  controlBase,
  "border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-[color:var(--text)]",
  "hover:enabled:border-[color:var(--border-strong)] hover:enabled:bg-[color:var(--surface-subtle)] hover:enabled:shadow-[var(--shadow-hover)]",
  "aria-pressed:border-[color:var(--clinical-accent)] aria-pressed:text-[color:var(--clinical-accent-hover)]",
);

export const softControl = cn(
  controlBase,
  "border border-[color:var(--border)] bg-[color:var(--surface)] px-4 font-medium text-[color:var(--text-muted)]",
  "hover:enabled:border-[color:var(--border-strong)] hover:enabled:bg-[color:var(--surface-subtle)] hover:enabled:text-[color:var(--text)] hover:enabled:shadow-[var(--shadow-hover)]",
  "aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:bg-[color:var(--clinical-accent-soft)] aria-pressed:font-semibold aria-pressed:text-[color:var(--clinical-accent-hover)]",
  "data-[tone=success]:border-[color:var(--success-border)] data-[tone=success]:bg-[color:var(--success-bg)] data-[tone=success]:font-semibold data-[tone=success]:text-[color:var(--success-text)]",
);

export const iconControl = cn(
  therapyBtn,
  "inline-flex h-tap w-tap items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-soft)]",
  "hover:enabled:border-[color:var(--border-strong)] hover:enabled:bg-[color:var(--surface-subtle)] hover:enabled:text-[color:var(--text)]",
);

export const linkButton = cn(
  therapyBtn,
  "border-0 bg-transparent p-0 text-sm-minus font-semibold text-[color:var(--clinical-accent)]",
  "hover:enabled:text-[color:var(--clinical-accent-hover)] hover:enabled:underline hover:enabled:underline-offset-[3px]",
);

export const card =
  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]";

export const heroCard = cn(card, "border-l-[3px] border-l-[color:var(--clinical-accent)]");

export const flexControl = "min-w-[150px] flex-1";

export const compactControl = "px-[13px] text-xs";

/** Shared hover wash for list rows. */
export const therapyRow = "transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)]";
