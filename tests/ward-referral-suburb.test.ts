import { describe, expect, it } from "vitest";

import { lookupCatchment } from "@/components/ward-management/ward-catchment";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { referralSuburbIsKnown } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A REFERRAL RECORDS THE SUBURB, AND THE SUBURB IS RESOLVED AGAINST THE REAL TABLE.
 *
 * `CM-4`: **suburb is the recorded fact.** It is the coarsest fact the owner's catchment documents
 * are keyed on and the finest one that is stable. `PD-3`: ⚠️ **a suburb is not an address** — it
 * identifies a service area, not a dwelling — which is why `PD-1`'s permission to hold facts about
 * a person reaches it while `address` stays unruled and closed.
 *
 * ⚠️ **PROVENANCE: relayed to this session by Ward Referrals, not heard first-hand.** `R55` exists
 * because a relay written down twice becomes indistinguishable from a direct ruling, so it is
 * recorded as a relay here and in the field's own comment. The design basis (`CM-4`, `PD-3`) is
 * first-hand in the register and is what this is built on.
 *
 * ⚠️ **CHECKED AGAINST THE TABLE, NEVER FOR NON-EMPTINESS.** The same move as `edId` resolving
 * against the real network: `"12 Wellington St"` is a non-empty string and would sail through a
 * length check, putting a street address into the one field whose whole defence is that it is
 * coarser than one. `referralSuburbIsKnown` asks the catchment source, which is the only thing that
 * can actually answer.
 *
 * ⚠️ **"KNOWN" IS NOT "HAS A CATCHMENT", AND CONFLATING THE TWO WOULD REJECT REAL PATIENTS.** The
 * table carries a suburb with no follow-up clinic recorded against it, and a suburb whose two
 * readings disagree. Both are known places. A referral from one must be recordable; whether anybody
 * can route it is a different question, asked later, by the catchment lookup itself.
 */
const KNOWN = "Armadale";
const NOT_A_SUBURB = "12 Wellington St, Perth";

function receive(suburb: string) {
  return wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    // The front door is the community role's event; a coordinator cannot raise one, and the
    // permission check fires BEFORE the field checks — so a wrong role here would hide every
    // assertion below behind a role rejection that looked like the one being tested.
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    destinations: [{ kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false }],
    homeRegion: "Perth Metropolitan",
    suburb,
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
  } as never);
}

describe("a referral records its suburb", () => {
  it("accepts a suburb the catchment table knows", () => {
    expect(referralSuburbIsKnown(KNOWN)).toBe(true);
    const state = receive(KNOWN);
    expect(state.rejections, "a real suburb must be accepted, or nothing below is exercised").toEqual([]);
    expect(state.referrals.at(-1)!.suburb).toBe(KNOWN);
  });

  it("⚠️ REFUSES A STREET ADDRESS, which a non-emptiness check would have accepted", () => {
    expect(NOT_A_SUBURB.trim().length, "the counter-example must be non-empty, or it proves nothing").toBeGreaterThan(
      0,
    );
    expect(referralSuburbIsKnown(NOT_A_SUBURB)).toBe(false);

    const state = receive(NOT_A_SUBURB);
    expect(state.rejections.length, "an address must be refused at the door, not stored and regretted").toBe(1);
    expect(state.referrals.length, "no referral may be created by a refused event").toBe(
      seedWardFlowState().referrals.length,
    );
  });

  it("refuses an empty suburb too, and says which rule it broke", () => {
    const state = receive("   ");
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("suburb");
  });

  it("matches case-insensitively, because a picker and a person type differently", () => {
    expect(referralSuburbIsKnown("armadale")).toBe(true);
    expect(referralSuburbIsKnown("  ARMADALE  ")).toBe(true);
  });

  it("⚠️ KNOWS A CONTESTED SUBURB, because contested means two answers rather than no place", () => {
    // Mandurah is one of the five direct contradictions between the owner's two catchment documents
    // (`CM-2`). The lookup reports that honestly and refuses to pick a winner. It is still a real
    // suburb a real person lives in, and a front door that rejected them would be inventing a rule
    // nobody made.
    const lookup = lookupCatchment("Mandurah");
    expect(lookup.state, "if this stops being contested, this test is no longer testing that case").toBe("contested");
    expect(referralSuburbIsKnown("Mandurah")).toBe(true);
  });

  it("⚠️ IS EXERCISED BY EVERY SEEDED REFERRAL, or the screens have nothing real to look up", () => {
    const referrals = seedWardFlowState().referrals;
    expect(referrals.length).toBeGreaterThan(1);
    for (const referral of referrals) {
      expect(referral.suburb.length, `${referral.id} carries no suburb`).toBeGreaterThan(0);
      expect(
        referralSuburbIsKnown(referral.suburb),
        `${referral.id}'s suburb "${referral.suburb}" is not in the catchment table, so the front ` +
          "door would refuse the fixture it ships with",
      ).toBe(true);
    }
  });

  it("⚠️ DOES NOT DERIVE homeRegion FROM IT, and that duplication is a stated cost", () => {
    // `CM-4` says region should be DERIVED from suburb, and it cannot be today: the catchment source
    // keys suburbs to follow-up CLINICS, not to the ten WA regions `HOME_REGIONS` holds. Deriving
    // one from the other would invent an administrative fact — the exact thing `homeRegion`'s own
    // comment already refuses, and the reason `"out_of_catchment"` was renamed.
    //
    // So both are stored, they CAN contradict each other, and nothing can catch it. Pinned here as
    // an accepted cost with its reason, because the alternative is a silent invention and because
    // the day a suburb-to-region source exists this test is where the change starts.
    const referrals = seedWardFlowState().referrals;
    expect(referrals.every((referral) => referral.homeRegion.length > 0)).toBe(true);
    expect(
      referrals.some((referral) => referral.suburb.length > 0 && referral.homeRegion.length > 0),
      "both facts are stored side by side, deliberately and not by oversight",
    ).toBe(true);
  });
});
