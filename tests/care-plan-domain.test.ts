import { describe, expect, it } from "vitest";

import {
  BANNED_ADMISSION_CONSTRUCTIONS,
  PRESENTATION_ACTIVITY_WINDOW_MONTHS,
  assertSingleCurrentVersion,
  buildCmhtMailto,
  buildCmhtTel,
  buildPatientSnapshot,
  canPerformAction,
  countPresentationActivity,
  deriveReviewState,
  getCurrentManagementPlanVersion,
  getCurrentSafetyPlanVersion,
  getOpenManagementDraft,
  getPatientById,
  getReviewQueues,
  searchPatients,
} from "@/components/care-plan/mockups/domain";
import {
  PROTOTYPE_NOW,
  identificationPolicy,
  publicCrisisContacts,
  syntheticCmhtContacts,
  syntheticEdPresentations,
  syntheticEdSites,
  syntheticIdentificationReviews,
  syntheticManagementPlanVersions,
  syntheticManagementPlans,
  syntheticPatients,
  syntheticPersonalSafetyPlanVersions,
  syntheticPersonalSafetyPlans,
  syntheticPresentationAmendments,
  syntheticReviewTriggers,
  syntheticUsers,
} from "@/components/care-plan/mockups/fixtures";
import {
  FIRST_MINUTE_CONTENT_KEYS,
  MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS,
  type EdPresentation,
  type ManagementPlanContent,
  type ManagementPlanVersion,
  type PatientSnapshotSource,
  type PrototypeRole,
  type ReviewQueues,
} from "@/components/care-plan/mockups/types";

const fixtureBundle = {
  syntheticUsers,
  syntheticPatients,
  syntheticEdSites,
  syntheticCmhtContacts,
  syntheticManagementPlans,
  syntheticManagementPlanVersions,
  syntheticPersonalSafetyPlans,
  syntheticPersonalSafetyPlanVersions,
  syntheticEdPresentations,
  syntheticPresentationAmendments,
  syntheticReviewTriggers,
  syntheticIdentificationReviews,
  identificationPolicy,
  publicCrisisContacts,
};

const snapshotSource: PatientSnapshotSource = {
  patients: syntheticPatients,
  cmhtContacts: syntheticCmhtContacts,
  managementPlans: syntheticManagementPlans,
  managementPlanVersions: syntheticManagementPlanVersions,
  personalSafetyPlans: syntheticPersonalSafetyPlans,
  personalSafetyPlanVersions: syntheticPersonalSafetyPlanVersions,
  edPresentations: syntheticEdPresentations,
};

const serialisedFixtures = JSON.stringify(fixtureBundle);

function collectStrings(value: unknown, keyFilter: (key: string) => boolean, into: string[], key = ""): void {
  if (typeof value === "string") {
    if (keyFilter(key)) into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, keyFilter, into, key);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectStrings(childValue, keyFilter, into, childKey);
    }
  }
}

// --- Clinical-language guards -------------------------------------------------
// Each guard is a predicate so the tests can prove it rejects a bad line before
// asserting that every fixture line passes it. A guard that cannot fail reports
// confidence it has not earned.

const PERSON_REFERENCE =
  /\b(he|she|they|him|her|them|his|hers|their|theirs|the patient|the person|rowan|mira|jordan|evelyn|evie|alex)\b/i;
const OPENS_WITH_PERSON =
  /^\s*(he|she|they|his|her|their|the patient|the person|rowan|mira|jordan|evelyn|evie|alex)\b/i;
const BLAMING_TERM =
  /\b(aggressive|aggression|agitated|abusive|hostile|threatening|violent|demanding|difficult|manipulative|uncooperative|non-cooperative|disruptive|attention[- ]seeking|drug[- ]seeking|refuses|refusing|non-compliant|escalates|kicks off|lashes out|acts out|plays up|challenging behaviour|behavioural)\b/i;

/**
 * `What makes it worse` must describe what the service does. A line fails when
 * the person is its subject, or when it pairs any reference to the person with a
 * word that attributes bad behaviour to them. A response to circumstances — "her
 * back pain builds and she cannot concentrate" — is allowed, as the spec requires.
 */
function describesTheService(line: string): boolean {
  if (OPENS_WITH_PERSON.test(line)) return false;
  return !(PERSON_REFERENCE.test(line) && BLAMING_TERM.test(line));
}

const CONCRETE_FINDING =
  /\b(chest pain|breathless|fever|head injury|head strike|seizure|fall|confusion|disorient|conscious state|drowsi|limb weakness|slurred speech|facial droop|delirium|infection|medicine|medication|overdose|pregnan|attempt|means and preparation|means or preparation|safeguarding|self-harm|physical symptom|nowhere safe)\b/i;

/**
 * `What would make this different` must name a finding a clinician could observe,
 * not an instruction to be careful. Generic caution passes no clinical decision to
 * anyone, and this is the section that voids the plan.
 */
function namesConcreteFindings(line: string): boolean {
  return line.trim().length > 25 && CONCRETE_FINDING.test(line);
}

/**
 * `What we have agreed` must name who agreed the position and when, in one clause,
 * so neither half can be satisfied by an unrelated sentence elsewhere in the block.
 */
const AGREED_WITH_NAMED_PARTIES_AND_DATE =
  /\bagreed\s+(?:with|between|by)\s+[^.;]{3,140}?\bon\s+\d{1,2}\s+[A-Za-z]+\s+20\d{2}/i;

describe("Care Plan identification policy", () => {
  it("keeps identification policy governance-pending without a numeric rule", () => {
    expect(identificationPolicy).toEqual({
      id: "SYN-IDENTIFICATION-POLICY-001",
      status: "pending_governance",
      thresholdCount: null,
      thresholdLookbackMonths: null,
      manualReferralEnabled: true,
      explanation: expect.stringMatching(/local clinical and privacy governance/i),
    });
  });
});

describe("Care Plan patient search", () => {
  it.each([
    ["Rowan", "SYN-PATIENT-001"],
    ["SYN-MRN-0001", "SYN-PATIENT-001"],
    ["1986-04-12", "SYN-PATIENT-001"],
    ["Ro", "SYN-PATIENT-001"],
  ])("finds a patient by supported synthetic identity field", (query, patientId) => {
    expect(searchPatients(syntheticPatients, query).map(({ id }) => id)).toContain(patientId);
  });

  it("matches the Australian display date of birth and a recorded alias", () => {
    expect(searchPatients(syntheticPatients, "12/04/1986").map(({ id }) => id)).toEqual(["SYN-PATIENT-001"]);
    expect(searchPatients(syntheticPatients, "Ro Sample").map(({ id }) => id)).toEqual(["SYN-PATIENT-001"]);
  });

  it("trims and case-folds the query before matching", () => {
    expect(searchPatients(syntheticPatients, "   rOwAn   ").map(({ id }) => id)).toEqual(["SYN-PATIENT-001"]);
  });

  it("returns nothing for an empty query rather than the whole directory", () => {
    expect(searchPatients(syntheticPatients, "   ")).toEqual([]);
  });

  it("never searches plan, presentation, safety-plan or other clinical text", () => {
    const rowan = getPatientById(syntheticPatients, "SYN-PATIENT-001");
    expect(rowan?.fullName).toBe("Rowan Sample");

    const currentVersion = getCurrentManagementPlanVersion(syntheticManagementPlanVersions, "SYN-MGMT-PLAN-001");
    const clinicalPhrase = currentVersion?.content.whatHelps[0]?.split(" ").slice(0, 3).join(" ") ?? "";
    expect(clinicalPhrase.length).toBeGreaterThan(4);
    expect(searchPatients(syntheticPatients, clinicalPhrase)).toEqual([]);

    expect(searchPatients(syntheticPatients, "corridor")).toEqual([]);
    expect(searchPatients(syntheticPatients, "North River Hospital ED")).toEqual([]);
  });

  it("returns null for an unknown patient identifier", () => {
    expect(getPatientById(syntheticPatients, "SYN-PATIENT-404")).toBeNull();
  });
});

describe("Care Plan management plan version selection", () => {
  it("keeps exactly one Current version per plan", () => {
    expect(() => assertSingleCurrentVersion(syntheticManagementPlanVersions)).not.toThrow();

    const current = syntheticManagementPlanVersions.find(({ state }) => state === "current");
    expect(current).toBeDefined();
    const duplicated: ManagementPlanVersion[] = [
      current as ManagementPlanVersion,
      { ...(current as ManagementPlanVersion), id: "SYN-MGMT-VERSION-999" },
    ];
    expect(() => assertSingleCurrentVersion(duplicated)).toThrow(/more than one current version/i);
  });

  it("keeps a submitted draft separate from the Current version it would replace", () => {
    const current = getCurrentManagementPlanVersion(syntheticManagementPlanVersions, "SYN-MGMT-PLAN-002");
    const open = getOpenManagementDraft(syntheticManagementPlanVersions, "SYN-MGMT-PLAN-002");

    expect(current?.state).toBe("current");
    expect(open?.state).toBe("awaiting_approval");
    expect(open?.id).not.toBe(current?.id);
    expect(open?.version).toBeGreaterThan(current?.version ?? 0);
  });

  it("reports no Current version for a plan whose only version was withdrawn", () => {
    expect(getCurrentManagementPlanVersion(syntheticManagementPlanVersions, "SYN-MGMT-PLAN-004")).toBeNull();
    expect(getOpenManagementDraft(syntheticManagementPlanVersions, "SYN-MGMT-PLAN-004")).toBeNull();
  });

  it("returns the Current Personal Safety Plan version independently of management approval", () => {
    const safety = getCurrentSafetyPlanVersion(syntheticPersonalSafetyPlanVersions, "SYN-SAFETY-PLAN-004");
    expect(safety?.state).toBe("current");
    expect(getCurrentManagementPlanVersion(syntheticManagementPlanVersions, "SYN-MGMT-PLAN-004")).toBeNull();

    expect(getCurrentSafetyPlanVersion(syntheticPersonalSafetyPlanVersions, "SYN-SAFETY-PLAN-003")).toBeNull();
  });
});

describe("Care Plan review clock", () => {
  const reviewDueAt = "2026-09-01T09:00:00+08:00";

  it.each([
    ["2026-08-04T08:59:59.999+08:00", "within_review"],
    ["2026-08-04T09:00:00+08:00", "due_soon"],
    ["2026-09-01T09:00:00+08:00", "due_soon"],
    ["2026-09-01T09:00:00.001+08:00", "overdue"],
  ])("pins the review-state boundaries at %s", (now, expected) => {
    expect(deriveReviewState(reviewDueAt, now)).toBe(expected);
  });

  it("treats an unreadable review date as overdue rather than as reassuring", () => {
    // Failure degrades conservatively: a date the application cannot read must
    // send someone to look at the plan, not present as the safest state.
    expect(deriveReviewState("not a date", PROTOTYPE_NOW)).toBe("overdue");
    expect(deriveReviewState("", PROTOTYPE_NOW)).toBe("overdue");
    expect(deriveReviewState("2026-09-01T09:00:00+08:00", "not a date")).toBe("overdue");
  });

  // Review state is never stored on a version, so these pin that each fixture's
  // own reviewDueAt still derives the state its scenario is meant to demonstrate.
  it.each([
    ["SYN-MGMT-VERSION-002", "within_review"],
    ["SYN-MGMT-VERSION-003", "overdue"],
  ])("derives the intended review state for management version %s", (id, expected) => {
    const version = syntheticManagementPlanVersions.find((candidate) => candidate.id === id);
    expect(version?.reviewDueAt).toBeTruthy();
    expect(deriveReviewState(version?.reviewDueAt as string, PROTOTYPE_NOW)).toBe(expected);
  });

  it.each([
    ["SYN-SAFETY-VERSION-001", "due_soon"],
    ["SYN-SAFETY-VERSION-002", "within_review"],
    ["SYN-SAFETY-VERSION-004", "within_review"],
  ])("derives the intended review state for safety plan version %s", (id, expected) => {
    const version = syntheticPersonalSafetyPlanVersions.find((candidate) => candidate.id === id);
    expect(version?.reviewDueAt).toBeTruthy();
    expect(deriveReviewState(version?.reviewDueAt as string, PROTOTYPE_NOW)).toBe(expected);
  });

  it("covers all three review states across the fixture set", () => {
    const derived = [...syntheticManagementPlanVersions, ...syntheticPersonalSafetyPlanVersions]
      .filter(({ reviewDueAt }) => reviewDueAt !== null)
      .map(({ reviewDueAt }) => deriveReviewState(reviewDueAt as string, PROTOTYPE_NOW));

    expect(new Set(derived)).toEqual(new Set(["within_review", "due_soon", "overdue"]));
  });
});

describe("Care Plan presentation activity", () => {
  it("derives Rowan's rolling twelve-month count from presentation timestamps alone", () => {
    const activity = countPresentationActivity(syntheticEdPresentations, "SYN-PATIENT-001", PROTOTYPE_NOW);
    const allRowanPresentations = syntheticEdPresentations.filter(({ patientId }) => patientId === "SYN-PATIENT-001");

    expect(activity.total).toBe(7);
    expect(activity.windowMonths).toBe(PRESENTATION_ACTIVITY_WINDOW_MONTHS);
    expect(activity.windowStart).toBe("2025-08-20T14:30:00+08:00");
    expect(activity.windowEnd).toBe(PROTOTYPE_NOW);
    expect(allRowanPresentations.length).toBe(8);
    expect(activity.bySite.reduce((sum, { count }) => sum + count, 0)).toBe(activity.total);
  });

  it("excludes a presentation that sits exactly on the window start", () => {
    const template = syntheticEdPresentations[0] as EdPresentation;
    const onBoundary: EdPresentation = {
      ...template,
      id: "SYN-PRESENTATION-901",
      patientId: "SYN-PATIENT-001",
      arrivedAt: "2025-08-20T14:30:00+08:00",
    };
    const justInside: EdPresentation = {
      ...onBoundary,
      id: "SYN-PRESENTATION-902",
      arrivedAt: "2025-08-20T14:30:00.001+08:00",
    };

    expect(countPresentationActivity([onBoundary], "SYN-PATIENT-001", PROTOTYPE_NOW).total).toBe(0);
    expect(countPresentationActivity([justInside], "SYN-PATIENT-001", PROTOTYPE_NOW).total).toBe(1);
  });

  it("counts only the named patient's own episodes", () => {
    expect(countPresentationActivity(syntheticEdPresentations, "SYN-PATIENT-404", PROTOTYPE_NOW).total).toBe(0);
  });
});

describe("Care Plan contact actions", () => {
  it("builds a generic CMHT email intent without patient information", () => {
    const contact = syntheticCmhtContacts[0]!;
    const href = buildCmhtMailto(contact);
    expect(href).toBe("mailto:north-river.cmht@example.org?subject=Care+Plan+%E2%80%94+team+contact+request");
    expect(href).not.toMatch(/Rowan|SYN-MRN|1986|presentation|management plan/i);
  });

  it("carries no patient field in any contact URI it can build", () => {
    const patientFields = syntheticPatients.flatMap((patient) => [
      patient.fullName,
      patient.preferredName,
      patient.mrn,
      patient.dateOfBirth,
      ...patient.aliases,
    ]);

    for (const contact of syntheticCmhtContacts) {
      const uris = [buildCmhtMailto(contact), buildCmhtTel(contact), buildCmhtTel(contact, "after_hours")];
      for (const uri of uris) {
        for (const field of patientFields) {
          expect(uri.toLowerCase()).not.toContain(field.toLowerCase());
        }
      }
    }
  });

  it("builds telephone intents from the displayed duty and after-hours numbers", () => {
    const contact = syntheticCmhtContacts[0]!;
    expect(buildCmhtTel(contact)).toBe(`tel:${contact.dutyTelephoneUri}`);
    expect(buildCmhtTel(contact, "after_hours")).toBe(`tel:${contact.afterHoursTelephoneUri}`);
    expect(buildCmhtTel(contact)).toMatch(/^tel:\+?\d+$/);
  });

  it("publishes only the authorised public crisis contacts", () => {
    expect(
      publicCrisisContacts.map(({ name, telephoneDisplay, isEmergencyService }) => ({
        name,
        telephoneDisplay,
        isEmergencyService,
      })),
    ).toEqual([
      { name: "Emergency services", telephoneDisplay: "000", isEmergencyService: true },
      {
        name: "Mental Health Emergency Response Line (MHERL) — Perth metropolitan",
        telephoneDisplay: "1300 555 788",
        isEmergencyService: false,
      },
      {
        name: "Mental Health Emergency Response Line (MHERL) — Peel",
        telephoneDisplay: "1800 676 822",
        isEmergencyService: false,
      },
      { name: "Rurallink", telephoneDisplay: "1800 552 002", isEmergencyService: false },
    ]);

    for (const contact of publicCrisisContacts) {
      expect(contact.verifiedOn).toBe("2026-08-20");
      expect(contact.sourceUrl).toMatch(/^https:\/\//);
      if (contact.name.includes("MHERL")) {
        expect(contact.caveat).toMatch(/not an emergency service/i);
      }
    }
  });

  it("keeps every fictional telephone number inside the reserved fiction range", () => {
    // Two rules, deliberately not one list.
    //
    // Fictional numbers: 0491 570 006 to 0491 570 156 is the ACMA range reserved for
    // drama and fiction, and (0X) 5550 XXXX is its landline equivalent. A mobile
    // outside that span is ordinary allocatable stock that could reach a real person,
    // and these numbers print onto a patient-facing safety plan. Checked as a numeric
    // range, so a number added by a later task cannot slip past a list of literals.
    //
    // Real numbers: the after-hours pathway genuinely is the public crisis service,
    // because a reader dialling it at 2am must reach a real service rather than a dead
    // number. Those are an explicit allowlist, so a fifth real number cannot be added
    // silently.
    const authorisedPublicNumbers = ["000", "1300555788", "1800676822", "1800552002"];

    const found = (serialisedFixtures.match(/\+61[\d\s]{6,}|\b0[2-9][\s\d]{7,}|\b1[38]00[\s\d]{5,}/g) ?? []).map(
      (match) => match.replace(/\s/g, "").replace(/^\+61/, "0"),
    );
    expect(found.length).toBeGreaterThan(10);

    // Guards against a broken sweep passing vacuously over an empty match set.
    const mobiles = found.filter((national) => /^04\d{8}$/.test(national));
    expect(mobiles.length).toBeGreaterThan(8);

    for (const national of mobiles) {
      const reserved = /^0491570(\d{3})$/.exec(national);
      expect(reserved, `${national} is outside the 0491 570 block reserved for fiction`).not.toBeNull();
      const suffix = Number(reserved?.[1]);
      expect(suffix, `${national} is below 0491 570 006`).toBeGreaterThanOrEqual(6);
      expect(suffix, `${national} is above 0491 570 156`).toBeLessThanOrEqual(156);
    }

    for (const national of found) {
      if (/^04\d{8}$/.test(national)) continue;
      if (/^0[2-8]5550\d{4}$/.test(national)) continue;
      expect(authorisedPublicNumbers, `${national} is not an authorised public crisis line`).toContain(national);
    }

    // The after-hours pathway must stay real: a later change must not quietly replace a
    // working crisis line with a dead fictional one.
    for (const publicNumber of ["1300555788", "1800676822", "1800552002"]) {
      expect(found, `${publicNumber} is no longer present as a verified public crisis line`).toContain(publicNumber);
    }
  });
});

describe("Care Plan review queues", () => {
  const buildQueues = (): ReviewQueues =>
    getReviewQueues({
      managementPlanVersions: syntheticManagementPlanVersions,
      reviewTriggers: syntheticReviewTriggers,
      cmhtContacts: syntheticCmhtContacts,
      identificationReviews: syntheticIdentificationReviews,
    });

  it("returns exactly the four action worklists", () => {
    expect(Object.keys(buildQueues())).toEqual([
      "awaitingApproval",
      "reviewSuggested",
      "contactVerification",
      "identificationReview",
    ]);
  });

  it("lists only submitted versions awaiting a senior decision", () => {
    expect(buildQueues().awaitingApproval.map(({ id }) => id)).toEqual(["SYN-MGMT-VERSION-004"]);
  });

  it("orders open review triggers oldest-first and never by apparent severity", () => {
    const { reviewSuggested } = buildQueues();
    expect(reviewSuggested.map(({ id }) => id)).toEqual(["SYN-TRIGGER-001", "SYN-TRIGGER-002"]);
    expect(reviewSuggested.every(({ status }) => status === "open")).toBe(true);

    const resolved = syntheticReviewTriggers.find(({ id }) => id === "SYN-TRIGGER-003");
    expect(resolved?.status).toBe("resolved");
    expect(Date.parse(resolved?.createdAt ?? "")).toBeLessThan(Date.parse(reviewSuggested[0]?.createdAt ?? ""));

    const severeSounding = reviewSuggested.find(({ source }) => source === "presentation_outcome");
    expect(severeSounding?.id).toBe("SYN-TRIGGER-002");
  });

  it("lists only teams whose contact details still need verification, oldest verification first", () => {
    const { contactVerification } = buildQueues();
    expect(contactVerification.map(({ id }) => id)).toEqual(["SYN-CMHT-003", "SYN-CMHT-002"]);
    expect(contactVerification.every(({ verificationState }) => verificationState !== "verified")).toBe(true);
  });

  it("lists only open identification referrals, oldest first", () => {
    const { identificationReview } = buildQueues();
    expect(identificationReview.map(({ id }) => id)).toEqual(["SYN-IDENT-REVIEW-003", "SYN-IDENT-REVIEW-001"]);
    expect(identificationReview.every(({ status }) => status === "open")).toBe(true);
  });
});

describe("Care Plan role capabilities", () => {
  const clinicalRoles: PrototypeRole[] = ["ed_clinician", "liaison_clinician", "cmht_clinician", "senior_clinician"];

  it("restricts approval and withdrawal to the named senior clinician", () => {
    expect(canPerformAction("senior_clinician", "approve_management_version")).toBe(true);
    expect(canPerformAction("senior_clinician", "withdraw_management_version")).toBe(true);

    for (const role of ["ed_clinician", "liaison_clinician", "cmht_clinician", "plan_coordinator"] as PrototypeRole[]) {
      expect(canPerformAction(role, "approve_management_version")).toBe(false);
      expect(canPerformAction(role, "withdraw_management_version")).toBe(false);
    }
  });

  it("opens Personal Safety Plan authorship to every clinical role and no one else", () => {
    for (const role of clinicalRoles) {
      expect(canPerformAction(role, "author_safety_plan")).toBe(true);
    }
    expect(canPerformAction("plan_coordinator", "author_safety_plan")).toBe(false);
  });

  it("lets every role read a plan and reach the team, and keeps recording clinical", () => {
    for (const role of [...clinicalRoles, "plan_coordinator"] as PrototypeRole[]) {
      expect(canPerformAction(role, "read_plan")).toBe(true);
      expect(canPerformAction(role, "contact_cmht")).toBe(true);
    }
    expect(canPerformAction("ed_clinician", "record_presentation")).toBe(true);
    expect(canPerformAction("plan_coordinator", "record_presentation")).toBe(false);
    expect(canPerformAction("ed_clinician", "author_management_draft")).toBe(false);
    expect(canPerformAction("liaison_clinician", "author_management_draft")).toBe(true);
  });

  it("gives the non-clinical coordinator the worklists without clinical authorship", () => {
    expect(canPerformAction("plan_coordinator", "manage_worklists")).toBe(true);
    expect(canPerformAction("plan_coordinator", "close_identification_review")).toBe(true);
    expect(canPerformAction("plan_coordinator", "approve_patient_plan")).toBe(false);
  });
});

describe("Care Plan patient snapshot", () => {
  it("assembles the reading surface for a patient with a Current Plan", () => {
    const snapshot = buildPatientSnapshot(snapshotSource, "SYN-PATIENT-001", PROTOTYPE_NOW);

    expect(snapshot?.patient.fullName).toBe("Rowan Sample");
    expect(snapshot?.cmht?.id).toBe("SYN-CMHT-001");
    expect(snapshot?.currentManagementVersion?.state).toBe("current");
    expect(snapshot?.openManagementDraft).toBeNull();
    expect(snapshot?.withdrawnManagementVersion).toBeNull();
    expect(snapshot?.reviewState).toBe("within_review");
    expect(snapshot?.currentSafetyPlanVersion?.state).toBe("current");
    expect(snapshot?.presentationActivity.total).toBe(7);
    expect(snapshot?.presentations.map(({ arrivedAt }) => arrivedAt)).toEqual(
      [...(snapshot?.presentations ?? [])].map(({ arrivedAt }) => arrivedAt).sort((a, b) => (a < b ? 1 : -1)),
    );
  });

  it("distinguishes a withdrawn plan from a patient who never had one", () => {
    const withdrawn = buildPatientSnapshot(snapshotSource, "SYN-PATIENT-004", PROTOTYPE_NOW);
    expect(withdrawn?.currentManagementVersion).toBeNull();
    expect(withdrawn?.withdrawnManagementVersion?.state).toBe("withdrawn");
    expect(withdrawn?.withdrawnManagementVersion?.withdrawalReason).toMatch(/\S/);
    expect(withdrawn?.withdrawnManagementVersion?.withdrawnBy).toBe("SYN-USER-SENIOR-001");
    expect(withdrawn?.reviewState).toBeNull();

    const neverHadOne = buildPatientSnapshot(snapshotSource, "SYN-PATIENT-003", PROTOTYPE_NOW);
    expect(neverHadOne?.currentManagementVersion).toBeNull();
    expect(neverHadOne?.withdrawnManagementVersion).toBeNull();
    expect(neverHadOne?.presentationActivity.total).toBeGreaterThan(0);
  });

  it("returns null for a patient the prototype does not hold", () => {
    expect(buildPatientSnapshot(snapshotSource, "SYN-PATIENT-404", PROTOTYPE_NOW)).toBeNull();
  });
});

describe("Care Plan fixture safety", () => {
  it("prefixes every synthetic identifier with SYN- and never repeats one", () => {
    const identifiers: string[] = [];
    collectStrings(fixtureBundle, (key) => /(^id$|Id$|Ids$|By$)/.test(key), identifiers);
    expect(identifiers.length).toBeGreaterThan(50);
    for (const identifier of identifiers) {
      expect(identifier).toMatch(/^SYN-/);
    }

    const primaryIds: string[] = [];
    collectStrings(fixtureBundle, (key) => key === "id", primaryIds);
    expect(new Set(primaryIds).size).toBe(primaryIds.length);
  });

  it("fills every required content key on every Current version", () => {
    const currentVersions = syntheticManagementPlanVersions.filter(({ state }) => state === "current");

    for (const version of currentVersions) {
      for (const key of MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS) {
        const value = version.content[key];
        if (typeof value === "string") {
          expect(value.trim()).not.toBe("");
        } else {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("leaves at least two optional full-plan keys empty so the Not recorded path is exercised", () => {
    const optionalKeys = [
      "whatThePersonWants",
      "practicalNeeds",
      "physicalHealthAndMedication",
      "whoElseIsInvolved",
      "reviewTriggers",
    ] as const;

    const emptyCounts = syntheticManagementPlanVersions
      .filter(({ state }) => state === "current")
      .map((version) => optionalKeys.filter((key) => (version.content[key] as readonly string[]).length === 0).length);

    expect(Math.max(...emptyCounts)).toBeGreaterThanOrEqual(2);
  });

  it("never writes a prohibitive admission construction into an agreed ED approach", () => {
    expect(BANNED_ADMISSION_CONSTRUCTIONS.length).toBeGreaterThan(3);

    const badExample = "The team agreed she should not be admitted for this presentation.";
    expect(BANNED_ADMISSION_CONSTRUCTIONS.some((phrase) => badExample.toLowerCase().includes(phrase))).toBe(true);

    for (const version of syntheticManagementPlanVersions) {
      const agreed = version.content.agreedEdApproach.join(" ").toLowerCase();
      for (const phrase of BANNED_ADMISSION_CONSTRUCTIONS) {
        expect(agreed).not.toContain(phrase);
      }
    }
  });

  it("names who agreed the ED approach and when, in one clause, on every version", () => {
    // The guard must reject a named party with no date, and a date that merely
    // appears somewhere else in the block.
    expect(AGREED_WITH_NAMED_PARTIES_AND_DATE.test("Agreed with the team.")).toBe(false);
    expect(AGREED_WITH_NAMED_PARTIES_AND_DATE.test("Agreed with Rowan and the CMHT. Reviewed again in 2026.")).toBe(
      false,
    );
    expect(AGREED_WITH_NAMED_PARTIES_AND_DATE.test("Agreed on 20 May 2026.")).toBe(false);
    expect(
      AGREED_WITH_NAMED_PARTIES_AND_DATE.test("Agreed with Rowan, the North River CMHT and Dr Taylor on 20 May 2026."),
    ).toBe(true);

    for (const version of syntheticManagementPlanVersions) {
      if (version.content.agreedEdApproach.length === 0) continue;
      const namesBoth = version.content.agreedEdApproach.some((line) => AGREED_WITH_NAMED_PARTIES_AND_DATE.test(line));
      expect(namesBoth, `${version.id} does not name who agreed the ED approach and when`).toBe(true);
    }
  });

  it("keeps every fixture free of stigmatising or utilisation labels", () => {
    const bannedLabels = [
      "frequent flyer",
      "frequent presenter",
      "frequent-presenter",
      "high utiliser",
      "high utilizer",
      "problem patient",
      "difficult patient",
      "drug seeking",
      "drug-seeking",
      "attention seeking",
      "attention-seeking",
      "manipulative",
      "malingering",
      "compliance",
      "compliant",
      "bed blocker",
      "risk score",
      "chief complaint",
      "next of kin",
    ];
    const haystack = serialisedFixtures.toLowerCase();

    for (const label of bannedLabels) {
      expect(haystack, `fixtures use the banned label "${label}"`).not.toContain(label);
    }
  });

  it("uses the glossary's preferred terms and none of its banned synonyms", () => {
    // docs/care-plan-context.md bans these as names for the domain concepts. The
    // noun forms have no legitimate use here; "visit" is banned only in the ED
    // sense, because a CMHT home visit is a different thing the glossary does not
    // govern.
    const bannedNouns = [
      "attendance",
      "attendances",
      "encounter",
      "encounters",
      "frequent-presenter flag",
      "automatic enrolment",
      "treatment order",
      "ed note",
      "expired plan",
      "deleted plan",
      "latest plan",
      "active draft",
      "contact completed",
      "message sent",
      "activity feed",
      "communication log",
      "effectiveness verdict",
      "compliance score",
      "case-management inbox",
    ];
    const haystack = serialisedFixtures.toLowerCase();
    for (const term of bannedNouns) {
      expect(haystack, `fixtures use the glossary-banned term "${term}"`).not.toContain(term);
    }

    const edSenseOfVisit = [
      /\b(?:ed|emergency department|emergency|hospital)\s+visits?\b/i,
      /\bvisits?\s+to\s+(?:the\s+)?(?:ed|emergency)/i,
      /\b(?:each|every|per)\s+visit\b/i,
    ];
    for (const pattern of edSenseOfVisit) {
      expect(pattern.test(serialisedFixtures), `fixtures use "visit" for an ED Presentation: ${pattern}`).toBe(false);
    }
  });

  it("writes What makes it worse about the service rather than about the person", () => {
    // Negative controls. Each of these passed the previous keyword-based guard.
    expect(describesTheService("Rowan gets aggressive when kept waiting too long")).toBe(false);
    expect(describesTheService("She becomes demanding and difficult when the wait is long.")).toBe(false);
    expect(describesTheService("The patient refuses to engage and is often hostile in the waiting room.")).toBe(false);
    expect(describesTheService("Long waits make Rowan aggressive towards staff.")).toBe(false);
    // Positive controls, including a response written as a response to circumstances.
    expect(describesTheService("Waiting in the main corridor within sight of the ambulance bay.")).toBe(true);
    expect(describesTheService("Long waits in the corridor without a chair. Her back pain builds.")).toBe(true);

    // Every version, not only the Current ones: a draft becomes a Current Plan.
    for (const version of syntheticManagementPlanVersions) {
      expect(version.content.whatMakesItWorse.length).toBeGreaterThan(0);
      for (const line of version.content.whatMakesItWorse) {
        expect(describesTheService(line), `${version.id}: ${line}`).toBe(true);
      }
    }
  });

  it("names concrete new findings in What would make this different, not generic caution", () => {
    // Negative controls. The first passed the previous exact-string guard.
    expect(namesConcreteFindings("Use your clinical judgement at all times in every case.")).toBe(false);
    expect(namesConcreteFindings("Exercise caution and stay alert to anything out of the ordinary here.")).toBe(false);
    expect(namesConcreteFindings("Chest pain.")).toBe(false);
    // Positive control.
    expect(
      namesConcreteFindings("New or worsening physical symptoms: chest pain, breathlessness, fever, or a seizure."),
    ).toBe(true);

    for (const version of syntheticManagementPlanVersions) {
      const boundary = version.content.whatWouldMakeThisDifferent;
      expect(boundary.length, `${version.id} names too few voiding findings`).toBeGreaterThanOrEqual(3);
      for (const line of boundary) {
        expect(namesConcreteFindings(line), `${version.id}: ${line}`).toBe(true);
      }
    }
  });

  it("records one attributed amendment per amendable field, matching the corrected record", () => {
    const amendableFields = [
      "assessmentOutcome",
      "disposition",
      "note",
      "planAvailability",
      "planUse",
      "planHelpfulness",
    ];
    expect(syntheticPresentationAmendments.length).toBeGreaterThan(1);
    expect(syntheticPresentationAmendments.map(({ field }) => field)).toContain("planHelpfulness");

    for (const amendment of syntheticPresentationAmendments) {
      expect(amendableFields).toContain(amendment.field);

      const presentation = syntheticEdPresentations.find(({ id }) => id === amendment.presentationId);
      expect(presentation).toBeDefined();
      expect(String(presentation?.[amendment.field])).toBe(amendment.replacementValue);
      expect(amendment.originalValue).not.toBe(amendment.replacementValue);
      expect(amendment.reason.trim()).not.toBe("");
    }
  });

  it("never claims in a reason that something had happened before it had", () => {
    // The count sweep checks how many; this checks when. A reason string is written
    // at a moment in time and cannot cite an episode that had not happened yet.
    const arrivedBefore = (arrivals: readonly string[], writtenAt: string): boolean =>
      arrivals.some((arrival) => Date.parse(arrival) < Date.parse(writtenAt));
    const arrivedBetween = (arrivals: readonly string[], from: string, to: string): boolean =>
      arrivals.some((arrival) => Date.parse(arrival) > Date.parse(from) && Date.parse(arrival) < Date.parse(to));

    // Negative controls carrying the exact dates of the defect this closes: a
    // referral written on 11 July citing a presentation that happened on 4 August.
    expect(arrivedBefore(["2026-08-04T11:10:00+08:00"], "2026-07-11T11:45:00+08:00")).toBe(false);
    expect(
      arrivedBetween(["2026-08-04T11:10:00+08:00"], "2026-07-04T16:20:00+08:00", "2026-07-11T11:45:00+08:00"),
    ).toBe(false);
    // Positive control: the corrected referral date.
    expect(
      arrivedBetween(["2026-08-04T11:10:00+08:00"], "2026-07-04T16:20:00+08:00", "2026-08-06T11:45:00+08:00"),
    ).toBe(true);

    const citesAPresentation = /presented|presentation|attended|came in|brought in|has been in/i;
    const citesSinceWithdrawal = /withdraw\w*[^.]*\bsince\b|\bsince\b[^.]*withdraw/i;
    const arrivalsFor = (patientId: string): string[] =>
      syntheticEdPresentations
        .filter((presentation) => presentation.patientId === patientId)
        .map((presentation) => presentation.arrivedAt);
    let claimsChecked = 0;

    for (const review of syntheticIdentificationReviews) {
      if (!citesAPresentation.test(review.reason)) continue;
      claimsChecked += 1;
      const arrivals = arrivalsFor(review.patientId);
      expect(
        arrivedBefore(arrivals, review.referredAt),
        `${review.id} cites a presentation that had not happened when it was written`,
      ).toBe(true);

      if (!citesSinceWithdrawal.test(review.reason)) continue;
      const patient = syntheticPatients.find(({ id }) => id === review.patientId);
      const withdrawn = syntheticManagementPlanVersions.find(
        (version) => version.planId === patient?.managementPlanId && version.state === "withdrawn",
      );
      expect(withdrawn?.withdrawnAt, `${review.id} says "since the withdrawal" with no withdrawn version`).toBeTruthy();
      expect(
        arrivedBetween(arrivals, withdrawn?.withdrawnAt as string, review.referredAt),
        `${review.id} says a presentation happened since the withdrawal, but none falls between them`,
      ).toBe(true);
    }

    for (const version of syntheticManagementPlanVersions) {
      if (version.withdrawalReason === null || !citesAPresentation.test(version.withdrawalReason)) continue;
      claimsChecked += 1;
      const plan = syntheticManagementPlans.find(({ id }) => id === version.planId);
      expect(
        arrivedBefore(arrivalsFor(plan?.patientId as string), version.withdrawnAt as string),
        `${version.id} cites a presentation that had not happened when it was withdrawn`,
      ).toBe(true);
    }

    // Guards against the sweep going quiet and passing over nothing.
    expect(claimsChecked).toBeGreaterThanOrEqual(3);
  });

  it("keeps every count claimed in fixture prose consistent with the episode records", () => {
    // Task 4 renders the objective count beside this prose. If the two disagree,
    // the objective count stops being the thing that settles the question.
    const numberWords: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      once: 1,
      twice: 2,
    };
    const claimPatterns = [
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:ed\s+)?presentations?\b/gi,
      /\bon\s+(one|two|three|four|five)\s+occasions?\b/gi,
      /\b(once|twice)\s+(?:leaving|left|presenting|attending)\b/gi,
    ];
    let claimsChecked = 0;

    for (const patient of syntheticPatients) {
      const episodes = syntheticEdPresentations.filter(({ patientId }) => patientId === patient.id);
      const total = episodes.length;
      const endedEarly = episodes.filter(({ disposition }) => disposition === "left_before_completion").length;

      const prose: string[] = [];
      for (const version of syntheticManagementPlanVersions.filter(
        ({ planId }) => planId === patient.managementPlanId,
      )) {
        collectStrings(version.content, () => true, prose);
        prose.push(version.revisionReason, version.returnedReason ?? "", version.withdrawalReason ?? "");
      }
      for (const version of syntheticPersonalSafetyPlanVersions.filter(
        ({ planId }) => planId === patient.personalSafetyPlanId,
      )) {
        prose.push(version.collaborationNote);
      }
      for (const review of syntheticIdentificationReviews.filter(({ patientId }) => patientId === patient.id)) {
        prose.push(review.reason, review.decisionReason ?? "");
      }
      for (const trigger of syntheticReviewTriggers.filter(({ patientId }) => patientId === patient.id)) {
        prose.push(trigger.reason, trigger.resolution ?? "");
      }

      for (const sentence of prose) {
        // A claim about episodes that ended early is measured against that subset;
        // any other episode count is measured against the patient's whole record.
        const aboutEarlyExit = /left before|leaving before|ended before assessment/i.test(sentence);
        const expected = aboutEarlyExit ? endedEarly : total;

        for (const pattern of claimPatterns) {
          for (const match of sentence.matchAll(pattern)) {
            const claimed = numberWords[(match[1] as string).toLowerCase()];
            claimsChecked += 1;
            expect(claimed, `${patient.id} prose claims a count the records do not support: "${sentence}"`).toBe(
              expected,
            );
          }
        }
      }
    }

    // Guards against the sweep going quiet and passing over nothing.
    expect(claimsChecked).toBeGreaterThanOrEqual(4);
  });

  it("orders the first-minute keys exactly as the summary card renders them", () => {
    expect(FIRST_MINUTE_CONTENT_KEYS).toEqual([
      "howToApproach",
      "whatHelps",
      "whatMakesItWorse",
      "agreedEdApproach",
      "whatWouldMakeThisDifferent",
    ]);
    expect(MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS).toEqual([...FIRST_MINUTE_CONTENT_KEYS, "whyThisPlanExists"]);

    const contentKeys: (keyof ManagementPlanContent)[] = [
      "howToApproach",
      "whatHelps",
      "whatMakesItWorse",
      "agreedEdApproach",
      "whatWouldMakeThisDifferent",
      "whyThisPlanExists",
      "whatThePersonWants",
      "practicalNeeds",
      "physicalHealthAndMedication",
      "whoElseIsInvolved",
      "reviewTriggers",
    ];
    for (const version of syntheticManagementPlanVersions) {
      expect(Object.keys(version.content)).toEqual(contentKeys);
    }
  });
});
