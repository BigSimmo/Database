import {
  ADMIN_REQUIREMENTS_CATALOGUE,
  catalogueItemForEntry,
  requirementChecklistRowsForJob,
  type AdminRequirementCatalogueItem,
  type RequirementChecklistRow,
} from "@/lib/admin/requirements";
import { utcDay } from "@/lib/admin/renewal-dates";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { complianceExpiresOn, entryNotForThisJob, isComplianceEntry } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * The three views Today's at-a-glance counts open on Renewals
 * (`/admin/renewals?show=<filter>`). Today counts and Renewals filters through
 * these same functions, so a count and the list it opens can never disagree.
 * Every date here is one the doctor recorded; nothing is checked with an issuer.
 */
export const RENEWALS_SHOW_FILTERS = ["date-passed", "due-90", "not-recorded"] as const;
export type RenewalsShowFilter = (typeof RENEWALS_SHOW_FILTERS)[number];

export const RENEWALS_SHOW_LABELS: Record<RenewalsShowFilter, string> = {
  "date-passed": "Date passed",
  "due-90": "Due in 90 days",
  "not-recorded": "Not recorded",
};

/** The "due soon" window, in Perth calendar days from today (inclusive). */
export const RENEWALS_DUE_WINDOW_DAYS = 90;

export function parseRenewalsShow(value: string | null | undefined): RenewalsShowFilter | null {
  return (RENEWALS_SHOW_FILTERS as readonly string[]).includes(value ?? "") ? (value as RenewalsShowFilter) : null;
}

/** A checklist row (statewide catalogue item) or one of the doctor's personal renewals. */
export type RenewalsFilterItem =
  | { readonly kind: "catalogue"; readonly row: RequirementChecklistRow }
  | { readonly kind: "personal"; readonly entry: OnCallEntry; readonly expiresOn: string | undefined };

export function renewalsFilterItemExpiresOn(item: RenewalsFilterItem): string | undefined {
  return item.kind === "catalogue" ? item.row.expiresOn : item.expiresOn;
}

/**
 * Everything Renewals lists: the checklist for this job (items marked "not for
 * this job" left out, as on the page) followed by personal renewals — the
 * compliance rows no catalogue item matches.
 */
export function renewalsFilterItems(
  own: readonly OnCallEntry[],
  catalogue: readonly AdminRequirementCatalogueItem[] = ADMIN_REQUIREMENTS_CATALOGUE,
): RenewalsFilterItem[] {
  const checklist = requirementChecklistRowsForJob(catalogue, own).map((row): RenewalsFilterItem => ({
    kind: "catalogue",
    row,
  }));
  const personal = own
    .filter(
      (entry) =>
        isComplianceEntry(entry) && catalogueItemForEntry(entry, catalogue) === undefined && !entryNotForThisJob(entry),
    )
    .map((entry): RenewalsFilterItem => ({ kind: "personal", entry, expiresOn: complianceExpiresOn(entry) }));
  return [...checklist, ...personal];
}

export function matchesRenewalsShow(filter: RenewalsShowFilter, item: RenewalsFilterItem, now: Date): boolean {
  if (filter === "not-recorded") return item.kind === "catalogue" && item.row.state === "not-recorded";
  const expiresOn = renewalsFilterItemExpiresOn(item);
  if (!expiresOn) return false;
  const today = perthCalendarDate(now);
  if (filter === "date-passed") return expiresOn < today;
  const days = (utcDay(expiresOn) ?? Number.NaN) - (utcDay(today) ?? Number.NaN);
  return days >= 0 && days <= RENEWALS_DUE_WINDOW_DAYS;
}

/** The matching items, soonest recorded date first; undated items keep list order. */
export function renewalsShowMatches(
  own: readonly OnCallEntry[],
  filter: RenewalsShowFilter,
  now: Date,
  catalogue: readonly AdminRequirementCatalogueItem[] = ADMIN_REQUIREMENTS_CATALOGUE,
): RenewalsFilterItem[] {
  const matches = renewalsFilterItems(own, catalogue).filter((item) => matchesRenewalsShow(filter, item, now));
  if (filter === "not-recorded") return matches;
  return matches.sort((a, b) =>
    (renewalsFilterItemExpiresOn(a) ?? "").localeCompare(renewalsFilterItemExpiresOn(b) ?? ""),
  );
}

export function renewalsShowCounts(
  own: readonly OnCallEntry[],
  now: Date,
  catalogue: readonly AdminRequirementCatalogueItem[] = ADMIN_REQUIREMENTS_CATALOGUE,
): Record<RenewalsShowFilter, number> {
  const items = renewalsFilterItems(own, catalogue);
  const count = (filter: RenewalsShowFilter) => items.filter((item) => matchesRenewalsShow(filter, item, now)).length;
  return { "date-passed": count("date-passed"), "due-90": count("due-90"), "not-recorded": count("not-recorded") };
}
