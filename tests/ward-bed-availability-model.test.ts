import { describe, expect, it } from "vitest";

import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  BED_RELEASE_CONFIDENCE_LEVELS,
  BED_RELEASE_STATES,
  type BedRelease,
  type LeaveBed,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
  it("gives every bed release the allowed field set — first fixture entry only (see the reducer-produced allowlist for the full structural proof)", () => {
    const releaseFields = Object.keys(bedReleases[0]).sort();
    expect(releaseFields).toEqual(
      ["blocker", "confidence", "confirmedAt", "confirmedBy", "expectedAt", "id", "state", "unitId"].sort(),
    );
  });

  /**
   * Review Finding 3: the field-set check above (mirrored below before the fix) inspected only
   * `leaveBeds[0]` — the fixture's first entry, never its second, and never a record `RECORD_LEAVE_BED`
   * actually produces. Because the check was `Object.keys(leaveBeds[0])`, an optional field added
   * to the type and set only on the reducer's OWN `created` literal (never on the hand-authored
   * fixture) would leave `leaveBeds[0]`'s own key set untouched and this check green — the exact
   * mutation the review names: `sex?: Sex` added to `LeaveBed` and set in `RECORD_LEAVE_BED`.
   * Mirrors `tests/ward-flow-reducer.test.ts`'s `BedRelease` allowlist exactly: an ALLOWLIST of the
   * exact field set (not a denylist of forbidden names, which only catches an anticipated name),
   * checked over EVERY seeded leave bed AND a fresh reducer-produced one.
   */
  it("gives every LeaveBed exactly the allowed field set — fixture and reducer-produced alike (review Finding 3)", () => {
    const ALLOWED_LEAVE_BED_FIELDS = ["id", "unitId", "usable", "expectedReturn", "confirmedAt", "confirmedBy"].sort();

    const seeded = seedWardFlowState();
    const recorded = wardFlowReducer(seeded, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW_ANCHOR,
      unitId: seeded.units[0].id,
      actingUnitId: seeded.units[0].id,
      usable: true,
      expectedReturn: NOW_ANCHOR + 200,
    });
    const reducerProduced = recorded.leaveBeds.at(-1)!;

    // Non-vacuity: this must actually inspect every fixture-seeded leave bed AND a fresh
    // reducer-produced one, never silently degrade to checking only one source or only the first.
    expect(seeded.leaveBeds.length).toBeGreaterThanOrEqual(2);
    expect(recorded.leaveBeds.length).toBe(seeded.leaveBeds.length + 1);
    const everyLeaveBed = [...seeded.leaveBeds, reducerProduced];
    for (const bed of everyLeaveBed) {
      expect(Object.keys(bed).sort()).toEqual(ALLOWED_LEAVE_BED_FIELDS);
    }
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
