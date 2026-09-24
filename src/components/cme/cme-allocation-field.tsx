"use client";

import { useState } from "react";

import { cn, fieldControlPlain, fieldLabel, textMuted } from "@/components/ui-primitives";
import { cmeCategories, cmeCategoryLabels, type CmeAllocation, type CmeCategory } from "@/lib/cme/types";

/**
 * One activity's hours, split across the three national categories.
 *
 * All three rows are always on screen — there is no separate "add a category"
 * step. A category the owner leaves blank simply contributes no allocation;
 * only a row with a positive number of hours in it reaches `onChange`.
 *
 * Each row keeps its own raw typed text as local state, rather than deriving
 * the input's displayed value back from the parsed number. Deriving it looks
 * equivalent right up until the owner types a leading "0" on the way to
 * "0.5": the instant that lone "0" parses to zero, a value driven by the
 * parse snaps back to empty, and the "." and "5" that follow land in a field
 * that was just cleared out from under them. Keeping the exact characters
 * typed as the field's own state avoids that entirely — text inputs (not
 * `type="number"`) for the same reason: a real browser's number input
 * silently rejects a value like "0." while it is still being typed.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Hours at the same hundredth precision `isAllocationBalanced` checks, with at
 * least one decimal: "1.0", "0.75". One decimal alone showed 0.75 stated and
 * 0.7 placed as "0.7 of 0.8 allocated · 0.1 hours still to place".
 */
export function formatAllocationHours(value: number): string {
  const twoPlaces = round2(value).toFixed(2);
  return twoPlaces.endsWith("0") ? twoPlaces.slice(0, -1) : twoPlaces;
}

/**
 * Whether a split adds up to the hours the owner said the activity took, to
 * a hundredth-of-an-hour (36-second) precision — enough to absorb ordinary
 * floating-point noise from summing several typed numbers without ever
 * calling a genuine mismatch "close enough".
 */
export function isAllocationBalanced(totalHours: number, statedHours: number): boolean {
  return round2(totalHours) === round2(statedHours);
}

export function totalAllocatedHours(allocations: readonly CmeAllocation[]): number {
  return round2(allocations.reduce((sum, allocation) => sum + allocation.hours, 0));
}

/**
 * Whether `raw` is a plain decimal number the way an owner would type one by
 * hand: digits, then optionally one decimal point followed by more digits.
 * No exponent notation (`e`/`E`) and no leading sign (`+`/`-`) — `Number()`
 * on its own accepts both, and exponent notation in particular can turn a
 * short string like `"1e10"` into a huge value that a simple `max` check
 * downstream may not be guarding against.
 */
export function isPlainDecimalText(raw: string): boolean {
  return /^\d+(\.\d+)?$/.test(raw.trim());
}

function parseHours(raw: string): number {
  if (!isPlainDecimalText(raw)) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function deriveAllocations(text: Record<CmeCategory, string>): CmeAllocation[] {
  return cmeCategories
    .map((category) => ({ category, hours: parseHours(text[category]) }))
    .filter((allocation) => allocation.hours > 0);
}

export type CmeAllocationFieldProps = {
  /** The hours the owner says the whole activity ran for — the figure the split must add up to. */
  statedHours: number;
  /** Called with the current split and its total on every change. Never stores `statedHours` itself. */
  onChange: (allocations: readonly CmeAllocation[], totalHours: number) => void;
  /** Prefixes each row's input id. Defaults are unique enough for one field per page. */
  idPrefix?: string;
  /** Existing or routine-provided split used when editing or pre-filling an entry. */
  initialAllocations?: readonly CmeAllocation[];
};

export function CmeAllocationField({
  statedHours,
  onChange,
  idPrefix = "cme-allocation",
  initialAllocations = [],
}: CmeAllocationFieldProps) {
  const [text, setText] = useState<Record<CmeCategory, string>>(() => ({
    educational: String(initialAllocations.find((item) => item.category === "educational")?.hours ?? ""),
    reviewing: String(initialAllocations.find((item) => item.category === "reviewing")?.hours ?? ""),
    measuring: String(initialAllocations.find((item) => item.category === "measuring")?.hours ?? ""),
  }));
  const allocations = deriveAllocations(text);
  const total = totalAllocatedHours(allocations);
  const balanced = isAllocationBalanced(total, statedHours);
  const remaining = round2(statedHours - total);

  function handleCategoryChange(category: CmeCategory, raw: string) {
    const nextText = { ...text, [category]: raw };
    setText(nextText);
    const nextAllocations = deriveAllocations(nextText);
    onChange(nextAllocations, totalAllocatedHours(nextAllocations));
  }

  return (
    <div className="w-full">
      <p className={fieldLabel}>Hours split across categories</p>
      <div className="flex flex-col gap-3">
        {cmeCategories.map((category) => {
          const inputId = `${idPrefix}-${category}`;
          return (
            <div key={category}>
              <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium leading-5 text-[color:var(--text)]">
                {cmeCategoryLabels[category]}
              </label>
              <input
                id={inputId}
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={text[category]}
                onChange={(event) => handleCategoryChange(category, event.target.value)}
                className={fieldControlPlain}
              />
            </div>
          );
        })}
      </div>
      {/* Position, weight and words carry the shortfall — never colour. */}
      <p data-testid="cme-allocation-total" className="mt-3 text-sm font-semibold text-[color:var(--text)]">
        {formatAllocationHours(total)} of {formatAllocationHours(statedHours)} allocated
      </p>
      <p className={cn("mt-1 text-xs", textMuted)}>
        {balanced
          ? "Matches the hours you said this took."
          : remaining > 0
            ? `${formatAllocationHours(remaining)} hour${remaining === 1 ? "" : "s"} still to place.`
            : `${formatAllocationHours(Math.abs(remaining))} hour${Math.abs(remaining) === 1 ? "" : "s"} over — take that back out of a category.`}
      </p>
    </div>
  );
}
