import { todaySeverities, type TodayItem } from "@/lib/today/today-item";

/**
 * The shared "needs you" order: overdue first, then due soon, then the rest;
 * within a band, earliest `due` first, undated last; then title, then id, so
 * two renders of the same items never reorder.
 *
 * A date-only `due` (`YYYY-MM-DD`) is read as midnight in Perth (UTC+8 all
 * year), so it sorts before any timed item later that Perth day.
 */
const PERTH_OFFSET_MS = 8 * 60 * 60 * 1000;

function dueInstant(due: string | null): number | null {
  if (!due) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const midnightUtc = Date.parse(`${due}T00:00:00Z`);
    return Number.isFinite(midnightUtc) ? midnightUtc - PERTH_OFFSET_MS : null;
  }
  const instant = Date.parse(due);
  return Number.isFinite(instant) ? instant : null;
}

export function compareTodayItems(a: TodayItem, b: TodayItem): number {
  const band = todaySeverities.indexOf(a.severity) - todaySeverities.indexOf(b.severity);
  if (band !== 0) return band;
  const aDue = dueInstant(a.due);
  const bDue = dueInstant(b.due);
  if (aDue !== bDue) {
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    return aDue - bDue;
  }
  return a.title.localeCompare(b.title, "en") || a.id.localeCompare(b.id, "en");
}

/** A new array in the shared order; the input is never mutated. */
export function sortTodayItems<T extends TodayItem>(items: readonly T[]): T[] {
  return [...items].sort(compareTodayItems);
}
