import { renewalStartOn } from "@/lib/admin/renewal-dates";
import { groupComplianceEntries } from "@/lib/admin/renewals";
import {
  ADMIN_REQUIREMENTS_CATALOGUE,
  catalogueItemForEntry,
  requirementChecklistRows,
  requirementsNotForThisJob,
  requirementsRecordedCount,
  type AdminRequirementCatalogueItem,
} from "@/lib/admin/requirements";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { complianceExpiresOn, sortComplianceEntries } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * Today's own selectors (owner-approved order, plan-update-1): the "Renew
 * next" answer card and the "Needs you" list. Both read only the reader's own
 * rows — a caller passes `selectAdminOwnEntries(state)` in, never the raw
 * On Call read, so a shared (read-only) row can never be offered for renewal.
 *
 * Neither selector builds a URL: `src/lib` may not import `@/components`
 * (`tests/lib-layering.test.ts`), and the Renewals anchor id is
 * `onCallEntryAnchorId`, which lives under `@/components/on-call`. Each
 * selector hands back the `OnCallEntry` itself and the page builds the href.
 */

const DAY_MS = 86_400_000;

/** A `YYYY-MM-DD` calendar date as a whole day count, for comparing two dates. */
function dayIndex(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

export type RenewNextState = "in-lead-time" | "passed" | "before-start";

export interface RenewNextItem {
  readonly kind: "compliance" | "new-job";
  readonly title: string;
  /** `YYYY-MM-DD`: the date this card is about — an expiry, or the new job's start. */
  readonly date: string;
  readonly state: RenewNextState;
  /** Present for `kind: "compliance"`. */
  readonly entry?: OnCallEntry;
  /** The lead-time window, for the drawing. Present for `kind: "compliance"` only. */
  readonly windowStart?: string;
  readonly windowEnd?: string;
}

/**
 * "Renew next" (Josh, owner-approved order): the soonest date of any kind — a
 * compliance requirement already inside its own lead-time window, one whose
 * recorded date has already passed, or the new job's start date — whichever
 * sits closest to today, in either direction. A future date within its window
 * and a passed date both compete on the same footing: nearest wins, so a
 * renewal opening in three weeks can rightly beat a passed date from three
 * weeks ago that nobody has caught up with yet.
 *
 * A requirement outside its lead-time window (too early to start) is not a
 * candidate at all — it is not yet "next" to renew.
 */
export function selectRenewNext(
  entries: readonly OnCallEntry[],
  newJobStartsOn: string | undefined,
  now: Date,
): RenewNextItem | null {
  const today = perthCalendarDate(now);
  const candidates: RenewNextItem[] = [];

  for (const entry of groupComplianceEntries(entries).counted) {
    const expiresOn = complianceExpiresOn(entry);
    if (!expiresOn) continue;
    const startOn = renewalStartOn(entry);
    if (expiresOn < today) {
      candidates.push({
        kind: "compliance",
        title: entry.title,
        date: expiresOn,
        state: "passed",
        entry,
        windowStart: startOn,
        windowEnd: expiresOn,
      });
    } else if (startOn !== undefined && startOn <= today) {
      candidates.push({
        kind: "compliance",
        title: entry.title,
        date: expiresOn,
        state: "in-lead-time",
        entry,
        windowStart: startOn,
        windowEnd: expiresOn,
      });
    }
  }

  if (newJobStartsOn) {
    candidates.push({ kind: "new-job", title: "New job starts", date: newJobStartsOn, state: "before-start" });
  }

  if (candidates.length === 0) return null;

  const todayIndex = dayIndex(today);
  candidates.sort((a, b) => {
    const distance = Math.abs(dayIndex(a.date) - todayIndex) - Math.abs(dayIndex(b.date) - todayIndex);
    if (distance !== 0) return distance;
    // A tie is rare (same day), but a compliance item is the more actionable
    // of the two, so it wins the card over the new job's start.
    if (a.kind !== b.kind) return a.kind === "compliance" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return candidates[0];
}

export type NeedsYouRow =
  | {
      readonly kind: "passed";
      readonly key: string;
      readonly entry: OnCallEntry;
      readonly expiresOn: string;
      /** True only for a catalogue item whose rule this app has not confirmed ("Check with your service"). */
      readonly needsChecking: boolean;
    }
  | {
      readonly kind: "not-recorded";
      readonly key: "not-recorded";
      readonly titles: readonly string[];
    };

export interface NeedsYou {
  readonly featured: NeedsYouRow;
  /** At most two, per the owner-approved order. */
  readonly rows: readonly NeedsYouRow[];
}

/**
 * "Needs you" (owner-approved order): one featured row, then at most two more.
 * A requirement whose recorded date has already passed comes first, ordered
 * worst consequence band first exactly as `sortComplianceEntries` orders the
 * rest of Renewals; everything Renewals calls "Not recorded yet" is then
 * grouped into one closing row, so a doctor with many gaps does not see one
 * row per gap. That is the reader's own personal renewals with no date,
 * followed by the catalogue items with no matching row at all — and never a
 * catalogue row recorded with no end date, which Renewals shows as
 * "Recorded" (the same `requirementChecklistRows` decides both pages).
 *
 * `excludeEntryId` drops the entry already shown on the "Renew next" card
 * (when that card's winner is itself a passed date), so the same requirement
 * is never named twice on the page.
 */
export function selectNeedsYou(
  entries: readonly OnCallEntry[],
  now: Date,
  options: {
    readonly excludeEntryId?: string;
    readonly catalogue?: readonly AdminRequirementCatalogueItem[];
  } = {},
): NeedsYou | null {
  const catalogue = options.catalogue ?? ADMIN_REQUIREMENTS_CATALOGUE;
  const today = perthCalendarDate(now);
  const counted = groupComplianceEntries(entries).counted.filter((entry) => entry.id !== options.excludeEntryId);

  const passed = sortComplianceEntries(
    counted.filter((entry) => {
      const expiresOn = complianceExpiresOn(entry);
      return expiresOn !== undefined && expiresOn < today;
    }),
  );
  const personalUndated = counted.filter(
    (entry) =>
      complianceExpiresOn(entry) === undefined &&
      catalogueItemForEntry(entry, ADMIN_REQUIREMENTS_CATALOGUE) === undefined,
  );
  const catalogueNotRecorded = requirementChecklistRows(catalogue, entries)
    .filter((row) => row.state === "not-recorded")
    .map((row) => row.item);
  // Catalogue order, not the checklist's alphabetical tie-break, so the named
  // items read in the order Renewals' own groups list them.
  catalogueNotRecorded.sort((a, b) => catalogue.indexOf(a) - catalogue.indexOf(b));
  const notRecordedTitles = [
    ...personalUndated.map((entry) => entry.title),
    ...catalogueNotRecorded.map((item) => item.title),
  ];

  const rows: NeedsYouRow[] = passed.map((entry) => ({
    kind: "passed",
    key: entry.id,
    entry,
    expiresOn: complianceExpiresOn(entry) as string,
    needsChecking: catalogueItemForEntry(entry, ADMIN_REQUIREMENTS_CATALOGUE)?.status === "needs-checking",
  }));
  if (notRecordedTitles.length > 0) {
    rows.push({ kind: "not-recorded", key: "not-recorded", titles: notRecordedTitles });
  }

  if (rows.length === 0) return null;
  const [featured, ...rest] = rows;
  return { featured, rows: rest.slice(0, 2) };
}

export interface RequirementsSummary {
  readonly recorded: number;
  readonly total: number;
  readonly notForThisJob: number;
}

/**
 * "7 of 10 recorded · 1 not for this job" (owner-approved order). Built on
 * `requirementsRecordedCount` and `requirementsNotForThisJob`, the same two
 * selectors Renewals' summary and closing section read, so the pages agree.
 */
export function selectRequirementsSummary(entries: readonly OnCallEntry[]): RequirementsSummary {
  const { recorded, total } = requirementsRecordedCount(ADMIN_REQUIREMENTS_CATALOGUE, entries);
  return {
    recorded,
    total,
    notForThisJob: requirementsNotForThisJob(ADMIN_REQUIREMENTS_CATALOGUE, entries).length,
  };
}
