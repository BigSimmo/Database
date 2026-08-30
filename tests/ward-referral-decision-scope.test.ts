import { describe, expect, it } from "vitest";

import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralDestination } from "@/components/ward-management/ward-model";

/**
 * WHO MAY ANSWER WHICH DESTINATION — and it is a NARROWING and a widening at once.
 *
 * `FD-3` was superseded by the owner: *"every referral is declinable, and NO CODE PATH MAY RENDER
 * A REFERRAL WITH NO DECLINE AFFORDANCE."* But `ACCEPT_REFERRAL` and `DECLINE_REFERRAL` permitted
 * only `["ward", "coordinator"]`, while the ED hub acts as `ed` — so an ED could not answer a
 * referral addressed to it, and the reducer's own else-branch for "an ED, a medical ward and a
 * community team are answered by a person or a team" was unreachable by the role that would use it.
 *
 * ⚠️ **AND THE AVAILABLE WORKAROUND WAS FOUND AND REFUSED, WHICH IS WHY THIS FILE EXISTS.**
 * Dispatching as `"ward"` or `"coordinator"` from the ED screen compiles, works, and writes a false
 * `decidedBy` — the reducer records `WARD_FLOW_ROLE_LABELS[event.role]`, so the record would say a
 * ward refused a patient that an emergency department refused. That is the exact defect
 * `decidedBy` exists to prevent, and nothing would have failed.
 *
 * ⚠️ **THE WIDENING ALONE WOULD HAVE BEEN TOO WIDE, WHICH IS THE HALF WORTH GUARDING.** Adding `ed`
 * to those two lists lets an emergency department accept a PSYCHIATRIC WARD destination — deciding
 * on a bed in a ward it has nothing to do with. A permission is never widened by accident, so the
 * role now has to match the destination it is answering: a ward answers ward destinations, an
 * emergency department answers emergency-department destinations, and the coordinator — the only
 * role that sees the whole picture — answers any of them.
 */
const NOW = NOW_ANCHOR;
const ED_ID = "peel-ed";
const WARD_DESTINATION: ReferralDestination = {
  kind: "psychiatric_ward",
  sex: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
};
const ED_DESTINATION: ReferralDestination = {
  kind: "emergency_department",
  edId: ED_ID,
  purpose: "psychiatric_review",
};

function referralAddressedTo(destinations: ReferralDestination[]): { state: WardFlowState; referralId: string } {
  const state = wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    source: "community",
    originSiteCode: "RPH",
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    // A real suburb: `RECEIVE_REFERRAL` resolves it against the catchment table, so an invented
    // name would be refused before the rule this file is actually testing was ever reached.
    suburb: { kind: "named", name: "Armadale" },
    urgency: 2,
    destinations,
  } as never);
  const referral = state.referrals[state.referrals.length - 1];
  return { state, referralId: referral.id };
}

function decline(state: WardFlowState, referralId: string, role: string, destinationKind: string) {
  return wardFlowReducer(state, {
    type: "DECLINE_REFERRAL",
    role,
    now: NOW,
    referralId,
    destinationKind,
    reason: "no_suitable_bed",
  } as never);
}

describe("a role may only answer the destination it is", () => {
  const { state, referralId } = referralAddressedTo([WARD_DESTINATION, ED_DESTINATION]);

  it("built a referral carrying BOTH destinations, or nothing below discriminates", () => {
    // ⚠️ The canary. With one destination, "the ED may not answer the ward's" and "the ED may
    // answer its own" cannot both be observed, and a rule that permits everything would pass.
    expect(state.rejections, "the referral must have been accepted").toEqual([]);
    const referral = state.referrals.find((candidate) => candidate.id === referralId);
    expect(referral?.destinations.map((addressing) => addressing.destination.kind).sort()).toEqual([
      "emergency_department",
      "psychiatric_ward",
    ]);
  });

  it("permits ed, ward and coordinator to decide at all — FD-3 has no undeclinable referral", () => {
    expect([...EVENT_ROLE.DECLINE_REFERRAL].sort()).toEqual(["coordinator", "ed", "ward"]);
    expect([...EVENT_ROLE.ACCEPT_REFERRAL].sort()).toEqual(["coordinator", "ed", "ward"]);
  });

  it("lets an emergency department decline the destination addressed to IT", () => {
    const after = decline(state, referralId, "ed", "emergency_department");
    expect(after.rejections).toEqual([]);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "emergency_department");
    expect(addressing?.state).toBe("declined");
    expect(
      addressing?.decidedBy,
      "the record must say an emergency department decided, not a ward — that is what decidedBy is for",
    ).toMatch(/emergency|ED/i);
  });

  it("⚠️ REFUSES AN EMERGENCY DEPARTMENT DECIDING ON A PSYCHIATRIC WARD'S BED", () => {
    const after = decline(state, referralId, "ed", "psychiatric_ward");
    expect(
      after.rejections.length,
      "an emergency department refused a bed in a ward it has nothing to do with. Widening the " +
        "role list without scoping it to the destination is what permits this, and the resulting " +
        "record reads as a legitimate refusal.",
    ).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state, "the ward destination must be untouched").toBe("queued");
  });

  it("REFUSES A WARD DECIDING ON AN EMERGENCY DEPARTMENT'S REFERRAL — the same rule, mirrored", () => {
    // Stated in both directions, because a rule that only stopped `ed` would leave the original
    // over-wide permission in place for the role that already had it.
    const after = decline(state, referralId, "ward", "emergency_department");
    expect(after.rejections.length).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "emergency_department");
    expect(addressing?.state).toBe("queued");
  });

  it("lets the COORDINATOR answer either, because it is the only role that sees the whole picture", () => {
    for (const kind of ["psychiatric_ward", "emergency_department"]) {
      const after = decline(state, referralId, "coordinator", kind);
      expect(after.rejections, `the coordinator must be able to answer ${kind}`).toEqual([]);
    }
  });
});
