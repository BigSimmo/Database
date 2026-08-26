// src/lib/caring-contacts/operational-reporting.ts
//
// The aggregate operational measures behind `/caring-contacts/reports`.
//
// OPERATIONAL ONLY, AND THE WORD IS DOING WORK. Spec §4.2 forbids ranking clinicians, and nothing
// here is per-actor: every measure below is over CONTACTS and DISPATCH ATTEMPTS, and no function
// in this file takes, returns, or groups by an actor. A measure that ordered people by output
// would have to be written from scratch rather than assembled from these, which is the point.
//
// Nothing here re-derives a rule another module owns:
//
//   * which contact states count as sent, still to send, or never to be sent comes from
//     `summariseStoredContacts`, which is built on `contactSendability` in ./model;
//   * which AWST calendar day an instant falls in comes from `awstCalendarDay` in ./clock;
//   * a dispatch attempt's discrepancy is the store's own recorded `expectedStatus` /
//     `reportedStatus` pair, compared, not reclassified.
//
// The counts are stated as data rather than as prose, and nothing in this module writes a sentence
// about them (Ruling 94): a report is nothing but counts, and a count restated in prose would be
// wrong the first time the data moved.
import { awstCalendarDay } from "./clock";
import { summariseStoredContacts, type DispatchRecord, type PlanRecord, type StoredContactSummary } from "./repository";
import type { PlanState } from "./model";

/** Contacts falling on one AWST calendar day, split by whether they have gone out yet. */
export type ContactsOnDay = {
  /** The AWST calendar day these two counts are about. */
  readonly calendarDay: string;
  /** Planned for that day and still to send. */
  readonly stillToSend: number;
  /** Planned for that day and already sent. */
  readonly alreadySent: number;
};

/**
 * Dispatch attempts whose reported provider status did not match what the dispatcher expected.
 *
 * `medianMinutesToResolution` is `null` when NO discrepancy has been resolved, which is a
 * different fact from a median of zero and must never be rendered as one. A median over an
 * even-sized set is the mean of the two middle values, rounded to the nearest minute; stated here
 * because "the median" alone does not determine it.
 */
export type DispatchDiscrepancySummary = {
  readonly attempts: number;
  readonly discrepancies: number;
  readonly resolved: number;
  readonly unresolved: number;
  readonly medianMinutesToResolution: number | null;
};

export type OperationalReport = {
  readonly plans: {
    readonly total: number;
    /** Every plan state that has at least one plan, in the order the states were encountered. */
    readonly byState: readonly { readonly state: PlanState; readonly count: number }[];
  };
  readonly contacts: StoredContactSummary;
  readonly today: ContactsOnDay;
};

/**
 * The whole team's plans and contacts, rolled up.
 *
 * `asAt` is REQUIRED and is the instant "today" is taken from. Not defaulted to `new Date()`: a
 * report that silently reads the wall clock cannot be tested against a fixed day, and a caller
 * that meant to pass a clock's instant and forgot would get a plausible answer instead of a
 * compile error.
 */
export function summariseOperationalReport(plans: readonly PlanRecord[], asAt: Date): OperationalReport {
  const contacts: StoredContactSummary = { total: 0, alreadySent: 0, stillToSend: 0, willNotBeSent: 0 };
  const byState = new Map<PlanState, number>();
  const calendarDay = awstCalendarDay(asAt);
  let todayStillToSend = 0;
  let todayAlreadySent = 0;

  for (const record of plans) {
    byState.set(record.plan.state, (byState.get(record.plan.state) ?? 0) + 1);

    const summary = summariseStoredContacts(record.contacts);
    contacts.total += summary.total;
    contacts.alreadySent += summary.alreadySent;
    contacts.stillToSend += summary.stillToSend;
    contacts.willNotBeSent += summary.willNotBeSent;

    for (const stored of record.contacts) {
      if (stored.planned.calendarDay !== calendarDay) continue;
      // One contact's day-scoped bucket is decided by the SAME classification the totals above
      // use, read off a one-element summary rather than by testing the state against a second
      // list of "sent-looking" states written here.
      const one = summariseStoredContacts([stored]);
      todayStillToSend += one.stillToSend;
      todayAlreadySent += one.alreadySent;
    }
  }

  return {
    plans: {
      total: plans.length,
      byState: [...byState].map(([state, count]) => ({ state, count })),
    },
    contacts,
    today: { calendarDay, stillToSend: todayStillToSend, alreadySent: todayAlreadySent },
  };
}

/**
 * A dispatch attempt carries a discrepancy once BOTH statuses are known and they differ.
 *
 * An attempt whose provider status has not come back yet is not a discrepancy -- it is an attempt
 * with nothing to compare -- and counting it as one would report an outstanding exception against
 * every message still in flight.
 */
function isDiscrepancy(record: DispatchRecord): boolean {
  return record.expectedStatus !== null && record.reportedStatus !== null && record.expectedStatus !== record.reportedStatus;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length / 2;
  return Number.isInteger(middle)
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[Math.floor(middle)];
}

export function summariseDispatchDiscrepancies(dispatches: readonly DispatchRecord[]): DispatchDiscrepancySummary {
  const discrepancies = dispatches.filter(isDiscrepancy);
  const resolvedMinutes = discrepancies
    .filter((record) => record.discrepancyResolvedAt !== null)
    .map((record) => Math.round((record.discrepancyResolvedAt!.getTime() - record.startedAt.getTime()) / 60_000));

  return {
    attempts: dispatches.length,
    discrepancies: discrepancies.length,
    resolved: resolvedMinutes.length,
    unresolved: discrepancies.length - resolvedMinutes.length,
    medianMinutesToResolution: median(resolvedMinutes),
  };
}
