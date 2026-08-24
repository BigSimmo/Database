"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn, controlDisabled } from "@/components/ui-primitives";
import { focusRing } from "@/components/card-recipes";

export type InteractiveRowVariant = "default" | "card" | "subtle" | "table-row";

/**
 * Shared token-backed recipe for interactive rows, list items, search match rows,
 * and disclosure triggers. Replaces bespoke per-feature interaction rules with a single
 * contract that handles hover, press, focus, and dual-disabled encodings.
 */
export const interactiveRowBase = cn(
  "group flex min-h-tap w-full cursor-pointer items-center text-left font-[inherit]",
  "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-quick)] motion-reduce:transition-none",
  "hover:not-aria-disabled:enabled:bg-[color:var(--surface-subtle)]",
  "active:not-aria-disabled:enabled:translate-y-px motion-reduce:active:translate-y-0",
  focusRing,
  controlDisabled,
);

const VARIANT: Record<InteractiveRowVariant, string> = {
  default:
    "gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 aria-[current=true]:border-[color:var(--clinical-accent-border)] aria-[current=true]:border-l-[3px] aria-[current=true]:border-l-[color:var(--clinical-accent)] aria-[current=true]:bg-[color:var(--clinical-accent-soft)]",
  card: "gap-3.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3.5 aria-[current=true]:border-[color:var(--clinical-accent-border)] aria-[current=true]:border-l-[3px] aria-[current=true]:border-l-[color:var(--clinical-accent)] aria-[current=true]:bg-[color:var(--clinical-accent-soft)]",
  subtle:
    "gap-2.5 rounded-md border-0 bg-transparent px-3 py-2 text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
  "table-row":
    "gap-2.5 rounded-none border-0 border-b border-[color:var(--border)] bg-transparent px-3.5 py-3 text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] last:border-b-0",
};

export type InteractiveRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: InteractiveRowVariant;
  active?: boolean;
  testId?: string;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * An accessible interactive row component for lists, cards, and option pickers.
 */
export function InteractiveRow({
  children,
  variant = "default",
  active = false,
  className,
  disabled,
  type = "button",
  testId,
  ref,
  ...props
}: InteractiveRowProps) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      data-testid={testId}
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      className={cn(interactiveRowBase, VARIANT[variant], className)}
    >
      {children}
    </button>
  );
}
