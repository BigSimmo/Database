// tests/ward-flow-diagram-status-truthfulness.test.ts
import { describe, expect, it } from "vitest";

import { hubStatusText } from "../src/components/ward-management/coordinator/flow-diagram";
import { eligibleCandidatesAmong } from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * THE HUB STATUS LINE MUST NAME THE POPULATION IT COUNTED.
 *
 * ⚠️ **THE DEFECT THIS EXISTS FOR: "3 eligible destinations" on a movement with THIRTEEN eligible
 * destinations.** `shortlist` is `eligibleCandidatesAmong(..., PARALLEL_REFERRAL_CAP)`, whose body
 * ends `.slice(0, limit)` with `limit` 3 — the wards a coordinator may refer to in parallel, not
 * the eligible destinations that exist. So the count was always a count WITHIN a capped shortlist,
 * and one branch of three presented it as an absolute.
 *
 * ⚠️ **THIS ASSERTS A PROPERTY, NOT A SENTENCE, AND THAT IS DELIBERATE.** A guard that pinned the
 * old wording would be defeated by any rephrasing — "three destinations can take this patient",
 * "3 wards eligible", "eligible: 3" all restore the defect and all pass a string blocklist.
 *
 * ⚠️ **BUT MY FIRST PROPERTY WAS ALSO USELESS, AND ONLY A MUTATION SHOWED IT.** It required the
 * line to name the population its figure came from — `shortlist.length` — which sounds like the
 * right obligation and is not: in this branch the eligible count and the shortlist size are THE
 * SAME NUMBER, so "3 eligible destinations" already contained it. The test fell into the identical
 * trap as the code, for the identical reason — the denominator looks redundant when it equals the
 * numerator. It passed against the unfixed code and I would have shipped it.
 *
 * The obligation that actually discriminates is **the NETWORK figure**: on a movement whose
 * shortlist is capped, the count of cohort-eligible wards is by construction larger than the
 * shortlist, so it is a number no understating sentence can contain by accident. Rephrase the line
 * however you like; drop the network count on a capped movement and this goes red, naming the
 * movement and both figures.
 *
 * Mutation-proved in both directions: with the fix, 3 pass; with the original wording restored,
 * "never understates the network without saying so" fails and reports
 * `WF-001: 11 eligible across the network, shortlist 3 -> "WF-001 — 3 eligible destinations"`.
 */

const NOW = NOW_ANCHOR;
const UNITS = allUnits();

/** Exactly what the component computes, so the test cannot pass against a different shortlist. */
function shortlistFor(movement: (typeof wardMovements)[number]) {
  return eligibleCandidatesAmong(movement, UNITS, NOW, PARALLEL_REFERRAL_CAP);
}

/** Movements that reach the shortlist branches at all — no accepted unit, no live referral. */
const SHORTLIST_BRANCH = wardMovements.filter(
  (movement) => movement.acceptedUnitId === undefined && movement.referredUnitIds.length === 0,
);

/**
 * The DISCRIMINATING population: shortlist-branch movements whose shortlist is actually CAPPED,
 * i.e. more units in their cohort are eligible than the shortlist can hold. On these, and only
 * these, dropping the denominator states something false rather than merely terse.
 *
 * ⚠️ Floored on THIS, never on `wardMovements.length`. A fixture that grew to 500 accepted
 * movements would leave this test walking nothing while a total-count floor sailed through — the
 * failure this project has now hit in three separate guards.
 */
const CAPPED = SHORTLIST_BRANCH.filter((movement) => {
  const cohortEligible = UNITS.filter(
    (unit) => unit.cohort === movement.cohort && eligibility(movement, unit, NOW).eligible,
  ).length;
  return cohortEligible > shortlistFor(movement).length;
});

describe("the flow diagram's hub status line", () => {
  it("has movements that actually exercise the capped branch", () => {
    // Both halves matter. The first proves the branch is reachable; the second proves the CAP is
    // real, because a shortlist that never truncates makes the property below vacuously true.
    expect(
      SHORTLIST_BRANCH.length,
      `movements reaching the shortlist branch: ${SHORTLIST_BRANCH.map((m) => m.id).join(", ")}`,
    ).toBeGreaterThan(3);
    expect(
      CAPPED.length,
      `movements whose shortlist is genuinely capped: ${CAPPED.map((m) => m.id).join(", ")}`,
    ).toBeGreaterThan(3);
  });

  it("never understates the network without saying so", () => {
    const offenders: string[] = [];
    for (const movement of SHORTLIST_BRANCH) {
      const shortlist = shortlistFor(movement);
      if (shortlist.length === 0) continue; // "no destinations found" states no count
      const text = hubStatusText(movement, shortlist, UNITS, NOW);
      if (!/\d/u.test(text)) continue; // a line with no figure claims no quantity

      /*
       * ⚠️ THE OBLIGATION IS THE NETWORK FIGURE, NOT THE SHORTLIST SIZE — and that correction is
       * the whole reason this assertion is worth running.
       *
       * My first version required `shortlist.length` to appear in the line, and it PASSED against
       * the original defect. In the all-eligible branch the eligible count and the shortlist size
       * are THE SAME NUMBER, so "3 eligible destinations" satisfied "the population must be
       * named" — the test fell into the identical trap as the code it was written to catch, and
       * for the identical reason: the denominator looked redundant because it equalled the
       * numerator. Found by mutating the fix back, not by reading the test.
       *
       * On a CAPPED movement the network figure is by construction LARGER than the shortlist, so
       * it is a number no understating sentence can contain by accident. Rephrase the line however
       * you like; if it drops the network count on a capped movement, this goes red.
       */
      const cohortEligible = UNITS.filter(
        (unit) => unit.cohort === movement.cohort && eligibility(movement, unit, NOW).eligible,
      ).length;
      if (cohortEligible <= shortlist.length) continue;
      if (!new RegExp(String.raw`\b${cohortEligible}\b`, "u").test(text)) {
        offenders.push(
          `${movement.id}: ${cohortEligible} eligible across the network, shortlist ${shortlist.length} -> "${text}"`,
        );
      }
    }
    expect(
      offenders,
      `these lines report a figure without naming the population it came from:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("never states an eligible count that equals neither the shortlist's nor the network's", () => {
    // The second half of honesty: naming a population is not enough if the number is not a true
    // count of anything. Every integer in the line must be a real quantity about this movement.
    const offenders: string[] = [];
    for (const movement of CAPPED) {
      const shortlist = shortlistFor(movement);
      const text = hubStatusText(movement, shortlist, UNITS, NOW);
      const eligibleInShortlist = shortlist.filter((candidate) => candidate.verdict.eligible).length;
      const cohortEligible = UNITS.filter(
        (unit) => unit.cohort === movement.cohort && eligibility(movement, unit, NOW).eligible,
      ).length;
      const permitted = new Set([shortlist.length, eligibleInShortlist, cohortEligible]);
      for (const raw of text.match(/\b\d+\b/gu) ?? []) {
        // Movement ids carry digits ("WF-004"); only free-standing figures are claims.
        if (text.includes(`${movement.id}`) && movement.id.includes(raw)) continue;
        if (!permitted.has(Number(raw))) {
          offenders.push(`${movement.id}: "${text}" contains ${raw}, which counts nothing`);
        }
      }
    }
    expect(offenders, `figures that are not a count of anything:\n${offenders.join("\n")}`).toEqual([]);
  });
});
