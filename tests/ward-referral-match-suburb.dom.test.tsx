import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referrals as seededReferrals } from "@/components/ward-management/ward-movements";
import { suburbUnknownLabels, type Referral, type Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
/**
 * The owner's ruling: the coordinator sees a patient's suburb (`referral-match.tsx`'s
 * `ward-referral-match-suburb` line). Two cases: a named suburb renders its name, and an unknown
 * suburb renders the shared label from `suburbUnknownLabels` — never a blank cell, because a
 * patient of no fixed abode is a real, common case here (see `ReferralSuburb`'s own doc comment
 * in `ward-model.ts`), not an edge case safe to render as empty.
 */

/** Same harness shape as `tests/ward-referral-match-hooks-order.dom.test.tsx` — the provider
 *  supplies `now`/`dispatch`/`rejections`, which this view needs but does not own. */
function MatchHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

function tree(referral: Referral) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MatchHarness referral={referral} units={allUnits()} />
    </WardFlowProvider>
  );
}

/** A queued ward referral so the render reaches the bed shortlist rather than the "not a bed
 *  question" or "already decided" early returns — the suburb line only exists on that branch. */
const BASE_WARD_REFERRAL: Referral = {
  id: "RF-TEST-SUBURB",
  ageBand: "Adult",
  destinations: [
    {
      destination: {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
      },
      state: "queued",
    },
  ],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW_ANCHOR - 10,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  ...FIXTURE_HISTORY,
};

const NAMED_SUBURB_REFERRAL: Referral = BASE_WARD_REFERRAL;

const UNKNOWN_SUBURB_REFERRAL: Referral = {
  ...BASE_WARD_REFERRAL,
  id: "RF-TEST-SUBURB-UNKNOWN",
  suburb: { kind: "unknown", reason: "not_known" },
};

describe("the seed actually holds a referral with an unknown suburb", () => {
  it("RF-006 is seeded with suburb.kind === 'unknown' — the fixture this feature depends on", () => {
    const rf006 = seededReferrals.find((referral) => referral.id === "RF-006");
    expect(rf006).toBeDefined();
    expect(rf006!.suburb).toEqual({ kind: "unknown", reason: "not_known" });
    // Non-vacuity for the whole seed, not just RF-006 by name: at least one seeded referral is
    // genuinely unknown, so a test asserting the unknown rendering is exercising a real case.
    expect(seededReferrals.some((referral) => referral.suburb.kind === "unknown")).toBe(true);
  });
});

describe("ReferralMatchView shows the coordinator a patient's suburb", () => {
  it("renders the suburb's name for a named suburb", () => {
    render(tree(NAMED_SUBURB_REFERRAL));
    expect(screen.getByTestId("ward-referral-match-suburb")).toHaveTextContent("Armadale");
  });

  it("renders the shared unknown-suburb label, never a blank cell, for an unknown suburb", () => {
    render(tree(UNKNOWN_SUBURB_REFERRAL));
    expect(screen.getByTestId("ward-referral-match-suburb")).toHaveTextContent(suburbUnknownLabels.not_known);
  });
});
