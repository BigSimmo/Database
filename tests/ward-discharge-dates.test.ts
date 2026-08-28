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
    state: "occupied",
    pulledAt: DAY_ZERO,
    arrivedAt: DAY_ZERO,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    ...overrides,
  };
}

describe("derivedBedReleases — predicted releases", () => {
  /** Requirement 1: a date set on an occupied bed derives exactly one predicted release,
   *  carrying a waitingOn value drawn from the real vocabulary. */
  it("derives one predicted release from an admission with a discharge date set, carrying a waitingOn value", () => {
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
    expect(release.waitingOn).not.toBeNull();
    expect(BED_RELEASE_WAITING_ON).toContain(release.waitingOn);
  });

  /**
   * Requirement 2, AS WRITTEN IN THE BRIEF, is impossible to honour and this test documents why
   * rather than forcing a fake implementation of it.
   *
   * The brief asks for an admission "confirmed as going" to derive `state: "confirmed"`.
   * `Admission` (`ward-admissions.ts`, read before writing this file) has no field recording that
   * a ward has actively DECIDED a discharge is happening, as distinct from merely having set a
   * planned date — `state`, `blockReason`, `dischargeDateSetAt/By` and `dischargeDateMoves` are
   * the whole vocabulary, and none of them means "confirmed". In the live ward-flow model that
   * decision is `CONFIRM_BED_RELEASE` (`ward-flow-reducer.ts`), recorded on a SEPARATE, real
   * `BedRelease` the reducer tracks independently of any `Admission`. Inventing a proxy here (the
   * date has arrived, or has been set a while, or has never moved) would render a ward decision
   * that nobody made — exactly the class of fabricated fact this codebase treats as a defect
   * (`AGENTS.md`'s "Never invent a figure... from the Mental Health Act" is the sharpest version
   * of the same rule; this is the same discipline applied to a decision instead of a figure).
   *
   * So `derivedBedReleases` only ever emits `"predicted"` or `"released"` — asserted here as a
   * structural fact over a set of admissions built to exercise every state field this module
   * reads, so a future change that starts inventing a `"confirmed"` release trips this test
   * rather than silently landing.
   */
  it("never derives a 'confirmed' release — Admission carries no fact distinguishing a decided departure from a merely-planned one", () => {
    const admissions: Admission[] = [
      anAdmission({ id: "ADM-A", state: "occupied", expectedDischargeAt: DAY_ZERO + MINUTES_PER_DAY }),
      anAdmission({ id: "ADM-B", state: "pulled", arrivedAt: null, expectedDischargeAt: DAY_ZERO + 2 * MINUTES_PER_DAY }),
      anAdmission({
        id: "ADM-C",
        state: "occupied",
        expectedDischargeAt: DAY_ZERO + MINUTES_PER_DAY,
        dischargeDateMoves: 4,
        blockReason: BED_RELEASE_BLOCKERS[0],
      }),
    ];

    const releases = derivedBedReleases(admissions, DAY_ZERO);

    expect(releases.length).toBeGreaterThan(0);
    expect(releases.every((release) => release.state !== "confirmed")).toBe(true);
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
});

describe("statewideReleaseCount — a ward-to-ward transfer nets differently for the ward and the state", () => {
  /**
   * Requirement 5, both halves in ONE test so neither can pass alone. Two admissions leave in the
   * same instant: one is a genuine discharge to the community (frees a bed AND gives the state
   * one back), the other is a transfer to another psychiatric ward (frees a bed but gives the
   * state nothing — `LEAVING_DESTINATIONS`'s own `countsAsStatewideRelease: false`).
   *
   * Half 1 asserts the SENDING unit's own released-release count rises for BOTH admissions
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
    expect(releases.filter((r) => r.unitId === sendingUnit && r.state === "released")).toHaveLength(1);
    expect(releases.filter((r) => r.unitId === otherUnit && r.state === "released")).toHaveLength(1);

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
