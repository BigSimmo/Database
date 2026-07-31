"use client";

import { cn } from "@/components/ui-primitives";

export type QuantityProps = {
  /** The numeral only, e.g. "12.5", "0.6–0.8". Never include the unit here. */
  value: string;
  /** The unit, e.g. "mg", "mg/day", "mmol/L". Rendered as authored. */
  unit?: string;
  /**
   * Demote the numeral from value weight to label weight. Use when the figure is
   * machine-derived and low confidence: a confident-looking number is the wrong
   * output for an uncertain extraction.
   */
  demoted?: boolean;
  /** Step for the numeral. Units always sit one step below, in sans. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE: Record<NonNullable<QuantityProps["size"]>, { value: string; unit: string }> = {
  sm: { value: "text-sm", unit: "text-xs" },
  md: { value: "text-base-minus", unit: "text-sm" },
  lg: { value: "text-lg", unit: "text-sm" },
};

/**
 * The one quantity style. Every number that carries clinical meaning — a dose, a
 * serum level, an overdue interval, a count — renders through this.
 *
 * Two rules are safety rules, not style:
 *
 *   1. **The unit is never uppercased.** `g` is not `G`; `mg` is not `MG`. A
 *      `text-transform: uppercase` on a dose changes what the dose says. This
 *      component pins `normal-case` so an inherited transform cannot reach it.
 *   2. **The unit is demoted, never equal.** When the numeral and unit share the
 *      same font and weight, "1 g" reads as one token and the figure stops being
 *      the thing you see first.
 *
 * Numerals are Geist Mono with `tabular-nums` so figures stack in a column and
 * do not reflow as they change.
 */
export function Quantity({ value, unit, demoted = false, size = "md", className }: QuantityProps) {
  const step = SIZE[size];

  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      <span
        data-testid="quantity-value"
        className={cn(
          "font-mono tabular-nums",
          step.value,
          demoted
            ? "text-[color:var(--text-muted)] [font-weight:var(--font-weight-label)]"
            : "text-[color:var(--text-heading)] [font-weight:var(--font-weight-value)]",
        )}
      >
        {value}
      </span>
      {unit ? (
        <span
          data-testid="quantity-unit"
          // `normal-case` is load-bearing: it blocks an inherited uppercase
          // transform from silently rewriting the unit.
          className={cn(
            "normal-case text-[color:var(--text-muted)] [font-weight:var(--font-weight-label)]",
            "ml-[var(--quantity-unit-gap)] tracking-[var(--quantity-unit-tracking)]",
            step.unit,
          )}
        >
          {unit}
        </span>
      ) : null}
    </span>
  );
}
