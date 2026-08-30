import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralDestination } from "@/components/ward-management/ward-model";

/**
 * A REFERRAL TO AN EMERGENCY DEPARTMENT MUST NAME A REAL ONE.
 *
 * `RECEIVE_REFERRAL` membership-checks `ageBand`, `sex`, `source`, `homeRegion` and `urgency`, and
 * resolves `originSiteCode` against the real network — with a comment saying exactly why: *"resolved
 * against the real network rather than merely checked for non-emptiness, so '12 Wellington St,
 * Perth' cannot pass as a code."* When the ED arm gained `edId` and `purpose` it got neither
 * treatment, so **a referral could queue at an empty or invented department and read like an answer.**
 *
 * ⚠️ **AND THIS IS THE CHECK THAT WOULD HAVE CAUGHT THE SHORTCUT TWO SESSIONS AGREED MUST NOT BE
 * MADE.** When the destination arm grew required fields, three call sites stopped compiling, and the
 * tempting repair was a cast or an `edId: ""` stub — a form offering a destination the application
 * cannot construct, while looking finished. Ward Referrals mutation-tested that stub and found it
 * broke only its own new screen-level guards and **no pre-existing test anywhere**. A screen guard is
 * the wrong last line: it is one component away from being bypassed, and the reducer is the thing
 * every path goes through.
 *
 * ⚠️ **NON-EMPTINESS IS NOT THE CHECK.** `edId: "not-a-department"` is as wrong as `edId: ""` and
 * far more convincing — it survives every truthiness test, renders as a plausible identifier, and
 * queues a real person at a hospital that does not exist. The assertions below use both, because a
 * guard written against the empty string alone passes the case that would actually ship.
 */
const NOW = NOW_ANCHOR;

function receive(destinations: ReferralDestination[]): WardFlowState {
  return wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    source: "community",
    originSiteCode: "RPH",
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    // A real suburb: `RECEIVE_REFERRAL` resolves it against the catchment table, so an invented
    // name would be refused before the rule this file is actually testing was ever reached.
    suburb: "Armadale",
    urgency: 2,
    destinations,
  } as never);
}

const REAL_ED = allEmergencyDepartments()[0].id;

describe("an emergency-department destination is validated like every other governed field", () => {
  it("has a real department to compare against, or nothing below discriminates", () => {
    // The canary. With no departments in the network, "resolves against the real network" and
    // "accepts anything" are the same behaviour and every assertion here passes either way.
    expect(allEmergencyDepartments().length).toBeGreaterThan(1);
    expect(REAL_ED.length).toBeGreaterThan(0);
  });

  it("ACCEPTS a destination naming a real department, so the guard is not refusing everything", () => {
    const after = receive([{ kind: "emergency_department", edId: REAL_ED, purpose: "psychiatric_review" }]);
    expect(after.rejections).toEqual([]);
    expect(after.referrals.length).toBe(seedWardFlowState().referrals.length + 1);
  });

  it("⚠️ REFUSES AN EMPTY edId — the stub that would otherwise have shipped", () => {
    const after = receive([{ kind: "emergency_department", edId: "", purpose: "psychiatric_review" }]);
    expect(
      after.rejections.length,
      "an empty department queues a real person at nowhere and reads like an answer. This is the " +
        "exact value the compile errors tempted three call sites toward.",
    ).toBe(1);
    expect(after.referrals.length).toBe(seedWardFlowState().referrals.length);
  });

  it("⚠️ REFUSES AN INVENTED edId TOO — non-emptiness is not the check", () => {
    // The more dangerous of the two: it survives every truthiness test, reads as a plausible
    // identifier, and names a hospital that does not exist. A guard written against "" alone
    // passes this one.
    const after = receive([{ kind: "emergency_department", edId: "not-a-department", purpose: "psychiatric_review" }]);
    expect(after.rejections.length).toBe(1);
    expect(after.referrals.length).toBe(seedWardFlowState().referrals.length);
  });

  it("refuses a purpose outside REFERRAL_PURPOSES, by membership rather than truthiness", () => {
    const after = receive([{ kind: "emergency_department", edId: REAL_ED, purpose: "urgent_review" as never }]);
    expect(after.rejections.length).toBe(1);
    expect(after.rejections[0].reason).toContain("REFERRAL_PURPOSES");
  });

  it("leaves the WARD arm alone — the guard is scoped to the destination it validates", () => {
    // A guard that rejected every destination would satisfy three assertions above.
    const after = receive([
      { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
    ]);
    expect(after.rejections).toEqual([]);
  });
});
