import { describe, expect, it } from "vitest";

import {
  admissionStagePosition,
  bedsBeingPrepared,
  blockedDischargesByReason,
  declinesByReason,
  pullToArrival,
  referralToBedJoin,
  refusedAndNothingPending,
  type AdmissionStagePosition,
} from "@/components/ward-management/statistics/statistics-derivations";
import { ADMISSION_STATES, type Admission, type AdmissionState } from "@/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { BedRelease, Decline, DeclineReason, Movement, Referral } from "@/components/ward-management/ward-model";

/**
 * THE ARITHMETIC BEHIND THE STATISTICS SCREEN, PROVED AGAINST VALUES WRITTEN OUT BY HAND.
 *
 * ⚠️ **NO EXPECTATION IN THIS FILE IS COMPUTED WITH THE EXPRESSION THE IMPLEMENTATION USES.** Every
 * expected number below is either a literal typed into the assertion, or arithmetic done on
 * literals chosen so the answer is obvious by inspection. This project has already shipped a test
 * that derived its expected value from the implementation's own expression, so both sides moved
 * together and the check could not fail; that is the specific failure this discipline exists to
 * prevent, and it matters more here than anywhere because a wrong figure on the statistics screen
 * is believed rather than checked.
 *
 * ⚠️ **EVERY SCAN OVER A COLLECTION ASSERTS THE COLLECTION IS NON-EMPTY FIRST.** A check that walks
 * a set and finds no counter-example passes vacuously against an empty fixture, which is
 * indistinguishable from passing correctly. The seed-backed cases below therefore pin a
 * non-emptiness fact before pinning anything derived from the population.
 */

/** A fully-populated admission, minted rather than found, so populations the seed cannot produce
 *  are still testable. Typed as `Admission`, so a field added to the record fails to compile here
 *  rather than leaving this helper silently building a stale shape. */
function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-01",
    unitId: "unit-under-test",
    specialling: false,
    referralId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: null,
    arrivedAt: null,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

function bedRelease(overrides: Partial<BedRelease>): BedRelease {
  return {
    id: "BR-TEST-01",
    unitId: "unit-under-test",
    state: "expected",
    expectedAt: 0,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: 0,
    confirmedBy: "Ward manager",
    ...overrides,
  };
}

describe("admissionStagePosition — the one place an AdmissionState VALUE is read", () => {
  /**
   * The mapping is written out here as a literal table, NOT produced by calling the function and
   * recording what came back. `"left"` HAS since been renamed to `"departed"` — it landed in the
   * merge of 2026-09-01 — and that is exactly the event this shape is for: the old union member
   * disappeared, a table naming it stopped type-checking against `AdmissionState`, and the failure
   * was loud. A table generated from the implementation would have followed the rename in silence
   * and the figures would have quietly changed meaning instead.
   */
  const EXPECTED: Record<AdmissionState, AdmissionStagePosition> = {
    waitlisted: "no-bed-yet",
    pulled: "bed-given-not-arrived",
    occupied: "in-the-bed",
    departed: "ended",
  };

  /**
   * ⚠️ **THIS TEST, WITH "gives each state its own position" BELOW, IS THE GUARD FOR A HALF-LANDED
   * RENAME — AND IT CAUGHT ONE.** `"left"` became `"departed"` on 2026-09-01. An adversarial check
   * applied exactly the half-landed version — rename the union member and the seed, leave the stale
   * `case "left"` in place — and all 32 tests passed, because a member-driven check then compared
   * `undefined` against `EXPECTED["departed"]`, which is also `undefined`. This table is written out
   * as a literal for that reason, and this test is what walks it.
   *
   * ⚠️ **It depends on the `default:` arm still throwing.** The last test in this block is what keeps
   * that arm alive; strip it and this one passes in silence through the very rename it exists for.
   * Established by construction on 2026-09-01 against a real stale switch, not reasoned about.
   */
  it("covers every member of ADMISSION_STATES, and the set it walks is not empty", () => {
    // The vacuity guard: without it, an ADMISSION_STATES that had collapsed to `[]` would make
    // every assertion in the loop below pass by never running.
    expect(ADMISSION_STATES.length).toBe(4);

    for (const state of ADMISSION_STATES) {
      expect(admissionStagePosition(admission({ state }))).toBe(EXPECTED[state]);
    }
  });

  it("maps the departed state to 'ended' and nothing else", () => {
    expect(admissionStagePosition(admission({ state: "departed" }))).toBe("ended");
    expect(admissionStagePosition(admission({ state: "occupied" }))).not.toBe("ended");
  });

  it("gives each state its own position, so no two states are ever counted as the same thing", () => {
    const positions = ADMISSION_STATES.map((state) => admissionStagePosition(admission({ state })));
    expect(positions.length).toBe(4);
    expect(new Set(positions).size).toBe(4);
  });

  /**
   * ⚠️ **THIS TEST IS NOT THE CATCHER, AND BELIEVING IT IS COSTS YOU THE TWO THAT ARE.** It passes
   * green straight through a half-landed rename. What it does instead is keep the `default:` throw
   * arm alive — and that arm is the only reason "covers every member" and "gives each state its own
   * position" can see anything at all. Remove the arm and the function returns `undefined` for an
   * unhandled state, and both of those pass in silence. So this is the floor beneath them, not a
   * third check of the same thing: do not delete it as redundant coverage.
   *
   * The history, since it is what the two above were written for. `"left"` became `"departed"` on
   * 2026-09-01. An adversarial check applied exactly the half-landed version — rename the union
   * member and the seed, leave the stale `case "left"` in place — and all 32 tests passed, because
   * the member-driven check above then compared `undefined` against `EXPECTED["departed"]`, which
   * is also `undefined`.
   *
   * The probe value is therefore `"left"` and not `"departed"`: `"departed"` is now a real member
   * that the switch handles, so asking it to throw would assert the opposite of what is wanted.
   * The value fed in here must always be one the union does NOT hold.
   *
   * `tsc` sees that. **Vitest does not run `tsc`,** and the suite is what people run. So this test
   * reaches the `default:` arm with a value the union does not hold and asserts it THROWS rather
   * than returning `undefined` — the failure mode that made the survivor possible. The cast is the
   * point of the test: it simulates the runtime a stale `switch` would actually meet.
   */
  it("throws rather than returning undefined for a state it does not handle", () => {
    // The probe must always be a value the union does NOT hold, or this test asserts the opposite of
    // its purpose. Asserted rather than trusted: a transitional compat `case "left"` added during
    // some future rename would otherwise turn this red with "did not throw", which does not say why.
    const probe = "left";
    expect(ADMISSION_STATES as readonly string[]).not.toContain(probe);
    const renamed = { ...admission({}), state: probe as unknown as AdmissionState };

    expect(() => admissionStagePosition(renamed)).toThrow(/no stage position for admission state/);
    // And the message names the offending value, so the failure says WHICH member was missed
    // rather than only that one was.
    expect(() => admissionStagePosition(renamed)).toThrow(/left/);
  });
});

describe("pullToArrival", () => {
  it("averages the two instants on the record, and nothing else", () => {
    // 400 - 100 = 300, and 160 - 100 = 60. Mean of 300 and 60 is 180. Every number here is typed
    // out; nothing is recomputed from the implementation.
    const result = pullToArrival([
      admission({ id: "AD-A", pulledAt: 100, arrivedAt: 400 }),
      admission({ id: "AD-B", pulledAt: 100, arrivedAt: 160 }),
    ]);

    expect(result.measuredCount).toBe(2);
    expect(result.averageMinutes).toBe(180);
    expect(result.shortestMinutes).toBe(60);
    expect(result.longestMinutes).toBe(300);
  });

  it("returns null rather than 0 when there is nothing to average", () => {
    const result = pullToArrival([
      admission({ id: "AD-A", state: "waitlisted", pulledAt: null, arrivedAt: null }),
      admission({ id: "AD-B", state: "pulled", pulledAt: 50, arrivedAt: null }),
    ]);

    // The whole point: an average of nothing is absent, never nought. A mean of 0 would claim
    // everybody arrived the instant their bed was given away.
    expect(result.averageMinutes).toBeNull();
    expect(result.shortestMinutes).toBeNull();
    expect(result.longestMinutes).toBeNull();
    // The counts beside it are still real counts, and one of them is genuinely non-zero.
    expect(result.measuredCount).toBe(0);
    expect(result.awaitingArrivalCount).toBe(1);
  });

  it("excludes a bed given away where nobody has arrived, and counts it separately", () => {
    const result = pullToArrival([
      admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
      admission({ id: "AD-B", state: "pulled", pulledAt: 0, arrivedAt: null }),
      admission({ id: "AD-C", state: "pulled", pulledAt: 30, arrivedAt: null }),
    ]);

    // 120 alone: the two pulled admissions must not drag the average anywhere.
    expect(result.measuredCount).toBe(1);
    expect(result.averageMinutes).toBe(120);
    expect(result.awaitingArrivalCount).toBe(2);
  });

  it("keeps a completed gap after the admission has ended, and says how many of those there are", () => {
    const result = pullToArrival([
      admission({ id: "AD-A", state: "departed", pulledAt: 0, arrivedAt: 200, leftAt: 5000 }),
      admission({ id: "AD-B", state: "occupied", pulledAt: 0, arrivedAt: 400 }),
    ]);

    // 200 and 400 -> 300. The departed admission is IN the average; excluding it would shrink the
    // ward's own history every time somebody left.
    expect(result.measuredCount).toBe(2);
    expect(result.averageMinutes).toBe(300);
    expect(result.endedCount).toBe(1);
  });

  /**
   * ⚠️ **THE CHRONOLOGY GUARD.** Ward Lead ruled on 2026-09-01 that clamping a negative gap with
   * `Math.max(0, …)` is the defect — it converts "this record cannot be true" into "this patient
   * waited no time at all", and then averages that in as a real measurement. These two tests are
   * what hold that ruling here: a clamped implementation would put a 0 into the average and report
   * no incoherence, and both assertions below would go red.
   *
   * ⚠️ **THIS COMMENT DESCRIBED A DIVERGENCE FROM `averageEmptyBedMinutes` (`ward-statistics.ts`)
   * UNTIL THE MERGE OF 2026-09-01, AND THE DIVERGENCE IS GONE** — that function has had its clamp
   * removed under the same ruling and now returns `null` for a negative gap. The two modules agree.
   * Nothing in this file went red for the stale sentence; the claims register did, from the copy of
   * the same sentence in `statistics-derivations.ts`. A test comment is prose like any other and
   * has no guard of its own, which is why this correction is recorded rather than quietly applied.
   */
  it("excludes a negative gap from the average instead of clamping it to nought", () => {
    const result = pullToArrival([
      admission({ id: "AD-A", pulledAt: 0, arrivedAt: 240 }),
      // Arrived four hours BEFORE the bed was given away. A clamp would make this a 0 and pull the
      // average down to 120; excluding it leaves the one real measurement standing alone.
      admission({ id: "AD-B", pulledAt: 500, arrivedAt: 260 }),
    ]);

    expect(result.measuredCount).toBe(1);
    expect(result.averageMinutes).toBe(240);
    expect(result.incoherentCount).toBe(1);
    // And it must not creep into the extremes either.
    expect(result.shortestMinutes).toBe(240);
    expect(result.longestMinutes).toBe(240);
  });

  it("reports a real nought incoherent count when every record is coherent", () => {
    const result = pullToArrival([admission({ id: "AD-A", pulledAt: 0, arrivedAt: 240 })]);

    expect(result.incoherentCount).toBe(0);
  });

  it("counts an incoherent record even when it is the only one, leaving nothing to average", () => {
    const result = pullToArrival([admission({ id: "AD-A", pulledAt: 500, arrivedAt: 260 })]);

    // The two halves must not be confused: there is nothing to average (null, never nought) AND
    // there is one record that cannot be true (a genuine count of one).
    expect(result.averageMinutes).toBeNull();
    expect(result.measuredCount).toBe(0);
    expect(result.incoherentCount).toBe(1);
  });

  it("treats an exactly-simultaneous pull and arrival as coherent, not incoherent", () => {
    // Zero is a real gap, not a negative one. The boundary is `< 0`, and a `<= 0` guard here would
    // start discarding true records.
    const result = pullToArrival([admission({ id: "AD-A", pulledAt: 300, arrivedAt: 300 })]);

    expect(result.measuredCount).toBe(1);
    expect(result.averageMinutes).toBe(0);
    expect(result.incoherentCount).toBe(0);
  });

  it("skips a non-finite instant rather than coercing it to a number", () => {
    const result = pullToArrival([
      admission({ id: "AD-A", pulledAt: Number.NaN, arrivedAt: 400 }),
      admission({ id: "AD-B", pulledAt: 100, arrivedAt: 220 }),
    ]);

    expect(result.measuredCount).toBe(1);
    expect(result.averageMinutes).toBe(120);
  });

  it("reads the seeded world, where every measured gap is the same 5 hours the fixture writes", () => {
    const seeded = seedWardFlowState();
    const result = pullToArrival(seeded.admissions);

    // Vacuity guard first: a seed that produced no measurable admission would make every
    // assertion below meaningless rather than wrong.
    expect(seeded.admissions.length).toBeGreaterThan(0);
    expect(result.measuredCount).toBeGreaterThan(0);

    // 300 is read straight out of `ward-admissions-seed.ts` — `PULL_TO_ARRIVAL_MINUTES = 5 * 60`,
    // applied to every seeded arrival — not observed from this function's own output. That the
    // range collapses onto the average is the fixture telling the truth about itself: these are
    // authored instants with no spread, which is exactly why the screen renders the range beside
    // the average rather than the average alone.
    expect(result.averageMinutes).toBe(300);
    expect(result.shortestMinutes).toBe(300);
    expect(result.longestMinutes).toBe(300);

    // No seeded record is chronologically impossible, so the guard removes nothing from the figure
    // above. Pinned so that a seed which later DID carry one could not shrink the average without
    // this going red first.
    expect(result.incoherentCount).toBe(0);
  });
});

describe("referralToBedJoin", () => {
  /** A referral built by hand so the only fields these tests depend on — `id` and `raisedAt` — are
   *  literals typed out here rather than fixture values that could move underneath the assertion. */
  function referral(id: string, raisedAt: number): Referral {
    const [seeded] = seedWardFlowState().referrals;
    // Structural rather than hand-built: a field added to `Referral` must not silently give this
    // helper a stale shape, and only `id` and `raisedAt` are ever read by the function under test.
    return { ...seeded!, id, raisedAt };
  }

  it("matches an id exactly, and counts a match as a match", () => {
    const result = referralToBedJoin(
      [admission({ id: "AD-A", referralId: "RF-100", arrivedAt: 900 })],
      [referral("RF-100", 300)],
    );

    expect(result.withReferralIdCount).toBe(1);
    expect(result.joinedCount).toBe(1);
    // 900 is after 300, so this pair could carry a duration.
    expect(result.chronologicallyCoherentCount).toBe(1);
  });

  it("counts an unmatched id as unmatched rather than fuzzily resolving it", () => {
    const result = referralToBedJoin(
      [
        // A ward-tagged admission id of exactly the shape the admissions fixture mints, against a
        // referral list that does not contain it.
        admission({ id: "AD-A", referralId: "RF-GER1-01", arrivedAt: 900 }),
        // A real `null`: this admission came from a movement, not a referral.
        admission({ id: "AD-B", referralId: null }),
      ],
      [referral("RF-100", 300)],
    );

    expect(result.withReferralIdCount).toBe(1);
    expect(result.joinedCount).toBe(0);
    expect(result.chronologicallyCoherentCount).toBe(0);
  });

  it("refuses a matched pair whose admission arrived before the referral existed", () => {
    const result = referralToBedJoin(
      // Arrived at 100, referred at 300: the person was in the bed two hundred minutes before
      // anybody referred them. The ids match; the records are not the same person.
      [admission({ id: "AD-A", referralId: "RF-100", arrivedAt: 100 })],
      [referral("RF-100", 300)],
    );

    expect(result.joinedCount).toBe(1);
    expect(result.chronologicallyCoherentCount).toBe(0);
  });

  it("refuses a matched pair with no arrival instant at all", () => {
    const result = referralToBedJoin(
      [admission({ id: "AD-A", state: "waitlisted", referralId: "RF-100", arrivedAt: null })],
      [referral("RF-100", 300)],
    );

    expect(result.joinedCount).toBe(1);
    expect(result.chronologicallyCoherentCount).toBe(0);
  });

  it("reports a searched-referrals count so a nought join is not mistaken for an empty search", () => {
    const result = referralToBedJoin([admission({ id: "AD-A", referralId: "RF-001" })], []);

    expect(result.referralsSearchedCount).toBe(0);
    expect(result.joinedCount).toBe(0);
  });

  /**
   * ⚠️ **THIS FIGURE IS COUPLED TO TWO THINGS THAT DO NOT MENTION IT. READ THEM BEFORE CHANGING IT.**
   *
   *   1. `tests/ward-statistics.dom.test.tsx`, "the live world" — the same measurement rendered on
   *      the statistics screen, as `ward-statistics-join-matched-count` and
   *      `ward-statistics-join-coherent-count`. It moves whenever this does, and it is a separate
   *      file that will go red on its own.
   *   2. **The community hub.** `admissionBelongsToTeam`
   *      (`src/components/ward-management/community/community-derivations.ts`) does the SAME `find`
   *      over the SAME two arrays. A seeded admission whose `referralId` matches a real referral is
   *      simultaneously the only thing that makes this count non-nought and the only thing that can
   *      put anybody on one of the 65 community team pages. The two are one fact with two readers.
   *
   * The full account is `docs/ward-flow/fields-with-no-producer-2026-09-01.md` (final addendum).
   *
   * ⚠️ **THE MEASUREMENT THE SCREEN'S EMPTY STATE IS BUILT ON, AND THE FIGURE IN IT HAS MOVED TWICE.**
   * This asserted NINE matches until 2026-09-01. Those nine were then removed, for a separate
   * reason: they asked for no ward bed and were sitting at the top of the coordinator's
   * bed-matching queue. The join was then a true nought.
   *
   * ⚠️ **IT IS ONE SINCE THE `RF-007` SPLIT, AND ONE IS THE GOOD NEWS.** `AD-LEFT-01`
   * (`ward-admissions-seed.ts`) names `RF-010` (`ward-movements.ts`), the community-only referral
   * split out of `RF-007`. **The pair is chronologically coherent, which is the whole difference
   * between this and the nine:** `RF-010` is raised 24 days before the anchor and `AD-LEFT-01`
   * arrived 23 days ago, so `joinedCount` and `chronologicallyCoherentCount` are BOTH one. A future
   * change that makes them disagree — a match that cannot carry a duration — is the defect, not the
   * count moving.
   *
   * ⚠️ **THE NINE WERE AUTHORED, NOT ACCIDENTAL — and this comment said the opposite until the
   * merge of 2026-09-01.** `52ad01dda` added them deliberately, in its own words, "by using the ids
   * the admissions ALREADY hold, so not one admission changed", to close the first of two causes
   * that left all 65 community team pages empty. The earlier account of them as a collision between
   * the admissions fixture's ward tags and referrals that happened to share hospital abbreviations
   * was false, and so was "arriving weeks before the referral": three of the nine were 1.03, 3.03
   * and 5.04 days. The ~1-day case is the dangerous one, because it reads as a rounding error
   * rather than a category error.
   *
   * ⚠️ **BOTH HALVES ARE TRUE AND NEITHER ALONE IS THE STORY: the nine were DELIBERATE, and the
   * pairs they produced were NOT MEANINGFUL.** The pages genuinely rendered — that was the point of
   * authoring them — but every resulting pair has the patient arriving in the bed before the
   * referral existed, so not one could carry a duration. "It never worked" and "it worked by
   * coincidence" are both wrong; it worked on purpose, and what it showed was impossible. Both false claims were copied onto the SCREEN, and this test
   * stayed green through both — because it was measuring the count and nothing was watching the
   * reason. That is why the page no longer repeats either number in prose: it renders its counts
   * and explains only what a matched pair would have to be in order to date a bed, and that
   * sentence survives any value this test ends up asserting.
   *
   * ⚠️ **EVERY OTHER SEEDED ADMISSION STILL JOINS TO NOTHING, AND THAT IS WHY THE COUNT IS ONE
   * RATHER THAN MANY.** All four producers in `ward-admissions-seed.ts` MANUFACTURE `referralId`
   * from the admission's own id by string substitution, and `AD-LEFT-01` is the single exception
   * that names a real referral instead. So `withReferralIdCount` still equals the seeded admission
   * count by construction and remains evidence about the field rather than about the join.
   *
   * ⚠️ **DO NOT CLOSE THE REMAINING GAP BY RENAMING THE MANUFACTURED IDS TO MATCH REFERRALS.** That
   * is exactly what `52ad01dda` did, and it would make `joinedCount` jump while
   * `chronologicallyCoherentCount` stayed where it is — matched pairs that cannot carry a duration.
   * The two numbers below are asserted separately for that reason: they are what tells a real join
   * apart from a naming coincidence, and a single figure could not.
   */
  it("finds exactly one seeded pair, and that pair can carry a duration", () => {
    const seeded = seedWardFlowState();
    const result = referralToBedJoin(seeded.admissions, seeded.referrals);

    // Vacuity guards first — the claim below is worthless if either side is empty.
    expect(result.withReferralIdCount).toBeGreaterThan(0);
    expect(result.referralsSearchedCount).toBeGreaterThan(0);

    // AD-LEFT-01 -> RF-010, and nothing else. Asserted exactly, so a fixture change that
    // reintroduces a naming collision surfaces here rather than passing quietly.
    expect(result.joinedCount).toBe(1);

    // ⚠️ AND THE SAME ONE, NOT A SECOND UNRELATED PAIR. Equality with `joinedCount` is the
    // assertion that matters: every match must be a match that could date a bed. If this ever
    // reads lower than the line above, some admission is in a bed before its referral existed.
    expect(result.chronologicallyCoherentCount).toBe(1);
    expect(result.chronologicallyCoherentCount).toBe(result.joinedCount);
  });
});

describe("bedsBeingPrepared", () => {
  it("counts only the releases flagged as being made ready", () => {
    const count = bedsBeingPrepared([
      bedRelease({ id: "BR-A", preparing: true }),
      bedRelease({ id: "BR-B", preparing: false }),
      bedRelease({ id: "BR-C", preparing: true }),
    ]);

    expect(count).toBe(2);
  });

  it("returns a real nought when no bed is being prepared", () => {
    const count = bedsBeingPrepared([bedRelease({ id: "BR-A", preparing: false })]);

    // A count, not an absence. The screen renders this as a numeral whatever it is.
    expect(count).toBe(0);
  });

  it("returns a real nought for an empty list too", () => {
    expect(bedsBeingPrepared([])).toBe(0);
  });

  /**
   * ⚠️ **THE UNIQUENESS THE MODULE'S DOC COMMENT ASSERTS, PINNED — because one fixture line
   * falsifies it and nothing was watching.** `statistics-derivations.ts` says "the seed's only
   * `preparing: true` record carries `state: 'discharged'`", and that sentence is half of why the
   * screen may describe a preparing bed as one somebody has already left. A second seeded preparing
   * record, or one on an `"expected"` release, makes it false; either goes red here first.
   */
  it("finds exactly one seeded preparing bed, and it is a bed somebody has already left", () => {
    const seeded = seedWardFlowState();

    // Vacuity guard: an empty release list would satisfy every filter below by having nothing in it.
    expect(seeded.bedReleases.length).toBeGreaterThan(0);

    const preparing = seeded.bedReleases.filter((release) => release.preparing);
    expect(preparing.length).toBe(1);
    expect(preparing[0]?.state).toBe("discharged");
    // And the count the screen renders is that same one, so the page cannot disagree with this.
    expect(bedsBeingPrepared(seeded.bedReleases)).toBe(1);
  });

  /**
   * ⚠️ **THE FACT THE WHOLE "WITHHELD, NOT ABSENT" ARGUMENT STANDS ON, and it was pinned by
   * nothing.** The declines paragraph on the screen tells a coordinator that declines DO happen and
   * ARE recorded, and that the figure is withheld pending an owner ruling rather than missing. If
   * every seeded `Movement.declines` were empty that sentence would be describing a world the
   * prototype does not contain — true of the model, false of what a reader can see.
   */
  it("finds seeded movement declines, so the withheld-not-absent claim describes a real world", () => {
    const seeded = seedWardFlowState();

    expect(seeded.movements.length).toBeGreaterThan(0);

    const withDeclines = seeded.movements.filter((movement) => movement.declines.length > 0);
    // A real count rather than `> 0`: a seed that quietly lost one of the two surfaces here.
    expect(withDeclines.length).toBe(2);
    // Every decline names a unit — the half of the argument that makes `Movement.declines` the
    // record that CAN name a ward, and `ReferralAddressing` the one that cannot.
    for (const movement of withDeclines) {
      for (const decline of movement.declines) {
        expect(decline.unitId.length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * A fully-populated movement, minted rather than found, so populations the seed cannot produce are
 * still testable. Typed as `Movement`, so a field added to the record fails to compile here rather
 * than leaving this helper silently building a stale shape — the same discipline as `admission`
 * above, and the reason neither helper is written as a cast.
 */
function movement(overrides: Partial<Movement>): Movement {
  return {
    id: "WF-TEST-01",
    originEdId: "ed-under-test",
    openedAt: 0,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    ...overrides,
  };
}

/** A decline that names a unit and a reason. The instant is irrelevant to every figure below and is
 *  a literal rather than a clock read, so nothing here can accidentally become time-dependent. */
function decline(unitId: string, reason: DeclineReason): Decline {
  return { unitId, at: 0, reason };
}

describe("refusedAndNothingPending — a refusal on record and nothing pending, SO FAR", () => {
  /**
   * ⚠️ **THE NAME IS THE ASSERTION HERE.** This figure is headed "Referrals where every ward asked
   * SO FAR has refused", and the qualifier is load-bearing: the condition is satisfied by a
   * movement a coordinator is about to refer onward again, and the model holds no marker that
   * would let anything tell the two apart. The cases below pin exactly that — a movement moves in
   * and out of the count as its live referrals come and go, with no state anywhere recording that
   * the asking has finished.
   */
  it("counts a movement with a refusal on record and no ward currently deciding", () => {
    const result = refusedAndNothingPending(
      [movement({ id: "WF-A", referredUnitIds: [], declines: [decline("unit-1", "no_bed")] })],
      [],
      0,
    );

    expect(result.count).toBe(1);
    expect(result.openMovementCount).toBe(1);
    expect(result.escalatedCount).toBe(0);
  });

  /**
   * The half that makes "so far" true rather than cautious: referring the same movement onward
   * takes it straight back out of the count, while every refusal it collected stays on the record.
   * A figure that meant "nobody is left to ask" could not behave this way.
   */
  it("stops counting a movement the moment a fresh ward is asked, with the refusals still on record", () => {
    const declinedThenReferredOnward = movement({
      id: "WF-B",
      referredUnitIds: ["unit-4"],
      declines: [decline("unit-1", "no_bed"), decline("unit-2", "no_bed"), decline("unit-3", "no_bed")],
    });

    const result = refusedAndNothingPending([declinedThenReferredOnward], [], 0);

    // Three wards have refused it — more than most movements ever see — and it is still not counted,
    // because a fourth is deciding. Nothing in the record marks it as exhausted or not exhausted.
    expect(declinedThenReferredOnward.declines.length).toBe(3);
    expect(result.count).toBe(0);
    expect(result.openMovementCount).toBe(1);
  });

  it("does not count a movement nobody has refused, whatever else is true of it", () => {
    const result = refusedAndNothingPending([movement({ id: "WF-C", referredUnitIds: [], declines: [] })], [], 0);

    expect(result.count).toBe(0);
    expect(result.openMovementCount).toBe(1);
  });

  /**
   * ⚠️ **THE SUBTRACTION THE PAGE HAS TO DISCLOSE.** The shared derivation classifies an escalation
   * FIRST, so a movement that carries one is absent from the declined-by-all group even when it
   * meets the condition exactly. That makes `count` a floor. This test builds the overlap the seed
   * may or may not contain and pins both numbers, so the disclosure on the page is describing a
   * real behaviour rather than a defensive guess.
   */
  it("leaves an escalated movement out of the count even when it meets the condition, and says so", () => {
    const alsoEscalated = movement({
      id: "WF-D",
      referredUnitIds: [],
      declines: [decline("unit-1", "no_bed")],
      escalation: { at: 0, triedUnitIds: ["unit-1"], contact: "State bed coordination" },
    });

    const result = refusedAndNothingPending([alsoEscalated], [], 0);

    // It satisfies the condition by inspection — no live referral, one refusal — and is still not
    // in `count`. If this ever becomes 1, the page's "floor rather than the whole of it" note is
    // wrong and must be removed rather than left standing.
    expect(alsoEscalated.referredUnitIds.length).toBe(0);
    expect(alsoEscalated.declines.length).toBe(1);
    expect(result.count).toBe(0);
    expect(result.escalatedCount).toBe(1);
    expect(result.openMovementCount).toBe(1);
  });

  /**
   * ⚠️ **THE CLOCK IS TAKEN AND IS NOT PART OF THE ANSWER, and this is the test that keeps that
   * sentence honest.** `handoverSnapshot` demands a `now` for its own other sections; this figure
   * is scoped by `isOpen` and decided by two array lengths, neither of which reads a clock. The
   * page says so in prose. Prose has no guard, so the property is pinned here with two instants a
   * lifetime apart.
   */
  it("gives the same answer at two clocks a hundred years apart", () => {
    const population = [
      movement({ id: "WF-E", referredUnitIds: [], declines: [decline("unit-1", "sex_mix")] }),
      movement({ id: "WF-F", referredUnitIds: ["unit-2"], declines: [] }),
    ];

    const early = refusedAndNothingPending(population, [], 0);
    const late = refusedAndNothingPending(population, [], 52_596_000);

    expect(early).toEqual(late);
    expect(early.count).toBe(1);
  });

  it("returns a real nought for an empty world rather than refusing to answer", () => {
    const result = refusedAndNothingPending([], [], 0);

    expect(result.count).toBe(0);
    expect(result.escalatedCount).toBe(0);
    expect(result.openMovementCount).toBe(0);
  });
});

describe("declinesByReason — one row per member of the model's own vocabulary", () => {
  /**
   * ⚠️ **THE ROW SET IS COMPARED AGAINST `DECLINE_REASONS` ITSELF, NEVER AGAINST A LIST TYPED
   * HERE.** A hand-written expectation is a second copy of the vocabulary, and this project was
   * bitten by exactly that on 2026-09-01: a task brief carried a member name a rename had already
   * replaced, and a table plus a test both copied from it would have agreed with each other and
   * with nothing else. Comparing the whole ordered array is what makes a member added to the model
   * and missed by the derivation fail here.
   */
  it("returns one row per member, in the model's order, whatever the data contains", () => {
    // Vacuity guard: an empty vocabulary would satisfy the comparison below by having nothing in it.
    expect(DECLINE_REASONS.length).toBeGreaterThan(0);

    const result = declinesByReason([]);

    expect(result.tallies.map((tally) => tally.reason)).toEqual([...DECLINE_REASONS]);
    expect(result.vocabularySize).toBe(DECLINE_REASONS.length);
  });

  /**
   * ⚠️ **A MEMBER NOBODY USED IS A NOUGHT, NOT A MISSING ROW — and the distinction is the whole
   * reason the empties are rendered.** A missing row is what a broken generator produces too: a
   * mistyped filter or a bad mapping yields output indistinguishable from "nobody gave this
   * reason", and nothing goes red. A nought is evidence the count ran over that member.
   *
   * This is not a breach of "null is never zero". That rule is about an AVERAGE with nothing to
   * average; `ward-statistics.ts` documents the exemption for genuine counts in its own words, and
   * a decline count is a genuine count.
   */
  it("gives an unused reason a nought rather than dropping its row", () => {
    const used = DECLINE_REASONS[0];
    const unused = DECLINE_REASONS[1];
    // The premise, asserted rather than assumed: these must be two different members for the case
    // below to test anything at all.
    expect(used).not.toBe(unused);

    const result = declinesByReason([movement({ id: "WF-G", declines: [decline("unit-1", used)] })]);

    expect(result.tallies.length).toBe(DECLINE_REASONS.length);
    expect(result.tallies.find((tally) => tally.reason === used)?.count).toBe(1);
    expect(result.tallies.find((tally) => tally.reason === unused)?.count).toBe(0);
  });

  it("counts every decline against its own reason, across movements", () => {
    const [first, second] = [DECLINE_REASONS[0], DECLINE_REASONS[1]];
    expect(first).not.toBe(second);

    const result = declinesByReason([
      movement({ id: "WF-H", declines: [decline("unit-1", first), decline("unit-2", first)] }),
      movement({ id: "WF-I", declines: [decline("unit-3", second)] }),
      movement({ id: "WF-J", declines: [] }),
    ]);

    // 2 + 1 = 3, arithmetic on literals chosen so the answer is obvious by inspection.
    expect(result.totalCount).toBe(3);
    expect(result.tallies.find((tally) => tally.reason === first)?.count).toBe(2);
    expect(result.tallies.find((tally) => tally.reason === second)?.count).toBe(1);
    expect(result.movementsWithDeclinesCount).toBe(2);
    expect(result.movementCount).toBe(3);
  });

  /**
   * The sum-to-total invariant, which is what makes the table readable as a partition rather than
   * as a selection. Written as a fold over the rendered rows rather than recomputed from the input,
   * so it checks the OUTPUT against itself: a row silently dropped, double-counted, or counted into
   * the wrong member all break it.
   */
  it("has rows that sum to the total it reports", () => {
    const result = declinesByReason([
      movement({ id: "WF-K", declines: [decline("unit-1", DECLINE_REASONS[0])] }),
      movement({
        id: "WF-L",
        declines: [decline("unit-2", DECLINE_REASONS[2]), decline("unit-3", DECLINE_REASONS[0])],
      }),
    ]);

    expect(result.tallies.reduce((sum, tally) => sum + tally.count, 0)).toBe(result.totalCount);
    expect(result.totalCount).toBe(3);
  });

  /**
   * ⚠️ **AN UNRECOGNISED REASON THROWS RATHER THAN VANISHING.** The type forbids it, and `tsc` is
   * not what most people run — the seed is data, and a record carrying a reason outside the
   * vocabulary would otherwise shrink the total silently while every row still looked plausible.
   * The cast here is the whole point of the test and is the only one in this file.
   */
  it("refuses a decline whose reason is outside the vocabulary instead of quietly losing it", () => {
    const rogue = movement({
      id: "WF-M",
      declines: [{ unitId: "unit-1", at: 0, reason: "not_a_real_reason" as DeclineReason }],
    });

    expect(() => declinesByReason([rogue])).toThrow(/not a member of DECLINE_REASONS/);
  });

  /**
   * The seed-backed case, which is what stops the figure being proved only against minted data. The
   * two movements carrying declines are already pinned by the withheld-declines test in this file;
   * this asserts the tally agrees with the raw records rather than recomputing the derivation's own
   * expression — the expected total is counted straight off the seed, by a different route.
   */
  it("agrees with the seeded declines, counted a different way", () => {
    const seeded = seedWardFlowState();

    expect(seeded.movements.length).toBeGreaterThan(0);
    const rawTotal = seeded.movements.reduce((sum, seededMovement) => sum + seededMovement.declines.length, 0);
    // Vacuity guard: a seed with no declines at all would satisfy every assertion below trivially.
    expect(rawTotal).toBeGreaterThan(0);

    const result = declinesByReason(seeded.movements);

    expect(result.totalCount).toBe(rawTotal);
    expect(result.movementCount).toBe(seeded.movements.length);
    expect(result.tallies.length).toBe(DECLINE_REASONS.length);
  });
});

describe("blockedDischargesByReason — one row per member of the model's own vocabulary", () => {
  /**
   * Same discipline as `declinesByReason` above: the row set is compared against `BED_RELEASE_BLOCKERS`
   * itself, never against a list typed out here, so a member added to the model and missed by the
   * derivation fails this comparison rather than agreeing with a copy of itself.
   */
  it("returns one row per member, in the model's order, whatever the data contains", () => {
    // Vacuity guard: an empty vocabulary would satisfy the comparison below by having nothing in it.
    expect(BED_RELEASE_BLOCKERS.length).toBeGreaterThan(0);
    // Pinned so a change to the owner-approved list is a deliberate, visible edit here too.
    expect(BED_RELEASE_BLOCKERS.length).toBe(8);

    const result = blockedDischargesByReason([]);

    expect(result.tallies.map((tally) => tally.reason)).toEqual([...BED_RELEASE_BLOCKERS]);
    expect(result.vocabularySize).toBe(BED_RELEASE_BLOCKERS.length);
  });

  /**
   * ⚠️ A BLOCKER NOBODY USED IS A NOUGHT, NOT A MISSING ROW — the same reasoning `declinesByReason`
   * documents: a missing row is what a broken generator also produces, and nothing goes red for it.
   */
  it("gives an unused blocker a nought rather than dropping its row", () => {
    const used = BED_RELEASE_BLOCKERS[0];
    const unused = BED_RELEASE_BLOCKERS[1];
    expect(used).not.toBe(unused);

    const result = blockedDischargesByReason([admission({ id: "AD-USED", blockReason: used })]);

    expect(result.tallies.length).toBe(BED_RELEASE_BLOCKERS.length);
    expect(result.tallies.find((tally) => tally.reason === used)?.count).toBe(1);
    expect(result.tallies.find((tally) => tally.reason === unused)?.count).toBe(0);
  });

  it("counts every blocked admission against its own blocker, and an unblocked admission counts toward the population but no tally", () => {
    const [first, second] = [BED_RELEASE_BLOCKERS[0], BED_RELEASE_BLOCKERS[1]];
    expect(first).not.toBe(second);

    const result = blockedDischargesByReason([
      admission({ id: "AD-A", blockReason: first }),
      admission({ id: "AD-B", blockReason: first }),
      admission({ id: "AD-C", blockReason: second }),
      admission({ id: "AD-D", blockReason: null }),
    ]);

    // 2 + 1 = 3, arithmetic on literals chosen so the answer is obvious by inspection.
    expect(result.totalCount).toBe(3);
    expect(result.tallies.find((tally) => tally.reason === first)?.count).toBe(2);
    expect(result.tallies.find((tally) => tally.reason === second)?.count).toBe(1);
    expect(result.admissionCount).toBe(4);
  });

  /**
   * ⚠️ **THE SAME SCOPING `wardStatistics` APPLIES TO `readyToLeaveCannot`, quoted rather than
   * re-derived:** "`blockReason` describes what is currently holding a bed up. Someone who has
   * already left is no longer being held from leaving, whatever the record still says."
   */
  it("excludes departed admissions from both the population and the tally, whatever blockReason still says", () => {
    const blocker = BED_RELEASE_BLOCKERS[0];

    const result = blockedDischargesByReason([
      admission({ id: "AD-STILL-HERE", state: "occupied", blockReason: blocker }),
      admission({ id: "AD-DEPARTED", state: "departed", blockReason: blocker }),
    ]);

    expect(result.admissionCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.tallies.find((tally) => tally.reason === blocker)?.count).toBe(1);
  });

  it("has rows that sum to the total it reports", () => {
    const result = blockedDischargesByReason([
      admission({ id: "AD-E", blockReason: BED_RELEASE_BLOCKERS[0] }),
      admission({ id: "AD-F", blockReason: BED_RELEASE_BLOCKERS[2] }),
      admission({ id: "AD-G", blockReason: BED_RELEASE_BLOCKERS[0] }),
    ]);

    expect(result.tallies.reduce((sum, tally) => sum + tally.count, 0)).toBe(result.totalCount);
    expect(result.totalCount).toBe(3);
  });

  /**
   * ⚠️ **AN UNRECOGNISED BLOCKER THROWS RATHER THAN VANISHING.** The type forbids it, and `tsc` is
   * not what most people run — the cast here is the whole point of the test and is the only one in
   * this block.
   */
  it("refuses a block reason that is outside the vocabulary instead of quietly losing it", () => {
    const rogue = admission({ id: "AD-ROGUE", blockReason: "not_a_real_blocker" as BedReleaseBlocker });

    expect(() => blockedDischargesByReason([rogue])).toThrow(/not a member of BED_RELEASE_BLOCKERS/);
  });

  /**
   * The seed-backed case. The expected total is counted straight off the seed by a different route —
   * a raw field comparison rather than the derivation's own expression — matching how
   * `declinesByReason`'s seed test is proved.
   */
  it("agrees with the seeded blocked admissions, counted a different way", () => {
    const seeded = seedWardFlowState();

    expect(seeded.admissions.length).toBeGreaterThan(0);
    const stillOnWard = seeded.admissions.filter((seededAdmission) => seededAdmission.state !== "departed");
    const rawTotal = stillOnWard.filter((seededAdmission) => seededAdmission.blockReason !== null).length;
    // Vacuity guard: a seed with no blocked admissions at all would satisfy every assertion below trivially.
    expect(rawTotal).toBeGreaterThan(0);

    const result = blockedDischargesByReason(seeded.admissions);

    expect(result.totalCount).toBe(rawTotal);
    expect(result.admissionCount).toBe(stillOnWard.length);
    expect(result.tallies.length).toBe(BED_RELEASE_BLOCKERS.length);
  });
});
