import { describe, expect, it } from "vitest";

import { referralSexCell, SEX_NOT_HELD } from "@/components/ward-management/ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { SEXES, type Referral } from "@/components/ward-management/ward-model";

/**
 * THE SEX COLUMN STATES ITS ABSENCE IN WORDS, AND THE ABSENCE HAS A REASON.
 *
 * `sex` sits on a referral's WARD arm, to be matched against a bed's designation. A referral that
 * asks for no bed never carried one — so the empty case is a fact about the request, not missing
 * data, and the two must not look the same.
 *
 * ⚠️ **THIS CELL RETURNED `"—"` UNTIL 2026-09-05.** The reasoning recorded with it was that a dash
 * *"is a different statement from an empty cell and reads as one"*, which is true and one step
 * short: a dash separates "nothing here" from "nothing rendered", and does nothing to separate
 * "not held, and here is why" from "we do not know". The house rule — a stated absence in words,
 * never a dash, never a blank, never a zero — exists because those two look identical once both
 * are dashes.
 *
 * ⚠️ **AND THE SAME RULE WAS ALREADY ENFORCED ON THIS FUNCTION'S SIBLING, IN THE SAME MODULE.**
 * `tests/ward-referral-clocks.test.ts` asserts `REFERRAL_CLOCK_TERMS.notInDepartment` is neither a
 * digit nor `"—"`. One screen family enforcing the rule on one absent value while printing a dash
 * for the other is precisely the drift a house rule exists to stop — and nothing caught it, because
 * the two live in different functions and only one had a guard.
 */
describe("the referral board's Sex column", () => {
  /**
   * ⚠️ FLOORED ON THE POPULATION WALKED, NOT ON THE VIOLATIONS FOUND. A guard that only inspects
   * the rows it finds objectionable passes on the day the seed stops producing either shape — and
   * that is the day it is worth least. The seed must carry BOTH a ward referral and a
   * no-ward referral, or the assertions below are about nothing.
   */
  const referrals: Referral[] = seedWardFlowState().referrals;
  const withWard = referrals.filter((r) => r.destinations.some((d) => d.destination.kind === "psychiatric_ward"));
  const withoutWard = referrals.filter((r) => !r.destinations.some((d) => d.destination.kind === "psychiatric_ward"));

  it("has both shapes in the seed, or every assertion here is vacuous", () => {
    expect(referrals.length, "the seed produced no referrals at all").toBeGreaterThan(0);
    expect(withWard.length, "no seeded referral asks for a bed — the ward case is untested").toBeGreaterThan(0);
    expect(
      withoutWard.length,
      "every seeded referral asks for a bed, so the not-held case never renders and this guard " +
        "would pass while the dash was still there",
    ).toBeGreaterThan(0);
  });

  it("never renders a dash, a blank, or a zero — for any referral in the seed", () => {
    for (const referral of referrals) {
      const cell = referralSexCell(referral);
      expect(cell, `${referral.id} renders an empty Sex cell`).not.toBe("");
      expect(cell.trim(), `${referral.id} renders whitespace in the Sex cell`).not.toBe("");
      // Every dash character a keyboard or a copy-paste produces, not just the em dash that was
      // there: replacing one dash with a different dash is the obvious way to satisfy a guard that
      // names only one.
      expect(cell, `${referral.id} renders a dash in the Sex cell`).not.toMatch(/^[\s]*[-–—]+[\s]*$/u);
      expect(cell, `${referral.id} renders a bare zero in the Sex cell`).not.toBe("0");
    }
  });

  it("says which fact is not held, in words, when no bed was asked for", () => {
    for (const referral of withoutWard) {
      expect(
        referralSexCell(referral),
        `${referral.id} asks for no bed, so the Sex cell must explain that rather than go quiet`,
      ).toBe(SEX_NOT_HELD);
    }
    // The wording follows `REFERRAL_CLOCK_TERMS`' idiom: a term, not a sentence, so screens compose
    // the layout. Asserted rather than described, because "no full stop" is the half a rewrite drops.
    expect(SEX_NOT_HELD.length, "an empty term would print nothing").toBeGreaterThan(0);
    expect(SEX_NOT_HELD, "a term, not a sentence — screens compose the layout").not.toContain(".");
    expect(SEX_NOT_HELD, "a stated absence carries no digits").not.toMatch(/\d/u);
  });

  it("still prints the real value where a bed IS asked for, so the fix did not flatten the column", () => {
    /*
     * ⚠️ THE OTHER DIRECTION, AND IT IS THE ONE A CARELESS FIX BREAKS. Returning the not-held term
     * unconditionally satisfies every assertion above — no dash, no blank, words in the cell — and
     * empties the column of its only real content. A guard that checks the absent case and not the
     * present one licenses exactly that.
     */
    for (const referral of withWard) {
      const cell = referralSexCell(referral);
      expect(cell, `${referral.id} asks for a bed, so its Sex cell must carry a real value`).not.toBe(SEX_NOT_HELD);
      expect([...SEXES] as string[], `${referral.id} renders "${cell}", which is not a member of SEXES`).toContain(
        cell,
      );
    }
  });
});
