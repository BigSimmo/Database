import type { CmeEntry } from "@/lib/cme/types";

export type RecentActivity = {
  /** The entry the "Log again" prefill copies. */
  readonly id: string;
  readonly title: string;
  /** Total hours the copied entry recorded, across its categories. */
  readonly hours: number;
  readonly date: string;
};

/** Titles that differ only in case or spacing are the same activity for "Log again". */
function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The owner's most recent distinct activities, newest first, for the "Log again"
 * chips on the new-entry form. Archived entries are skipped (they count for
 * nothing), and each title appears once, as its latest occasion — so a monthly
 * peer review group offers last month's hours, not the first meeting's.
 */
export function recentRepeatableActivities(entries: readonly CmeEntry[], limit = 5): RecentActivity[] {
  const seen = new Set<string>();
  const recent: RecentActivity[] = [];
  const newestFirst = entries
    .filter((entry) => !entry.archivedAt && entry.title.trim())
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of newestFirst) {
    const key = titleKey(entry.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const hours = Math.round(entry.allocations.reduce((sum, allocation) => sum + allocation.hours, 0) * 100) / 100;
    recent.push({ id: entry.id, title: entry.title.trim(), hours, date: entry.date });
    if (recent.length >= limit) break;
  }
  return recent;
}
