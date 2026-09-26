import type { z } from "zod";

import { formatRecordedDate, renewalStartOn } from "@/lib/admin/renewal-dates";
import { addDays, type CalendarEvent } from "@/lib/calendar/calendar-event";
import { toIcs } from "@/lib/calendar/ics";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import type { updateOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import { onCallExpiryEvents } from "@/lib/on-call/calendar-events";
import {
  complianceExpiresOn,
  entryNotForThisJob,
  partitionLogisticsEntries,
  sortComplianceEntries,
} from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_LIMIT = 10;
type UpdateBody = z.input<typeof updateOnCallEntrySchema>;

function detailsOf(entry: OnCallEntry): Record<string, unknown> {
  return typeof entry.details === "object" && entry.details !== null ? (entry.details as Record<string, unknown>) : {};
}

export function complianceExpiryHistory(entry: OnCallEntry): string[] {
  const value = detailsOf(entry).expiryHistory;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && DATE_KEY.test(item))
    : [];
}

/** PATCH is a full replace (updateOnCallEntrySchema): every field round-trips unchanged. Exported
 *  so another Admin module patching one `details` key (`src/lib/admin/new-job-progress.ts`) can
 *  build the same complete body rather than re-deriving this list of fields. */
export function fullBody(entry: OnCallEntry, details: unknown): UpdateBody {
  return {
    section: entry.section,
    slug: entry.slug,
    title: entry.title,
    subtitle: entry.subtitle,
    body: entry.body,
    details,
    linkedDocumentIds: entry.linkedDocumentIds,
    tags: entry.tags,
    isPersonal: entry.isPersonal,
    includeOnCard: entry.includeOnCard,
    sortOrder: entry.sortOrder,
    lastVerifiedAt: entry.lastVerifiedAt,
  };
}

export type RenewedInput = { newExpiresOn: string; proofNote: string };

export function buildRenewedEntryBody(
  entry: OnCallEntry,
  input: RenewedInput,
):
  | { ok: true; body: UpdateBody; earlier: boolean }
  | { ok: false; reason: "missing" | "malformed" | "unchanged" | "too-long" } {
  const next = input.newExpiresOn.trim();
  if (!next) return { ok: false, reason: "missing" };
  if (!DATE_KEY.test(next) || Number.isNaN(Date.parse(`${next}T00:00:00Z`))) return { ok: false, reason: "malformed" };
  const previous = complianceExpiresOn(entry);
  if (previous === next) return { ok: false, reason: "unchanged" };
  const note = input.proofNote.trim();
  if (note.length > 120) return { ok: false, reason: "too-long" };
  const { proofNote: _dropped, ...rest } = detailsOf(entry);
  const history = previous
    ? [previous, ...complianceExpiryHistory(entry)].slice(0, HISTORY_LIMIT)
    : complianceExpiryHistory(entry);
  return {
    ok: true,
    earlier: previous !== undefined && next < previous,
    body: fullBody(entry, {
      ...rest,
      expiresOn: next,
      expiryHistory: history,
      provenance: "typed",
      ...(note ? { proofNote: note } : {}),
    }),
  };
}

/** Undo ("Marked renewed. Undo"): the row exactly as it was before the save. Also the undo
 *  path for the "Not for this job" toggle below (same pattern: restore the original row). */
export function buildRestoreEntryBody(original: OnCallEntry): UpdateBody {
  return fullBody(original, original.details);
}

/** 09:00 Perth on a calendar day, as a UTC instant. Perth has no daylight saving: always 01:00Z. */
function perthNineAm(date: string): string {
  return `${date}T01:00:00.000Z`;
}

/**
 * Spec review 9: the calendar export's own expiry event (same stable id, so
 * re-downloading replaces it rather than adding a second), with alerts at 09:00
 * Perth at the start of the lead time and one week before the date. An alert
 * whose moment has passed is dropped.
 */
export function renewalCalendarEvent(entry: OnCallEntry, now: Date): CalendarEvent | null {
  const [base] = onCallExpiryEvents([entry]);
  const expiresOn = complianceExpiresOn(entry);
  const startOn = renewalStartOn(entry);
  if (!base || !expiresOn || !startOn) return null;
  const alarms = [...new Set([startOn, addDays(expiresOn, -7)])]
    .sort()
    .map(perthNineAm)
    .filter((instant) => Date.parse(instant) > now.getTime());
  // `reminderType` is dropped: this file carries its own alerts, not the Settings-driven one.
  const { reminderType: _feedOnly, ...event } = base;
  return { ...event, alarmsAt: alarms };
}

/** One file with every dated renewal (spec review 9, "Add all to my calendar"). No calendar name. */
export function renewalsCalendarFile(entries: readonly OnCallEntry[], now: Date): string | null {
  const events = partitionLogisticsEntries(entries).compliance.flatMap((entry) => {
    const event = renewalCalendarEvent(entry, now);
    return event ? [event] : [];
  });
  return events.length ? toIcs(events, { now }) : null;
}

export function workforceCopyText(entries: readonly OnCallEntry[], now: Date): string {
  const lines = sortComplianceEntries(partitionLogisticsEntries(entries).compliance).map((entry) => {
    const issuer = detailsOf(entry).issuingBody;
    const name = typeof issuer === "string" && issuer.trim() ? `${entry.title} (${issuer.trim()})` : entry.title;
    const expiresOn = complianceExpiresOn(entry);
    return expiresOn ? `${name}: recorded as expiring ${formatRecordedDate(expiresOn)}` : `${name}: no expiry recorded`;
  });
  return [
    `Dates as I recorded them, copied ${formatRecordedDate(perthCalendarDate(now))}; not checked with issuers`,
    ...lines,
  ].join("\n");
}

/**
 * Spec review 27/28: "Not for this job" splits the compliance rows into the
 * ones that count towards the "X of Y recorded" ring, and the ones marked as
 * not applying to this doctor's job, which move to a final section and leave
 * the count — they are not counted as either recorded or unrecorded.
 *
 * `counted` keeps every other compliance row, recorded and not-recorded alike,
 * in the same order `partitionLogisticsEntries` returns them; a caller that
 * wants the page's own order runs it through `sortComplianceEntries`.
 */
export interface ComplianceCounts {
  readonly recorded: number;
  readonly total: number;
  readonly notForThisJob: number;
}

export interface ComplianceGroups {
  readonly counted: OnCallEntry[];
  readonly notForThisJob: OnCallEntry[];
  readonly counts: ComplianceCounts;
}

export function groupComplianceEntries(entries: readonly OnCallEntry[]): ComplianceGroups {
  const counted: OnCallEntry[] = [];
  const notForThisJob: OnCallEntry[] = [];
  for (const entry of partitionLogisticsEntries(entries).compliance) {
    if (entryNotForThisJob(entry)) notForThisJob.push(entry);
    else counted.push(entry);
  }
  const recorded = counted.filter((entry) => complianceExpiresOn(entry) !== undefined).length;
  return { counted, notForThisJob, counts: { recorded, total: counted.length, notForThisJob: notForThisJob.length } };
}

/**
 * Toggle "Not for this job" (owner-only, spec review 28). Setting it to `false`
 * drops the key rather than storing an explicit `false`, so a row nobody has
 * ever flagged and a row flagged and then un-flagged are indistinguishable —
 * the ordinary, unflagged case either way. Undo is `buildRestoreEntryBody`
 * applied to the row's state from before the toggle: the same "save the row
 * you started from" pattern the Renewed sheet uses.
 */
export function buildNotForThisJobToggleBody(entry: OnCallEntry, notForThisJob: boolean): UpdateBody {
  const { notForThisJob: _dropped, ...rest } = detailsOf(entry);
  return fullBody(entry, notForThisJob ? { ...rest, notForThisJob: true } : rest);
}
