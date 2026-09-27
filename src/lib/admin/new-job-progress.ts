import type { z } from "zod";

import { fullBody, buildRestoreEntryBody } from "@/lib/admin/renewals";
import { utcDay } from "@/lib/admin/renewal-dates";
import { selectNewJobRows } from "@/lib/admin/help-items";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import type { updateOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

type UpdateBody = z.input<typeof updateOnCallEntrySchema>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A row is shown on Today for at most this many days past its own start date —
 * "the first week of the job" (owner-approved design). Past that, New job is a
 * checklist to visit directly, not a Today headline.
 */
const SHOWS_UNTIL_DAYS_PAST_START = 7;

function detailsOf(entry: OnCallEntry): Record<string, unknown> {
  return typeof entry.details === "object" && entry.details !== null ? (entry.details as Record<string, unknown>) : {};
}

function jobStartsOnOf(entry: OnCallEntry): string | undefined {
  const value = detailsOf(entry).jobStartsOn;
  return typeof value === "string" && DATE_KEY.test(value) ? value : undefined;
}

function isNewJobStepDone(entry: OnCallEntry): boolean {
  return detailsOf(entry).done === true;
}

/** The owner's own New job checklist rows, in the order the New job page lists them. */
function ownNewJobSteps(entries: { own: readonly OnCallEntry[]; shared: readonly OnCallEntry[] }): OnCallEntry[] {
  return selectNewJobRows(entries)
    .logins.filter((row) => row.source === "you")
    .map((row) => row.entry);
}

/**
 * The owner's stored job start date and the own row that holds it, with no
 * display window: the New job page shows it for as long as it is stored,
 * while Today's `selectNewJobProgress` hides it a week after the start.
 *
 * The most recently *updated* own row that carries a start date, not the most
 * recently listed one: `lastVerifiedAt` is the only per-row timestamp
 * `OnCallEntry` carries. A row that was never verified sorts behind one that
 * was, and among equally-unverified rows the earliest in listed order wins,
 * so the result never depends on object identity or iteration quirks. A new
 * date is written to `entry`, so the row written is the row read.
 */
export function selectNewJobStart(entries: {
  own: readonly OnCallEntry[];
  shared: readonly OnCallEntry[];
}): { readonly startsOn: string; readonly entry: OnCallEntry } | null {
  let found: { startsOn: string; entry: OnCallEntry } | null = null;
  let latestVerifiedAt = Number.NEGATIVE_INFINITY;
  for (const entry of ownNewJobSteps(entries)) {
    const date = jobStartsOnOf(entry);
    if (date === undefined) continue;
    const verifiedAt = entry.lastVerifiedAt ? Date.parse(entry.lastVerifiedAt) : Number.NEGATIVE_INFINITY;
    if (found === null || verifiedAt > latestVerifiedAt) {
      found = { startsOn: date, entry };
      latestVerifiedAt = verifiedAt;
    }
  }
  return found;
}

export interface NewJobProgress {
  /** The start date, `YYYY-MM-DD`, exactly as the owner typed it. */
  readonly startsOn: string;
  /** Whole weeks between today's Perth date and `startsOn` (negative once the job has started). */
  readonly weeksAway: number;
  /** How many of the owner's own New job rows carry a saved tick. */
  readonly done: number;
  /** How many New job rows the owner owns — shared, read-only guide rows are not counted. */
  readonly total: number;
  /** The title of the first own row that is not yet ticked done, or null once every one is. */
  readonly nextStep: string | null;
}

/**
 * Today's "New job progress" line (owner-approved design, plan-update-1):
 * "Starts Mon 2 Nov 2026 · in 5 weeks · 5 of 12 done · next: <first open step>".
 *
 * Shows only while a start date is set, and only up to a week into the job —
 * a doctor two months into a new post does not need this on Today every day.
 */
export function selectNewJobProgress(
  entries: { own: readonly OnCallEntry[]; shared: readonly OnCallEntry[] },
  now: Date,
): NewJobProgress | null {
  const steps = ownNewJobSteps(entries);

  const start = selectNewJobStart(entries);
  if (!start) return null;
  const { startsOn } = start;

  const startDay = utcDay(startsOn);
  const nowDay = utcDay(perthCalendarDate(now));
  if (startDay === null || nowDay === null) return null;
  const daysAway = startDay - nowDay;
  if (daysAway < -SHOWS_UNTIL_DAYS_PAST_START) return null;

  return {
    startsOn,
    weeksAway: Math.round(daysAway / 7),
    done: steps.filter(isNewJobStepDone).length,
    total: steps.length,
    nextStep: steps.find((entry) => !isNewJobStepDone(entry))?.title ?? null,
  };
}

export interface NewJobFieldUpdate {
  /** The full PATCH body — every other field round-trips unchanged. */
  readonly body: UpdateBody;
  /** The same row's original body, for "Undo" — the pattern `buildRestoreEntryBody` already gives Renewals. */
  readonly undo: UpdateBody;
}

/**
 * Ticks or clears one New job row's saved checklist state. Clearing drops the
 * key rather than storing an explicit `false` (the same choice
 * `buildNotForThisJobToggleBody` makes for "Not for this job"): a step nobody
 * has ticked and a step ticked and then un-ticked are indistinguishable — the
 * ordinary, not-done case either way.
 */
export function setNewJobStepDone(entry: OnCallEntry, done: boolean): NewJobFieldUpdate {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop it from `rest`
  const { done: _dropped, ...rest } = detailsOf(entry);
  return {
    body: fullBody(entry, done ? { ...rest, done: true } : rest),
    undo: buildRestoreEntryBody(entry),
  };
}

export type SetNewJobStartResult =
  { ok: true; body: UpdateBody; undo: UpdateBody } | { ok: false; reason: "malformed" };

/**
 * Sets or clears the owner's job start date. `null` clears it (drops the key,
 * same reasoning as `setNewJobStepDone`'s clear). A non-null date must be a
 * real calendar day: New job never guesses or stores a date it cannot show
 * back to the owner in words.
 */
export function setNewJobStart(entry: OnCallEntry, date: string | null): SetNewJobStartResult {
  if (date !== null && (!DATE_KEY.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
    return { ok: false, reason: "malformed" };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop it from `rest`
  const { jobStartsOn: _dropped, ...rest } = detailsOf(entry);
  return {
    ok: true,
    body: fullBody(entry, date === null ? rest : { ...rest, jobStartsOn: date }),
    undo: buildRestoreEntryBody(entry),
  };
}
