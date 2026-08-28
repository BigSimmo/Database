import { describe, expect, it } from "vitest";

import {
  capacityBreakdown,
  EVENING_SHIFT_END_MINUTES,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const unit = allUnits()[0];

function release(overrides: Partial<BedRelease>): BedRelease {
  return {
    id: "WR-T01",
    unitId: unit.id,
    state: "predicted",
    expectedAt: NOW_ANCHOR + 60,
    confidence: "likely",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

/** A release carrying the blocked flag, with the role that recorded it — the two always move
 *  together (`tests/ward-bed-availability-model.test.ts` pins that on the fixture). */
function blockedRelease(overrides: Partial<BedRelease>): BedRelease {
  return release({ blocker: BED_RELEASE_BLOCKERS[0], blockedBy: "NUM Test Unit", ...overrides });
}

function leave(overrides: Partial<LeaveBed>): LeaveBed {
  return {
    id: "WL-T01",
    unitId: unit.id,
    usable: true,
    expectedReturn: NOW_ANCHOR + 300,
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

describe("release bands", () => {
  it("ends the evening shift at 22:00, expressed once", () => {
    expect(EVENING_SHIFT_END_MINUTES).toBe(1320);
  });

  it("puts an already-released bed in 'now' whatever its expected time said", () => {
    expect(releaseBand(release({ state: "released", expectedAt: NOW_ANCHOR + 600 }), NOW_ANCHOR)).toBe("now");
  });

  it("drops a released bed off 'now' once the operating day rolls over", () => {
    const released = release({ state: "released", expectedAt: NOW_ANCHOR, confirmedAt: NOW_ANCHOR });
    expect(releaseBand(released, NOW_ANCHOR)).toBe("now");
    expect(releaseBand(released, NOW_ANCHOR + MINUTES_PER_DAY)).toBe("beyond-today");
  });

  it("excludes anything expected after the evening shift ends", () => {
    // 1440 minutes is a full day past the anchor, so it lands beyond tonight whatever hour the
    // anchor sits at.
    expect(releaseBand(release({ expectedAt: NOW_ANCHOR + 1440 }), NOW_ANCHOR)).toBe("beyond-today");
  });
});

describe("capacity breakdown", () => {
  it("never adds a predicted or confirmed bed into availableNow", () => {
    const bare = capacityBreakdown(unit, [], [], NOW_ANCHOR);
    const loaded = capacityBreakdown(
      unit,
      [release({ state: "predicted" }), release({ id: "WR-T02", state: "confirmed", confidence: null })],
      [],
      NOW_ANCHOR,
    );
    expect(loaded.availableNow).toBe(bare.availableNow);
    expect(loaded.predictedToday).toBe(1);
    expect(loaded.confirmedToday).toBe(1);
  });

  it("never merges a usable leave bed into availableNow either", () => {
    const bare = capacityBreakdown(unit, [], [], NOW_ANCHOR);
    const withLeave = capacityBreakdown(unit, [], [leave({ usable: true })], NOW_ANCHOR);
    expect(withLeave.availableNow).toBe(bare.availableNow);
    expect(withLeave.leaveUsable).toBe(1);
  });

  it("counts an unusable leave bed in neither figure", () => {
    const result = capacityBreakdown(unit, [], [leave({ usable: false })], NOW_ANCHOR);
    expect(result.leaveUsable).toBe(0);
  });

  it("reports what it excluded rather than dropping it silently", () => {
    const result = capacityBreakdown(unit, [release({ expectedAt: NOW_ANCHOR + 1440 })], [], NOW_ANCHOR);
    expect(result.predictedToday).toBe(0);
    expect(result.excludedBeyondToday).toBe(1);
  });

  it("counts a blocked release expected beyond today in excludedBeyondToday and nowhere else", () => {
    const result = capacityBreakdown(
      unit,
      [blockedRelease({ state: "confirmed", confidence: null, expectedAt: NOW_ANCHOR + 1440 })],
      [],
      NOW_ANCHOR,
    );
    expect(result.excludedBeyondToday).toBe(1);
    expect(result.confirmedToday).toBe(0);
    expect(result.predictedToday).toBe(0);
    // Q2 (2026-08-28): the today horizon and its excluded count both stay. The blocked figure
    // obeys the same horizon as the two it cross-cuts, so a release counted as excluded is never
    // also counted as blocked — that would be one release appearing in two totals.
    expect(result.blockedToday).toBe(0);
    expect(result.availableNow).toBe(capacityBreakdown(unit, [], [], NOW_ANCHOR).availableNow);
  });

  /**
   * THE defect this whole bed-model rework exists to close, verified in the code before the change
   * was raised. `capacityBreakdown` used to sort today's releases into `confirmedToday` or
   * `predictedToday` by state; a release in the fourth state `"blocked"` matched NEITHER branch
   * and was counted nowhere at all. Marking a confirmed discharge as blocked therefore DROPPED the
   * ward's confirmed count by one, with nothing appearing anywhere to say why — the figures
   * improved at the exact moment the ward got stuck.
   *
   * The `bare` comparison is what makes this a guard rather than a restatement: it pins that
   * flagging an existing confirmed release changes the confirmed count by exactly nothing.
   */
  it("keeps a blocked-but-confirmed release counting as confirmed, and reports it as blocked beside that", () => {
    const unblocked = capacityBreakdown(unit, [release({ state: "confirmed", confidence: null })], [], NOW_ANCHOR);
    const blocked = capacityBreakdown(unit, [blockedRelease({ state: "confirmed", confidence: null })], [], NOW_ANCHOR);

    expect(unblocked.confirmedToday).toBe(1);
    expect(unblocked.blockedToday).toBe(0);

    // The bed is stuck, and it is still a confirmed discharge. Both facts, at once.
    expect(blocked.confirmedToday).toBe(1);
    expect(blocked.blockedToday).toBe(1);
    // ...and being stuck never leaks into "a bed I can fill this minute".
    expect(blocked.availableNow).toBe(capacityBreakdown(unit, [], [], NOW_ANCHOR).availableNow);
  });

  it("keeps a blocked-but-predicted release counting as predicted, and reports it as blocked beside that", () => {
    const result = capacityBreakdown(unit, [blockedRelease({ state: "predicted" })], [], NOW_ANCHOR);
    expect(result.predictedToday).toBe(1);
    expect(result.confirmedToday).toBe(0);
    expect(result.blockedToday).toBe(1);
  });

  /**
   * `blockedToday` is a CROSS-CUT, not a fourth bucket — every release it counts is also counted
   * in `confirmedToday` or `predictedToday`. Asserted over a mixed set rather than a single
   * release so an implementation that partitioned the three (subtracting blocked out of the other
   * two) fails here rather than passing the two single-release cases above.
   */
  it("counts blocked releases as a cross-cut of confirmed and predicted, never as a bucket taken out of them", () => {
    const result = capacityBreakdown(
      unit,
      [
        release({ id: "WR-T01", state: "confirmed", confidence: null }),
        blockedRelease({ id: "WR-T02", state: "confirmed", confidence: null }),
        release({ id: "WR-T03", state: "predicted" }),
        blockedRelease({ id: "WR-T04", state: "predicted" }),
      ],
      [],
      NOW_ANCHOR,
    );
    expect(result.confirmedToday).toBe(2);
    expect(result.predictedToday).toBe(2);
    expect(result.blockedToday).toBe(2);
  });

  /**
   * Q4 (2026-08-28), the owner's own clinical answer: "Once a bed is available, a patient will be
   * pulled. Pulled patient takes hours to transport and move, so it is fine to allocate this bed.
   * Just have a note for preparing bed maybe until it is ready."
   *
   * So a bed being made ready is **still offered, still counted, and still appears in every
   * figure**. This pins that the preparation indication gates nothing: every figure is identical
   * with and without it, which is stronger than checking `availableNow` alone — a mistaken
   * implementation is as likely to quarantine the bed out of `confirmedToday` as out of
   * `availableNow`.
   */
  it("never lets a preparation note change any figure — a bed being made ready is still available", () => {
    const plain = release({ state: "released", preparing: false });
    const beingPrepared = release({ state: "released", preparing: true });

    expect(capacityBreakdown(unit, [beingPrepared], [], NOW_ANCHOR)).toEqual(
      capacityBreakdown(unit, [plain], [], NOW_ANCHOR),
    );
    // Non-vacuity: the unit really does have beds to lose, so an implementation that withheld one
    // while it was being cleaned would have somewhere to lose it from.
    expect(capacityBreakdown(unit, [beingPrepared], [], NOW_ANCHOR).availableNow).toBeGreaterThan(0);
  });

  it("never lets a preparation note change a figure on an unreleased release either", () => {
    const plain = release({ state: "confirmed", confidence: null, preparing: false });
    const beingPrepared = release({ state: "confirmed", confidence: null, preparing: true });

    expect(capacityBreakdown(unit, [beingPrepared], [], NOW_ANCHOR)).toEqual(
      capacityBreakdown(unit, [plain], [], NOW_ANCHOR),
    );
    expect(capacityBreakdown(unit, [beingPrepared], [], NOW_ANCHOR).confirmedToday).toBe(1);
  });

  it("ignores releases and leave beds belonging to another unit", () => {
    const result = capacityBreakdown(
      unit,
      [release({ unitId: "not-this-unit" })],
      [leave({ unitId: "not-this-unit" })],
      NOW_ANCHOR,
    );
    expect(result.predictedToday).toBe(0);
    expect(result.leaveUsable).toBe(0);
  });
});
