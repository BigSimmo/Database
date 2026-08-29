// tests/ward-admission-model.test.ts
import { describe, expect, it } from "vitest";

import {
  ADMISSION_FIELDS,
  ADMISSION_STATES,
  LEAVING_DESTINATIONS,
  PULL_RELEASE_REASONS,
  STAY_BANDS,
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  type Admission,
} from "../src/components/ward-management/ward-admissions";
import {
  TENTATIVE_DIAGNOSIS_BLOCKS,
  isTentativeDiagnosisBlock,
  tentativeDiagnosisPhrase,
} from "../src/components/ward-management/ward-diagnosis";
import { BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";

/**
 * Every admission in this file is CONSTRUCTED, never found.
 *
 * The rule this file holds to, and the reason it is written at the top rather than buried: an
 * assertion that SEARCHES a collection for an example satisfying a property passes as soon as any
 * example exists — including one a live defect still permits. A sister session's single most
 * important test was fake for exactly that reason: it scanned a fixture, found a different
 * satisfying example, and survived a real defect untouched. So where a property should hold
 * generally, it is asserted directly against an input built here, with `.filter(...)` and
 * `.find(...)` kept out of the load-bearing tests entirely.
 */
const DAY_ZERO = 8 * 60;

function anAdmission(overrides: Partial<Admission> = {}): Admission {
  return {
    id: "ADM-1",
    unitId: "rph-adult-open",
    referralId: "REF-1",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    // A block, never a condition, and `null` is equally ordinary — the base admission here carries
    // one so that a test overriding it to `null` is testing the absence deliberately.
    tentativeDiagnosis: "F30–F39",
    state: "occupied",
    pulledAt: DAY_ZERO,
    arrivedAt: DAY_ZERO,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    // A plan is not a decision: the base admission here has neither been confirmed nor refused,
    // only planned for.
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    ...overrides,
  };
}

describe("admission vocabulary", () => {
  it("ADMISSION_STATES is exactly the four states, in lifecycle order", () => {
    expect(ADMISSION_STATES).toEqual(["waitlisted", "pulled", "occupied", "left"]);
  });

  it("STAY_BANDS ids are exactly the four bands the product owner supplied, shortest first", () => {
    expect(STAY_BANDS.map((band) => band.id)).toEqual([
      "under-2-weeks",
      "2-weeks-1-month",
      "1-3-months",
      "over-3-months",
    ]);
  });

  /**
   * The BOUNDARIES, pinned as data and not only as the banding behaviour below.
   *
   * These four ceilings are the product owner's, supplied verbatim, and the previous set
   * (7 / 28 / 90) was replaced wholesale rather than added to. Asserted as an exact ordered list
   * so a retuned boundary — the change most likely to be made quietly, because no band id moves
   * and every banding test can be adjusted to match — has to be made against a stated expectation
   * instead. There is exactly one set of bands in this feature; a second one anywhere is the
   * defect.
   */
  it("carries exactly the ceilings the product owner supplied", () => {
    expect(STAY_BANDS.map((band) => [band.id, band.upToDays])).toEqual([
      ["under-2-weeks", 14],
      ["2-weeks-1-month", 30],
      ["1-3-months", 90],
      ["over-3-months", null],
    ]);
  });

  /**
   * The open-ended band must be the LAST one and the only one with no ceiling. A `null` ceiling
   * anywhere earlier would swallow every longer stay into it, and `stayBand` would stop
   * discriminating without a single band id changing.
   */
  it("gives exactly one band an open ceiling, and it is the last", () => {
    const openEnded = STAY_BANDS.filter((band) => band.upToDays === null);
    expect(openEnded).toHaveLength(1);
    expect(openEnded[0]!.id).toBe("over-3-months");
    expect(STAY_BANDS[STAY_BANDS.length - 1]!.id).toBe("over-3-months");
  });

  /**
   * No "target" band. A threshold nobody agreed to, used to judge how long a person has been in
   * a bed, is explicitly refused — see the array's own doc comment. The four ids above are the
   * whole vocabulary, so this is asserted as an exact set rather than as an absence of one word.
   */
  it("holds no band beyond the four supplied", () => {
    expect(STAY_BANDS).toHaveLength(4);
  });

  /**
   * The `false` is the entire point of this list. A ward-to-ward transfer frees the SENDING
   * ward's bed and gives the state no bed at all, so it must never count as a statewide release.
   * Asserted as an exact partition rather than by finding the one entry, so an entry flipped to
   * `true` later cannot hide behind a search that still finds something.
   */
  it("counts every leaving destination as a statewide release EXCEPT a transfer to another psychiatric ward", () => {
    expect(LEAVING_DESTINATIONS.map((destination) => [destination.id, destination.countsAsStatewideRelease])).toEqual([
      ["discharged-to-the-community", true],
      ["transferred-to-another-psychiatric-ward", false],
      ["transferred-to-a-general-hospital", true],
      ["moved-to-residential-care", true],
      ["left-against-advice", true],
    ]);
  });

  it("holds five pull-release reasons, none of them free text", () => {
    expect(PULL_RELEASE_REASONS).toHaveLength(5);
    for (const reason of PULL_RELEASE_REASONS) {
      expect(typeof reason).toBe("string");
    }
  });

  /**
   * One vocabulary for one fact. `blockReason` reuses the owner-approved `BED_RELEASE_BLOCKERS`
   * rather than declaring a second blocked-reason list, which is the defect class this repository
   * produces most reliably. This test is what makes the reuse structural: a copied local list
   * would drift from these eight the day one is added, and nothing else would notice.
   */
  it("draws blockReason from BED_RELEASE_BLOCKERS itself, never from a second list", () => {
    expect(BED_RELEASE_BLOCKERS.length).toBeGreaterThan(0);
    for (const blocker of BED_RELEASE_BLOCKERS) {
      expect(anAdmission({ blockReason: blocker }).blockReason).toBe(blocker);
    }
  });

  /**
   * THE ELEVEN BLOCKS, pinned as an exact ordered list of code/heading pairs.
   *
   * These are the ICD-10-AM Chapter V block headings and they are the STANDARD'S, not this
   * prototype's. Asserting them exactly is what stops a later author paraphrasing a heading into
   * something friendlier, splitting one, or adding a twelfth: each of those is a change to what the
   * screen claims the classification says, and none of them would move a code or fail any other
   * test in this repository.
   *
   * F70–F79 reads "Intellectual disability" here on purpose. The printed heading in ICD-10 and in
   * older ICD-10-AM editions is "Mental retardation"; the product owner supplied the current term
   * and the substitution is deliberate. This assertion is what makes a well-meaning "correction"
   * back to the code book go red rather than ship.
   */
  it("carries exactly the eleven ICD-10-AM Chapter V block headings, code and words together", () => {
    expect(TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => [block.code, block.label])).toEqual([
      ["F00–F09", "Organic, including symptomatic, mental disorders"],
      ["F10–F19", "Mental and behavioural disorders due to psychoactive substance use"],
      ["F20–F29", "Schizophrenia, schizotypal and delusional disorders"],
      ["F30–F39", "Mood (affective) disorders"],
      ["F40–F48", "Neurotic, stress-related and somatoform disorders"],
      ["F50–F59", "Behavioural syndromes associated with physiological disturbances and physical factors"],
      ["F60–F69", "Disorders of adult personality and behaviour"],
      // The deliberate departure from the source text. Do not "fix" this to "Mental retardation".
      ["F70–F79", "Intellectual disability"],
      ["F80–F89", "Disorders of psychological development"],
      ["F90–F98", "Behavioural and emotional disorders with onset usually occurring in childhood and adolescence"],
      ["F99", "Unspecified mental disorder"],
    ]);
  });

  /** Every block is a BLOCK — a code covering a range, or the single unspecified code. A
   *  four-character code (`F32.1`) would be a specific condition, which this record must never
   *  hold, and it would pass an eleven-entry length check unnoticed. */
  it("holds block codes only, never a specific four-character code", () => {
    for (const block of TENTATIVE_DIAGNOSIS_BLOCKS) {
      expect(block.code, `${block.code} is not a block code`).toMatch(/^F\d{2}(–F\d{2})?$/);
      expect(block.code).not.toContain(".");
    }
  });

  /** Chosen, never typed: the membership check is what makes that structural rather than a
   *  convention, in both directions. */
  it("accepts every declared block and rejects anything else", () => {
    for (const block of TENTATIVE_DIAGNOSIS_BLOCKS) {
      expect(isTentativeDiagnosisBlock(block.code)).toBe(true);
    }
    for (const notABlock of ["F32.1", "Depression", "F30-F39", "", "Bipolar affective disorder", "F100"]) {
      expect(isTentativeDiagnosisBlock(notABlock), `"${notABlock}" was accepted as a block`).toBe(false);
    }
  });

  /**
   * ONE renderer for the phrase, so no screen builds its own and two screens cannot disagree about
   * how a block reads. The code travels with the words in every phrase — the words alone are not
   * checkable against the classification.
   */
  it("renders every block as its words followed by its code, and renders nothing for an absent one", () => {
    for (const block of TENTATIVE_DIAGNOSIS_BLOCKS) {
      expect(tentativeDiagnosisPhrase(block.code)).toBe(`${block.label} (${block.code})`);
    }
    // Absence yields no phrase at all — never a substituted "Unspecified", which is a real block
    // somebody chose and must not be manufactured for somebody nobody recorded one for.
    expect(tentativeDiagnosisPhrase(null)).toBeNull();
    expect(tentativeDiagnosisPhrase(null)).not.toBe("Unspecified mental disorder (F99)");
  });

  /** The field itself: a declared block goes in and comes back unchanged, and `null` stays
   *  `null` rather than being filled in on the way through. */
  it("carries a tentative diagnosis block on the record, or null, unchanged", () => {
    for (const block of TENTATIVE_DIAGNOSIS_BLOCKS) {
      expect(anAdmission({ tentativeDiagnosis: block.code }).tentativeDiagnosis).toBe(block.code);
    }
    expect(anAdmission({ tentativeDiagnosis: null }).tentativeDiagnosis).toBeNull();
  });
});

describe("bedIsOccupied — which admissions consume a bed", () => {
  /**
   * THE RULE THE WHOLE BOARD RESTS ON, and the one a reviewer is most likely to "correct".
   *
   * The ward gives the bed away at the PULL. The person may still be in an emergency department
   * waiting for transport, so `arrivedAt` is null and the bed looks empty to anyone reading
   * arrival — but it is not empty, it is spoken for, and offering it again is a double-allocation.
   * `bedIsOccupied` must NEVER be tightened to require `arrivedAt`.
   *
   * Constructed, not searched: a pulled admission is built here and the predicate is asserted
   * directly on it.
   */
  it("counts a PULLED bed as occupied even though nobody has arrived", () => {
    const pulledButNobodyThereYet = anAdmission({ state: "pulled", pulledAt: DAY_ZERO, arrivedAt: null });
    expect(bedIsOccupied(pulledButNobodyThereYet)).toBe(true);
  });

  it("counts an occupied bed as occupied", () => {
    expect(bedIsOccupied(anAdmission({ state: "occupied" }))).toBe(true);
  });

  /** A waitlisted person has been given no bed, so they must not consume one. */
  it("does NOT count a waitlisted person against a bed", () => {
    const waiting = anAdmission({ state: "waitlisted", pulledAt: null, arrivedAt: null });
    expect(bedIsOccupied(waiting)).toBe(false);
  });

  /** A departed person releases the bed; counting them would freeze the ward at full forever. */
  it("does NOT count a departed person against a bed", () => {
    const gone = anAdmission({
      state: "left",
      leftAt: DAY_ZERO + MINUTES_PER_DAY,
      leavingDestination: "discharged-to-the-community",
    });
    expect(bedIsOccupied(gone)).toBe(false);
  });

  /** The predicate is total over the state vocabulary: exactly two of the four states occupy. */
  it("is decided by state alone, and exactly two of the four states occupy a bed", () => {
    const occupying = ADMISSION_STATES.filter((state) => bedIsOccupied(anAdmission({ state })));
    expect(occupying).toEqual(["pulled", "occupied"]);
  });
});

describe("daysInBed — two different clocks", () => {
  /**
   * `arrivedAt` and `pulledAt` are DIFFERENT CLOCKS and must never be conflated. The bed has been
   * gone since the pull; the person's stay runs from arrival. Reading `pulledAt` here would
   * overstate every length of stay in the hospital by the transport delay — silently, and in the
   * same direction every time, which is how it would survive review.
   *
   * The two instants are deliberately a FULL DAY apart, so a swap changes the whole-day answer
   * and this assertion fails rather than rounding the defect away.
   */
  it("counts from arrivedAt, never from pulledAt", () => {
    const pulledADayBeforeArriving = anAdmission({
      state: "occupied",
      pulledAt: DAY_ZERO,
      arrivedAt: DAY_ZERO + MINUTES_PER_DAY,
    });
    const now = DAY_ZERO + MINUTES_PER_DAY + 3 * MINUTES_PER_DAY;

    expect(daysInBed(pulledADayBeforeArriving, now)).toBe(3);
    // Stated as its own assertion so the failure message names the defect: 4 is the pulledAt answer.
    expect(daysInBed(pulledADayBeforeArriving, now)).not.toBe(4);
  });

  it("returns null for someone who has not arrived", () => {
    expect(daysInBed(anAdmission({ state: "pulled", arrivedAt: null }), DAY_ZERO + MINUTES_PER_DAY)).toBeNull();
  });

  it("returns null rather than throwing or substituting a fallback for a non-finite instant", () => {
    expect(daysInBed(anAdmission({ arrivedAt: Number.NaN }), DAY_ZERO)).toBeNull();
    expect(daysInBed(anAdmission({ arrivedAt: Number.POSITIVE_INFINITY }), DAY_ZERO)).toBeNull();
    expect(daysInBed(anAdmission(), Number.NaN)).toBeNull();
  });

  /** An arrival later than `now` is incoherent data, not a negative stay. Never below zero. */
  it("never reports a negative stay", () => {
    expect(daysInBed(anAdmission({ arrivedAt: DAY_ZERO + 5 * MINUTES_PER_DAY }), DAY_ZERO)).toBe(0);
  });
});

describe("stayBand", () => {
  function bandIdAfterDays(days: number): string | null {
    const admission = anAdmission({ state: "occupied", arrivedAt: DAY_ZERO });
    return stayBand(admission, DAY_ZERO + days * MINUTES_PER_DAY)?.id ?? null;
  }

  it("bands a 5-day stay as under-2-weeks", () => {
    expect(bandIdAfterDays(5)).toBe("under-2-weeks");
  });

  /**
   * The value that moved. Under the previous bands a 13-day stay was already two bands up
   * (`1-4-weeks`); under the owner's it is still in the first. Asserted explicitly because it is
   * the whole point of the change — the first boundary now sits AFTER most stays have cleared
   * rather than before, so the palest shade stops holding nearly everybody.
   */
  it("keeps a 13-day stay in the first band, where the previous 1-week boundary did not", () => {
    expect(bandIdAfterDays(13)).toBe("under-2-weeks");
  });

  /**
   * BOUNDARY. Exactly fourteen days has left the first band, not stayed in it: `upToDays` is the
   * ceiling the band stops BELOW. An off-by-one here would under-report every stay sitting
   * exactly on a boundary, on every screen at once.
   */
  it("bands a stay of exactly 14 days as 2-weeks-1-month, not under-2-weeks", () => {
    expect(bandIdAfterDays(14)).toBe("2-weeks-1-month");
  });

  it("bands the other two boundaries the same way", () => {
    expect(bandIdAfterDays(29)).toBe("2-weeks-1-month");
    expect(bandIdAfterDays(30)).toBe("1-3-months");
    expect(bandIdAfterDays(89)).toBe("1-3-months");
    expect(bandIdAfterDays(90)).toBe("over-3-months");
  });

  it("bands a 100-day stay as over-3-months", () => {
    expect(bandIdAfterDays(100)).toBe("over-3-months");
  });

  /**
   * A pulled-but-empty bed has no stay yet. Returning a zero-day band would present it as a fresh
   * admission — a person shown as having just arrived somewhere they have not reached.
   */
  it("returns null for someone who has not arrived, rather than banding them as a fresh admission", () => {
    const pulled = anAdmission({ state: "pulled", pulledAt: DAY_ZERO, arrivedAt: null });
    expect(stayBand(pulled, DAY_ZERO + 2 * MINUTES_PER_DAY)).toBeNull();
  });
});

describe("isPastExpectedDischarge", () => {
  it("is true once the expected date has passed", () => {
    const admission = anAdmission({ expectedDischargeAt: DAY_ZERO + 2 * MINUTES_PER_DAY });
    expect(isPastExpectedDischarge(admission, DAY_ZERO + 3 * MINUTES_PER_DAY)).toBe(true);
  });

  it("is false before the expected date", () => {
    const admission = anAdmission({ expectedDischargeAt: DAY_ZERO + 2 * MINUTES_PER_DAY });
    expect(isPastExpectedDischarge(admission, DAY_ZERO + MINUTES_PER_DAY)).toBe(false);
  });

  /**
   * An ABSENT date must never read as "past due" — the same discipline `LegalForm.dueAt` holds
   * elsewhere in this codebase: an absent instant is rendered as absent, never substituted with a
   * fallback and never allowed to answer a question it has no basis to answer. Nobody has said
   * when this person is expected to leave, so nothing here may claim they are overdue.
   */
  it("is false when the expected date is null — an absent date is never past due", () => {
    expect(isPastExpectedDischarge(anAdmission({ expectedDischargeAt: null }), DAY_ZERO + 400 * MINUTES_PER_DAY)).toBe(
      false,
    );
  });

  it("is false for a non-finite instant rather than throwing", () => {
    expect(isPastExpectedDischarge(anAdmission({ expectedDischargeAt: Number.NaN }), DAY_ZERO)).toBe(false);
    expect(isPastExpectedDischarge(anAdmission({ expectedDischargeAt: DAY_ZERO }), Number.NaN)).toBe(false);
  });
});

describe("admissionsForUnit", () => {
  const here = "rph-adult-open";
  const elsewhere = "fsh-adult-secure";

  it("returns this unit's live admissions and excludes departed ones and other units", () => {
    const all: Admission[] = [
      anAdmission({ id: "ADM-here-waitlisted", unitId: here, state: "waitlisted", pulledAt: null, arrivedAt: null }),
      anAdmission({ id: "ADM-here-pulled", unitId: here, state: "pulled", arrivedAt: null }),
      anAdmission({ id: "ADM-here-occupied", unitId: here, state: "occupied" }),
      anAdmission({ id: "ADM-here-left", unitId: here, state: "left", leftAt: DAY_ZERO + MINUTES_PER_DAY }),
      anAdmission({ id: "ADM-elsewhere", unitId: elsewhere, state: "occupied" }),
    ];

    expect(admissionsForUnit(all, here).map((admission) => admission.id)).toEqual([
      "ADM-here-waitlisted",
      "ADM-here-pulled",
      "ADM-here-occupied",
    ]);
  });

  it("returns an empty list for a unit with nothing on it, rather than falling back to everything", () => {
    expect(admissionsForUnit([anAdmission({ unitId: elsewhere })], here)).toEqual([]);
  });
});

/**
 * STRUCTURAL PRIVACY, following the Phase 4/5/7 pattern (`tests/ward-referral-model.test.ts`'s
 * `Referral` allowlist, `tests/ward-bed-availability-model.test.ts`'s `LeaveBed` allowlist): an
 * ALLOWLIST of the exact field set, so a future field named `notes`, `diagnosis`, `name` or `dob`
 * FAILS rather than being discouraged by convention.
 *
 * Two halves, because one of them alone would be blind:
 *
 *   - The `ADMISSION_FIELDS` half is checked by plain `vitest run`, no `tsc` involved. That array
 *     is derived in the source from a total `Record<keyof Admission, true>`, so the compiler
 *     refuses a field added to the type and left out of it — and once it is in, this test fails
 *     at runtime. This is the half that catches a new field while an implementer is working.
 *   - The canonical-literal half is checked by TypeScript, not by vitest: every `Admission` field
 *     is required, so a field added to the type and omitted from the literal is a COMPILE error,
 *     invisible to `vitest run`. It is kept because it pins the two halves to each other.
 *
 * Stated plainly, because a guard that overstates its reach is this repository's most repeated
 * failure: a field added to `Admission` AND to neither the record nor the literal is caught by
 * `tsc` alone, not by this file.
 *
 * **THE LIST BELOW WAS WIDENED ON PURPOSE ON 2026-08-29, from fifteen fields to seventeen.**
 * `dischargeConfirmedAt` and `dischargeConfirmedBy` were added by an owner ruling, and the
 * widening is recorded here rather than absorbed silently — the same discipline `Referral` held to
 * when it went from three fields to five. An allowlist that grows without anybody saying so is not
 * an allowlist.
 *
 * What makes that widening permissible is WHAT the two fields are about. A discharge date is a
 * PLAN; confirming it is the ward's own DECISION, and both new fields record the ward's act — when
 * it decided, and which ROLE decided — in exactly the category `dischargeDateSetAt` and
 * `dischargeDateSetBy` already occupy. Neither is a fact about the person in the bed.
 *
 * **AND WIDENED AGAIN, LATER THE SAME DAY, TO EIGHTEEN — `tentativeDiagnosis`.** This one IS a
 * fact about the person, and it is the first. The owner reversed the standing no-diagnosis rule
 * himself: "It can give a tentative diagnosis. This is because most referrals will require a
 * diagnosis", and "Just create broad core categories used in Australia for mental health coding
 * for now". What ships is a single value from `TENTATIVE_DIAGNOSIS_BLOCKS` — eleven ICD-10-AM
 * Chapter V block headings — or `null`. Nothing finer, and no free-text route to it.
 *
 * **The forbidden-field test below was rewritten in the SAME change, and that is the load-bearing
 * part of this widening.** It used to compare field names against the exact string `"diagnosis"`,
 * which `tentativeDiagnosis` does not equal: adding the field would have left every assertion in
 * this file green without anybody widening anything, and the guard would have been STEPPED AROUND
 * rather than passed. It now matches on the diagnosis STEM, so the new field trips it, and the
 * field is then let through by being named in `AUTHORISED_PERSON_FACTS` — one line, one owner, one
 * date. A future `diagnosisDetail`, `provisionalDiagnosis` or `notes` still fails.
 */
describe("Admission privacy — structural", () => {
  const ALLOWED_ADMISSION_FIELDS = [
    "id",
    "unitId",
    "referralId",
    "sex",
    "homeRegion",
    // WIDENED ON PURPOSE, 2026-08-29 (second widening of the day) — see this describe block's own
    // doc comment. One field, and unlike the pair below it IS a fact about the person: a broad
    // ICD-10-AM Chapter V block, chosen from eleven, or `null`.
    "tentativeDiagnosis",
    "state",
    "pulledAt",
    "arrivedAt",
    "expectedDischargeAt",
    "dischargeDateMoves",
    "dischargeDateSetAt",
    "dischargeDateSetBy",
    // WIDENED ON PURPOSE, 2026-08-29 — see this describe block's own doc comment. Two fields, and
    // they are facts about the WARD'S OWN DECISION, not about a person.
    "dischargeConfirmedAt",
    "dischargeConfirmedBy",
    "blockReason",
    "leavingDestination",
    "leftAt",
  ].sort();

  it("declares exactly the permitted field set at runtime", () => {
    expect([...ADMISSION_FIELDS].sort()).toEqual(ALLOWED_ADMISSION_FIELDS);
  });

  it("gives a fully-populated Admission exactly the permitted field set", () => {
    const canonical: Required<Admission> = {
      id: "ADM-CANON",
      unitId: "rph-adult-open",
      referralId: "REF-CANON",
      sex: "Male",
      homeRegion: "Kimberley",
      // A BLOCK, never a condition and never anybody's words.
      tentativeDiagnosis: "F20–F29",
      state: "occupied",
      pulledAt: DAY_ZERO,
      arrivedAt: DAY_ZERO + MINUTES_PER_DAY,
      expectedDischargeAt: DAY_ZERO + 20 * MINUTES_PER_DAY,
      dischargeDateMoves: 2,
      dischargeDateSetAt: DAY_ZERO + 2 * MINUTES_PER_DAY,
      // A ROLE, never a personal name.
      dischargeDateSetBy: "Flow coordinator",
      dischargeConfirmedAt: DAY_ZERO + 3 * MINUTES_PER_DAY,
      // A ROLE too, and held to exactly the same bar as `dischargeDateSetBy` above.
      dischargeConfirmedBy: "Nurse unit manager",
      blockReason: "Awaiting transport",
      leavingDestination: "discharged-to-the-community",
      leftAt: DAY_ZERO + 30 * MINUTES_PER_DAY,
    };
    expect(Object.keys(canonical).sort()).toEqual(ALLOWED_ADMISSION_FIELDS);
  });

  /**
   * THE STEM DENYLIST — rewritten on 2026-08-29, in the same change that added
   * `tentativeDiagnosis`, and STRENGTHENED by that rewrite rather than relaxed by it.
   *
   * It used to compare each declared field name against exact strings, one of which was
   * `"diagnosis"`. `tentativeDiagnosis` is not equal to `"diagnosis"`, so the field could have been
   * added, shipped and rendered without a single assertion in this file going red — the guard would
   * have been walked around, not passed, and the widening above would have been a widening only in
   * the comments. That is the exact failure this test exists to make impossible, so the matching is
   * now on STEMS, case-insensitively, against the whole field name: any field whose name contains
   * `diagnos`, `note`, `comment`, `name`, `dob`, `address`, `text`, `history` or `patient` trips it,
   * wherever in the name it appears.
   *
   * One field is then let through, by name, in `AUTHORISED_PERSON_FACTS`. Adding a line there is
   * the deliberate act — it costs an owner, a date and a reason, and it cannot be done by accident
   * while adding a field. `provisionalDiagnosis`, `diagnosisDetail`, `notes`, `clinicalNote`,
   * `freeTextDiagnosis` and `patientName` all still fail.
   */
  it("holds no name, date of birth, record number, address, free text, or diagnosis beyond the one authorised block", () => {
    const forbiddenStems = [
      "diagnos",
      "notes",
      "note",
      "comment",
      "name",
      "dob",
      "patient",
      "address",
      "text",
      "history",
    ];

    /**
     * The ONLY fields permitted to match a stem above, each with the ruling that permitted it.
     * A name here is a governance record, not a convenience: it is what a reviewer reads when
     * asking why this record holds a fact about a person at all.
     */
    const AUTHORISED_PERSON_FACTS = new Map<string, string>([
      [
        "tentativeDiagnosis",
        "Owner ruling 2026-08-29: a referral's broad ICD-10-AM Chapter V block, chosen from eleven, never typed.",
      ],
    ]);

    const runtimeFields = [...ADMISSION_FIELDS];
    const builtFields = Object.keys(anAdmission());

    const offendersIn = (fields: readonly string[], source: string): string[] =>
      fields
        .filter((field) => forbiddenStems.some((stem) => field.toLowerCase().includes(stem)))
        .filter((field) => !AUTHORISED_PERSON_FACTS.has(field))
        .map((field) => `${source} declares an unauthorised person-fact field: ${field}`);

    expect([
      ...offendersIn(runtimeFields, "ADMISSION_FIELDS"),
      ...offendersIn(builtFields, "a real Admission"),
    ]).toEqual([]);

    // The authorised exception is really THERE — an entry left in this map after the field it names
    // was removed would quietly re-open the hole for the next field of that name.
    for (const authorised of AUTHORISED_PERSON_FACTS.keys()) {
      expect(runtimeFields, `${authorised} is authorised but not declared`).toContain(authorised);
      expect(builtFields, `${authorised} is authorised but not built`).toContain(authorised);
    }

    // The stems really discriminate — a denylist that matched nothing, or everything, would be the
    // "check that cannot fail" shape in either direction.
    const trips = (field: string): boolean =>
      forbiddenStems.some((stem) => field.toLowerCase().includes(stem)) && !AUTHORISED_PERSON_FACTS.has(field);
    for (const wouldBeCaught of [
      "notes",
      "note",
      "comment",
      "diagnosis",
      "provisionalDiagnosis",
      "diagnosisDetail",
      "freeTextDiagnosis",
      "name",
      "patientName",
      "dob",
      "address",
      "clinicalHistory",
    ]) {
      expect(trips(wouldBeCaught), `the denylist would not catch a field named ${wouldBeCaught}`).toBe(true);
    }
    for (const mustNotTrip of ["id", "unitId", "referralId", "sex", "homeRegion", "state", "blockReason", "leftAt"]) {
      expect(trips(mustNotTrip), `the denylist wrongly flags ${mustNotTrip}`).toBe(false);
    }
    expect(trips("tentativeDiagnosis"), "the authorised block field was not let through by name").toBe(false);

    // Non-vacuity: the two sets are really populated, so the loops above are not passing on nothing.
    expect(runtimeFields).toHaveLength(ALLOWED_ADMISSION_FIELDS.length);
    expect(builtFields).toHaveLength(ALLOWED_ADMISSION_FIELDS.length);
  });
});
