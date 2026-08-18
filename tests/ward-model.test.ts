import { describe, expect, it } from "vitest";

import { DECLINE_REASONS, MOVEMENT_STAGES, PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";
import { allEmergencyDepartments, allUnits, siteByCode, wardSites } from "../src/components/ward-management/ward-sites";

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
