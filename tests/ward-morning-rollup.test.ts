import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import {
  CAPACITY_FIGURE_LABELS,
  MORNING_HANDOVER_MINUTES,
  morningHandoverInstant,
  serviceRollup,
} from "@/components/ward-management/ward-morning-rollup";
import type { BedRelease, LeaveBed, Site, Unit } from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    security: "Open",
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    speciallingCapacity: 1,
    ...overrides,
  };
}

function site(overrides: Partial<Site> = {}): Site {
  return {
    code: "RPH",
    name: "Test Site",
    service: "North Metro",
    units: [],
    ...overrides,
  };
}

describe("ward-morning-rollup", () => {
  describe("rule 1: figures are plain sums of the per-unit breakdown", () => {
    it("sums availableNow, confirmedToday, predictedToday, held and leaveUsable across units", () => {
      const unitA = unit({
        id: "unit-a",
        siteCode: "RPH",
        empty: { value: 3, source: "feed", confirmedAt: NOW, staleAfterMinutes: 15 },
        allocatable: { value: 2, source: "ward", confirmedAt: NOW, staleAfterMinutes: 120 },
      });
      const unitB = unit({
        id: "unit-b",
        siteCode: "RPH",
        empty: { value: 5, source: "feed", confirmedAt: NOW, staleAfterMinutes: 15 },
        allocatable: { value: 4, source: "ward", confirmedAt: NOW, staleAfterMinutes: 120 },
      });
      const releases: BedRelease[] = [
        {
          id: "r-1",
          unitId: "unit-a",
          state: "confirmed",
          expectedAt: NOW,
          confidence: null,
          blocker: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        {
          id: "r-2",
          unitId: "unit-b",
          state: "predicted",
          expectedAt: NOW,
          confidence: "likely",
          blocker: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        {
          id: "r-3",
          unitId: "unit-b",
          state: "confirmed",
          expectedAt: NOW,
          confidence: null,
          blocker: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
      ];
      const leave: LeaveBed[] = [
        {
          id: "l-1",
          unitId: "unit-a",
          usable: true,
          expectedReturn: NOW + 100,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
      ];
      const testSite = site({ code: "RPH" });

      const result = serviceRollup(
        [testSite],
        [unitA, unitB],
        releases,
        leave,
        NOW,
      );

      // Hand-computed expectation: availableNow = min(empty, allocatable) per unit — unit-a
      // min(3,2)=2, unit-b min(5,4)=4, total 6. held = max(empty - availableNow, 0) per unit —
      // unit-a max(3-2,0)=1, unit-b max(5-4,0)=1, total 2. confirmedToday = 2 (unit-a's r-1
      // confirmed release plus unit-b's r-3 confirmed release). predictedToday = 1 (unit-b's
      // r-2 predicted release). The two figures are deliberately asymmetric (2 vs 1) so a
      // swap between confirmedToday and predictedToday in sumBreakdowns changes both totals
      // and cannot pass unnoticed.
      expect(result.service.availableNow).toBe(6);
      expect(result.service.held).toBe(2);
      expect(result.service.confirmedToday).toBe(2);
      expect(result.service.predictedToday).toBe(1);
      expect(result.service.leaveUsable).toBe(1);
    });
  });

  describe("rule 2: freshness uses the OLDEST contributing confirmedAt, never the newest", () => {
    it("reports the older of two units' confirmedAt, not the newer", () => {
      const older = unit({
        id: "unit-older",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NOW - 500, staleAfterMinutes: 120 },
      });
      const newer = unit({
        id: "unit-newer",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
      });
      const testSite = site({ code: "RPH" });

      const result = serviceRollup([testSite], [older, newer], [], [], NOW);

      expect(result.service.freshness.kind).toBe("confirmed");
      if (result.service.freshness.kind === "confirmed") {
        expect(result.service.freshness.oldestConfirmedAt).toBe(NOW - 500);
      }
    });
  });

  describe("rule 3: freshness kind — never / partial / confirmed", () => {
    it("is 'never' when no unit below has ever confirmed", () => {
      const a = unit({ id: "a", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 } });
      const b = unit({ id: "b", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 } });
      const result = serviceRollup([site({ code: "RPH" })], [a, b], [], [], NOW);
      expect(result.service.freshness).toEqual({ kind: "never" });
    });

    it("is 'partial' when at least one unit has confirmed and at least one has not", () => {
      const confirmed = unit({ id: "confirmed", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NOW - 20, staleAfterMinutes: 120 } });
      const never = unit({ id: "never", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 } });
      const result = serviceRollup([site({ code: "RPH" })], [confirmed, never], [], [], NOW);
      expect(result.service.freshness).toEqual({
        kind: "partial",
        oldestConfirmedAt: NOW - 20,
        unitsConfirmed: 1,
        unitsTotal: 2,
      });
    });

    it("is 'confirmed' when every unit below has confirmed", () => {
      const a = unit({ id: "a", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NOW - 20, staleAfterMinutes: 120 } });
      const b = unit({ id: "b", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 120 } });
      const result = serviceRollup([site({ code: "RPH" })], [a, b], [], [], NOW);
      expect(result.service.freshness).toEqual({
        kind: "confirmed",
        oldestConfirmedAt: NOW - 20,
        unitsConfirmed: 2,
        unitsTotal: 2,
      });
    });
  });

  describe("rule 4: morningHandoverInstant", () => {
    it("returns 08:00 of now's operating day once handover has happened", () => {
      const day = 5;
      const now: Instant = day * MINUTES_PER_DAY + MORNING_HANDOVER_MINUTES + 30; // 08:30
      expect(morningHandoverInstant(now)).toBe(day * MINUTES_PER_DAY + MORNING_HANDOVER_MINUTES);
    });

    it("returns exactly the 08:00 instant at the boundary (now === handover)", () => {
      const day = 5;
      const handover = day * MINUTES_PER_DAY + MORNING_HANDOVER_MINUTES;
      expect(morningHandoverInstant(handover)).toBe(handover);
    });

    it("returns null when now is earlier in the day than 08:00, never falling back to now", () => {
      const day = 5;
      const now: Instant = day * MINUTES_PER_DAY + MORNING_HANDOVER_MINUTES - 1; // 07:59
      expect(morningHandoverInstant(now)).toBeNull();
    });

    it("never returns a previous day's instant when now is before today's handover", () => {
      const day = 5;
      const now: Instant = day * MINUTES_PER_DAY + 60; // 01:00 on day 5
      const result = morningHandoverInstant(now);
      // Must not be day 4's 08:00 — the only legal values are null or today's 08:00.
      expect(result).not.toBe((day - 1) * MINUTES_PER_DAY + MORNING_HANDOVER_MINUTES);
      expect(result).toBeNull();
    });
  });

  describe("rule 5: absent or non-finite confirmedAt counts as never-confirmed, no sentinel invented", () => {
    it("treats a unit missing allocatable.confirmedAt as never-confirmed", () => {
      const missing = unit({ id: "missing", siteCode: "RPH" });
      // Delete the field entirely to simulate "absent", not merely zero or falsy.
      const withMissingConfirmedAt = {
        ...missing,
        allocatable: { ...missing.allocatable },
      } as Unit;
      delete (withMissingConfirmedAt.allocatable as Partial<typeof missing.allocatable>).confirmedAt;

      const result = serviceRollup([site({ code: "RPH" })], [withMissingConfirmedAt], [], [], NOW);
      expect(result.service.freshness).toEqual({ kind: "never" });
    });

    it("treats a unit with a NaN confirmedAt as never-confirmed rather than a real timestamp", () => {
      const nanUnit = unit({
        id: "nan-unit",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 },
      });
      const result = serviceRollup([site({ code: "RPH" })], [nanUnit], [], [], NOW);
      expect(result.service.freshness).toEqual({ kind: "never" });
    });
  });

  describe("R2: figures come from the units argument, never from sites' own embedded units", () => {
    it("uses the passed-in units for figures even when a site's embedded units differ", () => {
      const passedInUnit = unit({
        id: "passed-in",
        siteCode: "RPH",
        empty: { value: 9, source: "feed", confirmedAt: NOW, staleAfterMinutes: 15 },
        allocatable: { value: 9, source: "ward", confirmedAt: NOW, staleAfterMinutes: 120 },
      });
      const siteWithDifferentEmbeddedUnit = site({
        code: "RPH",
        units: [unit({ id: "embedded-only", siteCode: "RPH", allocatable: { value: 1, source: "ward", confirmedAt: NOW, staleAfterMinutes: 120 } })],
      });

      const result = serviceRollup([siteWithDifferentEmbeddedUnit], [passedInUnit], [], [], NOW);

      expect(result.service.availableNow).toBe(9);
      expect(result.sites[0]?.units.map((u) => u.unit.id)).toEqual(["passed-in"]);
      expect(result.unplacedUnitIds).toEqual([]);
    });

    it("reports a unit whose site code matches no site as unplaced, and still counts it in the total", () => {
      const orphanUnit = unit({
        id: "orphan",
        siteCode: "NOWHERE",
        allocatable: { value: 3, source: "ward", confirmedAt: NOW, staleAfterMinutes: 120 },
      });
      const result = serviceRollup([site({ code: "RPH" })], [orphanUnit], [], [], NOW);

      expect(result.unplacedUnitIds).toEqual(["orphan"]);
      expect(result.sites[0]?.units).toEqual([]);
      expect(result.service.availableNow).toBe(3);
    });
  });

  /**
   * D2's protection: nothing predicted, confirmed-but-unreleased, or on leave may ever reach the
   * headline `availableNow` figure. `availableNow` is computed from `unit.allocatable`/`unit.empty`
   * before any release is examined (mirroring `capacityBreakdown` in `ward-bed-availability.ts`),
   * so it must be identical whether or not any releases or leave beds exist at all. If a release
   * could ever reach it, these two would differ.
   */
  it("never lets a release or a leave bed reach the headline figure", () => {
    const units = allUnits();
    const withReleases = serviceRollup(wardSites, units, bedReleases, leaveBeds, NOW_ANCHOR);
    const withNone = serviceRollup(wardSites, units, [], [], NOW_ANCHOR);
    expect(withReleases.service.availableNow).toBe(withNone.service.availableNow);
  });

  it("defines the five figure labels once, in the order the spec lists them", () => {
    expect(CAPACITY_FIGURE_LABELS).toEqual({
      availableNow: "Available now",
      confirmedToday: "Confirmed today",
      predictedToday: "Predicted today",
      held: "Held",
      leaveUsable: "Leave (usable)",
    });
  });

  it("fixes the morning handover at 08:00, expressed once as a named constant", () => {
    expect(MORNING_HANDOVER_MINUTES).toBe(8 * 60);
  });
});
