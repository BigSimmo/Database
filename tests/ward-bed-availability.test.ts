import { describe, expect, it } from "vitest";

import {
  capacityBreakdown,
  EVENING_SHIFT_END_MINUTES,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
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
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
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
      [
        release({
          state: "blocked",
          blocker: BED_RELEASE_BLOCKERS[0],
          confidence: null,
          expectedAt: NOW_ANCHOR + 1440,
        }),
      ],
      [],
      NOW_ANCHOR,
    );
    expect(result.excludedBeyondToday).toBe(1);
    expect(result.confirmedToday).toBe(0);
    expect(result.predictedToday).toBe(0);
    expect(result.availableNow).toBe(capacityBreakdown(unit, [], [], NOW_ANCHOR).availableNow);
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
