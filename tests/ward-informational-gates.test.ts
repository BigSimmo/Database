import { describe, expect, it } from "vitest";

import { INFORMATIONAL_GATES } from "../src/components/ward-management/ward-derivations";
import { SUITABILITY_GATES } from "../src/components/ward-management/ward-flow-reducer";

/**
 * ⚠️ THE SHAPE THIS FILE EXISTS FOR IS ONE THIS PROJECT REJECTED IN WRITING AND THEN BUILT ANYWAY,
 * ONE FILE OVER, ON THE SAME DAY.
 *
 * `tests/ward-referral-reducer.test.ts` refused a guard because "the guard's strength would rest on
 * a list nobody maintains". `INFORMATIONAL_GATES` then arrived in `ward-derivations.ts` as a second
 * hand-maintained list — module-private, ZERO test references — deciding which failing gates the
 * SCREEN treats as non-blocking. The screen's default for a gate added later had stopped being
 * "refuses" and become "whatever this list says".
 *
 * ⚠️ WHAT THE PROTECTION ACTUALLY IS, AND IT IS NOT THIS FILE. Measured, not assumed: adding
 * `allocatable_bed` to the list turns FIVE tests in `ward-shortlist-candidates.test.ts` red by name,
 * including "a ward that declined AND fails a physical gate is still unavailable". The list is
 * answerable to behaviour there. This file exists to make that answerability FINDABLE from the list
 * itself, and to hold the two structural claims those behavioural tests do not state.
 *
 * ⚠️ AND ONE THING THIS FILE DELIBERATELY NO LONGER CLAIMS. Its first version asserted that the
 * reducer "refers with nothing recorded" for every member. That check could not fail: referring to
 * a ward with no allocatable bed is ALSO accepted with nothing recorded — legitimately, since a
 * coordinator may ask a full ward and be declined. The property did not discriminate, the smuggling
 * mutation passed 6 of 6, and the test would have been counted as protection it never provided.
 * Found by running the mutation, not by reading the test.
 */
describe("INFORMATIONAL_GATES — the second list, and what keeps it honest", () => {
  it("is non-empty, or every assertion here holds over nothing", () => {
    expect(INFORMATIONAL_GATES.length).toBeGreaterThan(0);
  });

  it("names prior_decline, so a silent emptying is visible", () => {
    // ⚠️ A NAMED POSITIVE PIN, never a count: `length === 1` passes with the wrong single member,
    // and a disjointness check alone fails OPEN — it stays green if SUITABILITY_GATES shrinks.
    expect(INFORMATIONAL_GATES).toContain("prior_decline");
  });

  for (const gate of INFORMATIONAL_GATES) {
    it(`${gate}: is not ALSO an overridable judgement gate`, () => {
      // The two lists make opposite claims. "Informational" means the coordinator needs to record
      // NOTHING; "overridable" means they must record a reason. A gate in both would be offered a
      // reason box the engine never wanted — the owner's ruling on prior_decline, inverted.
      expect(
        SUITABILITY_GATES,
        `${gate} is on both lists, which assert opposite things about what a coordinator must do`,
      ).not.toContain(gate);
    });
  }
});
