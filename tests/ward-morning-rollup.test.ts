import { referralState } from "../src/components/ward-management/ward-referrals";
import { describe, expect, it } from "vitest";

import {} from "@/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import {
  CAPACITY_FIGURE_LABELS,
  MORNING_HANDOVER_MINUTES,
  morningHandoverInstant,
  peopleWaitingCount,
  PEOPLE_WAITING_LABEL,
  serviceRollup,
} from "@/components/ward-management/ward-morning-rollup";
import type {
  BedRelease,
  LeaveBed,
  Referral,
  ReferralAddressing,
  Site,
  Unit,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds, referrals } from "@/components/ward-management/ward-movements";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
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
    sexDesignation: "Undesignated",
    forensic: false,
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
    it("sums availableNow, confirmedToday, expectedToday, held and leaveUsable across units", () => {
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
          waitingOn: null,
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        {
          id: "r-2",
          unitId: "unit-b",
          state: "expected",
          expectedAt: NOW,
          waitingOn: "Awaiting ward round",
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        {
          id: "r-3",
          unitId: "unit-b",
          state: "confirmed",
          expectedAt: NOW,
          waitingOn: null,
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
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

      const result = serviceRollup([testSite], [unitA, unitB], releases, leave, NOW);

      // Hand-computed expectation: availableNow = min(empty, allocatable) per unit — unit-a
      // min(3,2)=2, unit-b min(5,4)=4, total 6. held = max(empty - availableNow, 0) per unit —
      // unit-a max(3-2,0)=1, unit-b max(5-4,0)=1, total 2. confirmedToday = 2 (unit-a's r-1
      // confirmed release plus unit-b's r-3 confirmed release). expectedToday = 1 (unit-b's
      // r-2 expected release). The two figures are deliberately asymmetric (2 vs 1) so a
      // swap between confirmedToday and expectedToday in sumBreakdowns changes both totals
      // and cannot pass unnoticed.
      expect(result.service.availableNow).toBe(6);
      expect(result.service.held).toBe(2);
      expect(result.service.confirmedToday).toBe(2);
      expect(result.service.expectedToday).toBe(1);
      expect(result.service.leaveUsable).toBe(1);
      // No release in this set carries the blocked flag, so the rollup's new sixth figure is a
      // real zero rather than an unasserted one — see the dedicated blocked-flag rollup test
      // below for the non-zero half.
      expect(result.service.blockedToday).toBe(0);
    });
  });

  /**
   * Bed-model rework (2026-08-28). `blockedToday` is a real per-unit sum like every other figure,
   * AND it is a cross-cut: the same release is counted here and in `confirmedToday`. The fixture
   * is built so a rollup that partitioned instead of cross-cutting — subtracting the blocked one
   * out of `confirmedToday` — produces a different number here, which is exactly the arithmetic
   * the four-stage model performed by accident and this rework exists to undo.
   */
  describe("rule 1 (continued): blockedToday is a real per-unit sum that cross-cuts the other two", () => {
    it("sums the blocked flag across units without taking those releases out of confirmed or expected", () => {
      const unitA = unit({ id: "unit-a", siteCode: "RPH" });
      const unitB = unit({ id: "unit-b", siteCode: "RPH" });
      const releases: BedRelease[] = [
        {
          id: "r-blocked-confirmed",
          unitId: "unit-a",
          state: "confirmed",
          expectedAt: NOW,
          waitingOn: null,
          blocker: BED_RELEASE_BLOCKERS[0],
          blockedBy: "Ward",
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        {
          id: "r-blocked-expected",
          unitId: "unit-b",
          state: "expected",
          expectedAt: NOW,
          waitingOn: "Awaiting ward round",
          blocker: BED_RELEASE_BLOCKERS[1],
          blockedBy: "Ward",
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        // An unblocked confirmed release, so "confirmedToday" is not vacuously equal to the
        // blocked count and a partitioning implementation has somewhere to go wrong.
        {
          id: "r-clear",
          unitId: "unit-a",
          state: "confirmed",
          expectedAt: NOW,
          waitingOn: null,
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
      ];
      const testSite = site({ code: "RPH" });

      const result = serviceRollup([testSite], [unitA, unitB], releases, [], NOW);

      expect(result.service.blockedToday).toBe(2);
      expect(result.service.confirmedToday).toBe(2);
      expect(result.service.expectedToday).toBe(1);
      expect(result.sites[0]?.rollup.blockedToday).toBe(2);
    });
  });

  /**
   * Gap 2 (final review). `sumBreakdowns` sums six fields, but only five of them — the ones
   * `CAPACITY_FIGURE_LABELS` names — had ever been asserted at rollup level. `excludedBeyondToday`
   * was not, and the seeded real fixture happens to total zero for it at the frozen handover
   * instant, so even reading the rendered page could not have caught a mutation that hardcoded it
   * to `0` in `sumBreakdowns` — the page would have shown "0 beds excluded" whether or not that
   * were true, exactly the silent-truncation-reads-as-completeness failure the spec calls out
   * ("a bed coordinator who discovers a hidden bucket stops trusting the visible ones"). This
   * fixture is built to be genuinely non-zero — a release expected beyond tonight — so a hardcoded
   * `0` cannot pass by coincidence.
   */
  describe("rule 1 (continued): excludedBeyondToday is a real per-unit sum, not a hardcoded zero", () => {
    it("sums excludedBeyondToday at both site and service level for a release expected beyond tonight", () => {
      const unitA = unit({ id: "unit-a", siteCode: "RPH" });
      const unitB = unit({ id: "unit-b", siteCode: "RPH" });
      const releases: BedRelease[] = [
        {
          id: "r-beyond-a",
          unitId: "unit-a",
          state: "expected",
          // Beyond the 22:00 evening-shift-end boundary `releaseBand()` uses — genuinely
          // Beyond the board's horizon entirely: WB-DB-7 (2026-08-30) made a release one day out
          // "tomorrow" rather than excluded, so producing an exclusion now takes two days.
          expectedAt: NOW_ANCHOR + 2 * MINUTES_PER_DAY,
          waitingOn: "Awaiting ward round",
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        {
          id: "r-beyond-b",
          unitId: "unit-b",
          state: "confirmed",
          expectedAt: NOW_ANCHOR + 2 * MINUTES_PER_DAY + 60,
          waitingOn: null,
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
        // A same-day release, included so the fixture is not vacuously "everything is beyond
        // tonight" — only the two releases above should count.
        {
          id: "r-today",
          unitId: "unit-a",
          state: "confirmed",
          expectedAt: NOW,
          waitingOn: null,
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: NOW,
          confirmedBy: "Ward",
        },
      ];
      const testSite = site({ code: "RPH" });

      const result = serviceRollup([testSite], [unitA, unitB], releases, [], NOW);

      // Non-vacuity: the fixture must genuinely produce a non-zero figure, or a hardcoded `0`
      // in `sumBreakdowns` would pass this test by coincidence exactly as it passed every other
      // guard on the real fixture.
      expect(result.service.excludedBeyondToday).toBeGreaterThan(0);
      expect(result.service.excludedBeyondToday).toBe(2);
      expect(result.sites[0]?.rollup.excludedBeyondToday).toBe(2);
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
      const a = unit({
        id: "a",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 },
      });
      const b = unit({
        id: "b",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 },
      });
      const result = serviceRollup([site({ code: "RPH" })], [a, b], [], [], NOW);
      expect(result.service.freshness).toEqual({ kind: "never" });
    });

    it("is 'partial' when at least one unit has confirmed and at least one has not", () => {
      const confirmed = unit({
        id: "confirmed",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NOW - 20, staleAfterMinutes: 120 },
      });
      const never = unit({
        id: "never",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NaN, staleAfterMinutes: 120 },
      });
      const result = serviceRollup([site({ code: "RPH" })], [confirmed, never], [], [], NOW);
      expect(result.service.freshness).toEqual({
        kind: "partial",
        oldestConfirmedAt: NOW - 20,
        unitsConfirmed: 1,
        unitsTotal: 2,
      });
    });

    it("is 'confirmed' when every unit below has confirmed", () => {
      const a = unit({
        id: "a",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NOW - 20, staleAfterMinutes: 120 },
      });
      const b = unit({
        id: "b",
        siteCode: "RPH",
        allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 120 },
      });
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
        units: [
          unit({
            id: "embedded-only",
            siteCode: "RPH",
            allocatable: { value: 1, source: "ward", confirmedAt: NOW, staleAfterMinutes: 120 },
          }),
        ],
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
   * D2's protection: nothing expected, confirmed-but-unreleased, or on leave may ever reach the
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

  /**
   * Six labels since the bed-model rework of 2026-08-28. `blockedToday` is a capacity figure about
   * beds, so unlike `PEOPLE_WAITING_LABEL` it belongs in the shared vocabulary and is rendered at
   * every level. Its text is deliberately "Blocked releases" and not the bare "Blocked": the ward
   * screen already renders a "Blocked" chip meaning physically blocked BEDS
   * (`unitCapacity().blocked`), and two chips reading the same word beside each other while
   * meaning different things is a defect, not a tidy-up.
   */
  it("defines the six figure labels once, in the order the spec lists them", () => {
    expect(CAPACITY_FIGURE_LABELS).toEqual({
      availableNow: "Available now",
      confirmedToday: "Confirmed today",
      expectedToday: "Expected today",
      blockedToday: "Blocked releases",
      held: "Held",
      leaveUsable: "Leave (usable)",
    });
  });

  it("fixes the morning handover at 08:00, expressed once as a named constant", () => {
    expect(MORNING_HANDOVER_MINUTES).toBe(8 * 60);
  });

  /**
   * Task 9's demand figure. The three things that can go wrong with it, each asserted rather than
   * assumed:
   *
   *   1. It counts the wrong people. `peopleWaitingCount` must count referrals still `"queued"`
   *      and nothing else — an `"accepted"` or `"declined"` referral has left the queue a
   *      coordinator is working, exactly as `referralQueueOrder` (`ward-referrals.ts`) already
   *      scopes the board. The hand-built set below is deliberately asymmetric (2 queued against
   *      3 decided) so folding the decided ones in changes the number rather than happening to
   *      agree with it.
   *   2. It diverges from the referral board. The board renders `referralQueueOrder(referrals)`;
   *      this figure must be the length of that same list on the real shipped fixture, or the two
   *      screens can give two answers from one state.
   *   3. It leaks into the capacity vocabulary. `PEOPLE_WAITING_LABEL` is a demand label and must
   *      never join `CAPACITY_FIGURE_LABELS`, whose five members are rendered by every
   *      `FigureList` at service, hospital AND ward level (spec D3) and summed field-wise by
   *      `sumBreakdowns` (spec D2).
   */
  describe("task 9: the people-waiting figure", () => {
    /** Flat decision overrides, routed into the single ward addressing -- so the cases below still
     *  read `referral({ state: "accepted" })` and only the shape moved, not their meaning. */
    type ReferralOverrides = Partial<Omit<Referral, "destinations">> &
      Partial<Pick<ReferralAddressing, "state" | "acceptedUnitId" | "declineReason" | "decidedAt">>;

    function referral(overrides: ReferralOverrides = {}): Referral {
      const { state, acceptedUnitId, declineReason, decidedAt, ...rest } = overrides;
      return {
        id: "RF-TEST",
        ageBand: "Adult",
        destinations: [
          {
            destination: {
              kind: "psychiatric_ward",
              sex: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
            },
            state: state ?? "queued",
            acceptedUnitId,
            declineReason,
            decidedAt,
          },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: "Armadale",
        source: "community",
        raisedAt: NOW - 30,
        urgency: 2,
        originSiteCode: "RPH",
        transportNeeded: false,
        ...rest,
      };
    }

    it("counts referrals still queued, and never one that has been accepted or declined", () => {
      const mixed: Referral[] = [
        referral({ id: "q-1", state: "queued" }),
        referral({ id: "q-2", state: "queued" }),
        referral({ id: "a-1", state: "accepted", acceptedUnitId: "rph-adult-open", decidedAt: NOW - 5 }),
        referral({ id: "a-2", state: "accepted", acceptedUnitId: "rph-adult-open", decidedAt: NOW - 4 }),
        referral({ id: "d-1", state: "declined", declineReason: "belongs_to_another_service", decidedAt: NOW - 3 }),
      ];

      // Guard the guard: the set really does hold decided referrals, so "2" cannot be right for
      // the wrong reason (nothing to exclude in the first place).
      expect(mixed.filter((entry) => referralState(entry) !== "queued")).toHaveLength(3);
      expect(peopleWaitingCount(mixed)).toBe(2);
    });

    it("counts nobody as waiting when every referral has been decided", () => {
      const allDecided: Referral[] = [
        referral({ id: "a-1", state: "accepted", acceptedUnitId: "rph-adult-open", decidedAt: NOW - 5 }),
        referral({ id: "d-1", state: "declined", declineReason: "no_suitable_bed", decidedAt: NOW - 3 }),
      ];
      expect(peopleWaitingCount(allDecided)).toBe(0);
    });

    it("counts waiting exactly as the referral board counts it, on the real shipped fixture", () => {
      // Non-vacuity, both directions: the fixture has someone waiting (so the equality is not
      // 0 === 0) and someone already decided (so a second, drifting filter that forgot to exclude
      // them would produce a different number here).
      expect(referralQueueOrder(referrals).length).toBeGreaterThan(0);
      expect(referrals.length).toBeGreaterThan(referralQueueOrder(referrals).length);
      expect(peopleWaitingCount(referrals)).toBe(referralQueueOrder(referrals).length);
    });

    it("keeps the demand label out of the five-figure capacity vocabulary", () => {
      expect(PEOPLE_WAITING_LABEL).toBe("People waiting for a bed");
      expect(Object.values(CAPACITY_FIGURE_LABELS)).not.toContain(PEOPLE_WAITING_LABEL);
      expect(Object.keys(CAPACITY_FIGURE_LABELS)).toEqual([
        "availableNow",
        "confirmedToday",
        "expectedToday",
        "blockedToday",
        "held",
        "leaveUsable",
      ]);
    });

    it("adds no figure to the rollup itself — serviceRollup never sees a referral", () => {
      const result = serviceRollup(wardSites, allUnits(), bedReleases, leaveBeds, NOW_ANCHOR);
      // Structural, not arithmetic: the demand figure lives outside the `CapacityRollup` shape
      // entirely, so no field-wise sum in `sumBreakdowns` and no `ALL_FIGURE_KEYS` iteration can
      // reach the headline through it (spec D2, this task's rule 3).
      expect(Object.keys(result.service)).not.toContain("peopleWaiting");
      expect(Object.keys(result)).not.toContain("peopleWaiting");
      expect(serviceRollup.length).toBe(5);
    });
  });
});
