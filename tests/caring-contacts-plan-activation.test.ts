// tests/caring-contacts-plan-activation.test.ts
//
// What stage 4 collects, what it derives, and the body it sends (Phase 2B Task 9).
//
// The module under test is pure — no React, no storage, no fetch — because every decision in it is
// a decision about a VALUE, and the wizard is a Client Component whose DOM tests cannot prove a
// value cheaply. What is pinned here, and why each one:
//
//   * Ruling [120] — the plan id and the idempotency key are minted ONCE and reused, and both must
//     survive the audit trail's own guards. A minted id the trail refuses would switch off the
//     audit record for the one write this whole workspace performs.
//   * Ruling [121] — `dischargeAt` is collected here, and the instant it becomes must land on the
//     AWST calendar day the clinician chose.
//   * Ruling [118] — the first-contact day, its range, its reason, and the CONSEQUENCE of moving
//     it: at discharge + 7 the Week 1 contact is absorbed and the plan sends nine, not ten.
//   * Ruling [119] — every count is derived. The strongest available pin is here: the preview the
//     screen shows is compared against `summariseStoredContacts` over the contacts the store
//     ACTUALLY creates from the same input, so a preview that agreed only with itself goes red.
//
// `createPlanRequestBody` is likewise not checked against a copy of the schema. The body it builds
// is POSTed to the real route handler, so `.strict()`, every `min(1)` and the `auditableIdentifier`
// shape are all enforced by the thing that will enforce them in production.
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ store: { current: null as unknown } }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => mockCookies[name] })),
}));

vi.mock("@/lib/caring-contacts-server/store", () => ({
  caringContactsStore: async () => mocks.store.current,
}));

import {
  EMPTY_PLAN_ACTIVATION,
  createPlanRequestBody,
  dischargeInstantFor,
  firstContactReasonIsRequired,
  mintPlanSubmissionIdentity,
  planSchedulePreview,
  submissionRefusalWording,
  type PlanActivationDraft,
} from "@/components/caring-contacts/workspace/plan-wizard/plan-activation";
import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import { buildAccessAuditEvent } from "@/lib/caring-contacts/access-audit";
import { awstCalendarDay, fixedClock } from "@/lib/caring-contacts/clock";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import {
  actorId,
  idempotencyKey,
  patientId,
  planId,
  referralId,
  pathwayVersionId,
  teamId,
} from "@/lib/caring-contacts/ids";
import { summariseStoredContacts } from "@/lib/caring-contacts/repository";
import {
  buildApprovedSchedule,
  firstContactDayBounds,
  FIRST_CONTACT_REASON_MAX_LENGTH,
} from "@/lib/caring-contacts/schedule";

let mockCookies: Record<string, { value: string } | undefined> = {};

afterEach(() => {
  vi.restoreAllMocks();
});

const DISCHARGE_DAY = "2026-03-10";
const NOW = "2026-03-10T03:00:00.000Z";

const PATIENT_DETAIL = {
  patientName: "Rowan Example",
  patientMobileNumber: "+61 491 570 156",
  patientIdentifiers: ["UR-00219384"],
  culturalIdentity: null,
};

function activation(overrides: Partial<PlanActivationDraft> = {}): PlanActivationDraft {
  return { ...EMPTY_PLAN_ACTIVATION, dischargeDay: DISCHARGE_DAY, ...overrides };
}

function bounds() {
  const resolved = firstContactDayBounds(DISCHARGE_DAY);
  if (resolved === null) throw new Error("the fixture discharge day is not a calendar day");
  return resolved;
}

function ready(preview: ReturnType<typeof planSchedulePreview>) {
  if (preview.kind !== "ready") throw new Error(`expected a ready preview, got ${preview.kind}`);
  return preview;
}

describe("minting the plan id and the idempotency key (Ruling [120])", () => {
  it("mints a different pair every time it is called", () => {
    const first = mintPlanSubmissionIdentity();
    const second = mintPlanSubmissionIdentity();

    // The wrong value this rejects: a constant. A fixed plan id would make the SECOND patient
    // signed up on this machine collide with the first, and the collision is refused as a replay —
    // so the second clinician's plan would silently never be created.
    expect(first.planId).not.toBe(second.planId);
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    // And the two halves of one pair are not the same value either: one key covering one plan is
    // the contract, but a key that IS the plan id would make a retry of a different write on the
    // same plan collide with the create.
    expect(first.planId).not.toBe(first.idempotencyKey);
  });

  it("mints identifiers the audit trail itself accepts", () => {
    // NOT a regex written here. `buildAccessAuditEvent` applies the id-shape allowlist AND the
    // audit event's own mobile-number scan, and either of them throwing means the write this
    // screen performs would leave no audit record. The wrong value this rejects is an id
    // containing a run of digits that reads as an Australian mobile number — which a random
    // hexadecimal identifier can produce.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const minted = mintPlanSubmissionIdentity();
      for (const value of [minted.planId, minted.idempotencyKey]) {
        expect(() =>
          buildAccessAuditEvent(
            {
              actorId: actorId("demo-coordinator"),
              actorRoles: ["coordinator"],
              teamId: teamId("SYN-TEAM-001"),
              kind: "mutation",
              objectType: "plan",
              objectId: value,
              outcome: "denied",
            },
            fixedClock(NOW),
          ),
        ).not.toThrow();
        // Belt and braces, and it is the property that makes the guard above unable to fail: no
        // digits at all means no digit run can ever read as a phone number.
        expect(value, "a minted identifier carries a digit, so it could one day read as a number").not.toMatch(/\d/);
      }
    }
  });
});

describe("the discharge day stage 4 collects (Ruling [121])", () => {
  it("turns a chosen AWST day into an instant that falls on that same AWST day", () => {
    const instant = dischargeInstantFor(DISCHARGE_DAY);
    expect(instant).not.toBeNull();
    // The wrong value this rejects: UTC midnight for the chosen day, which in AWST is 8am the same
    // day, and for any wall time before 08:00 AWST is the day BEFORE.
    // `buildApprovedSchedule` hangs the entire twelve-month calendar off the AWST day of this
    // instant, so a day out is a year of dates out.
    expect(awstCalendarDay(instant!)).toBe(DISCHARGE_DAY);
  });

  it("answers null for anything that is not a real AWST calendar day", () => {
    expect(dischargeInstantFor("")).toBeNull();
    expect(dischargeInstantFor("2026-02-30")).toBeNull();
    expect(dischargeInstantFor("10/03/2026")).toBeNull();
  });
});

describe("the schedule preview stage 4 derives (Rulings [118] and [119])", () => {
  it("says what is missing rather than previewing a schedule it cannot build", () => {
    const noDischarge = planSchedulePreview({ activation: EMPTY_PLAN_ACTIVATION, sendingPreference: "morning" });
    expect(noDischarge.kind).toBe("incomplete");
    if (noDischarge.kind === "incomplete") {
      expect(noDischarge.issues.map((issue) => issue.code)).toEqual(["discharge-day-required"]);
    }

    const badDischarge = planSchedulePreview({
      activation: activation({ dischargeDay: "2026-02-30" }),
      sendingPreference: "morning",
    });
    expect(badDischarge.kind).toBe("incomplete");
    if (badDischarge.kind === "incomplete") {
      expect(badDischarge.issues.map((issue) => issue.code)).toEqual(["discharge-day-invalid"]);
    }

    const noPreference = planSchedulePreview({ activation: activation(), sendingPreference: null });
    expect(noPreference.kind).toBe("incomplete");
    if (noPreference.kind === "incomplete") {
      expect(noPreference.issues.map((issue) => issue.code)).toEqual(["sending-preference-required"]);
    }
  });

  it("previews the usual day as ten entries, of which one is the closing message", () => {
    const preview = ready(planSchedulePreview({ activation: activation(), sendingPreference: "morning" }));

    expect(preview.firstContactDay).toBe(bounds().usual);
    expect(preview.movedFromUsualDay).toBe(false);
    // Ruling [98]/[119]: derived, never the mockup's literal. The wrong value this rejects is the
    // "10-contact schedule" heading — ten ENTRIES is right, ten caring contacts is not, because the
    // last one is a closing message.
    expect(preview.summary.total).toBe(10);
    expect(preview.summary.stillToSend).toBe(10);
    expect(preview.summary.willNotBeSent).toBe(0);
    expect(preview.summary.closing).toBe(1);
  });

  it("previews discharge + 7 as NINE messages, because Week 1 is absorbed (Ruling [118])", () => {
    const preview = ready(
      planSchedulePreview({
        activation: activation({
          firstContactDay: bounds().latest,
          firstContactReason: "The ward agreed this day with the patient before discharge.",
        }),
        sendingPreference: "morning",
      }),
    );

    // This is the consequence the clinician must see BEFORE the choice is committed. The wrong
    // value it rejects is ten — the count every other day in the range produces, and the count the
    // approved mockup writes as a literal.
    expect(preview.summary.total).toBe(10);
    expect(preview.summary.stillToSend).toBe(9);
    expect(preview.summary.willNotBeSent).toBe(1);
    expect(preview.absorbed.map((contact) => contact.cadenceLabel)).toEqual(["Week 1"]);
    expect(preview.movedFromUsualDay).toBe(true);
  });

  it("agrees with the contacts the store actually creates, on both the usual day and discharge + 7", async () => {
    // RULING [119], and the only pin here that can fail honestly. Every other assertion in this
    // file compares the preview against numbers written here; this one compares it against
    // `summariseStoredContacts` — one of the two functions the ruling names — over a plan the
    // in-memory store really built from the same input. A preview that counted its own way would
    // disagree here even while agreeing with itself everywhere else.
    for (const [label, chosen, reason] of [
      ["the usual day", "", ""],
      ["discharge + 7", bounds().latest, "The ward agreed this day with the patient before discharge."],
    ] as const) {
      const draft = activation({ firstContactDay: chosen, firstContactReason: reason });
      const preview = ready(planSchedulePreview({ activation: draft, sendingPreference: "morning" }));

      const store = createInMemoryRepository(fixedClock(NOW));
      const created = await store.createPlan(
        {
          planId: planId("SYN-PLAN-PREVIEW"),
          referralId: referralId("SYN-REFERRAL-001"),
          patientId: patientId("SYN-PATIENT-001"),
          pathwayVersionId: pathwayVersionId("SYN-PATHWAY-001"),
          dischargeAt: dischargeInstantFor(DISCHARGE_DAY)!,
          sendingPreference: "morning",
          firstContactDate: chosen === "" ? undefined : chosen,
          firstContactReason: reason === "" ? undefined : reason,
          patientDetail: PATIENT_DETAIL,
        },
        { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("preview-create") },
      );
      if (!created.ok) throw new Error(`${label}: the store refused the same input (${created.reason})`);

      const stored = summariseStoredContacts(created.value.contacts);
      expect(preview.summary.total, `${label}: the preview counts a different number of entries`).toBe(stored.total);
      expect(preview.summary.stillToSend, `${label}: the preview promises a different number of messages`).toBe(
        stored.stillToSend,
      );
      expect(preview.summary.willNotBeSent, `${label}: the preview hides a message the store will not send`).toBe(
        stored.willNotBeSent,
      );
      expect(preview.contacts.map((contact) => contact.calendarDay)).toEqual(
        created.value.contacts.map((entry) => entry.planned.calendarDay),
      );
    }
  });

  it("names the schedule's own refusal rather than deciding for itself that a value is wrong", () => {
    const moved = { firstContactDay: bounds().latest };

    const noReason = planSchedulePreview({ activation: activation(moved), sendingPreference: "morning" });
    expect(noReason.kind).toBe("refused");
    if (noReason.kind === "refused") expect(noReason.refusal).toBe("first-contact-reason-required");

    const tooLong = planSchedulePreview({
      activation: activation({ ...moved, firstContactReason: "x".repeat(FIRST_CONTACT_REASON_MAX_LENGTH + 1) }),
      sendingPreference: "morning",
    });
    expect(tooLong.kind).toBe("refused");
    if (tooLong.kind === "refused") expect(tooLong.refusal).toBe("first-contact-reason-too-long");

    const outOfRange = planSchedulePreview({
      activation: activation({ firstContactDay: "2026-03-20", firstContactReason: "Agreed with the ward." }),
      sendingPreference: "morning",
    });
    expect(outOfRange.kind).toBe("refused");
    if (outOfRange.kind === "refused") expect(outOfRange.refusal).toBe("first-contact-out-of-range");

    // A reason of exactly the maximum length is accepted, so "too long" means longer than the limit
    // rather than at it — the wrong value that rejects is an off-by-one refusing a reason the
    // domain takes.
    const atCap = planSchedulePreview({
      activation: activation({ ...moved, firstContactReason: "x".repeat(FIRST_CONTACT_REASON_MAX_LENGTH) }),
      sendingPreference: "morning",
    });
    expect(atCap.kind).toBe("ready");
  });
});

describe("when the screen asks for a reason (Ruling [118])", () => {
  it("asks for one on exactly the days the schedule refuses without one", () => {
    // The property, not a copy of the rule. For every day the control can offer, the screen's
    // decision to show the reason field must agree with what `buildApprovedSchedule` does when no
    // reason is supplied. The wrong value this rejects is "ask on every moved day except the
    // earliest", or any other off-by-one at the ends of the range.
    const range = bounds();
    const offered = daysFrom(range.earliest, range.latest);
    expect(offered.length, "the range under test collapsed to nothing").toBeGreaterThan(2);

    for (const day of offered) {
      const refusedWithoutReason =
        buildApprovedSchedule({
          dischargeAt: dischargeInstantFor(DISCHARGE_DAY)!,
          sendingPreference: "morning",
          firstContactDate: day,
        }).ok === false;

      expect(
        firstContactReasonIsRequired({ dischargeDay: DISCHARGE_DAY, firstContactDay: day }),
        `${day}: the screen and the schedule disagree about whether a reason is required`,
      ).toBe(refusedWithoutReason);
    }
  });

  it("asks for none while no day has been chosen, because the usual day needs none", () => {
    expect(firstContactReasonIsRequired({ dischargeDay: DISCHARGE_DAY, firstContactDay: "" })).toBe(false);
    expect(firstContactReasonIsRequired({ dischargeDay: "", firstContactDay: "" })).toBe(false);
  });
});

describe("the body stage 4 sends", () => {
  it("is accepted by the real route, which is what proves it matches the schema", async () => {
    mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: "coordinator" } };
    mocks.store.current = createInMemoryRepository(fixedClock(NOW));

    const minted = mintPlanSubmissionIdentity();
    const body = createPlanRequestBody({
      submission: minted,
      referralId: "SYN-REFERRAL-001",
      patientId: "SYN-PATIENT-001",
      pathwayVersionId: "SYN-PATHWAY-001",
      activation: activation(),
      sendingPreference: "morning",
      patientDetail: PATIENT_DETAIL,
    });
    expect(body).not.toBeNull();

    const { POST } = await import("@/app/api/caring-contacts/plans/route");
    const response = await POST(
      new NextRequest("http://localhost/api/caring-contacts/plans", { method: "POST", body: JSON.stringify(body) }),
    );

    // 400 here would mean the body failed `createPlanSchema` — the failure mode a hand-written
    // list of expected keys cannot see, because `.strict()` refuses a fifth key outright.
    expect(response.status, `the route refused the body: ${await response.clone().text()}`).toBe(200);
  });

  it("sends the day the screen showed, and omits a reason nobody had to give", () => {
    const body = createPlanRequestBody({
      submission: mintPlanSubmissionIdentity(),
      referralId: "SYN-REFERRAL-001",
      patientId: "SYN-PATIENT-001",
      pathwayVersionId: "SYN-PATHWAY-001",
      activation: activation(),
      sendingPreference: "morning",
      patientDetail: PATIENT_DETAIL,
    });

    expect(body).not.toBeNull();
    // The day is sent explicitly rather than left to the domain's default, because the screen
    // showed a specific day and the plan must be created for the day that was read back.
    expect(body!.firstContactDate).toBe(bounds().usual);
    // `firstContactReason` is `z.string().min(1).optional()`, so an empty string is REFUSED
    // outright. The wrong value this rejects is `""`.
    expect(Object.keys(body!)).not.toContain("firstContactReason");
  });

  it("refuses to build a body while anything required is missing", () => {
    const common = {
      submission: mintPlanSubmissionIdentity(),
      referralId: "SYN-REFERRAL-001",
      patientId: "SYN-PATIENT-001",
      pathwayVersionId: "SYN-PATHWAY-001" as string | null,
      activation: activation(),
      sendingPreference: "morning" as const,
      patientDetail: PATIENT_DETAIL,
    };

    expect(createPlanRequestBody({ ...common, submission: null })).toBeNull();
    expect(createPlanRequestBody({ ...common, patientDetail: null })).toBeNull();
    expect(createPlanRequestBody({ ...common, sendingPreference: null })).toBeNull();
    expect(createPlanRequestBody({ ...common, activation: EMPTY_PLAN_ACTIVATION })).toBeNull();
    expect(createPlanRequestBody({ ...common, pathwayVersionId: null })).toBeNull();
  });
});

describe("what the screen says when the write is refused (Ruling [117])", () => {
  it("tells the three kinds of refusal apart, in words", () => {
    const denied = submissionRefusalWording("action-not-granted");
    const exists = submissionRefusalWording("duplicate-active-plan");
    const schedule = submissionRefusalWording("first-contact-reason-required");

    // The three the ruling names must not read alike, and the wrong value this rejects is one
    // sentence reused for all of them.
    expect(new Set([denied.heading, exists.heading, schedule.heading]).size).toBe(3);
    expect(denied.heading).toMatch(/not allowed|not permitted|cannot/i);
    expect(exists.heading).toMatch(/already/i);
    expect(schedule.heading).toMatch(/schedule/i);
  });

  it("never says only that something went wrong, whatever the refusal is called", () => {
    // The failure this exists to prevent, stated as a property over every refusal the boundary can
    // produce plus one it cannot. A default reading "Something went wrong" would pass a check that
    // only looked at named refusals.
    const named = [
      "not-found",
      "permission-denied",
      "cross-team-denied",
      "action-not-granted",
      "no-roles",
      "stale-version",
      "duplicate-active-plan",
      "plan-already-exists",
      "idempotency-key-reused-for-a-different-write",
      "service-stopped",
      "invalid-request",
      "request-body-too-large",
      "access-audit-unavailable",
      "first-contact-invalid-date",
      "first-contact-out-of-range",
      "first-contact-reason-required",
      "first-contact-reason-too-long",
      "unknown-sending-preference",
      "invalid-discharge-instant",
      "contacts-not-strictly-increasing",
      "a-refusal-nobody-has-written-yet",
    ];
    for (const refusal of named) {
      const wording = submissionRefusalWording(refusal);
      expect(wording.heading, `${refusal} is not explained`).not.toMatch(/something went wrong/i);
      expect(wording.because.length, `${refusal} has no reason`).toBeGreaterThan(20);
      expect(wording.changedBy.length, `${refusal} has no remedy`).toBeGreaterThan(10);
      // Every refusal must say the draft is still here. A clinician who has typed a name, a mobile
      // number and identifiers needs to know they have not lost them.
      expect(`${wording.because} ${wording.changedBy}`, `${refusal} does not say the draft survived`).toMatch(
        /still on this computer/i,
      );
    }

    // The unnamed one still names ITSELF, so an unmapped refusal is legible rather than mute.
    expect(submissionRefusalWording("a-refusal-nobody-has-written-yet").because).toContain(
      "a-refusal-nobody-has-written-yet",
    );
  });
});

/** Every calendar day from `from` to `to` inclusive. */
function daysFrom(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  for (let guard = 0; guard < 40 && cursor <= to; guard += 1) {
    days.push(cursor);
    const [year, month, day] = cursor.split("-").map(Number);
    cursor = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  }
  return days;
}
