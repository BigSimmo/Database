import { ChevronDown, type LucideIcon } from "lucide-react";

import { cn } from "@/components/ui-primitives";

/** 48px hit area — matches `--spacing-tap`, clear of the touch-target rounding flake. */
export const modeNavSlotBase =
  "mode-nav__slot relative flex min-h-12 min-w-0 items-center justify-center px-3 no-underline transition-colors";

/**
 * The shared visual grammar for Therapy-style priority navigation.
 *
 * The owner supplies the interaction semantics: ModeNav wraps it in route
 * links, while medication in-page navigation uses panel-switching buttons.
 */
export function ModeNavSlotInk({
  icon: Icon,
  label,
  count,
  state,
  trailing,
}: {
  icon?: LucideIcon;
  label: string;
  count?: string;
  state: "on" | "trail" | "off";
  trailing?: boolean;
}) {
  return (
    <span
      className={cn(
        // One weight in every state. Bolding the active label changes its width,
        // which shifts the rule and every neighbour on each navigation.
        "mode-nav__ink relative flex h-5 min-w-0 items-center gap-2 text-sm-minus font-semibold tracking-display",
        // The 2px rule takes space at the bottom of the bar, so a centred label
        // sits optically high without this compensating offset.
        "mt-0.5",
        state === "on" ? "text-[color:var(--text-heading)]" : "text-[color:var(--text-muted)]",
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn(
            "size-icon-md shrink-0",
            state === "on"
              ? "text-[color:var(--clinical-accent)]"
              : state === "trail"
                ? "text-[color:var(--clinical-accent)]/55"
                : "opacity-70",
          )}
        />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      {count ? (
        <span
          className={cn(
            "nums grid h-[1.125rem] min-w-[1.125rem] shrink-0 place-items-center rounded-full border px-1.5 text-3xs font-bold leading-none",
            state === "on"
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
              : "border-[color:var(--border-strong)] text-[color:var(--text-muted)]",
          )}
        >
          {count}
        </span>
      ) : null}
      {trailing ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-55" /> : null}
      {/* The rule hangs off the ink, so it is exactly as wide as icon plus word.
          The 2px cap stays literal: it is a hairline on a 2px-tall bar. */}
      <span
        aria-hidden="true"
        className={cn(
          "mode-nav__rule absolute inset-x-0 -bottom-[0.8125rem] rounded-t-sm",
          state === "on"
            ? "h-0.5 bg-[color:var(--clinical-accent)]"
            : state === "trail"
              ? "h-px bg-[color:var(--clinical-accent)]/35"
              : "h-0.5 bg-transparent",
        )}
      />
    </span>
  );
}
