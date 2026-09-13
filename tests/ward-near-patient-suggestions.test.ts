// tests/ward-near-patient-suggestions.test.ts
//
// `nearPatients` — the matcher behind "did you mean?" on the patient front door.
//
// ⚠️ THE HARM THIS EXISTS TO PREVENT IS NOT A FAILED SEARCH. A clinician who searches a misspelling,
// is told "nobody of that name is known", and presses the button the screen offers has created a
// SECOND RECORD for a person already in the system — two medication histories, two risk records,
// and a bed found for somebody the system already knows. A duplicate is worse than friction.
//
// ⚠️ AND THE OPPOSITE FAILURE IS WORSE STILL: a suggestion that surfaces the WRONG person, accepted,
// attaches a referral to somebody else. A duplicate is visible; a misattribution is not. That is why
// the rule is one keystroke rather than a similarity score, and why nothing here ranks.
import { describe, expect, it } from "vitest";

import { duplicateCandidates, findPatients, nearPatients } from "../src/components/ward-management/ward-patients";
import { wardPatients } from "../src/components/ward-management/ward-patients-seed";

const patients = wardPatients;
const names = (found: readonly { familyName: string }[]) => found.map((p) => p.familyName).sort();

describe("nearPatients — the three confusable pairs, all of them", () => {
  /**
   * ⚠️ ALL THREE PAIRS, AND THE REASON IS AN ANTI-VACUITY ONE MEASURED BY WARD BUILDER TWO: the
   * O'Quinn pair ALREADY matches today, because `findPatients`'s fold strips the apostrophe. So a
   * test written against that pair alone would pass against a `nearPatients` THAT DID NOTHING AT
   * ALL. Two of the three are the real subjects; the third is the control that proves the fixture
   * is not doing the work.
   */
  it("the exact search genuinely fails on the two pairs this feature is for, and genuinely succeeds on the third", () => {
    expect(findPatients(patients, "Halowin"), "a missing letter finds nobody today").toEqual([]);
    expect(findPatients(patients, "Marowby"), "a missing letter finds nobody today").toEqual([]);
    // The control: this one needs no help, and a suggestion engine must not be credited for it.
    expect(findPatients(patients, "Oquinn").length, "the fold already handles the apostrophe").toBe(2);
  });

  it("offers the near spelling for a missing letter", () => {
    expect(names(nearPatients(patients, ["Halowin"]))).toEqual(["Hallowin"]);
    expect(names(nearPatients(patients, ["Marowby"]))).toEqual(["Marrowby"]);
  });

  it("offers a near spelling for a changed letter and for two letters swapped", () => {
    expect(names(nearPatients(patients, ["Hallowon"])), "one letter changed").toEqual(["Hallowin"]);
    expect(names(nearPatients(patients, ["Hallowni"])), "two adjacent letters swapped").toEqual(["Hallowin"]);
  });

  it("compares a term that is NOT the first one, which a single-term matcher would pass anyway", () => {
    // ⚠️ WRITTEN AFTER A MUTATION SURVIVED. The both-fields test below passes ["Halowin", ""] —
    // and the matching term is the FIRST, so a matcher that only ever looked at terms[0] passed it.
    // The add-patient form can put the surname in EITHER box depending on how the clinician types,
    // so the second term has to work on its own.
    expect(names(nearPatients(patients, ["", "Halowin"]))).toEqual(["Hallowin"]);
    expect(names(nearPatients(patients, ["Marcus", "Marowby"]))).toEqual(["Marrowby"]);
  });

  it("stops at ONE keystroke — two is not near, at either end of the word", () => {
    // ⚠️ ALSO WRITTEN AFTER A MUTATION SURVIVED, and this one found a real defect rather than a
    // weak test: loosening the length guard let a name with TWO extra characters through, because
    // the insertion walk returns true once the shorter string is exhausted without checking what
    // is left over. Both directions are pinned here so neither end can rot.
    expect(nearPatients(patients, ["Hallowinxy"]), "two extra letters at the end").toEqual([]);
    expect(nearPatients(patients, ["xyHallowin"]), "two extra letters at the start").toEqual([]);
    expect(nearPatients(patients, ["Halown"]), "two letters missing").toEqual([]);
  });

  it("still warns when the given name is RIGHT and only the surname is misspelt", () => {
    // ⚠️ THE COMMONEST REAL DUPLICATE THERE IS, and it produced NOTHING until Ward Builder Two
    // stood where the caller stands and checked. The prefill drops "Halowin" into the given-name
    // box and the warning fires; the clinician then does the obvious tidy-up — moves the surname
    // across and types "Marcus" — and the warning VANISHED, because "marcus" exactly matched a
    // real given name and an "already found" guard excluded that patient entirely.
    //
    // The guard's premise was "an exact hit means the search already showed them". True of the
    // SEARCH screen, which passes one term. False of the ADD screen, which passes two, where the
    // search that brought the clinician here used only one of them.
    expect(names(nearPatients(patients, ["Marcus", "Halowin"]))).toEqual(["Hallowin"]);
    expect(names(nearPatients(patients, ["Ines", "Marowby"]))).toEqual(["Marrowby"]);
  });

  it("compares every term against BOTH name fields, which is the add-form case", () => {
    // ⚠️ THE JOURNEY THAT CREATES THE DUPLICATE: the prefill puts the whole typed string into
    // `givenName` and leaves `familyName` empty, so the surname arrives in the forename box. A
    // matcher comparing given-to-given would find nothing here — which is the one case it is for.
    expect(names(nearPatients(patients, ["Halowin", ""]))).toEqual(["Hallowin"]);
  });
});

describe("nearPatients — what it refuses to do", () => {
  it("never re-offers somebody the exact search already found", () => {
    // Otherwise the screen would say "nobody is known" and then list the person it just found.
    expect(nearPatients(patients, ["Hallowin"])).toEqual([]);
    expect(nearPatients(patients, ["Oquinn"])).toEqual([]);
  });

  it("never suggests a different person, however short the query", () => {
    expect(nearPatients(patients, ["Smith"]), "an unrelated name reaches nobody").toEqual([]);
    // ⚠️ Below four characters one keystroke is most of the word, so "near" stops meaning anything.
    // "Hal" is caught by the length rule anyway; "Ine" is the case that actually needs the minimum,
    // because it sits ONE keystroke from the real given name "Ines" — written after a mutation that
    // dropped the minimum survived, proving the rule was untested rather than unnecessary.
    expect(nearPatients(patients, ["Hal"]), "too short to be near anything").toEqual([]);
    expect(nearPatients(patients, ["Ine"]), "one keystroke from Ines, and still too short to offer").toEqual([]);
    expect(nearPatients(patients, [""]), "an empty term reaches nobody, never everybody").toEqual([]);
    expect(nearPatients(patients, []), "no terms at all reaches nobody").toEqual([]);
  });

  it("NEVER treats a record number as near-missable, because a near-miss record number is another patient", () => {
    // ⚠️ THE SHARPEST RULE HERE. UM100001 and UM100002 are one keystroke apart and are two different
    // people. There is no near-miss to be helpful about, and offering one would invite exactly the
    // misattribution this feature exists to prevent.
    const oneKeystrokeFromARealRecordNumber = "UM100003";
    expect(
      findPatients(patients, oneKeystrokeFromARealRecordNumber).length,
      "the control: it IS a real record number",
    ).toBe(1);
    expect(nearPatients(patients, ["UM10000"]), "a truncated record number suggests nobody").toEqual([]);
    expect(nearPatients(patients, ["UM100009"]), "a wrong record number suggests nobody").toEqual([]);
  });

  it("leaves the two patients who belong to no confusable pair alone", () => {
    // ⚠️ Ward Builder Two's point, and it is the half a threshold test usually skips: a tight rule
    // has to be shown NOT firing as well as firing. Feodora Blennerhast and Kwame Vandersloot exist
    // in the seed precisely because they belong to no pair — a matcher loose enough to return them
    // for "Halowin" would look like it was working on every test written from the pairs alone.
    const unpaired = patients
      .filter((p) => !["Halloway", "Hallowin", "Marrowby", "Marrowbee", "O'Quinn", "Oquinn"].includes(p.familyName))
      .map((p) => p.familyName);
    expect(unpaired.length, "the seed must actually contain unpaired people, or this proves nothing").toBeGreaterThan(
      1,
    );

    for (const query of ["Halowin", "Marowby", "Oquinn"]) {
      const suggested = nearPatients(patients, [query]).map((p) => p.familyName);
      for (const bystander of unpaired) {
        expect(suggested, `"${query}" must not reach ${bystander}`).not.toContain(bystander);
      }
    }
  });

  it("returns candidates unranked, in the order the patient list holds them", () => {
    // A "best match" is an invitation, and on this screen an invitation is the hazard. Both
    // Marrow- names are one keystroke from this query; neither may be presented as the better one.
    const found = nearPatients(patients, ["Marrowbe"]);
    const seedOrder = patients.filter((p) => found.includes(p)).map((p) => p.id);
    expect(
      found.map((p) => p.id),
      "order follows the seed, never a score",
    ).toEqual(seedOrder);
  });

  // Anti-vacuity for the whole file: every assertion above is about a small set, and an empty
  // fixture would satisfy most of them.
  it("the fixture is real", () => {
    expect(patients.length).toBeGreaterThan(4);
  });
});

describe("duplicateCandidates — the creation-time check", () => {
  const draft = (over: Partial<Parameters<typeof duplicateCandidates>[1]> = {}) => ({
    umrn: "",
    givenName: "",
    familyName: "",
    dateOfBirth: "",
    ...over,
  });
  const marcus = patients.find((p) => p.familyName === "Hallowin")!;

  it("reports a record-number collision as its own claim, never merged with the rest", () => {
    // ⚠️ A record number is unique by definition. This is not "might be the same person" — either
    // it is, or somebody mistyped, and the screen has to be able to say so flatly.
    const found = duplicateCandidates(patients, draft({ umrn: marcus.umrn }));
    expect(found.recordNumberCollision.map((p) => p.id)).toEqual([marcus.id]);
    expect(found.sameNameSameBirthDate).toEqual([]);
    expect(found.sameNameBirthDateNotMatched).toEqual([]);
  });

  it("separates same-name-same-birthdate from same-name-unmatched-birthdate", () => {
    const same = duplicateCandidates(
      patients,
      draft({ givenName: "Marcus", familyName: "Hallowin", dateOfBirth: marcus.dateOfBirth }),
    );
    expect(same.sameNameSameBirthDate.map((p) => p.id)).toEqual([marcus.id]);
    expect(same.sameNameBirthDateNotMatched).toEqual([]);

    const differs = duplicateCandidates(
      patients,
      draft({ givenName: "Marcus", familyName: "Hallowin", dateOfBirth: "1900-01-01" }),
    );
    expect(differs.sameNameSameBirthDate).toEqual([]);
    expect(differs.sameNameBirthDateNotMatched.map((p) => p.id)).toEqual([marcus.id]);
  });

  it("treats a BLANK date of birth as not-matched, never as matched", () => {
    // ⚠️ The tier is named for what it knows. A blank field is not a different date of birth, and
    // it must not be allowed to satisfy the "same person" tier by being equally empty.
    const blank = duplicateCandidates(patients, draft({ givenName: "Marcus", familyName: "Hallowin" }));
    expect(blank.sameNameSameBirthDate, "an empty draft DOB never confirms identity").toEqual([]);
    expect(blank.sameNameBirthDateNotMatched.map((p) => p.id)).toEqual([marcus.id]);
  });

  it("uses the same fold as the search, so an apostrophe is not a different person", () => {
    // "Priya O'Quinn" typed against a seeded "Priya Oquinn" — folded they are one person. Only one
    // normaliser is allowed to have that opinion, and it is this file's.
    const priya = patients.find((p) => p.familyName === "Oquinn")!;
    const found = duplicateCandidates(
      patients,
      draft({ givenName: "Priya", familyName: "O'Quinn", dateOfBirth: priya.dateOfBirth }),
    );
    expect(found.sameNameSameBirthDate.map((p) => p.id)).toEqual([priya.id]);
  });

  it("NEVER names the same person twice across the tiers", () => {
    // ⚠️ A notice that says "this IS that record" and then "this MAY be that record" about one
    // person teaches a reader to skim both. Enforced here, not left to the caller.
    const found = duplicateCandidates(
      patients,
      draft({ umrn: marcus.umrn, givenName: "Marcus", familyName: "Halowin" }),
    );
    const everyone = [
      ...found.recordNumberCollision,
      ...found.sameNameSameBirthDate,
      ...found.sameNameBirthDateNotMatched,
      ...found.nearSpelling,
    ].map((p) => p.id);
    expect(everyone.length, "no duplicates across tiers").toBe(new Set(everyone).size);
    expect(found.recordNumberCollision.map((p) => p.id)).toEqual([marcus.id]);
    expect(found.nearSpelling, "already named above, so not repeated here").toEqual([]);
  });

  it("still surfaces the near spelling when nothing exact matched", () => {
    const found = duplicateCandidates(patients, draft({ givenName: "Marcus", familyName: "Halowin" }));
    expect(found.recordNumberCollision).toEqual([]);
    expect(found.sameNameSameBirthDate).toEqual([]);
    expect(found.nearSpelling.map((p) => p.familyName)).toEqual(["Hallowin"]);
  });

  it("an empty draft accuses nobody", () => {
    const found = duplicateCandidates(patients, draft());
    expect([
      found.recordNumberCollision,
      found.sameNameSameBirthDate,
      found.sameNameBirthDateNotMatched,
      found.nearSpelling,
    ]).toEqual([[], [], [], []]);
  });
});
