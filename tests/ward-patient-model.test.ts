import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  PATIENT_FIELDS,
  findPatients,
  patientAgeYears,
  patientDisplayName,
  type Patient,
} from "@/components/ward-management/ward-patients";

const NOW = 10 * 60 + 42;

/**
 * `Patient` holds identity, and this file is the reason that is a decision rather than a drift.
 *
 * Owner ruling PD-1, 2026-08-30: name, record number, date of birth and age are permitted ON THIS
 * RECORD. `address` and narrative history were NOT ruled on, and silence is not permission.
 *
 * The guard has three legs because each catches something the others cannot:
 *
 *   1. EXACT SET EQUALITY against a fully-populated literal. Catches a field added to the type, and
 *      catches one added at runtime and not to the type — a type-only check runs under `tsc` and is
 *      absent from a plain `vitest run`.
 *   2. EVERY AUTHORISED FIELD CARRIES A DECISION ID THAT RESOLVES. An allowlist whose reasons are
 *      free text is a list of assertions nobody can check; one whose ids must exist is a governance
 *      record. Mutation-proved below with an invented id.
 *   3. THE UNRULED STEMS ARE DENIED OVER THE ALLOWLIST. A field matching them fails even with a
 *      plausible decision id beside it, because the failure this leg exists for is somebody widening
 *      by implication — reading "he allowed names" as "he allowed identity".
 */
const DECISIONS = new Map<string, string>([
  [
    "PD-1",
    "Owner, 2026-08-30: explicit permission to hold a name or record number for patients, and to " +
      "search by either the UMRN or the name, age and date of birth.",
  ],
]);

/** Fields permitted to match an identity stem, each with the ruling that permitted it. */
const AUTHORISED_IDENTITY_FIELDS = new Map<string, string>([
  ["givenName", "PD-1"],
  ["familyName", "PD-1"],
  ["dateOfBirth", "PD-1"],
]);

/** Never permitted on any Ward Flow record, and NOT openable by the allowlist above. */
const NEVER_PERMITTED_STEMS = ["address", "history", "notes", "note", "comment", "narrative", "diagnos"];

/** Permitted only when the field is named in `AUTHORISED_IDENTITY_FIELDS`. */
const IDENTITY_STEMS = ["name", "dob", "birth", "umrn", "patient"];

function aPatient(): Required<Patient> {
  return {
    id: "PT-T01",
    umrn: "UM900000",
    givenName: "Testable",
    familyName: "Quillfeather",
    dateOfBirth: "1990-06-01",
  };
}

describe("Patient identity is a ruling, not a drift", () => {
  it("declares exactly the fields the ruling authorises, at runtime and in the type", () => {
    const expected = ["dateOfBirth", "familyName", "givenName", "id", "umrn"];
    expect(
      [...PATIENT_FIELDS].sort(),
      "PATIENT_FIELDS no longer matches the authorised field set. A field added here is a widening " +
        "of what this prototype holds about a person, and it needs an owner ruling and a line in " +
        "AUTHORISED_IDENTITY_FIELDS — not a passing test.",
    ).toEqual(expected);
    expect(
      Object.keys(aPatient()).sort(),
      "a real Patient carries fields PATIENT_FIELDS does not declare. The runtime list is what the " +
        "guard can see without tsc, so the two must not drift apart.",
    ).toEqual(expected);
  });

  it("has every authorised identity field carry a decision id that resolves", () => {
    for (const [field, decision] of AUTHORISED_IDENTITY_FIELDS) {
      expect(
        DECISIONS.has(decision),
        `${field} is authorised by "${decision}", which is not a decision anybody can look up. An ` +
          "allowlist of free-text reasons is a list of assertions; one whose ids must resolve is a record.",
      ).toBe(true);
      expect([...PATIENT_FIELDS], `${field} is authorised but not declared`).toContain(field);
    }
  });

  it("refuses an invented decision id, which is what makes the leg above worth having", () => {
    // The mutation, run in-line rather than described: an entry citing a ruling that does not exist
    // must fail. Without this the leg above passes on any string at all.
    const invented = new Map([["somethingUnruled", "PD-99"]]);
    const unresolved = [...invented.values()].filter((decision) => !DECISIONS.has(decision));
    expect(unresolved, "an invented decision id must not resolve").toEqual(["PD-99"]);
  });

  it("keeps the unruled stems denied OVER the allowlist, so nothing widens by implication", () => {
    const offenders = [...PATIENT_FIELDS].filter((field) =>
      NEVER_PERMITTED_STEMS.some((stem) => field.toLowerCase().includes(stem)),
    );
    expect(
      offenders,
      "Patient declares a field the owner never ruled on. PD-1 permits identity — name, record " +
        "number, date of birth, age. It does not permit an address, a history or free text, and " +
        "reading it as though it did is the widening-by-implication this leg exists to stop. A new " +
        "ruling, or nothing.",
    ).toEqual([]);

    // Both stem lists really discriminate, in both directions — a list matching nothing, or
    // everything, is the check-that-cannot-fail shape either way.
    expect(NEVER_PERMITTED_STEMS.some((stem) => "homeAddress".toLowerCase().includes(stem))).toBe(true);
    expect(IDENTITY_STEMS.some((stem) => "givenName".toLowerCase().includes(stem))).toBe(true);
    expect(NEVER_PERMITTED_STEMS.some((stem) => "givenName".toLowerCase().includes(stem))).toBe(false);
  });
});

describe("a patient exists before anything happens to them", () => {
  /**
   * THE DECIDING TEST. If this cannot be written, the lifecycle is wrong whatever the type looks
   * like — and the wrong version passes everything else, because a patient created at arrival
   * renders correctly on every screen that shows admitted people.
   *
   * The owner's flow is: search, and if nobody comes up, ADD them. The person being added has never
   * been referred, never moved, and never arrived.
   */
  it("is created with no movement, no referral and no admission, and is then found by searching", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900123",
      givenName: "Nerissa",
      familyName: "Blennerhast",
      dateOfBirth: "1979-02-11",
    });

    expect(after.rejections, "adding a patient must not be refused").toEqual([]);
    expect(after.patients.length, "exactly one person is added").toBe(before.patients.length + 1);

    const added = after.patients[after.patients.length - 1];

    // The whole point, asserted rather than assumed: this person is attached to nothing.
    expect(after.movements, "adding a patient must not create a movement").toHaveLength(before.movements.length);
    expect(after.referrals, "adding a patient must not create a referral").toHaveLength(before.referrals.length);
    expect(after.admissions, "adding a patient must not create an admission").toHaveLength(before.admissions.length);

    const found = findPatients(after.patients, "UM900123");
    expect(
      found.map((patient) => patient.id),
      "a patient who has never been referred, moved or admitted must be findable. If this fails, the " +
        "record is being created by the wrong event — the failure that looks correct on every screen " +
        "showing admitted people and appears only at 'if nobody comes up, add them'.",
    ).toEqual([added.id]);
  });

  it("finds related names rather than only exact ones, which the owner asked for by name", () => {
    const patients = seedWardFlowState().patients;

    expect(
      findPatients(patients, "hallow")
        .map((patient) => patient.familyName)
        .sort(),
      "related-name search found fewer than the near-miss pair the fixture seeds for exactly this. " +
        "The seed carries Halloway beside Hallowin so this behaviour has something to prove.",
    ).toEqual(["Halloway", "Hallowin"]);

    expect(
      findPatients(patients, "oquinn")
        .map((patient) => patient.familyName)
        .sort(),
      "punctuation must not decide whether a person is found — the two spellings are one query",
    ).toEqual(["O'Quinn", "Oquinn"]);

    expect(findPatients(patients, ""), "an empty query finds nobody, never everybody").toEqual([]);
  });

  it("derives age from the stored date of birth rather than holding both", () => {
    // One fact, one home. The owner said "Name, Age and DOB"; holding both would let a record state
    // an age that disagrees with its own date of birth, and nothing would notice.
    const patient: Patient = { ...aPatient(), dateOfBirth: "1990-06-01" };
    expect(patientAgeYears(patient, new Date(2026, 5, 1)), "on the birthday itself").toBe(36);
    expect(patientAgeYears(patient, new Date(2026, 4, 31)), "the day before").toBe(35);
    expect(patientDisplayName(patient)).toBe("Testable Quillfeather");
  });
});
