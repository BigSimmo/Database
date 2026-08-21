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

  it("uses the stored review state that the review clock derives for every Current version", () => {
    const currentVersions = syntheticManagementPlanVersions.filter(({ state }) => state === "current");
    expect(currentVersions.length).toBeGreaterThan(1);

    for (const version of currentVersions) {
      expect(version.reviewDueAt).not.toBeNull();
      expect(version.reviewState).toBe(deriveReviewState(version.reviewDueAt as string, PROTOTYPE_NOW));
    }

    expect(currentVersions.map(({ reviewState }) => reviewState).sort()).toEqual(["overdue", "within_review"]);
  });

  it("covers a due-soon review state somewhere in the fixture set", () => {
    const safetyStates = syntheticPersonalSafetyPlanVersions
      .filter(({ reviewDueAt: due }) => due !== null)
      .map(({ reviewDueAt: due }) => deriveReviewState(due as string, PROTOTYPE_NOW));
    const managementStates = syntheticManagementPlanVersions
      .filter(({ reviewDueAt: due }) => due !== null)
      .map(({ reviewDueAt: due }) => deriveReviewState(due as string, PROTOTYPE_NOW));

    expect([...safetyStates, ...managementStates]).toContain("due_soon");
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

  it("names who agreed the ED approach and when, on every version that has one", () => {
    for (const version of syntheticManagementPlanVersions) {
      if (version.content.agreedEdApproach.length === 0) continue;
      const agreed = version.content.agreedEdApproach.join(" ");
      expect(agreed).toMatch(/agreed (with|by|at|on)|agreed .* on \d{1,2} \w+ 20\d{2}/i);
      expect(agreed).toMatch(/20\d{2}/);
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
      expect(haystack).not.toContain(label);
    }
  });

  it("writes What makes it worse about the service rather than about the person", () => {
    const currentVersions = syntheticManagementPlanVersions.filter(({ state }) => state === "current");
    expect(currentVersions.length).toBeGreaterThan(0);

    for (const version of currentVersions) {
      const worse = version.content.whatMakesItWorse;
      expect(worse.length).toBeGreaterThan(0);
      expect(worse.join(" ")).toMatch(/corridor|wait|history|security|handover|noise|light|room|staff|department/i);
      for (const line of worse) {
        expect(line).not.toMatch(/\b(he|she|they) (is|are|becomes|gets) (aggressive|demanding|difficult|hostile)\b/i);
      }
    }
  });

  it("names concrete new findings in What would make this different, not generic caution", () => {
    for (const version of syntheticManagementPlanVersions) {
      const boundary = version.content.whatWouldMakeThisDifferent;
      if (boundary.length === 0) continue;
      expect(boundary.length).toBeGreaterThanOrEqual(3);
      for (const line of boundary) {
        expect(line.length).toBeGreaterThan(25);
        expect(line).not.toMatch(/^\s*(use|exercise|apply)\s+(clinical\s+)?(judgement|judgment|caution)\s*\.?\s*$/i);
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
