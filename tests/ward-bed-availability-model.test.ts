import { describe, expect, it } from "vitest";

import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import {
  BED_RELEASE_CONFIDENCE_LEVELS,
  BED_RELEASE_STATES,
  type BedRelease,
  type LeaveBed,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";

describe("bed release model", () => {
  it("has four lifecycle states in the order a bed moves through them", () => {
    expect(BED_RELEASE_STATES).toEqual(["predicted", "confirmed", "blocked", "released"]);
  });

  it("no longer treats 'confirmed' as a confidence, because it is a state", () => {
    expect(BED_RELEASE_CONFIDENCE_LEVELS).toEqual(["likely", "possible"]);
  });

  it("offers seven blockers, all of them about the bed and none about a person", () => {
    expect(BED_RELEASE_BLOCKERS).toEqual([
      "Awaiting clean",
      "Awaiting pharmacy",
      "Awaiting placement confirmation",
      "Awaiting service coordination",
      "Awaiting accommodation",
      "Awaiting transport",
      "Awaiting receiving-service acceptance",
    ]);
  });

  /**
   * The privacy rule is structural, not a matter of fixture hygiene: a future field named
   * `patientId` would pass a content check and fail this one.
   */
  it("gives neither a bed release nor a leave bed any field describing a person", () => {
    const releaseFields = Object.keys(bedReleases[0]).sort();
    expect(releaseFields).toEqual(
      ["blocker", "confidence", "confirmedAt", "confirmedBy", "expectedAt", "id", "state", "unitId"].sort(),
    );
    const leaveFields = Object.keys(leaveBeds[0]).sort();
    expect(leaveFields).toEqual(["confirmedAt", "confirmedBy", "expectedReturn", "id", "unitId", "usable"].sort());
  });

  /** D13: the board must open on its worst case, not its best. */
  it("seeds releases in every state, at least two of them blocked", () => {
    const byState = (state: BedRelease["state"]) => bedReleases.filter((r) => r.state === state);
    expect(byState("predicted").length).toBeGreaterThanOrEqual(1);
    expect(byState("confirmed").length).toBeGreaterThanOrEqual(1);
    expect(byState("blocked").length).toBeGreaterThanOrEqual(2);
    expect(byState("released").length).toBeGreaterThanOrEqual(1);
  });

  it("seeds at least one leave bed the ward says cannot be filled", () => {
    expect(leaveBeds.some((bed: LeaveBed) => bed.usable === false)).toBe(true);
  });

  /** D3: a blocker belongs to the blocked state and to no other. */
  it("carries a blocker exactly when blocked, and a confidence exactly when predicted", () => {
    for (const release of bedReleases) {
      expect(release.blocker === null).toBe(release.state !== "blocked");
      expect(release.confidence === null).toBe(release.state !== "predicted");
      if (release.blocker !== null) {
        expect(BED_RELEASE_BLOCKERS).toContain(release.blocker);
      }
    }
  });
});
