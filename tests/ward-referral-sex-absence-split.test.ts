import { describe, expect, it } from "vitest";

import {
  referralPersonFacts,
  referralPersonFactsStatingSex,
  referralSexCell,
  SEX_NOT_HELD,
} from "@/components/ward-management/ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * 🔴 **TWO HELPERS DISAGREE ON PURPOSE, AND THE REASON IS A PRIVACY RULING RATHER THAN A STYLE.**
 *
 * Ward Lead ruled on 2026-09-06 that the referral board's phone card must STATE an absent sex in
 * words — "not a ward referral" — the way `referralSexCell` already does for the desktop table. A
 * shorter list hides the absence instead of reporting it, which is the drift the house rule exists
 * to stop.
 *
 * ⚠️ **APPLYING THAT TO THE SHARED HELPER WOULD HAVE CHANGED WHAT AN EMERGENCY DEPARTMENT IS TOLD.**
 * `referralPersonFacts` feeds five surfaces, and `ward-referral-visibility.ts` records an owner
 * ruling about one of them: because the helper returns a sex only when a ward arm exists, an ED
 * rendering those facts already learns THAT a ward was asked — one bit, in shipped code, and *"the
 * owner was told that when he was asked, and the ruling records it… No fix is scheduled for it and
 * none should be opened."*
 *
 * Emitting the words from the shared helper adds no bit. **It turns a bit a careful reader could
 * INFER into a sentence every reader is TOLD** — a change in disclosure, on the one surface whose
 * disclosure the owner was consulted about, as a side effect of a copy ruling about a phone card.
 *
 * **So the split is deliberate and this pins BOTH sides of it.** The obvious tidy — noticing two
 * near-identical functions and merging them — is exactly what must not happen silently, and it is
 * the kind of change that looks like cleanup in a diff.
 */

const wardReferrals = seedWardFlowState().referrals;

const nonWard = wardReferrals.find(
  (referral) => !referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
);
const wardBound = wardReferrals.find((referral) =>
  referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
);

describe("the absent sex is stated on the board and left inferable for an ED", () => {
  it("the seed still holds both shapes, or neither half of this proves anything", () => {
    expect(nonWard, "no seeded referral lacks a ward arm — the absence case cannot be exercised").toBeDefined();
    expect(wardBound, "no seeded referral has a ward arm — the present case cannot be exercised").toBeDefined();
  });

  it("the board's helper states the absence in the table's own words", () => {
    expect(referralPersonFactsStatingSex(nonWard!)).toContain(SEX_NOT_HELD);
    // The same words the desktop table uses, not a second spelling of the same idea.
    expect(referralSexCell(nonWard!)).toBe(SEX_NOT_HELD);
  });

  it("the shared helper still OMITS it, which is the behaviour the owner approved for an ED", () => {
    expect(
      referralPersonFacts(nonWard!),
      "referralPersonFacts now states the absent sex. That reads like a tidy-up and is a change to " +
        "what an emergency department is told: ward-referral-visibility.ts records the owner being " +
        "asked about this exact one-bit disclosure and saying it may stand. Widening it is his call. " +
        "The board has its own helper — referralPersonFactsStatingSex — precisely so this one need not move.",
    ).not.toContain(SEX_NOT_HELD);
    expect(referralPersonFacts(nonWard!)).toHaveLength(2);
  });

  it("both agree wherever the fact IS held, so the split is only ever about the absence", () => {
    expect(referralPersonFactsStatingSex(wardBound!)).toEqual(referralPersonFacts(wardBound!));
    expect(referralPersonFacts(wardBound!)).toHaveLength(3);
  });
});
