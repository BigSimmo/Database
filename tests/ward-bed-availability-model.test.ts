import { describe, expect, it } from "vitest";

import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  BED_RELEASE_WAITING_ON,
  BED_RELEASE_STATES,
  type BedRelease,
  type LeaveBed,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("bed release model", () => {
  /**
   * Bed-model rework (2026-08-28), replacing "has four lifecycle states...". Three stages, each
   * saying only how CERTAIN the discharge is. `"blocked"` is gone from this list because being
   * stuck is not a degree of certainty — it is a flag on a expected or confirmed release, and
   * the test immediately below pins that it can sit on either.
   */
  it("has three lifecycle stages in the order a bed moves through them, and blocked is not one of them", () => {
    expect(
      BED_RELEASE_STATES,
      "blocked is not a lifecycle stage — a blocked discharge is an expected one carrying a blocker, " +
        "and adding it here would make the stage a place a bed can rest rather than a reason it cannot",
    ).toEqual(["expected", "confirmed", "discharged"]);
  });

  /**
   * The Q1 axis change (2026-08-28, "The three lists" List 2). This replaces "no longer treats
   * 'confirmed' as a confidence...", which pinned `["likely", "possible"]`. A expected discharge
   * no longer states how confident the ward is; it states what it is WAITING ON — a fact two wards
   * can mean the same thing by, which a probability estimate is not.
   *
   * Pinned to the EXACT members in the EXACT owner-approved order, not to a length: a length check
   * would pass an entry silently reworded, and these words go in front of a coordinator as fact.
   * `"Nothing outstanding"` is asserted present by name as well, because it is the load-bearing
   * one — without it the list forces a ward to name an obstacle that does not exist.
   */
  it("states what a expected discharge is waiting on, in the owner-approved words, and offers 'Nothing outstanding'", () => {
    expect(BED_RELEASE_WAITING_ON).toEqual([
      "Awaiting ward round",
      "Awaiting family or carer agreement",
      "Awaiting accommodation",
      "Awaiting community team acceptance",
      "Nothing outstanding",
    ]);
    expect(BED_RELEASE_WAITING_ON).toContain("Nothing outstanding");
  });

  /**
   * ⚠️ **A CHECK THAT MEANT SOMETHING, IMPLEMENTED AS SOMETHING ELSE.** Until 2026-09-03 the test
   * above ended with `.not.toContain("likely")` and `.not.toContain("possible")`. `toContain` on an
   * ARRAY tests element membership, so those asserted no entry *equals* the bare word "likely" —
   * which nothing ever will, because every entry is a full label like "Awaiting accommodation".
   * Permanently green, and about nothing.
   *
   * The intent is legible and worth keeping: **a ward says what it is waiting on, it does not
   * hedge.** "Likely home Friday" is a guess wearing the clothes of a plan, and a bed-flow board
   * carrying guesses is one a coordinator cannot count. Ward Lead's ruling, 2026-09-03: a broken
   * attempt at a real check is worth more than its absence, because somebody once decided this
   * property mattered.
   *
   * ⚠️ **AND IT LIVES IN ITS OWN TEST FOR A REASON I GOT WRONG FIRST.** The obvious place was at the
   * end of the test above — where I initially put it, and where it would have been DEAD BY ORDER,
   * the very defect this session spent the night removing. That test opens by pinning the whole
   * array with `toEqual`, so anything asserted after it is already decided; a mutation aborts at
   * the `toEqual` and never reaches the loop at all. Caught because the mutation produced a
   * failure from the wrong assertion. Standing alone, this test fails on its own evidence and
   * prints its own sentence.
   */
  it("never hedges — a ward states what it is waiting on rather than guessing", () => {
    const hedgingWords = ["likely", "possible", "probably", "perhaps", "maybe", "hopefully", "should"];
    expect(hedgingWords.length, "an empty hedging list would make the loop below vacuous").toBeGreaterThan(0);
    expect(BED_RELEASE_WAITING_ON.length, "an empty label list would make the loop below vacuous").toBeGreaterThan(0);

    for (const label of BED_RELEASE_WAITING_ON) {
      for (const word of hedgingWords) {
        expect(
          label.toLowerCase().includes(word),
          `"${label}" hedges: it contains "${word}". A ward states what it is waiting on; a label ` +
            "that guesses turns a bed-flow board into a list of hopes, and a coordinator cannot " +
            "plan a discharge against a hope.",
        ).toBe(false);
      }
    }
  });

  /**
   * List 3 (2026-08-28). This array was empty until the owner supplied it, which made
   * `BedPreparationNote` resolve to `never` and `preparationNote` unusable. Pinned to its exact
   * members for the same reason as the two lists either side of it.
   */
  it("offers exactly the two owner-approved preparation notes, both about the bed", () => {
    expect(BED_PREPARATION_NOTES).toEqual(["Being cleaned", "Awaiting maintenance or repair"]);
  });

  /**
   * List 1 (2026-08-28) adds an eighth: "Awaiting family or carer arrangement". That entry
   * deliberately overturns the Phase 5 exclusion of family availability — see
   * `ward-change-reasons.ts` for the owner's reasoning, which is that excluding it does not stop
   * the delay happening, it just makes the recorded reason wrong.
   *
   * Pinned to the EXACT members in the EXACT order. A length check would pass an entry silently
   * reworded or reordered, and these words are read by a coordinator as fact.
   */
  it("offers eight blockers, all of them about the bed and none about a person", () => {
    expect(BED_RELEASE_BLOCKERS).toEqual([
      "Awaiting clean",
      "Awaiting pharmacy",
      "Awaiting placement confirmation",
      "Awaiting service coordination",
      "Awaiting accommodation",
      "Awaiting transport",
      "Awaiting receiving-service acceptance",
      "Awaiting family or carer arrangement",
    ]);
    // Still excluded, and the Phase 5 reasoning still holds for these two: they describe the
    // person's affairs, not the bed.
    expect(BED_RELEASE_BLOCKERS.some((blocker) => /guardian|financial/i.test(blocker))).toBe(false);
  });

  /**
   * The privacy rule is structural, not a matter of fixture hygiene: a future field named
   * `patientId` would pass a content check and fail this one.
   */
  it("gives every bed release the allowed field set — first fixture entry only (see the reducer-produced allowlist for the full structural proof)", () => {
    const releaseFields = Object.keys(bedReleases[0]).sort();
    expect(releaseFields).toEqual(
      [
        "blocker",
        // The three fields the 2026-08-28 rework added. `blockedBy` is the role that recorded the
        // block (never a person, Q3); `preparing`/`preparationNote` are the informational
        // made-ready indication (Q4). All three are about the BED or the reporting WARD, which is
        // what this allowlist exists to hold: a field named for the departing patient would fail
        // here even if every fixture value looked innocent.
        "blockedBy",
        "waitingOn",
        "confirmedAt",
        "confirmedBy",
        "expectedAt",
        "id",
        "preparationNote",
        "preparing",
        "state",
        "unitId",
      ].sort(),
    );
  });

  /**
   * Review Finding 3: the field-set check above (mirrored below before the fix) inspected only
   * `leaveBeds[0]` — the fixture's first entry, never its second, and never a record `RECORD_LEAVE_BED`
   * actually produces. Because the check was `Object.keys(leaveBeds[0])`, an optional field added
   * to the type and set only on the reducer's OWN `created` literal (never on the hand-authored
   * fixture) would leave `leaveBeds[0]`'s own key set untouched and this check green — the exact
   * mutation the review names: `sex?: Sex` added to `LeaveBed` and set in `RECORD_LEAVE_BED`.
   * Mirrors `tests/ward-flow-reducer.test.ts`'s `BedRelease` allowlist exactly: an ALLOWLIST of the
   * exact field set (not a denylist of forbidden names, which only catches an anticipated name),
   * checked over EVERY seeded leave bed AND a fresh reducer-produced one.
   */
  it("gives every LeaveBed exactly the allowed field set — fixture and reducer-produced alike (review Finding 3)", () => {
    const ALLOWED_LEAVE_BED_FIELDS = ["id", "unitId", "usable", "expectedReturn", "confirmedAt", "confirmedBy"].sort();

    const seeded = seedWardFlowState();
    const recorded = wardFlowReducer(seeded, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW_ANCHOR,
      unitId: seeded.units[0].id,
      actingUnitId: seeded.units[0].id,
      usable: true,
      expectedReturn: NOW_ANCHOR + 200,
    });
    const reducerProduced = recorded.leaveBeds.at(-1)!;

    // Non-vacuity: this must actually inspect every fixture-seeded leave bed AND a fresh
    // reducer-produced one, never silently degrade to checking only one source or only the first.
    expect(seeded.leaveBeds.length).toBeGreaterThanOrEqual(2);
    expect(recorded.leaveBeds.length).toBe(seeded.leaveBeds.length + 1);
    const everyLeaveBed = [...seeded.leaveBeds, reducerProduced];
    for (const bed of everyLeaveBed) {
      expect(Object.keys(bed).sort()).toEqual(ALLOWED_LEAVE_BED_FIELDS);
    }
  });

  /**
   * D13: the board must open on its worst case, not its best.
   *
   * Rewritten for the 2026-08-28 rework. "At least two of them blocked" used to be satisfiable by
   * two releases in the fourth STATE; there is no such state now, so it is re-expressed against
   * the flag — and strengthened, because the flag has to be seeded on BOTH stages it can sit on.
   * A blocked-but-confirmed release is the exact shape the counting defect was found on, and a
   * fixture carrying only blocked PREDICTIONS would let a `state`-keyed bucket pass by accident.
   */
  it("seeds releases in every stage, and the blocked flag on both a expected and a confirmed one", () => {
    const byState = (state: BedRelease["state"]) => bedReleases.filter((r) => r.state === state);
    expect(byState("expected").length).toBeGreaterThanOrEqual(1);
    expect(byState("confirmed").length).toBeGreaterThanOrEqual(1);
    expect(byState("discharged").length).toBeGreaterThanOrEqual(1);

    const blocked = bedReleases.filter((release) => release.blocker !== null);
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    expect(blocked.some((release) => release.state === "confirmed")).toBe(true);
    expect(blocked.some((release) => release.state === "expected")).toBe(true);
  });

  /**
   * Q4 (2026-08-28): the preparation indication must be seeded somewhere, or every screen that
   * renders it renders nothing and the display is untested by construction.
   *
   * This replaces "...and no invented preparation note anywhere", which asserted `preparationNote`
   * NULL on every release. That assertion existed to keep the owner-pending list honest while
   * `BED_PREPARATION_NOTES` was empty — a fixture note would have been invented clinical
   * vocabulary. The owner supplied List 3 on 2026-08-28, so the fixture may now carry a note, and
   * the assertion changes on purpose rather than being dropped: it is now the STRONGER claim that
   * every seeded note is a member of the owner's list, which still fails on an invented one and
   * additionally fails on a note that has drifted out of the list by a rewording.
   */
  it("seeds a bed being made ready with a real note, and no invented preparation note anywhere", () => {
    expect(bedReleases.some((release) => release.preparing)).toBe(true);
    expect(bedReleases.some((release) => release.preparationNote !== null)).toBe(true);
    for (const release of bedReleases) {
      if (release.preparationNote !== null) {
        expect(BED_PREPARATION_NOTES).toContain(release.preparationNote);
        // A note only ever describes a bed that is being made ready. The reducer forces this;
        // the fixture must not contradict it.
        expect(release.preparing).toBe(true);
      }
    }
  });

  it("seeds at least one leave bed the ward says cannot be filled", () => {
    expect(leaveBeds.some((bed: LeaveBed) => bed.usable === false)).toBe(true);
  });

  /**
   * Replaces "carries a blocker exactly when blocked...". D3's blocked-xor-expected rule went
   * with the fourth state: a blocker is now legal on a expected OR a confirmed release, and
   * illegal only on a released one, because once the bed is free nothing is being held up.
   * The waiting-on rule is untouched by the Q1 axis change — only what the field MEANS changed, so
   * it still belongs to `expected` and to nothing else. Every non-null value is additionally
   * pinned to be a member of `BED_RELEASE_WAITING_ON`, which the old confidence check could not
   * express meaningfully over a two-member union but which now guards real rendered words.
   *
   * `blockedBy` is pinned to move WITH the blocker in both directions. A block with no recorded
   * role, or a role left behind on a release nobody says is blocked, are both records that
   * cannot be acted on, and neither would be caught by checking the two fields separately.
   */
  it("carries a blocker only while unreleased, a waiting-on value exactly when expected, and a blocking role exactly when blocked", () => {
    for (const release of bedReleases) {
      expect(release.waitingOn === null).toBe(release.state !== "expected");
      if (release.waitingOn !== null) {
        expect(BED_RELEASE_WAITING_ON).toContain(release.waitingOn);
      }
      if (release.state === "discharged") {
        expect(release.blocker).toBeNull();
      }
      expect(release.blockedBy === null).toBe(release.blocker === null);
      if (release.blocker !== null) {
        expect(BED_RELEASE_BLOCKERS).toContain(release.blocker);
      }
    }
  });
});
