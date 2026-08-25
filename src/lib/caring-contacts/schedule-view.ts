// src/lib/caring-contacts/schedule-view.ts
//
// What a team's caring-contact schedule holds on a given AWST day -- Phase 2B Task 12, the read
// beneath the Schedule screen.
//
// WHY THERE IS NO NEW REPOSITORY METHOD (Ruling 124). Everything a schedule needs is already in
// what `listPlans` returns: each `PlanRecord` carries its contacts, and each of those carries the
// instant it sends at, the cadence label, the message type, whether the planner absorbed it, and
// the contact's own state. This module is an AGGREGATION OVER EXISTING RULES, not a new rule, so a
// second store read would add a second thing to keep honest -- and team scoping, the fact this
// domain guards hardest, comes free from the read that is already scoped. `listSendableContacts`
// is deliberately NOT used: it filters on the contact state alone with no plan-state gate, so a
// draft plan's contacts present there as sendable, and that is a filed defect on a different
// surface rather than something to work around here.
//
// WHY IT LIVES IN THE SEALED DOMAIN rather than beside the route or the screen. Three of the four
// rules it composes are already owned here -- the window mapping (./schedule), the sendability
// classification (./model) and the plan lifecycle (./model, ./repository) -- and the fourth, that a
// plan's own state holds sending, is a rule about the domain and not about any screen. There will
// be more than one reader: the HTTP route publishes it, and a Server Component render reads it
// directly rather than calling itself over the network. Both must get the same answer, and the only
// way to guarantee that is for there to be one answer.
//
// NOTHING HERE RE-DERIVES A RULE. The window an instant sends in comes from
// `sendingPreferenceAt`; whether a contact still sends comes from `contactSendability`; the three
// windows and their order come from `SENDING_PREFERENCE_OPTIONS`; and the sent/to-send/never
// arithmetic comes from `summariseStoredContacts`. What this module adds is the day bucketing, the
// plan-state hold, and the grouping.
//
// IT RELEASES NO PATIENT IDENTITY. Every field below comes from a `PlanRecord`, which carries none
// -- the patient is named only by the synthetic `patientId`. A screen that needs names reads them
// through `listPatientNames`, which is audited in its own right.
//
// Pure and deterministic: no clock, no storage, no ambient time. The day being asked about is an
// argument.
import { awstCalendarDay, awstWallTimeToInstant } from "./clock";
import type { ContactId, PatientId, PlanId } from "./ids";
import { contactSendability, type ContactSendability, type ContactState, type MessageType } from "./model";
import type { PlanState, SendingPreference } from "./model";
import { summariseStoredContacts, type PlanRecord, type StoredContact, type StoredContactSummary } from "./repository";
import { isAwstCalendarDay, SENDING_PREFERENCE_OPTIONS, sendingPreferenceAt } from "./schedule";

/**
 * Why a plan is not sending, whatever its individual contacts say. Null means the plan itself is
 * not in the way.
 *
 * THIS IS THE GATE `listSendableContacts` DOES NOT HAVE. A draft plan's contacts sit in
 * `scheduled` and a paused plan's do too -- neither lifecycle write touches them -- so a read that
 * asked only the contact would announce a plan nobody has started, and a plan a coordinator
 * deliberately paused, as work the service is about to do. `planNotStarted` and `planPaused` are
 * different facts from each other and from `planEnded`, and a screen has to be able to say which.
 */
export type PlanSendingHold = "planNotStarted" | "planPaused" | "planEnded";

/**
 * An exhaustive switch rather than a list of held states, for the same reason `contactSendability`
 * is one: a `PlanState` added later and left unclassified must not compile, so a new state cannot
 * default into "this plan is sending".
 */
export function planSendingHold(state: PlanState): PlanSendingHold | null {
  switch (state) {
    case "draft":
      return "planNotStarted";
    case "active":
      return null;
    case "paused":
      return "planPaused";
    case "withdrawn":
    case "cancelled":
    case "completed":
      return "planEnded";
    default: {
      const unclassified: never = state;
      return unclassified;
    }
  }
}

/**
 * Whether a contact's state is one a person has to look at.
 *
 * The four provider outcomes that are not a delivery, plus a contact the window closed on. All
 * five sent nothing a coordinator can rely on and none of them is retried, so each is a patient who
 * did not hear from the service and nobody has yet decided what to do about it.
 *
 * Exhaustive for the same reason the two switches above are. `delivered` and `sent` are not
 * exceptions: one is a transport receipt and the other is a send awaiting one.
 */
export function needsOperationalReview(state: ContactState): boolean {
  switch (state) {
    case "notDelivered":
    case "numberInvalid":
    case "contactChanged":
    case "statusUnavailable":
    case "missed":
      return true;
    case "scheduled":
    case "processing":
    case "sent":
    case "delivered":
    case "suppressed":
    case "cancelled":
      return false;
    default: {
      const unclassified: never = state;
      return unclassified;
    }
  }
}

/**
 * Why a contact will not be sent. Only ever set where `contactSendability` already answered
 * `willNotBeSent`, so it explains that answer rather than competing with it.
 *
 * `absorbedByFirstContact` is kept apart from the other three deliberately. An absorbed entry is
 * the planner folding Week 1 into a first contact moved onto the same day -- the plan is working
 * exactly as designed -- whereas a cancellation means something stopped it. Collapsing the two into
 * "not sending" is the shape of the defect `ListEmptyState` exists to prevent, one layer down.
 */
export type ScheduleNotSendingReason = "absorbedByFirstContact" | "suppressed" | "cancelled" | "missed";

/** One contact, on one day, with everything a screen needs to say what is happening to it. */
export type ScheduleEntry = {
  planId: PlanId;
  patientId: PatientId;
  contactId: ContactId;
  planState: PlanState;
  /** The AWST calendar day this contact actually sends on, derived from `sendAt`. */
  calendarDay: string;
  sendAt: Date;
  cadenceLabel: string;
  messageType: MessageType;
  state: ContactState;
  /** What the CONTACT's state says -- `contactSendability`'s answer, unmodified. */
  sendability: ContactSendability;
  /** What the PLAN's state says. A fact about the plan, so it is reported on a sent contact too. */
  planHold: PlanSendingHold | null;
  /** Still to send AND not held by its plan. The only entries the service will actually send. */
  isDue: boolean;
  /** Why this contact will not be sent; null unless `sendability` is `willNotBeSent`. */
  notSendingReason: ScheduleNotSendingReason | null;
  /** Whether this contact belongs in the named-exceptions panel rather than a routine window. */
  needsReview: boolean;
};

/**
 * How much of a group is going out, how much never will, and how much is held.
 *
 * `StoredContactSummary` supplies `total`, `alreadySent`, `stillToSend` and `willNotBeSent` from
 * `summariseStoredContacts` -- this does not restate that arithmetic, it EXTENDS it by splitting
 * `stillToSend` into the part the service will send and the part its own plan is holding.
 *
 * The invariant, stated rather than left to be inferred: `due + held === stillToSend`.
 */
export type ScheduleCounts = StoredContactSummary & {
  due: number;
  held: number;
  needsReview: number;
};

export type ScheduleGroup = {
  entries: readonly ScheduleEntry[];
  counts: ScheduleCounts;
};

/** One of the three approved sending windows, with the wording and time ./schedule publishes. */
export type ScheduleWindow = ScheduleGroup & {
  preference: SendingPreference;
  label: string;
  sendTime: string;
};

/**
 * What a day's emptiness means, which is exactly the distinction a list screen must not lose.
 *
 * `noContactsPlanned` and `nothingDue` both render as a day with no work on it, and they are
 * different facts about a suicide-prevention service: the first is a quiet day, the second is a day
 * whose contacts were all stopped, absorbed, missed or held. `counts` says which of those it was.
 */
export type ScheduleDayDisposition = "noContactsPlanned" | "nothingDue" | "contactsDue";

/**
 * One AWST calendar day.
 *
 * EVERY ENTRY THE DAY HOLDS APPEARS IN EXACTLY ONE GROUP: one of the three windows, the
 * outside-the-windows group, or the exceptions group. A contact needing operational review is taken
 * out of its window rather than listed twice, because the approved design keeps named exceptions
 * separate from the routine sending-window lists and a screen rendering both would otherwise count
 * one patient as two. `counts` covers the day as a whole, so the day's totals never depend on which
 * group an entry landed in.
 */
export type ScheduleDay = {
  calendarDay: string;
  /** Always all three, in the order they occur in a day, present whether or not they hold anything. */
  windows: readonly ScheduleWindow[];
  /** Contacts moved to a time that is not an approved send time -- see `sendingPreferenceAt`. */
  outsideApprovedWindows: ScheduleGroup;
  exceptions: ScheduleGroup;
  counts: ScheduleCounts;
  disposition: ScheduleDayDisposition;
};

export type ScheduleRangeView = {
  fromCalendarDay: string;
  toCalendarDay: string;
  /** Every day of the range, in order, including the ones holding nothing. */
  days: readonly ScheduleDay[];
};

export type ScheduleRangeResult = { ok: true; view: ScheduleRangeView } | { ok: false; reason: string };

/**
 * The longest range this read will answer, in days.
 *
 * A month, so a month view is possible and a seven-day strip is comfortably inside it. It is a
 * bound rather than a preference: the range arrives from a query string, the work is one pass over
 * every plan's every contact per day, and an unbounded range would let a caller ask for a decade.
 * Published so a screen offering a date range does not restate it.
 */
export const SCHEDULE_RANGE_MAX_DAYS = 31;

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * A calendar day as an instant, taken at midday AWST.
 *
 * Midday rather than midnight on purpose: it is the furthest point from either boundary, so adding
 * whole days can never land on the wrong side of one. AWST is UTC+8 all year, so there is no
 * daylight-saving shift for this to survive -- the margin is against arithmetic, not against a
 * clock change.
 */
function middayOf(calendarDay: string): number {
  return awstWallTimeToInstant(calendarDay, 12).getTime();
}

function daysBetween(fromCalendarDay: string, toCalendarDay: string): number {
  return Math.round((middayOf(toCalendarDay) - middayOf(fromCalendarDay)) / MILLISECONDS_PER_DAY);
}

function calendarDaysFrom(fromCalendarDay: string, count: number): string[] {
  const start = middayOf(fromCalendarDay);
  return Array.from({ length: count }, (_unused, offset) => awstCalendarDay(new Date(start + offset * MILLISECONDS_PER_DAY)));
}

function notSendingReasonFor(stored: StoredContact): ScheduleNotSendingReason | null {
  if (contactSendability(stored.contact.state) !== "willNotBeSent") return null;
  // The planner's own mark, checked before the state: an absorbed entry is stored in the terminal
  // `suppressed` state at creation, so reading the state alone could not tell it apart from a
  // contact something later suppressed.
  if (stored.planned.suppressed !== undefined) return "absorbedByFirstContact";
  switch (stored.contact.state) {
    case "suppressed":
      return "suppressed";
    case "cancelled":
      return "cancelled";
    case "missed":
      return "missed";
    default:
      // `contactSendability` classifies exactly these four as `willNotBeSent`; if it ever
      // classifies a fifth, saying nothing is better than naming the wrong reason.
      return null;
  }
}

function entryFor(record: PlanRecord, stored: StoredContact): ScheduleEntry {
  const sendability = contactSendability(stored.contact.state);
  const planHold = planSendingHold(record.plan.state);
  return {
    planId: record.plan.id,
    patientId: record.patientId,
    contactId: stored.contact.id,
    planState: record.plan.state,
    calendarDay: awstCalendarDay(stored.planned.sendAt),
    sendAt: new Date(stored.planned.sendAt.getTime()),
    cadenceLabel: stored.planned.cadenceLabel,
    messageType: stored.planned.messageType,
    state: stored.contact.state,
    sendability,
    planHold,
    isDue: sendability === "stillToSend" && planHold === null,
    notSendingReason: notSendingReasonFor(stored),
    needsReview: needsOperationalReview(stored.contact.state),
  };
}

/** Sorted so two reads of the same plans, in any order, produce the same list. */
function ordered(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort(
    (left, right) =>
      left.sendAt.getTime() - right.sendAt.getTime() ||
      (left.planId < right.planId ? -1 : left.planId > right.planId ? 1 : 0) ||
      (left.contactId < right.contactId ? -1 : left.contactId > right.contactId ? 1 : 0),
  );
}

/**
 * The three buckets `summariseStoredContacts` already answers for, plus the two this read adds.
 * The stored contacts are handed to it rather than the entries, so the sent/to-send/never counts
 * stay that function's answer and not a second one taken over the same states.
 */
function countsFor(entries: readonly ScheduleEntry[], stored: readonly StoredContact[]): ScheduleCounts {
  return {
    ...summariseStoredContacts(stored),
    due: entries.filter((entry) => entry.isDue).length,
    held: entries.filter((entry) => entry.sendability === "stillToSend" && entry.planHold !== null).length,
    needsReview: entries.filter((entry) => entry.needsReview).length,
  };
}

function groupOf(pairs: readonly { entry: ScheduleEntry; stored: StoredContact }[]): ScheduleGroup {
  const entries = ordered(pairs.map((pair) => pair.entry));
  return { entries, counts: countsFor(entries, pairs.map((pair) => pair.stored)) };
}

function dispositionOf(counts: ScheduleCounts): ScheduleDayDisposition {
  if (counts.total === 0) return "noContactsPlanned";
  return counts.due > 0 ? "contactsDue" : "nothingDue";
}

function buildDay(
  pairsByDay: ReadonlyMap<string, { entry: ScheduleEntry; stored: StoredContact }[]>,
  calendarDay: string,
): ScheduleDay {
  const pairs = pairsByDay.get(calendarDay) ?? [];

  const exceptions = pairs.filter((pair) => pair.entry.needsReview);
  const routine = pairs.filter((pair) => !pair.entry.needsReview);
  const byPreference = new Map<SendingPreference, { entry: ScheduleEntry; stored: StoredContact }[]>();
  const outside: { entry: ScheduleEntry; stored: StoredContact }[] = [];
  for (const pair of routine) {
    const preference = sendingPreferenceAt(pair.entry.sendAt);
    if (preference === null) {
      outside.push(pair);
      continue;
    }
    const bucket = byPreference.get(preference);
    if (bucket) bucket.push(pair);
    else byPreference.set(preference, [pair]);
  }

  const windows: ScheduleWindow[] = SENDING_PREFERENCE_OPTIONS.map((option) => ({
    preference: option.preference,
    label: option.label,
    sendTime: option.sendTime,
    ...groupOf(byPreference.get(option.preference) ?? []),
  }));

  const counts = countsFor(
    pairs.map((pair) => pair.entry),
    pairs.map((pair) => pair.stored),
  );

  return {
    calendarDay,
    windows,
    outsideApprovedWindows: groupOf(outside),
    exceptions: groupOf(exceptions),
    counts,
    disposition: dispositionOf(counts),
  };
}

/**
 * The team's schedule over an inclusive range of AWST calendar days. One day is the range
 * `(day, day)`; there is deliberately no second entry point for it, because two entry points would
 * be two places for the grouping rules to be applied slightly differently.
 *
 * `plans` is whatever `listPlans` released for the actor -- already team-scoped, already free of
 * patient identity. Refuses by name rather than answering something for a range it cannot honour,
 * exactly as `buildApprovedSchedule` does, so the boundary above it can say what was wrong.
 *
 * A contact is placed on the AWST day of its OWN `sendAt`, never on `planned.calendarDay` and never
 * on the UTC date. `sendAt` is the instant that actually sends; the calendar day beside it is a
 * copy made when the plan was built, and a read that trusted the copy would report a day the
 * service was not going to send on. AWST is UTC+8, so the UTC date is a different day for anything
 * before 08:00 AWST.
 */
export function buildScheduleRange(
  plans: readonly PlanRecord[],
  fromCalendarDay: string,
  toCalendarDay: string,
): ScheduleRangeResult {
  if (!isAwstCalendarDay(fromCalendarDay) || !isAwstCalendarDay(toCalendarDay)) {
    return { ok: false, reason: "schedule-range-invalid-day" };
  }
  const span = daysBetween(fromCalendarDay, toCalendarDay);
  if (span < 0) return { ok: false, reason: "schedule-range-inverted" };
  if (span + 1 > SCHEDULE_RANGE_MAX_DAYS) return { ok: false, reason: "schedule-range-too-long" };

  const days = calendarDaysFrom(fromCalendarDay, span + 1);
  const wanted = new Set(days);

  const pairsByDay = new Map<string, { entry: ScheduleEntry; stored: StoredContact }[]>();
  for (const record of plans) {
    for (const stored of record.contacts) {
      const entry = entryFor(record, stored);
      if (!wanted.has(entry.calendarDay)) continue;
      const bucket = pairsByDay.get(entry.calendarDay);
      if (bucket) bucket.push({ entry, stored });
      else pairsByDay.set(entry.calendarDay, [{ entry, stored }]);
    }
  }

  return {
    ok: true,
    view: { fromCalendarDay, toCalendarDay, days: days.map((day) => buildDay(pairsByDay, day)) },
  };
}
