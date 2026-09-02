"use client";

import { cn } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";

export type AppliedFilter = {
  id: string;
  /** Compact value shown on the chip, for example `High`. */
  valueLabel: string;
  /** Optional group prefix, for example `Risk`. */
  groupLabel?: string;
  /** Complete label announced by assistive technology. */
  accessibleLabel?: string;
  onRemove: () => void;
};

export type AppliedFiltersProps = {
  filters: readonly AppliedFilter[];
  /** Clears every applied filter at once. Omit to hide the trailing action. */
  onClearAll?: () => void;
  /** Visible kicker before the chips. */
  label?: string;
  clearLabel?: string;
  className?: string;
  testId?: string;
  chipTestId?: string;
  clearTestId?: string;
};

function filterDisplayLabel(filter: AppliedFilter) {
  return filter.groupLabel ? `${filter.groupLabel}: ${filter.valueLabel}` : filter.valueLabel;
}

/**
 * Removable applied-filter chips plus an optional Clear all control.
 *
 * Empty `filters` renders nothing. Remove uses Chip’s removable API; Clear all
 * is `<Button variant="ghost">`. Focus stays on the Group 1 outline idiom
 * already owned by Chip and Button — no companion ring.
 */
export function AppliedFilters({
  filters,
  onClearAll,
  label = "Active filters:",
  clearLabel = "Clear all",
  className,
  testId = "applied-filters",
  chipTestId = "applied-filter-chip",
  clearTestId = "applied-filters-clear",
}: AppliedFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div
      data-testid={testId}
      role="group"
      aria-label="Applied filters"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      <span className="mr-1 text-xs font-semibold text-[color:var(--text-muted)]">{label}</span>
      {filters.map((filter) => {
        const displayLabel = filterDisplayLabel(filter);
        return (
          <span key={filter.id} data-testid={chipTestId}>
            <Chip
              appearance={{ kind: "information", tone: "accent" }}
              title={displayLabel}
              onRemove={filter.onRemove}
              removeLabel={`Remove filter ${filter.accessibleLabel ?? displayLabel}`}
            >
              {filter.groupLabel ? (
                <>
                  <span className="opacity-75">{filter.groupLabel}: </span>
                  {filter.valueLabel}
                </>
              ) : (
                filter.valueLabel
              )}
            </Chip>
          </span>
        );
      })}
      {onClearAll ? (
        <Button variant="ghost" size="sm" onClick={onClearAll} testId={clearTestId}>
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
