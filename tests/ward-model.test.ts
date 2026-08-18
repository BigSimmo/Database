import { describe, expect, it } from "vitest";

import { DECLINE_REASONS, MOVEMENT_STAGES, PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";

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
