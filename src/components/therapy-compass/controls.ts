import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";

/**
 * Therapy control recipes — token-backed Tailwind only (Clinical White / Sky Graphite).
 * Selected / pressed states use aria-pressed / aria-current so call sites do not need a
 * parallel `tc-is-*` class.
 *
 * Hover states use `hover:not-aria-disabled:enabled:` so unavailable controls stay quiet
 * under BOTH disabled encodings. `:enabled` alone was enough while every unavailable
 * control carried the native attribute; a control that is unavailable for a stated reason
 * now carries `aria-disabled="true"` instead (it must keep its tab stop, or the reason in
 * its `title` is unreachable — see `ignoreUnavailableActivation` in ui-primitives), and
 * such a button *is* `:enabled`, so it would otherwise light up on hover.
 *
 * Focus affordance comes from the shared `focusRing` in `card-recipes.ts`. It used to be
 * redeclared here, justified by the shared export having been "renamed away from `focusRing`
 * on main" — that was already untrue: `card-recipes.ts` exports it, and the local copy meant a
 * change to the focus contract had to find this file too.
 */
export const therapyBtn = cn(
  "cursor-pointer font-[inherit] transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-quick)]",
  "hover:not-aria-disabled:enabled:-translate-y-px active:not-aria-disabled:enabled:translate-y-px",
  "disabled:cursor-not-allowed disabled:opacity-55",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
  focusRing,
);

const controlBase = cn(
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-md text-sm-minus font-semibold",
  therapyBtn,
);

export const commandControl = cn(
  controlBase,
  "gap-[9px] border-0 bg-[color:var(--command)] px-5 text-sm text-[color:var(--command-contrast)] shadow-[var(--e1)]",
  "hover:not-aria-disabled:enabled:bg-[color:var(--command-hover)] hover:not-aria-disabled:enabled:shadow-[var(--shadow-hover)]",
);

export const outlineControl = cn(
  controlBase,
  "border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-[color:var(--text)]",
  "hover:not-aria-disabled:enabled:border-[color:var(--border-strong)] hover:not-aria-disabled:enabled:bg-[color:var(--surface-subtle)] hover:not-aria-disabled:enabled:shadow-[var(--shadow-hover)]",
  "aria-pressed:border-[color:var(--clinical-accent)] aria-pressed:text-[color:var(--clinical-accent-hover)]",
);

export const iconControl = cn(
  therapyBtn,
  "inline-flex h-tap w-tap items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--decoration-soft)]",
  "hover:not-aria-disabled:enabled:border-[color:var(--border-strong)] hover:not-aria-disabled:enabled:bg-[color:var(--surface-subtle)] hover:not-aria-disabled:enabled:text-[color:var(--text)]",
);

export const card =
  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]";

export const heroCard = cn(card, "border-l-[3px] border-l-[color:var(--clinical-accent)]");
