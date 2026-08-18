import { describe, expect, it } from "vitest";

import { DECLINE_REASONS, MOVEMENT_STAGES, PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";
import { allEmergencyDepartments, allUnits, siteByCode, wardSites } from "../src/components/ward-management/ward-sites";
import { requiresAuthorisedDestination } from "../src/components/ward-management/ward-eligibility";
import { bedReleases, movementById, wardMovements } from "../src/components/ward-management/ward-movements";

describe("ward model constants", () => {
  it("carries the seven stages in pathway order", () => {
    expect(MOVEMENT_STAGES).toEqual([
      "placement_requested",
      "destination_review",
      "accepted_awaiting_bed",
      "bed_held",
      "handover_ready",
      "moving",
      "arrived",
    ]);
  });

  it("offers a fixed decline vocabulary rather than free text", () => {
    expect(DECLINE_REASONS).toContain("no_bed");
    expect(DECLINE_REASONS).toContain("sex_mix");
    expect(DECLINE_REASONS).toContain("specialling_unavailable");
    expect(DECLINE_REASONS).toContain("acuity_mix");
    expect(DECLINE_REASONS).toContain("capability_mismatch");
    expect(DECLINE_REASONS).toContain("bed_held_for_earlier_referral");
  });

  it("caps parallel referrals so wards are not spammed", () => {
    expect(PARALLEL_REFERRAL_CAP).toBe(3);
  });
});

describe("ward sites", () => {
  it("models the eight metro emergency departments", () => {
    const codes = allEmergencyDepartments()
      .map((ed) => ed.siteCode)
      .sort();
    expect(codes).toEqual(["ARM", "FSH", "JHC", "PEEL", "RGH", "RPH", "SCGH", "SJGM"]);
  });

  it("includes sites that have units but no emergency department", () => {
    expect(siteByCode("FRE")?.emergencyDepartment).toBeUndefined();
    expect(siteByCode("FRE")?.units.length).toBeGreaterThan(0);
    expect(siteByCode("BTY")?.emergencyDepartment).toBeUndefined();
  });

  it("includes emergency departments that feed elsewhere and hold no units", () => {
    expect(siteByCode("PEEL")?.emergencyDepartment).toBeDefined();
    expect(siteByCode("PEEL")?.units).toHaveLength(0);
  });

  it("accounts for every bed in every unit", () => {
    for (const unit of allUnits()) {
      expect(unit.allocatable.value, `${unit.id} claims more allocatable than empty`).toBeLessThanOrEqual(
        unit.empty.value,
      );
      expect(unit.held + unit.blocked + unit.empty.value, `${unit.id} exceeds its bed count`).toBeLessThanOrEqual(
        unit.beds,
      );
      const occupants = unit.sexMix.Female + unit.sexMix.Male;
      expect(occupants + unit.empty.value + unit.blocked, `${unit.id} occupancy does not reconcile`).toBe(unit.beds);
    }
  });

  it("keeps at least one older-adult unit at zero allocatable, because scarcity is the norm", () => {
    const olderAdult = allUnits().filter((unit) => unit.cohort === "Older adult");
    expect(olderAdult.length).toBeGreaterThan(2);
    expect(olderAdult.some((unit) => unit.allocatable.value === 0)).toBe(true);
  });

  it("marks private and non-authorised units honestly", () => {
    expect(allUnits().some((unit) => !unit.authorised)).toBe(true);
    expect(wardSites.some((site) => site.service === "Private")).toBe(true);
    expect(wardSites.some((site) => site.service === "WACHS")).toBe(true);
  });
});

const NOW_ANCHOR = 10 * 60 + 42;

describe("ward movements", () => {
  it("runs at realistic pressure, not comfortable pressure", () => {
    expect(wardMovements.length).toBeGreaterThanOrEqual(40);
    expect(wardMovements.length).toBeLessThanOrEqual(60);
    const eds = new Set(wardMovements.map((movement) => movement.originEdId));
    expect(eds.size).toBe(8);
  });

  it("gives every movement an emergency department it is actually sitting in", () => {
    for (const movement of wardMovements) {
      expect(movement.originEdId, `${movement.id} has no origin`).toBeTruthy();
    }
  });

  it("carries no patient identity beyond sex", () => {
    for (const movement of wardMovements) {
      expect(movement.id).toMatch(/^WF-\d{3}$/);
      expect(movement).not.toHaveProperty("name");
      expect(movement).not.toHaveProperty("dateOfBirth");
      expect(movement).not.toHaveProperty("mrn");
      expect(movement).not.toHaveProperty("address");
      expect(movement).not.toHaveProperty("diagnosis");
      expect(movement).not.toHaveProperty("clinicalHistory");
    }
  });

  it("never exceeds the parallel referral cap", () => {
    for (const movement of wardMovements) {
      expect(movement.referredUnitIds.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
    }
  });

  it("never leaves an open movement without an owner", () => {
    for (const movement of wardMovements) {
      if (movement.closure) continue;
      expect(movement.owner.length, `${movement.id} is ownerless`).toBeGreaterThan(0);
    }
  });

  it("gives every non-voluntary movement a legal form with a deadline", () => {
    for (const movement of wardMovements) {
      if (!requiresAuthorisedDestination(movement.legalStatus)) continue;
      expect(movement.legalForm, `${movement.id} has no legal form`).toBeDefined();
    }
  });

  it("includes the states the old fixture could not express", () => {
    expect(wardMovements.some((movement) => movement.stage === "accepted_awaiting_bed")).toBe(true);
    expect(wardMovements.some((movement) => movement.declines.length >= 3)).toBe(true);
    expect(wardMovements.some((movement) => movement.statusChanges.length > 0)).toBe(true);
    expect(wardMovements.some((movement) => movement.closure?.outcome === "did_not_proceed")).toBe(true);
    expect(wardMovements.some((movement) => (movement.legalForm?.dueAt ?? Infinity) < NOW_ANCHOR)).toBe(true);
  });

  it("never records a decline against a unit that is also a live referral", () => {
    for (const movement of wardMovements) {
      for (const decline of movement.declines) {
        expect(movement.referredUnitIds).not.toContain(decline.unitId);
      }
    }
  });

  it("flags bed releases without any departing-patient detail", () => {
    expect(bedReleases.length).toBeGreaterThan(4);
    for (const release of bedReleases) {
      expect(release.id).toMatch(/^WR-\d{3}$/);
      expect(release).not.toHaveProperty("name");
      expect(release).not.toHaveProperty("mrn");
      expect(release).not.toHaveProperty("diagnosis");
    }
  });

  it("returns undefined for an unknown movement rather than a different patient", () => {
    expect(movementById("WF-999")).toBeUndefined();
  });
});
