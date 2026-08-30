// tests/ward-discharge-dates.test.ts
import { describe, expect, it } from "vitest";

import type { Admission } from "../src/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import { BED_RELEASE_WAITING_ON } from "../src/components/ward-management/ward-model";
import {
  blockedReleaseCount,
  derivedBedReleases,
  dischargeDateAccuracy,
  statewideReleaseCount,
} from "../src/components/ward-management/ward-discharge-dates";

/**
 * Every admission below is CONSTRUCTED, never found by searching a shared fixture.
 *
 * `tests/ward-admission-model.test.ts` states the reason at the top of its own file: an
 * assertion that searches a collection for a satisfying example passes as soon as ANY example
 * exists — including one a live defect still permits. A sister session's most important test was
 * fake for exactly that reason. So every property here is asserted against an input built in
 * THIS file, with `.filter(...)`/`.find(...)` kept out of admissions and used only to read back
 * this module's own output.
 */
const DAY_ZERO = 8 * 60;

function anAdmission(overrides: Partial<Admission> = {}): Admission {
  return {
    id: "ADM-1",
    unitId: "rph-adult-open",
    referralId: "REF-1",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    // `null` on purpose: nothing in this file reads or asserts on the tentative diagnosis, so
    // a value here would be a fact nobody uses. The field is present because `Admission`
    // declares it non-optional — a record where nobody wrote one down is present-and-empty.
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: DAY_ZERO,
    arrivedAt: DAY_ZERO,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    // Nobody has confirmed anything by default — a plan is not a decision, so the base admission
    // here is one the ward has planned for and never decided on.
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    ...overrides,
  };
}

describe("derivedBedReleases — predicted releases", () => {
  /** Requirement 1: a date set on an occupied bed derives exactly one predicted release. */
  it("derives one predicted release from an admission with a discharge date set", () => {
    const admission = anAdmission({
      id: "ADM-PLAN",
      unitId: "rph-adult-open",
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 3 * MINUTES_PER_DAY,
      dischargeDateSetAt: DAY_ZERO,
      dischargeDateSetBy: "Flow coordinator",
    });

    const releases = derivedBedReleases([admission], DAY_ZERO);

    expect(releases).toHaveLength(1);
    const release = releases[0]!;
    expect(release.state).toBe("predicted");
    expect(release.unitId).toBe("rph-adult-open");
    expect(release.expectedAt).toBe(DAY_ZERO + 3 * MINUTES_PER_DAY);
  });

  /**
   * RULING 2. **Silence and "Nothing outstanding" are different facts and this module may only
   * produce the first of them.**
   *
   * A blank `waitingOn` means NOBODY HAS LOOKED at what is holding this discharge up.
   * `"Nothing outstanding"` means a ward looked and found nothing in the way. This module derives
   * from an `Admission`, which records no obstacle at all, so the only honest answer it can give
   * is the blank one — and it must give it even for an admission with a date, a setter and a
   * revision count, because none of those is somebody having examined the discharge.
   *
   * The defect this replaces defaulted EVERY derived prediction to `"Nothing outstanding"`, which
   * put the optimistic answer on the board for every discharge nobody had examined.
   *
   * Asserted as an EXPLICIT ABSENCE (`toBeNull`), never as `not.toBe("Nothing outstanding")` —
   * the latter would pass just as happily if the derivation started asserting "Awaiting ward
   * round" instead, which is a different invented claim and equally wrong.
   */
  it("gives a predicted release NO waitingOn — nobody has spoken about this discharge", () => {
    const nobodyHasLookedAtIt = anAdmission({
      id: "ADM-SILENT",
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 3 * MINUTES_PER_DAY,
      dischargeDateSetAt: DAY_ZERO,
      dischargeDateSetBy: "Flow coordinator",
      dischargeDateMoves: 2,
    });

    const releases = derivedBedReleases([nobodyHasLookedAtIt], DAY_ZERO);

    expect(releases).toHaveLength(1);
    expect(releases[0]!.state).toBe("predicted");
    expect(releases[0]!.waitingOn).toBeNull();
  });

  /**
   * RULING 2's other half, and a guard against a future tidy-up rather than against this module.
   *
   * The default was the defect; the VALUE is owner-approved and ships verbatim. A ward that has
   * actually checked and found nothing in the way still needs to be able to say so, and
   * `BED_RELEASE_WAITING_ON` is the one place that wording lives. Removing it because "nothing
   * sets it any more" would delete a real answer a ward can give, so it is pinned here.
   */
  it("keeps 'Nothing outstanding' in BED_RELEASE_WAITING_ON — a ward may still choose it", () => {
    expect(BED_RELEASE_WAITING_ON).toContain("Nothing outstanding");
  });

  /**
   * RULING 3, and BOTH HALVES ARE IN ONE TEST SO NEITHER CAN PASS ALONE.
   *
   * A discharge date is a PLAN; confirming it is a DECISION. The earlier implementation of this
   * module could reach only `"predicted"` because `Admission` recorded no decision, and it
   * declined to invent a proxy — a date within some window, a move count of zero, a date set a
   * while ago — because every one of those renders a decision nobody made. That refusal was
   * correct; `dischargeConfirmedAt` is the fix, and it is now the ONLY thing that may produce a
   * `"confirmed"` release.
   *
   * The two admissions below differ in exactly one field. A derivation that went back to reading
   * a date window, a move count or an elapsed time would give both the same state, and one of the
   * two assertions would fail whichever way it guessed.
   */
  it("derives 'confirmed' from dischargeConfirmedAt and 'predicted' without it, from otherwise identical admissions", () => {
    const now = DAY_ZERO;
    const planned = anAdmission({
      id: "ADM-PLANNED",
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 2 * MINUTES_PER_DAY,
      dischargeDateSetAt: DAY_ZERO - MINUTES_PER_DAY,
      dischargeDateSetBy: "Flow coordinator",
      dischargeConfirmedAt: null,
      dischargeConfirmedBy: null,
    });
    const decided: Admission = {
      ...planned,
      id: "ADM-DECIDED",
      dischargeConfirmedAt: DAY_ZERO - 60,
      // A ROLE, never a personal name.
      dischargeConfirmedBy: "Nurse unit manager",
    };

    const [plannedRelease] = derivedBedReleases([planned], now);
    const [decidedRelease] = derivedBedReleases([decided], now);

    expect(plannedRelease!.state).toBe("predicted");
    expect(decidedRelease!.state).toBe("confirmed");
    // The decision's own provenance travels with it — the confirming role, not the date-setter.
    expect(decidedRelease!.confirmedAt).toBe(DAY_ZERO - 60);
    expect(decidedRelease!.confirmedBy).toBe("Nurse unit manager");
  });

  /**
   * The refusal that survives RULING 3: `dischargeConfirmedAt` is the ONLY route to `"confirmed"`.
   *
   * Every admission here is one a proxy would have been tempted by — its date has already passed,
   * its date has never moved, its date was set long ago — and none of them has been confirmed.
   * All three must stay `"predicted"`, so a re-introduced window or move-count heuristic fails
   * here rather than quietly promoting discharges nobody decided on.
   */
  it("never reaches 'confirmed' from a date window, a move count or an elapsed setting time", () => {
    const now = DAY_ZERO + 10 * MINUTES_PER_DAY;
    const admissions: Admission[] = [
      anAdmission({ id: "ADM-DATE-PASSED", state: "occupied", expectedDischargeAt: DAY_ZERO }),
      anAdmission({
        id: "ADM-NEVER-MOVED",
        state: "occupied",
        expectedDischargeAt: now + MINUTES_PER_DAY,
        dischargeDateMoves: 0,
        dischargeDateSetAt: DAY_ZERO,
      }),
      anAdmission({
        id: "ADM-BLOCKED",
        state: "pulled",
        arrivedAt: null,
        expectedDischargeAt: now + 2 * MINUTES_PER_DAY,
        dischargeDateMoves: 4,
        blockReason: BED_RELEASE_BLOCKERS[0],
      }),
    ];

    const releases = derivedBedReleases(admissions, now);

    expect(releases).toHaveLength(3);
    expect(releases.map((release) => release.state)).toEqual(["predicted", "predicted", "predicted"]);
  });

  /**
   * Requirement 3, BINDING: an admission with no discharge date produces NO release at all —
   * never one at `now`, never one at a fallback instant. Asserted as a length, which is what
   * makes it falsifiable: a defect that fabricates a release at `now` turns this 0 into a 1, and
   * a defect that fabricates one at any other fallback instant is caught the same way.
   */
  it("produces no release at all for an admission with no discharge date set", () => {
    const noDatePlanned = anAdmission({ id: "ADM-NO-DATE", state: "occupied", expectedDischargeAt: null });
    const now = DAY_ZERO + 5 * MINUTES_PER_DAY;

    expect(derivedBedReleases([noDatePlanned], now)).toHaveLength(0);
  });

  /** A non-finite discharge date is exactly as absent as a null one — the same conservative
   *  refusal `daysInBed`/`isPastExpectedDischarge` (`ward-admissions.ts`) apply to a broken
   *  instant, never a thrown error and never a substituted fallback. */
  it("produces no release for a non-finite discharge date, rather than throwing or substituting a fallback", () => {
    const brokenDate = anAdmission({ state: "occupied", expectedDischargeAt: Number.NaN });
    expect(derivedBedReleases([brokenDate], DAY_ZERO)).toHaveLength(0);
  });

  /** Only a bed genuinely occupied can have a future release predicted — a waitlisted admission
   *  holds no bed yet, so an (incoherent) date recorded on one must not fabricate a release. */
  it("produces no release for a waitlisted admission even if a discharge date is somehow set", () => {
    const waitlistedWithADate = anAdmission({
      state: "waitlisted",
      pulledAt: null,
      arrivedAt: null,
      expectedDischargeAt: DAY_ZERO + MINUTES_PER_DAY,
    });
    expect(derivedBedReleases([waitlistedWithADate], DAY_ZERO)).toHaveLength(0);
  });
});

describe("blockedReleaseCount — the cross-cut, never a bucket subtraction", () => {
  /**
   * Requirement 4, THE MOST IMPORTANT TEST IN THIS FILE, adapted from "confirmed" to "predicted"
   * for the reason the test immediately above states in full: `derivedBedReleases` can only ever
   * reach `"predicted"` from live admission data, never `"confirmed"`. The invariant under test is
   * unchanged by that substitution — it is general to EVERY state bucket, not specific to
   * `"confirmed"`: adding a blocker must never remove a release from whichever bucket its
   * CERTAINTY already puts it in.
   *
   * This is the exact defect the three-stage bed-model rework closed (`ward-model.ts`'s own doc
   * comment on `BED_RELEASE_STATES`): sorting releases into buckets BY the presence of a blocker
   * — rather than counting the blocker ALONGSIDE the bucket a release's state already belongs to
   * — let a release plug up matching neither branch, and it was counted nowhere. Stated as an
   * invariance, not a search: the SAME admission, before and after a blocker is added, must keep
   * the same predicted count while the blocked count rises by exactly one.
   */
  it("adding a blocker to a predicted release leaves the predicted count unchanged and raises the blocked count by exactly one", () => {
    const now = DAY_ZERO;
    const notYetBlocked = anAdmission({
      id: "ADM-BLOCK",
      unitId: "rph-adult-open",
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 2 * MINUTES_PER_DAY,
      dischargeDateSetAt: DAY_ZERO,
      dischargeDateSetBy: "Flow coordinator",
      blockReason: null,
    });

    const predictedBefore = derivedBedReleases([notYetBlocked], now).filter((r) => r.state === "predicted").length;
    const blockedBefore = blockedReleaseCount([notYetBlocked], now);
    expect(predictedBefore).toBe(1);
    expect(blockedBefore).toBe(0);

    const nowBlocked: Admission = { ...notYetBlocked, blockReason: BED_RELEASE_BLOCKERS[0] };

    const predictedAfter = derivedBedReleases([nowBlocked], now).filter((r) => r.state === "predicted").length;
    const blockedAfter = blockedReleaseCount([nowBlocked], now);

    // THE INVARIANT: the predicted bucket does not shrink...
    expect(predictedAfter).toBe(predictedBefore);
    // ...while the cross-cut rises by exactly the one release that changed.
    expect(blockedAfter).toBe(blockedBefore + 1);
  });

  /**
   * THE SAME INVARIANT ON THE STAGE RULING 3 MADE REACHABLE, which is the stage the defect
   * actually cost: a stuck CONFIRMED discharge is the one a ward most needs to see, and sorting
   * releases by the presence of a blocker is what dropped it out of the confirmed count
   * altogether. A blocked-but-confirmed release is still confirmed; blocked is a CROSS-CUT, never
   * a bucket subtracted from a stage.
   *
   * The same admission before and after a blocker is added, so nothing but the blocker differs.
   * The confirmed count is pinned to an ABSOLUTE 1 on both sides as well as to its own previous
   * value: a derivation that returned no releases at all would be perfectly invariant and
   * perfectly useless, and `toBe(confirmedBefore)` alone could not tell the difference.
   */
  it("adding a blocker to a CONFIRMED release leaves the confirmed count unchanged and raises the blocked count by exactly one", () => {
    const now = DAY_ZERO;
    const confirmedNotBlocked = anAdmission({
      id: "ADM-CONFIRMED-BLOCK",
      unitId: "rph-adult-open",
      state: "occupied",
      expectedDischargeAt: DAY_ZERO + 2 * MINUTES_PER_DAY,
      dischargeDateSetAt: DAY_ZERO - MINUTES_PER_DAY,
      dischargeDateSetBy: "Flow coordinator",
      dischargeConfirmedAt: DAY_ZERO - 30,
      dischargeConfirmedBy: "Nurse unit manager",
      blockReason: null,
    });

    const confirmedBefore = derivedBedReleases([confirmedNotBlocked], now).filter(
      (r) => r.state === "confirmed",
    ).length;
    const blockedBefore = blockedReleaseCount([confirmedNotBlocked], now);
    expect(confirmedBefore).toBe(1);
    expect(blockedBefore).toBe(0);

    const confirmedAndBlocked: Admission = { ...confirmedNotBlocked, blockReason: BED_RELEASE_BLOCKERS[0] };

    const confirmedAfter = derivedBedReleases([confirmedAndBlocked], now).filter((r) => r.state === "confirmed").length;
    const blockedAfter = blockedReleaseCount([confirmedAndBlocked], now);

    // THE INVARIANT: the confirmed stage keeps its release...
    expect(confirmedAfter).toBe(confirmedBefore);
    // ...pinned to a real figure, so an empty derivation cannot satisfy the invariance vacuously.
    expect(confirmedAfter).toBe(1);
    // ...while the cross-cut rises by exactly the one release that changed.
    expect(blockedAfter).toBe(blockedBefore + 1);
    expect(blockedAfter).toBe(1);
  });
});

describe("statewideReleaseCount — a ward-to-ward transfer nets differently for the ward and the state", () => {
  /**
   * Requirement 5, both halves in ONE test so neither can pass alone. Two admissions leave in the
   * same instant: one is a genuine discharge to the community (frees a bed AND gives the state
   * one back), the other is a transfer to another psychiatric ward (frees a bed but gives the
   * state nothing — `LEAVING_DESTINATIONS`'s own `countsAsStatewideRelease: false`).
   *
   * Half 1 asserts the SENDING unit's own discharged-release count rises for BOTH admissions
   * equally — a transfer is still a real, local bed coming free; that is precisely what makes the
   * network figure interesting rather than a foregone conclusion. Half 2 asserts the statewide
   * count reflects only the genuine discharge: one, not two. Constructing both departures side by
   * side, rather than asserting the transfer's contribution is merely "not 2", is what stops this
   * test degenerating into a search that happens to find a passing example.
   */
  it("counts a released bed for both units, but the statewide total only for the genuine discharge", () => {
    const now = DAY_ZERO + 5 * MINUTES_PER_DAY;
    const sendingUnit = "rph-adult-open";
    const otherUnit = "fsh-adult-secure";

    const genuineDischarge = anAdmission({
      id: "ADM-DISCHARGE",
      unitId: otherUnit,
      state: "left",
      leftAt: now,
      leavingDestination: "discharged-to-the-community",
    });
    const transferredElsewhere = anAdmission({
      id: "ADM-TRANSFER",
      unitId: sendingUnit,
      state: "left",
      leftAt: now,
      leavingDestination: "transferred-to-another-psychiatric-ward",
    });

    const admissions = [genuineDischarge, transferredElsewhere];
    const releases = derivedBedReleases(admissions, now);

    // Half 1: each unit gets its own bed back, transfer included.
    expect(releases.filter((r) => r.unitId === sendingUnit && r.state === "discharged")).toHaveLength(1);
    expect(releases.filter((r) => r.unitId === otherUnit && r.state === "discharged")).toHaveLength(1);

    // Half 2: the network gained exactly one bed, not two.
    expect(statewideReleaseCount(admissions, now)).toBe(1);
  });
});

describe("dischargeDateAccuracy — null, never zero, when there is nothing to average", () => {
  /**
   * Requirement 6, BINDING: zero and "no data" are different claims. A `{ met: 0, moved: 0,
   * total: 0 }` would read on a screen as "this ward has a perfect record", when the truth in
   * every case below is that nobody has left, or nobody who left ever had a date to keep or move.
   */
  it("returns null for an empty admission list", () => {
    expect(dischargeDateAccuracy([])).toBeNull();
  });

  it("returns null when nobody has left yet, however many dates are planned", () => {
    const stillHere = anAdmission({
      state: "occupied",
      dischargeDateSetAt: DAY_ZERO,
      expectedDischargeAt: DAY_ZERO + MINUTES_PER_DAY,
    });
    expect(dischargeDateAccuracy([stillHere])).toBeNull();
  });

  /**
   * `dischargeDateMoves` defaults to `0` for an admission that never had a date at all — reading
   * that bare `0` as "met" would silently count an undated departure as a successful prediction.
   * This is the plausible-looking mistake the gate on `dischargeDateSetAt !== null` exists to
   * prevent.
   */
  it("returns null for a departed admission that never had a date set, even though its moves count is zero", () => {
    const leftWithNoDateEver = anAdmission({
      state: "left",
      leftAt: DAY_ZERO,
      dischargeDateSetAt: null,
      dischargeDateMoves: 0,
      leavingDestination: "discharged-to-the-community",
    });
    expect(dischargeDateAccuracy([leftWithNoDateEver])).toBeNull();
  });

  it("counts a departed admission whose date was never moved as met, and one that was revised as moved", () => {
    const met = anAdmission({
      id: "ADM-MET",
      state: "left",
      leftAt: DAY_ZERO,
      dischargeDateSetAt: DAY_ZERO - MINUTES_PER_DAY,
      dischargeDateMoves: 0,
      leavingDestination: "discharged-to-the-community",
    });
    const moved = anAdmission({
      id: "ADM-MOVED",
      state: "left",
      leftAt: DAY_ZERO,
      dischargeDateSetAt: DAY_ZERO - MINUTES_PER_DAY,
      dischargeDateMoves: 2,
      leavingDestination: "left-against-advice",
    });

    expect(dischargeDateAccuracy([met, moved])).toEqual({ met: 1, moved: 1, total: 2 });
  });
});
