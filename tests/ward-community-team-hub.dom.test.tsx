// tests/ward-community-team-hub.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityTeamHub } from "@/components/ward-management/community/community-team-hub";
import { wardFlowReducer, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import {
  communityScopedReferral,
  coordinatorScopedReferral,
  type CommunityScopedReferral,
} from "@/components/ward-management/ward-referral-visibility";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const RAISED_AT = NOW_ANCHOR;
const WARD_DECIDED_AT = NOW_ANCHOR + 11;
const ED_DECIDED_AT = NOW_ANCHOR + 23;

/**
 * A referral addressed to all three destination kinds at once (FD-21), where the ward has DECLINED
 * and an emergency department has since ACCEPTED — which cancels the community arm (FD-22). Built
 * through the reducer's own write path, the same pattern `tests/ward-referral-visibility.test.ts`
 * uses for exactly this reason: the shapes it holds are shapes the live system actually produces,
 * not a hand-assembled object that might not be reachable.
 *
 * Chosen so the community arm's own state ("cancelled") differs from every other arm's state
 * ("declined", "accepted") — a fixture where all three agreed could not tell a leak from a
 * coincidence.
 */
function multiDestinationReferral(): Referral {
  const received = wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: RAISED_AT,
    ageBand: "Adult",
    destinations: [
      { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
      { kind: "emergency_department", edId: allEmergencyDepartments()[0].id, purpose: "bed" },
      { kind: "community_team", teamName: "Inner City Clinic" },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
  });
  expect(received.rejections, "the reducer refused the fixture referral this file needs").toEqual([]);
  const created = received.referrals.at(-1)!;

  const declined = wardFlowReducer(received, {
    type: "DECLINE_REFERRAL",
    role: "ward",
    now: WARD_DECIDED_AT,
    referralId: created.id,
    destinationKind: "psychiatric_ward",
    reason: "no_suitable_bed",
  });
  expect(declined.rejections, "the reducer refused the ward's own decline").toEqual([]);

  const accepted = wardFlowReducer(declined, {
    type: "ACCEPT_REFERRAL",
    role: "ed",
    now: ED_DECIDED_AT,
    referralId: created.id,
    destinationKind: "emergency_department",
  });
  expect(accepted.rejections, "the reducer refused the ED's own acceptance").toEqual([]);

  const referral = accepted.referrals.find((referral) => referral.id === created.id)!;

  /*
   * ⚠️ **THE COMMUNITY ARM CANNOT BE MADE "cancelled" THROUGH THE REDUCER TODAY, AND THIS IS NOT A
   * MISTAKE IN THE FIXTURE.** `ward-referral-visibility.ts`'s own doc comment says so directly:
   * `ACCEPT_REFERRAL` exempts a `community_team` CANDIDATE from cancellation regardless of who
   * accepts (owner ruling, "a community referral does not compete with a bed") — measured live
   * here: the ED's acceptance above left the community arm at "queued", not "cancelled". So this
   * one field is hand-set on an otherwise reducer-built referral, the same way
   * `tests/ward-referral-visibility.test.ts` had to split `cancelledArmReferral()` into its own
   * fixture for the identical reason (its own comment: "the reducer change... stops producing one").
   * The TYPE still allows the state — `ReferralAddressingState` carries `cancelled` uniformly across
   * every destination kind — so `CommunityTeamHub` must still handle it correctly even though no
   * button in this prototype can currently produce it for a community team.
   */
  return {
    ...referral,
    destinations: referral.destinations.map((addressing) =>
      addressing.destination.kind === "community_team"
        ? { ...addressing, state: "cancelled" as const, decidedAt: ED_DECIDED_AT, decidedBy: "ed" }
        : addressing,
    ),
  };
}

describe("CommunityTeamHub — the community role's own, restricted landing", () => {
  it("has a fixture that genuinely carries other destinations, so the absence assertions below are not vacuous", () => {
    const referral = multiDestinationReferral();
    const coordinatorView = coordinatorScopedReferral(referral);
    // The positive control: this is what `community-home.tsx` (the COORDINATOR's own view) reads,
    // and it DOES carry every destination. If this failed, the fixture would be too thin for the
    // community hub's own absence assertions to mean anything.
    expect(coordinatorView.destinations.map((d) => d.destination.kind).sort()).toEqual([
      "community_team",
      "emergency_department",
      "psychiatric_ward",
    ]);
    expect(coordinatorView.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.state).toBe("declined");
    expect(coordinatorView.destinations.find((d) => d.destination.kind === "emergency_department")?.state).toBe(
      "accepted",
    );
  });

  it("renders its own team's addressing, including a cancelled arm's own words", () => {
    const referral = multiDestinationReferral();
    const own = communityScopedReferral(referral);
    expect(own, "the fixture's community arm was not projected -- check the fixture").toBeTruthy();
    expect(own!.addressing.state).toBe("cancelled");

    render(
      <CommunityTeamHub
        teamId="inner-city-clinic"
        referrals={[own as CommunityScopedReferral]}
        now={NOW_ANCHOR + 30}
      />,
    );
    expect(screen.getByText(referral.id)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled/u)).toBeInTheDocument();
  });

  it("shows NOTHING about the referral's other destinations -- not a count, not a name, not the word 'elsewhere'", () => {
    const referral = multiDestinationReferral();
    const own = communityScopedReferral(referral)!;

    const { container } = render(
      <CommunityTeamHub teamId="inner-city-clinic" referrals={[own]} now={NOW_ANCHOR + 30} />,
    );
    const text = container.textContent ?? "";

    // The other two destination KINDS, and the ward's own criteria -- none of it is even reachable
    // from `CommunityScopedReferral`, but the assertion is positive rather than structural, per the
    // build plan's own instruction: build a fixture with real other destinations and prove none of
    // their words appear on screen.
    //
    // "somebody else has accepted" IS permitted -- FD-23's own ruling lets a team infer THAT the
    // patient went somewhere from its own arm reading "cancelled". What must never appear is WHERE,
    // to WHOM, or the ward's own declined state, so those are what this checks for specifically
    // rather than a blanket ban on every state word.
    expect(text).not.toMatch(/psychiatric_ward|emergency_department/u);
    expect(text).not.toMatch(/\belsewhere\b/iu);
    expect(text).not.toMatch(/no_suitable_bed/iu); // the ward's own decline reason
    expect(text).not.toMatch(/\bward\b/iu); // "psychiatric ward" / the ward's own criteria
    expect(text).not.toMatch(new RegExp(allEmergencyDepartments()[0].name, "u"));
    expect(text).not.toMatch(/\bFemale\b/u); // the ward destination's own sex criterion
  });

  it("says plainly it does not name any other destination", () => {
    render(
      <CommunityTeamHub
        teamId="inner-city-clinic"
        referrals={[communityScopedReferral(multiDestinationReferral())!]}
        now={NOW_ANCHOR}
      />,
    );
    expect(screen.getByText(/never another team's, and never where else/iu)).toBeInTheDocument();
  });
});
