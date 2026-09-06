import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
const NOW = NOW_ANCHOR;

/*
 * WHY THIS FILE EXISTS. Owner ruling, 2026-09-01, and the definition matters more than the rule:
 *
 *   "Community referral means a patient is about to be discharged... go ahead with your
 *    recommendation and stop cancelling them"
 *
 * A community referral does NOT compete with a bed. It means the patient is on their way OUT. So
 * `ACCEPT_REFERRAL` cancelling it because a ward said yes is the app cancelling DISCHARGE PLANNING at
 * the moment admission is confirmed, which is exactly backwards.
 *
 * ⚠️ THE DEFECT WAS INVISIBLE, WHICH IS THE FRAGILE KIND OF CORRECT. `admissionBelongsToTeam` reads a
 * destination's kind and team name and never its state — deliberately, with its own comment saying a
 * cancelled referral still named that team. So nothing displayed the wrongful cancellation. Anyone
 * later "tightening" the hub to respect state would have made it live and people would have vanished
 * from team pages. This fixes the cause; a sibling test pins the hub's blindness so the trap cannot
 * come back.
 */

/**
 * ⚠️ THE REFERRAL IS CONSTRUCTED, NOT FOUND IN THE SEED, and that is deliberate.
 *
 * No seeded referral holds a queued ward arm AND a queued community arm — I wrote this test against
 * the seed first and it failed with "the seed no longer contains a referral of the shape this test
 * needs", which is the honest failure but not the one under test. Ward Verifier's falsifier F1 asked
 * for exactly this: a property demonstrated on a constructed case, never on pinned fixture ids, so the
 * test cannot quietly start passing because a fixture moved.
 */
function referralWithBothArmsQueued(): Referral {
  return {
    id: "RF-TEST-BOTH-ARMS",
    ageBand: "Youth",
    destinations: [
      {
        destination: { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
        state: "queued",
      },
      { destination: { kind: "community_team", teamName: "Inner City Clinic" }, state: "queued" },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  };
}

function stateWithThatReferral(): WardFlowState {
  const base = seedWardFlowState();
  return { ...base, referrals: [...base.referrals, referralWithBothArmsQueued()] };
}

describe("a ward accepting a patient does not cancel their community follow-up", () => {
  it("the constructed referral really does hold two queued arms, so nothing below passes vacuously", () => {
    const referral = referralWithBothArmsQueued();
    expect(referral.destinations.filter((d) => d.state === "queued")).toHaveLength(2);
    expect(referral.destinations.map((d) => d.destination.kind).sort()).toEqual(["community_team", "psychiatric_ward"]);
  });

  it("leaves the community arm QUEUED when a ward accepts the ward arm", () => {
    const state = stateWithThatReferral();

    const next = wardFlowReducer(state, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW,
      referralId: "RF-TEST-BOTH-ARMS",
      destinationKind: "psychiatric_ward",
      unitId: "bty-youth",
    });

    expect(next.rejections).toHaveLength(0);
    const after = next.referrals.find((candidate) => candidate.id === "RF-TEST-BOTH-ARMS");
    expect(after?.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.state).toBe("accepted");
    // THE ASSERTION. A community arm is never cancelled by a ward decision.
    expect(after?.destinations.find((d) => d.destination.kind === "community_team")?.state).toBe("queued");
  });
});
