"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

export type CmeChoiceChipProps = {
  readonly children: ReactNode;
  readonly pressed: boolean;
  readonly onPress: () => void;
  readonly icon?: LucideIcon;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly testId?: string;
  readonly ariaDescribedBy?: string;
};

/**
 * CPD's selectable chip: a 36 px painted chip inside a 48 px tap area.
 *
 * Built the way the shared `ChoiceChip` (`@/components/ui/chip`) is — an
 * `aria-pressed` button at the 48 px tap floor with the painted surface on an
 * inset `aria-hidden` span, product blue (`--clinical-accent`) when pressed —
 * but drawn to the CPD spec: 36 px high (6 px inset top and bottom), 6 px
 * corners, 13 px text at weight 400 so a chip never shifts width when chosen.
 * The shared chip paints 40 px at weight 600/700, and changing it would
 * restyle every other mode's filters.
 */
export function CmeChoiceChip({
  children,
  pressed,
  onPress,
  icon: Icon,
  disabled = false,
  title,
  testId,
  ariaDescribedBy,
}: CmeChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-describedby={ariaDescribedBy}
      title={title}
      disabled={disabled}
      data-testid={testId}
      data-cme-chip="true"
      onClick={onPress}
      className={cn(
        "group relative isolate inline-flex min-h-tap min-w-tap items-center justify-center px-3 text-sm-minus font-normal leading-none tabular-nums transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:text-[color:var(--disabled)]",
        pressed
          ? "text-[color:var(--clinical-accent)] forced-colors:outline forced-colors:outline-2 forced-colors:[outline-color:Highlight]"
          : "text-[color:var(--text)]",
      )}
    >
      <span
        aria-hidden="true"
        data-cme-chip-surface="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 inset-y-1.5 z-0 rounded-sm border transition motion-reduce:transition-none",
          pressed
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-raised)] group-hover:bg-[color:var(--surface-subtle)] group-active:bg-[color:var(--surface-inset)]",
        )}
      />
      <span className="relative z-[var(--z-raised)] inline-flex items-center gap-1.5">
        {Icon ? <Icon aria-hidden="true" className="size-icon-sm shrink-0" /> : null}
        {children}
      </span>
    </button>
  );
}
