import { formatCalendarMonthLabel } from "@/lib/cme/cpd-year";
import { totalAllocatedHours } from "@/lib/cme/evaluate";
import {
  cmeCategories,
  cmeCategoryLabels,
  cmeCertificateMissing,
  type CmeCategory,
  type CmeEntry,
} from "@/lib/cme/types";

/** The three things an audit asks for per activity, as log filters. */
export type CmeLogAttention = "evidence" | "reflection" | "copy";

export const ATTENTION_FILTERS: readonly {
  value: CmeLogAttention;
  label: string;
  matches: (entry: CmeEntry) => boolean;
}[] = [
  { value: "evidence", label: "Missing evidence", matches: cmeCertificateMissing },
  { value: "reflection", label: "No reflection", matches: (entry) => entry.reflection.trim() === "" },
  { value: "copy", label: "Not copied", matches: (entry) => !entry.transcribed },
];

export type CategoryFilter = "all" | CmeCategory;

export const CATEGORY_OPTIONS: readonly { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...cmeCategories.map((category) => ({ value: category, label: cmeCategoryLabels[category] })),
];

export type MonthGroup = {
  /** `YYYY-MM`. */
  readonly key: string;
  readonly label: string;
  readonly hours: number;
  readonly entries: readonly CmeEntry[];
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The distinct category labels an entry's allocations touch, in canonical order. */
export function categoryNames(entry: CmeEntry): string {
  const present = new Set(entry.allocations.map((allocation) => allocation.category));
  return cmeCategories
    .filter((category) => present.has(category))
    .map((category) => cmeCategoryLabels[category])
    .join(" + ");
}

/**
 * Most-recent-month-first groups over an already-filtered, already-sorted
 * list. Grouping — never a chip that hides the other months — is the same
 * choice `onCallEntryGroups` documents for On Call: a reader wants to GET to
 * August, not have July and September removed from the screen while they
 * look at it. The month strip above the list jumps between these groups
 * instead of filtering them.
 */
export function groupByMonth(entries: readonly CmeEntry[]): MonthGroup[] {
  const byMonth = new Map<string, CmeEntry[]>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const existing = byMonth.get(key);
    if (existing) existing.push(entry);
    else byMonth.set(key, [entry]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, monthEntries]) => ({
      key,
      label: formatCalendarMonthLabel(key),
      hours: round2(totalAllocatedHours(monthEntries)),
      entries: monthEntries,
    }));
}

/** One decimal, so the hours column lines up ("1.0", "9.5"); a finer value such as 0.25 keeps its digits rather than rounding. */
export function formatLogHours(hours: number): string {
  const rounded = round2(hours);
  return Number.isInteger(rounded * 10) ? rounded.toFixed(1) : String(rounded);
}

/** The in-page anchor a month section carries, and the month strip jumps to. */
export function monthAnchorId(key: string): string {
  return `cme-log-month-anchor-${key}`;
}
