import { describe, expect, it } from "vitest";

import type { Unit } from "@/components/ward-management/ward-model";
import {
  designationSummary,
  lockedBedsFree,
  openBeds,
  openBedsFree,
  unitHasLockedBeds,
  unitHasOpenBeds,
} from "@/components/ward-management/ward-bed-designation";

/** A mixed ward: 17 beds, 4 of them locked; 2 allocatable, 1 of those locked. */
function mixedUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "test-mixed",
    siteCode: "TST",
    name: "Test Mixed",
    cohort: "Adult",
    authorised: true,
    beds: 17,
    lockedBeds: 4,
    empty: { value: 3, source: "feed", confirmedAt: 0, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
    allocatableLocked: 1,
    held: 1,
    blocked: 1,
    sexMix: { Female: 7, Male: 6 },
    speciallingCapacity: 2,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  } as Unit;
}

describe("bed designation arithmetic", () => {
  it("derives open beds rather than storing them", () => {
    expect(openBeds(mixedUnit())).toBe(13);
  });

  it("splits the allocatable figure into locked and open", () => {
    const unit = mixedUnit();
    expect(lockedBedsFree(unit)).toBe(1);
    expect(openBedsFree(unit)).toBe(1);
    expect(lockedBedsFree(unit) + openBedsFree(unit)).toBe(unit.allocatable.value);
  });

  it("reports a wholly open ward as having no locked beds", () => {
    const unit = mixedUnit({ lockedBeds: 0, allocatableLocked: 0 });
    expect(unitHasLockedBeds(unit)).toBe(false);
    expect(unitHasOpenBeds(unit)).toBe(true);
    expect(designationSummary(unit)).toBe("All open");
  });

  it("reports a wholly locked ward as having no open beds", () => {
    const unit = mixedUnit({
      beds: 17,
      lockedBeds: 17,
      allocatable: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatableLocked: 2,
    });
    expect(unitHasOpenBeds(unit)).toBe(false);
    expect(designationSummary(unit)).toBe("All locked");
  });

  it("names both figures on a mixed ward", () => {
    expect(designationSummary(mixedUnit())).toBe("4 locked, 13 open");
  });

  // ⚠️ The floor that stops these helpers reporting a plausible lie. A fixture whose
  // allocatableLocked exceeds its allocatable total is a data defect, and the helper must not
  // paper over it by returning a negative open count.
  it("never returns a negative free-bed count when the data disagrees with itself", () => {
    const broken = mixedUnit({ allocatableLocked: 5 }); // more locked free than free at all
    expect(openBedsFree(broken)).toBe(0);
    expect(lockedBedsFree(broken)).toBe(2); // clamped to the allocatable total
  });
});
