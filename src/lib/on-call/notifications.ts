import {
  complianceExpiresOn,
  isComplianceEntry,
  partitionLogisticsEntries,
  recordedExpiryHasPassed,
} from "@/lib/on-call/compliance";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { summariseOnCallFreshness } from "@/lib/on-call/freshness-summary";

/**
 * What this reader's own hub is asking them to deal with.
 *
 * ## Why this is derived and not stored
 *
 * Every signal here is already in the entries the viewer is holding: a
 * requirement whose recorded date has passed, a row nobody has ever confirmed,
 * a row confirmed too long ago. Storing a second copy as notification rows
 * would add a table, a migration and a write path — and, worse, a second
 * source of truth that goes stale the moment someone edits the entry. Derived
 * from the entries, a notification cannot disagree with the page it points at.
 *
 * It is user-specific in the way that matters: it is computed from what THIS
 * viewer can see, and the compliance half is personal to the owner by
 * construction, since `onCallEntryToRow` stamps every compliance requirement
 * `is_personal` and the shared read withholds them from everyone else.
 *
 * ## The wording is a governance constraint, not a style choice
 *
 * `recordedExpiryHasPassed` is arithmetic on a stored string, and its own
 * docblock spells out the rule a surface using it must follow: say "that date
 * has passed", never "expired". The holder may have renewed last week and not
 * come back to update the row. Nothing here may say compliant, valid, current,
 * lapsed or expired, and nothing here may render a tick that stands for one.
 */

export type OnCallNotificationKind = "compliance-date-passed" | "never-verified" | "overdue";

export interface OnCallNotification {
  /** Stable across renders: the entry it came from plus what it is about. */
  id: string;
  kind: OnCallNotificationKind;
  /** The entry's own title, so the reader recognises the row being named. */
  title: string;
  /** One plain sentence. Never a claim about the reader's standing. */
  detail: string;
  section: OnCallSection;
}

/** Worst first. A date that has passed outranks a row nobody has confirmed,
 *  which outranks one confirmed too long ago. */
const KIND_RANK: Record<OnCallNotificationKind, number> = {
  "compliance-date-passed": 0,
  "never-verified": 1,
  overdue: 2,
};

/**
 * Build the reader's notification list from the entries they already hold.
 *
 * `now` is injected so a test can pin the day rather than the clock, and so
 * both halves compare against the same instant — a list where the compliance
 * rows and the freshness rows disagreed about what "today" is would be worse
 * than no list.
 */
export function deriveOnCallNotifications(
  entries: readonly OnCallEntry[],
  now: Date = new Date(),
): OnCallNotification[] {
  const notifications: OnCallNotification[] = [];

  // Compliance first. `partitionLogisticsEntries` is the one place that decides
  // what a compliance requirement is; asking it here keeps this list and the
  // Compliance page from ever disagreeing about the set.
  const { compliance } = partitionLogisticsEntries([...entries]);
  for (const entry of compliance) {
    if (!recordedExpiryHasPassed(entry, now)) continue;
    const expiresOn = complianceExpiresOn(entry);
    notifications.push({
      id: `${entry.id}:compliance-date-passed`,
      kind: "compliance-date-passed",
      title: entry.title,
      // Phrased against the record, never against the person. See the docblock.
      detail: expiresOn
        ? `The date recorded for this was ${expiresOn}, which has passed. Worth checking whether the record needs updating.`
        : "The date recorded for this has passed. Worth checking whether the record needs updating.",
      section: entry.section,
    });
  }

  // Then freshness, from the same summary the home and the row already render,
  // so a badge and a notification can never contradict each other.
  const freshness = summariseOnCallFreshness(entries, now);
  for (const { entry, freshness: verdict } of freshness.stale) {
    // A compliance requirement whose date has passed is already above, named
    // for the thing that actually matters about it. Listing it twice would
    // make the count wrong and the list repetitive.
    if (isComplianceEntry(entry) && recordedExpiryHasPassed(entry, now)) continue;
    const neverVerified = verdict.reason === "never-verified";
    notifications.push({
      id: `${entry.id}:${neverVerified ? "never-verified" : "overdue"}`,
      kind: neverVerified ? "never-verified" : "overdue",
      title: entry.title,
      detail: neverVerified
        ? "Nobody has confirmed this is still right. Worth a look before the shift depends on it."
        : "This was last confirmed a long time ago. Worth checking it is still right.",
      section: entry.section,
    });
  }

  return notifications.sort((a, b) => {
    const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (byKind !== 0) return byKind;
    // Title last so the list is stable: two rows of the same kind must not swap
    // places between renders.
    return a.title.localeCompare(b.title);
  });
}
