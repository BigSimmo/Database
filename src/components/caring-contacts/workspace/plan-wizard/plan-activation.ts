// src/components/caring-contacts/workspace/plan-wizard/plan-activation.ts
//
// What stage 4 collects, what it derives from the domain, and the body it sends.
//
// WHY THIS IS NOT INSIDE THE WIZARD'S JSX, for the same reason `patient-detail.ts` is not: every
// decision here is a decision about a VALUE, and a rule living inside a render branch is a rule
// that cannot be tested directly and that the next screen re-derives. No React, no `"use client"`,
// no storage and no `fetch`.
//
// NOTHING HERE RE-DERIVES A RULE THE DOMAIN OWNS, and stage 4 is where that temptation is
// strongest, because the schedule has four separate rules a screen would find it easy to restate:
//
//   * WHICH DAYS the first contact may fall on — `firstContactDayBounds` in `./schedule` publishes
//     them, derived from the same three constants `buildApprovedSchedule` refuses against;
//   * WHETHER A REASON IS REQUIRED — decided by comparing the chosen day against the published
//     `usual` day, which is the value `buildApprovedSchedule` itself compares against. The refusal
//     still comes from that function; this only decides whether to ASK;
//   * WHETHER A VALUE IS ACCEPTABLE — never decided here at all. `planSchedulePreview` builds the
//     real schedule and reports the domain's own named refusal;
//   * WHICH CONTACTS WILL BE SENT — `sendableContacts` in `./hospital-events` is the function the
//     store itself uses when it decides which entries to create as `scheduled` and which as
//     `suppressed`, so the preview and the plan cannot disagree about the count.
//
// The last one is proved rather than asserted: `tests/caring-contacts-plan-activation.test.ts`
// creates a plan in the in-memory store from the same input and compares this module's summary
// against `summariseStoredContacts` over the contacts that store really built.
//
// WHY `summariseStoredContacts` IS NOT CALLED HERE, though Ruling [119] names it. It takes
// `StoredContact` — a plan that already exists — and it lives in `repository.ts`, which names the
// service-state module in its own imports. `tests/caring-contacts-explained-automation.dom.test.tsx`
// scans the wizard's whole client module graph for exactly that name, because the service-state
// record carries a free-text incident note that must never cross this boundary. So the function is
// used where it can be: in the test, against the store, as the pin on what is derived here.
import { sendableContacts } from "@/lib/caring-contacts/hospital-events";
import { awstCalendarDay, awstWallTimeToInstant } from "@/lib/caring-contacts/clock";
import type { SendingPreference } from "@/lib/caring-contacts/model";
import { buildApprovedSchedule, firstContactDayBounds, type PlannedContact } from "@/lib/caring-contacts/schedule";

/**
 * What stage 4 collects, as the clinician has it typed so far.
 *
 * All three are held AS TYPED, for the reason `patient-detail.ts` records: the draft's job is to
 * return the screen to the state it was left in, and parsing on the way into storage would quietly
 * rewrite what was entered on every refresh.
 *
 * `dischargeDay` IS COLLECTED HERE AND NOWHERE ELSE (Ruling [121]). `createPlanSchema` requires
 * `dischargeAt` and nothing in this domain holds one before a plan exists — `Referral` is five
 * fields and carries no discharge, `hospital-events.ts` has no discharge event, and every
 * `dischargeAt` in the tree is read back out of a plan that already exists. It sits beside the
 * first-contact control because that control is defined ENTIRELY relative to it: a date control
 * anchored on a day nobody has entered means nothing.
 */
export type PlanActivationDraft = {
  /** The AWST calendar day the patient was discharged, `YYYY-MM-DD`. Empty while none is chosen. */
  dischargeDay: string;
  /** The AWST calendar day of the first contact. Empty means the programme's usual day. */
  firstContactDay: string;
  /** As typed. Required only when the first contact is not on the usual day. */
  firstContactReason: string;
};

export const EMPTY_PLAN_ACTIVATION: PlanActivationDraft = Object.freeze({
  dischargeDay: "",
  firstContactDay: "",
  firstContactReason: "",
});

/**
 * The plan's identifier and the key that makes retrying this submission safe.
 *
 * RULING [120]: minted ONCE, together, at the moment stage 4 is first reached, held in the draft,
 * and reused for every retry of that submission. `handler.ts`'s own comment is the authority —
 * "Only the caller knows whether this request is a retry of the last one."
 *
 * The failure this prevents, stated plainly because it is the worst outcome available on this
 * screen: mint a fresh `planId` per attempt and a clinician who presses Activate twice after a
 * timeout creates TWO PLANS FOR ONE PATIENT — two schedules, two sets of messages, discovered by
 * the patient rather than by the system. Minted once and reused, the second attempt is refused as
 * a replay and returns the first attempt's own answer.
 */
export type PlanSubmissionIdentity = {
  planId: string;
  idempotencyKey: string;
};

/**
 * Sixteen hexadecimal characters mapped to sixteen letters.
 *
 * WHY NOT THE UUID ITSELF, which `ACCESS_OBJECT_ID_PATTERN` would happily accept. `audit.ts` scans
 * every field of an assembled audit event against an Australian mobile-number pattern and THROWS
 * when one matches — and a random hexadecimal string can produce a run of eleven digits. That is
 * rare rather than impossible, which is the worst kind of defect to leave in: the plan is created,
 * the audit event cannot be built, and the write this whole workspace exists to record leaves no
 * trace. An identifier with no digits in it at all cannot match a number pattern, ever, so the
 * hazard is removed by construction rather than by a retry loop that would have to know the rule.
 */
const HEX_TO_LETTER = "abcdefghijklmnop";

function lettersFromRandomIdentifier(): string {
  return globalThis.crypto
    .randomUUID()
    .replace(/-/g, "")
    .replace(/[0-9a-f]/g, (character) => HEX_TO_LETTER[Number.parseInt(character, 16)]);
}

export function mintPlanSubmissionIdentity(): PlanSubmissionIdentity {
  // Two independent values. A key that WAS the plan id would collide with any later write on the
  // same plan that reused it, and one key answers one write.
  return {
    planId: `PLAN-${lettersFromRandomIdentifier()}`,
    idempotencyKey: `PLAN-CREATE-${lettersFromRandomIdentifier()}`,
  };
}

/**
 * The instant a chosen AWST discharge day becomes, or null when it is not a real calendar day.
 *
 * MIDDAY, AND THE HOUR IS THE SCREEN'S DECISION RATHER THAN THE DOMAIN'S. `buildApprovedSchedule`
 * reads only the AWST CALENDAR DAY of `dischargeAt` — "the whole calendar hangs off the AWST
 * discharge day, not the UTC date" — so the time of day changes nothing about the schedule. What
 * it does change is what every OTHER reader of the stored instant sees, and midday is the one
 * choice that lands on the chosen day under any reasonable conversion: UTC midnight for the same
 * day is 08:00 AWST, and any wall time the clinician might have meant before that would land on
 * the day before.
 *
 * The clinician is not asked for a time because nothing in this domain uses one, and asking for a
 * value that changes nothing would invite the belief that it does.
 */
export const DISCHARGE_WALL_CLOCK_HOUR = 12;

export function dischargeInstantFor(dischargeDay: string): Date | null {
  // The domain's own parse, through the bounds it publishes: a screen that tested `YYYY-MM-DD`
  // with a regular expression would accept 2026-02-30.
  if (firstContactDayBounds(dischargeDay) === null) return null;
  const instant = awstWallTimeToInstant(dischargeDay, DISCHARGE_WALL_CLOCK_HOUR);
  return awstCalendarDay(instant) === dischargeDay ? instant : null;
}

/**
 * Whether the screen must ask for a reason for the first-contact day now chosen.
 *
 * It decides WHETHER TO ASK and nothing else. `buildApprovedSchedule` decides whether the answer
 * is acceptable and names its own refusal, so this cannot make a value acceptable that the domain
 * refuses, nor refuse one the domain takes.
 *
 * The comparison is against the published `usual` day rather than against an offset written here,
 * because `usual` is the value `buildApprovedSchedule` itself compares against when it decides
 * whether a reason is required. `tests/caring-contacts-plan-activation.test.ts` walks every day in
 * the offered range and requires the two to agree.
 */
export function firstContactReasonIsRequired(input: { dischargeDay: string; firstContactDay: string }): boolean {
  if (input.firstContactDay === "") return false;
  const bounds = firstContactDayBounds(input.dischargeDay);
  if (bounds === null) return false;
  return input.firstContactDay !== bounds.usual;
}

/** How much of the schedule about to be created will be sent, and how much never will. */
export type PlannedScheduleSummary = {
  /** Every entry the schedule holds, sendable or not. */
  total: number;
  /** Entries the plan will send. */
  stillToSend: number;
  /** Entries the plan will never send, because the schedule suppressed them. */
  willNotBeSent: number;
  /** The closing message. Its own kind, and not one more caring contact. */
  closing: number;
};

export type PlanActivationIssueCode =
  | "discharge-day-required"
  | "discharge-day-invalid"
  | "sending-preference-required";

export type PlanActivationIssue = {
  code: PlanActivationIssueCode;
  /** Plain words a clinician reads, rendered beside the control itself. Never a code. */
  message: string;
};

/**
 * The schedule this plan would run, as it stands.
 *
 * Three answers, not two, and the third is the one Ruling [117] is about: a value the DOMAIN
 * refused is a different thing from a value the clinician has not supplied yet, and a screen that
 * blended them would tell a clinician to fill in a field that is already filled in.
 */
export type PlanSchedulePreview =
  | { kind: "incomplete"; issues: readonly PlanActivationIssue[] }
  | { kind: "refused"; refusal: string }
  | {
      kind: "ready";
      contacts: readonly PlannedContact[];
      /** Entries the schedule will never send. Empty unless a chosen day collided with one. */
      absorbed: readonly PlannedContact[];
      summary: PlannedScheduleSummary;
      /** The day the first contact actually falls on, whether chosen or defaulted. */
      firstContactDay: string;
      /** Whether that day is not the programme's usual one. */
      movedFromUsualDay: boolean;
    };

export function planSchedulePreview(input: {
  activation: PlanActivationDraft;
  sendingPreference: SendingPreference | null;
}): PlanSchedulePreview {
  const issues: PlanActivationIssue[] = [];
  const dischargeDay = input.activation.dischargeDay.trim();

  if (dischargeDay === "") {
    issues.push({
      code: "discharge-day-required",
      message:
        "Enter the day the patient was discharged. Every date in this plan is counted from it, so nothing can be worked out until it is entered, and no record this prototype can read carries it.",
    });
  } else if (dischargeInstantFor(dischargeDay) === null) {
    issues.push({
      code: "discharge-day-invalid",
      message: "Enter the discharge day as a real date. Nothing was worked out from what is entered now.",
    });
  }

  if (input.sendingPreference === null) {
    issues.push({
      code: "sending-preference-required",
      message:
        "Choose when in the day messages go out, back on the personalisation stage. Every send time in this plan comes from it.",
    });
  }

  if (issues.length > 0) return { kind: "incomplete", issues };

  const dischargeAt = dischargeInstantFor(dischargeDay);
  const bounds = firstContactDayBounds(dischargeDay);
  // Both were established non-null above; the guard is here because a `!` would be an assertion
  // about a branch rather than a fact the reader can check.
  if (dischargeAt === null || bounds === null) {
    return { kind: "refused", refusal: "invalid-discharge-instant" };
  }

  const chosenDay = input.activation.firstContactDay.trim();
  const reason = input.activation.firstContactReason.trim();
  const schedule = buildApprovedSchedule({
    dischargeAt,
    sendingPreference: input.sendingPreference as SendingPreference,
    firstContactDate: chosenDay === "" ? bounds.usual : chosenDay,
    // Passed as typed rather than only when required. `buildApprovedSchedule` is what decides
    // whether a reason was needed, and a screen that withheld one it thought unnecessary would be
    // deciding that question itself.
    firstContactReason: reason === "" ? undefined : reason,
  });
  if (!schedule.ok) return { kind: "refused", refusal: schedule.reason };

  const sendable = sendableContacts(schedule.contacts);
  const sendableSequences = new Set(sendable.map((contact) => contact.sequence));
  const absorbed = schedule.contacts.filter((contact) => !sendableSequences.has(contact.sequence));
  const firstContactDay = chosenDay === "" ? bounds.usual : chosenDay;

  return {
    kind: "ready",
    contacts: schedule.contacts,
    absorbed,
    summary: {
      total: schedule.contacts.length,
      stillToSend: sendable.length,
      // The complement of what the domain answered, never a second predicate over the same
      // contacts: two predicates are two answers to "how much of this plan will be sent", and the
      // patient overview's own note records what that cost the first time.
      willNotBeSent: schedule.contacts.length - sendable.length,
      closing: schedule.contacts.filter((contact) => contact.messageType === "closing").length,
    },
    firstContactDay,
    movedFromUsualDay: firstContactDay !== bounds.usual,
  };
}

/** Exactly the body `createPlanSchema` accepts. Ten keys, because `.strict()` refuses an eleventh. */
export type CreatePlanRequestBody = {
  planId: string;
  referralId: string;
  patientId: string;
  pathwayVersionId: string;
  dischargeAt: string;
  sendingPreference: SendingPreference;
  firstContactDate: string;
  firstContactReason?: string;
  patientDetail: {
    patientName: string;
    patientMobileNumber: string;
    patientIdentifiers: string[];
    culturalIdentity: string | null;
  };
  idempotencyKey: string;
};

/**
 * The body this screen POSTs, or null while anything required is missing.
 *
 * `patientDetail` is TAKEN, not built: `createPlanPatientDetail` in `./patient-detail` already
 * decides what is trimmed, what is required and that cultural identity reaches a plan as `null`
 * whatever a stale draft holds. Re-deriving any of that here would be a second copy of a rule that
 * exists to have exactly one.
 *
 * `firstContactReason` is OMITTED rather than sent empty. The schema types it
 * `z.string().min(1).optional()`, so `""` is refused outright and a plan carrying one could not be
 * created at all — the same shape as `culturalIdentity`, one field over.
 */
export function createPlanRequestBody(input: {
  submission: PlanSubmissionIdentity | null;
  referralId: string;
  patientId: string;
  pathwayVersionId: string | null;
  activation: PlanActivationDraft;
  sendingPreference: SendingPreference | null;
  patientDetail: CreatePlanRequestBody["patientDetail"] | null;
}): CreatePlanRequestBody | null {
  if (input.submission === null) return null;
  if (input.pathwayVersionId === null) return null;
  if (input.sendingPreference === null) return null;
  if (input.patientDetail === null) return null;

  const preview = planSchedulePreview({ activation: input.activation, sendingPreference: input.sendingPreference });
  if (preview.kind !== "ready") return null;

  const dischargeAt = dischargeInstantFor(input.activation.dischargeDay.trim());
  if (dischargeAt === null) return null;

  const reason = input.activation.firstContactReason.trim();
  return {
    planId: input.submission.planId,
    referralId: input.referralId,
    patientId: input.patientId,
    pathwayVersionId: input.pathwayVersionId,
    dischargeAt: dischargeAt.toISOString(),
    sendingPreference: input.sendingPreference,
    // The day the screen SHOWED, not the domain's default. A clinician reads a date back and the
    // plan is created for the date that was read back, whether or not they chose it themselves.
    firstContactDate: preview.firstContactDay,
    ...(reason === "" ? {} : { firstContactReason: reason }),
    patientDetail: input.patientDetail,
    idempotencyKey: input.submission.idempotencyKey,
  };
}

/**
 * What the screen says when the write is refused, in the three-part shape spec §4.4 sets.
 *
 * RULING [117], THIRD ORDERING. "Something went wrong" is not acceptable on the screen that creates
 * a suicide-prevention contact plan: the refusals name genuinely different situations, and a
 * clinician who is told "you may not do this" acts differently from one told "this patient already
 * has a plan" or "the schedule could not be built from these dates".
 *
 * TOTAL over every string, and the default NAMES THE REFUSAL rather than hiding it. A refusal this
 * screen has never seen is still a fact somebody can act on, and an unnamed one is a support call
 * that starts from nothing.
 *
 * EVERY BRANCH SAYS THE DRAFT SURVIVED, because that is the second ordering of the same ruling and
 * it is the thing a clinician most needs to know at the moment a write fails: nothing they typed
 * has been lost. It is written into each wording rather than appended once, so a branch added later
 * cannot omit it silently — the test walks every refusal and requires the sentence.
 */
export type SubmissionRefusalWording = { heading: string; because: string; changedBy: string };

const DRAFT_SURVIVED = "Everything you entered is still on this computer, in this tab, exactly as you left it.";

const REFUSAL_WORDING: Readonly<Record<string, SubmissionRefusalWording>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, SubmissionRefusalWording>, {
    "action-not-granted": {
      heading: "Your role cannot create a plan",
      because: `The role you are signed in as is not granted the action that creates a plan, so nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Signing in as a role that may claim a plan, or asking someone who holds that role to finish this.",
    },
    "no-roles": {
      heading: "This session carries no role, so nothing may be created",
      because: `The session you are acting in has no caring-contacts role at all, so no action can be checked against it and nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Signing in again so the session carries a role.",
    },
    "permission-denied": {
      heading: "This plan cannot be created in this role",
      because: `The store refused the write for this actor, so nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Signing in as a role that may claim a plan, or asking someone who holds that role to finish this.",
    },
    "cross-team-denied": {
      heading: "This plan cannot be created by this team",
      because: `The referral this sign-up started from belongs to another team, so nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Starting the sign-up again from a referral your own team accepted.",
    },
    "not-found": {
      heading: "Nothing here could be found to create a plan against",
      because: `The service answered that there is nothing to act on — which is the same answer it gives for a record another team holds, deliberately, so the two cannot be told apart. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Starting the sign-up again from a referral your own team accepted.",
    },
    "duplicate-active-plan": {
      heading: "This patient already has a plan that has not ended",
      because: `A patient may hold one open plan at a time, across every team, because two open plans would send two sets of messages to one person. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy:
        "Opening the plan this patient already has. If it should not be running, it has to be withdrawn before another can start.",
    },
    "plan-already-exists": {
      heading: "A plan with this identifier already exists",
      because: `The identifier this sign-up minted is already in use, so nothing new was created. ${DRAFT_SURVIVED}`,
      changedBy: "Discarding this draft and starting the sign-up again, which mints a new identifier.",
    },
    "idempotency-key-reused-for-a-different-write": {
      heading: "This submission no longer matches the one it is retrying",
      because: `The key this sign-up holds was recorded against a different set of answers, so the service refused it rather than treating it as a retry — that check is what stops one patient getting two plans. Nothing was created by this attempt. ${DRAFT_SURVIVED}`,
      changedBy:
        "Discarding this draft and starting again. If a plan was created by the earlier attempt, it is on the patient's own screen.",
    },
    "stale-version": {
      heading: "Something else changed this record first",
      because: `The record moved between this screen reading it and this write reaching it, so the write was refused rather than applied over the change. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Reloading this screen so it reads the record as it now stands, then trying again.",
    },
    "service-stopped": {
      heading: "The service is stopped, so no plan can start",
      because: `A service-wide safety stop is in place and it holds every write, including this one. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Three different roles approving the restart. Until then no plan can be started by anyone.",
    },
    "access-audit-unavailable": {
      heading: "The access trail could not record this, so nothing was released",
      because: `Every read and write here is recorded, and one that cannot be recorded does not happen — that is the bargain, not a fault in this screen. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Trying again once the trail is available. Nothing about this draft has to be entered twice.",
    },
    "invalid-request": {
      heading: "The service would not read this request",
      because: `The request did not become one the service could act on, so it refused it before anything was checked. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Checking the dates and details on this screen, then trying again.",
    },
    "request-body-too-large": {
      heading: "This submission is larger than the service accepts",
      because: `The service holds a size limit on every request, and this one is over it. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Shortening the identifiers or the reason for the first-contact day, then trying again.",
    },
    "first-contact-invalid-date": {
      heading: "The schedule could not be built from the dates given",
      because: `The first-contact day is not a real date, so no schedule could be worked out and nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Choosing a first-contact day from the range this screen offers.",
    },
    "first-contact-out-of-range": {
      heading: "The schedule could not be built from the dates given",
      because: `The first-contact day is outside the range this programme allows, so no schedule could be worked out and nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Choosing a first-contact day inside the range this screen offers.",
    },
    "first-contact-reason-required": {
      heading: "The schedule could not be built without a reason for the moved day",
      because: `The first contact is not on the usual day, and a day that has been moved is recorded with the reason it moved. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Writing why the day was moved, or putting the first contact back on the usual day.",
    },
    "first-contact-reason-too-long": {
      heading: "The schedule could not be built because the reason is too long",
      because: `The reason is longer than this programme records. It is refused whole rather than cut short, because a clinical reason cut off mid-sentence can say the opposite of what was written. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Shortening the reason to a few sentences, then trying again.",
    },
    "unknown-sending-preference": {
      heading: "The schedule could not be built from the sending preference",
      because: `The preference held for this sign-up is not one this programme sends at, so no send times could be worked out and nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Going back to the personalisation stage and choosing when in the day messages go out.",
    },
    "invalid-discharge-instant": {
      heading: "The schedule could not be built from the discharge day",
      because: `Every date in the plan is counted from the discharge day, and the day held for this sign-up is not one a calendar recognises. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Entering the discharge day again as a real date.",
    },
    "contacts-not-strictly-increasing": {
      heading: "The schedule could not be built without two messages on one day",
      because: `The dates given would have put two caring contacts on the same day, which this programme never does, so the schedule was refused whole. Nothing was created. ${DRAFT_SURVIVED}`,
      changedBy: "Choosing a different first-contact day, or checking the discharge day is the one you meant.",
    },
    "request-did-not-reach-the-service": {
      heading: "This did not reach the service",
      because: `The request did not complete, so the service was never asked and nothing was created. This is what a lost connection looks like from here. ${DRAFT_SURVIVED}`,
      changedBy:
        "Trying again. Retrying is deliberately harmless: this sign-up reuses the same identifiers, so a plan cannot be created twice.",
    },
    "service-answered-with-something-unreadable": {
      heading: "The service's answer could not be read",
      because: `Something came back that this screen could not understand, so it will not claim the plan was created and it will not claim it was not. ${DRAFT_SURVIVED}`,
      changedBy:
        "Checking the patient's own screen for a plan before trying again. Retrying is harmless either way — this sign-up reuses the same identifiers.",
    },
  }),
);

export function submissionRefusalWording(refusal: string): SubmissionRefusalWording {
  const known = REFUSAL_WORDING[refusal];
  if (known !== undefined) return known;
  return {
    heading: "The service refused this, and gave a reason this screen has not been taught",
    // The refusal is NAMED. An unrecognised reason is still a fact somebody can act on, and hiding
    // it behind a general apology is how a support call starts from nothing.
    because: `The service refused the write and named the reason "${refusal}". This screen has no plain-words explanation for that one, so the reason is given as the service gave it. Nothing was created. ${DRAFT_SURVIVED}`,
    changedBy:
      "Passing that reason on to whoever supports this service. Retrying is harmless — this sign-up reuses the same identifiers, so a plan cannot be created twice.",
  };
}

/**
 * What each kind of message in the schedule is called.
 *
 * A SECOND COPY OF `MESSAGE_TYPE_LABELS` IN `patient-overview.tsx`, AND IT IS STATED RATHER THAN
 * PRETENDED AWAY. That module cannot be imported here: it reads `repository.ts`, which names the
 * service-state module, and `tests/caring-contacts-explained-automation.dom.test.tsx` scans this
 * wizard's whole client module graph for exactly that name. So the two screens hold the same three
 * strings and nothing keeps them in step. The right home is a module both can import — see the Task
 * 9 report, which names it as a seam rather than leaving the duplication for the next reader to
 * discover.
 *
 * The closing message has its own label because it is its own kind: it ends the plan and is not one
 * more caring contact. Calling it one would overstate the plan by one message.
 */
export const PLANNED_MESSAGE_TYPE_LABELS: Readonly<Record<PlannedContact["messageType"], string>> = Object.freeze({
  first: "First message",
  standard: "Caring contact",
  closing: "Closing message",
});

/**
 * The schedule summary as a sentence, built from what was measured.
 *
 * Ruling [94]: the invariant is stated and the number is not restated in prose around it. The
 * numbers here ARE the measurement — they come from `plannedScheduleSummary` above, which comes
 * from the domain — so this is the one place a count belongs.
 */
export function plannedScheduleSentence(summary: PlannedScheduleSummary): string {
  const entries = `${summary.total} ${summary.total === 1 ? "entry" : "entries"}`;
  if (summary.willNotBeSent === 0) return `${entries}, and every one of them will be sent.`;
  return `${entries}: ${summary.stillToSend} still to send, and ${summary.willNotBeSent} that will not be sent.`;
}

/** The refusal names this screen uses for a failure that never reached the service. */
export const TRANSPORT_REFUSALS = Object.freeze({
  didNotReach: "request-did-not-reach-the-service",
  unreadableAnswer: "service-answered-with-something-unreadable",
});
