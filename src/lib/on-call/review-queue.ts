import { isComplianceEntry } from "@/lib/on-call/compliance";
import {
  ON_CALL_REVIEW_INTERVAL_MONTHS,
  onCallEntryFreshness,
  onCallEntryIsEditable,
  type OnCallEntry,
} from "@/lib/on-call/entry-model";

/**
 * Which of the owner's entries need checking, soonest first.
 *
 * Three groups: never checked, overdue (more than twelve months since the last
 * check), and due soon (inside the next `windowDays`). The first two are the
 * existing stale rule exactly; "due soon" is new and only ever computed here,
 * so nothing that relies on fresh/stale — the printed card above all — moves.
 *
 * Only entries this reader can confirm are listed, and never compliance
 * records, which are checked against the issuing body rather than confirmed as
 * "still correct" (the same exclusion the Compliance page makes).
 */

export const ON_CALL_DUE_SOON_DAYS = 30;

const DAY_MS = 86_400_000;

/** The instant an entry's twelve months run out, or null if it was never checked. */
export function onCallReviewDueAt(lastVerifiedAt: string | null): Date | null {
  if (!lastVerifiedAt) return null;
  const due = new Date(lastVerifiedAt);
  if (Number.isNaN(due.getTime())) return null;
  const dayOfMonth = due.getUTCDate();
  due.setUTCMonth(due.getUTCMonth() + ON_CALL_REVIEW_INTERVAL_MONTHS);
  // Same leap-day clamp as `onCallEntryFreshness`, so the two never disagree.
  if (due.getUTCDate() !== dayOfMonth) due.setUTCDate(0);
  return due;
}

export type OnCallReviewItem = {
  readonly entry: OnCallEntry;
  readonly dueAt: Date | null;
};

export type OnCallReviewQueue = {
  readonly neverChecked: readonly OnCallReviewItem[];
  readonly overdue: readonly OnCallReviewItem[];
  readonly dueSoon: readonly OnCallReviewItem[];
  readonly total: number;
  /** How many entries were actually assessed. Zero means nothing was checked, not that all is well. */
  readonly assessed: number;
};

export function buildOnCallReviewQueue(
  entries: readonly OnCallEntry[],
  now: Date,
  windowDays: number = ON_CALL_DUE_SOON_DAYS,
): OnCallReviewQueue {
  const neverChecked: OnCallReviewItem[] = [];
  const overdue: OnCallReviewItem[] = [];
  const dueSoon: OnCallReviewItem[] = [];
  const horizon = now.getTime() + windowDays * DAY_MS;
  let assessed = 0;

  for (const entry of entries) {
    if (!onCallEntryIsEditable(entry) || isComplianceEntry(entry)) continue;
    assessed += 1;
    const freshness = onCallEntryFreshness(entry, now);
    const dueAt = onCallReviewDueAt(freshness.lastVerifiedAt);
    if (freshness.state === "stale") {
      (freshness.reason === "never-verified" ? neverChecked : overdue).push({ entry, dueAt });
    } else if (dueAt && dueAt.getTime() <= horizon) {
      dueSoon.push({ entry, dueAt });
    }
  }

  const byDue = (a: OnCallReviewItem, b: OnCallReviewItem) =>
    (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0) || a.entry.title.localeCompare(b.entry.title);
  neverChecked.sort((a, b) => a.entry.title.localeCompare(b.entry.title));
  overdue.sort(byDue);
  dueSoon.sort(byDue);
  return { neverChecked, overdue, dueSoon, total: neverChecked.length + overdue.length + dueSoon.length, assessed };
}
