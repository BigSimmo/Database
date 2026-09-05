import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  RATIFIED_SERVICE_ALIASES,
  ratifiedAliasesFor,
  ratifiedAliasesWithNoSuchTeam,
  ratifiedDecisionsOnMovedFigures,
  ratifiedSameServiceNames,
} from "@/components/ward-management/community/community-ratified-aliases";
import { communityNameCollisions } from "@/components/ward-management/community/community-vocabulary";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";

/**
 * 🔴 **THE TABLE OF SERVICE ALIASES A PERSON RATIFIED, AND THE THREE PROPERTIES THAT KEEP IT FROM
 * TURNING BACK INTO A RULE.**
 *
 * The owner ruled on 2026-09-05 that `ICC` and `Inner City Clinic` are one service. **The ruling is
 * not the risk. The implementation is** — the obvious way to satisfy it is to loosen a key in
 * `community-vocabulary.ts`, and any key loose enough to derive `ICC` → `Inner City Clinic` would
 * also merge `Alma Street (Cockburn)` with `Alma Street (Melville)`, which are two sites.
 *
 * ⚠️ **SO WHAT IS GUARDED HERE IS MOSTLY A SEPARATION, NOT A VALUE.** The near-duplicate relation
 * must stay ignorant of this table, and the table must stay a table.
 *
 * ---
 *
 * 🔴 **READ THIS BEFORE YOU FIX ANYTHING IN HERE THAT HAS GONE RED. FOUR THINGS ARE EXPECTED TO
 * FAIL WHEN THE TEAM LIST IS REPLACED, AND THEY ARE THE SYSTEM WORKING.**
 *
 * Pre-registered 2026-09-05 by Ward Lead, from Ward Builder One's list, **before the event** — the
 * owner has said he will replace the team data wholesale. Written down now because afterwards these
 * arrive as a wall of failures with no context, and the cheapest response to each of them is the
 * wrong one.
 *
 * **1. `ratifiedDecisionsOnMovedFigures()` IS SUPPOSED TO FIRE.** It asserts the suburb counts
 * recorded against `Inner City` (16), `ICC` (3), `Inner City Clinic` (1) and
 * `Inner City (central)` (1) still match `communityTeamSuburbCounts()`. New team data almost
 * certainly moves them. **DO NOT UPDATE `shownCounts` TO MAKE IT GREEN.** The owner signed a
 * ruling about twenty-one suburbs under four specific spellings; if the spellings or the counts
 * change, his ruling has stopped being about the thing that was in front of him. **Put the ruling
 * back to him.** That is what the guard's own failure message says, and it is right.
 *
 * **2. `ratifiedAliasesWithNoSuchTeam()` will fire if any of the four spellings disappears** from
 * the new vocabulary, naming it. The entry has become inert. **Retire the entry with a note; do not
 * delete the guard.**
 *
 * **3. `RECORDED_COLLISIONS` in `ward-community-vocabulary.test.ts` — the hand-recorded baseline,
 * currently 10 families / 24 names — will be wholly wrong.** ⚠️ **Re-derive it BY HAND from the new
 * names. Never paste the module's output into it.** Pasting recreates the exact tautology it was
 * written to replace, and it is one of only TWO things that actually cover the near-duplicate
 * predicate.
 *
 * **4. Ward Builder Three's independent implementation is the other one.** Both must be re-run
 * against the new list and their **symmetric difference taken BY NAME.** That comparison found both
 * of 2026-09-05's real bugs — the whitespace defect and the word-order defect. **Two counts
 * agreeing would have found neither.**
 *
 * **None of this is a reason to delay the data change. It is the reason the change is safe.**
 */

const VOCABULARY_SOURCE = readFileSync("src/components/ward-management/community/community-vocabulary.ts", "utf8");

describe("the ratified service aliases", () => {
  /**
   * ⚠️ **THE FLOOR FIRST.** Every assertion below quantifies over the table or over the vocabulary.
   * An empty table, or a vocabulary that failed to load, satisfies most of them perfectly.
   */
  it("has a table with entries, over a vocabulary with teams in it", () => {
    expect(RATIFIED_SERVICE_ALIASES.length, "the alias table is empty, so nothing below is tested").toBeGreaterThan(0);
    expect(communityTeamOptions().length, "the team vocabulary is empty").toBeGreaterThan(40);
  });

  /**
   * 🔴 **PROPERTY 1 — AN ALIAS WHOSE SUBJECT DOES NOT EXIST READS AS RATIFIED AND DOES NOTHING.**
   * That is worse than an absent row: a reviewer scanning the table sees the decision recorded and
   * has no way to notice it applies to no team on any page.
   */
  it("names only teams the referral picker actually offers", () => {
    expect(
      ratifiedAliasesWithNoSuchTeam(),
      "a ratified alias names a team the picker does not offer, so the ruling is recorded and inert",
    ).toEqual([]);
  });

  /**
   * 🔴 **PROPERTY 2 — THE RELATION MUST STAY IGNORANT OF THE TABLE.**
   *
   * ⚠️ **THIS IS ASSERTED OVER THE MODULE'S SOURCE AND NOT OVER ITS OUTPUT, DELIBERATELY, AND IT IS
   * THE ONE PLACE HERE THAT SCANS TEXT.** The output test — "ICC is in no near-duplicate family" —
   * cannot distinguish "the relation does not know about the table" from "the relation knows and
   * this particular alias happens not to change any family". A future second alias between two
   * names that ARE already near-duplicates would make the output identical either way. What must
   * hold is the import boundary.
   */
  it("is not reachable from the near-duplicate relation", () => {
    expect(
      VOCABULARY_SOURCE.includes("community-ratified-aliases"),
      "community-vocabulary.ts now imports the ratified-alias table. A human ruling and a string " +
        "similarity are different kinds of claim with different authority, and the screen can only " +
        "keep them apart if the code does",
    ).toBe(false);
  });

  /**
   * The output half of the same separation, kept as its own case so its failure names the symptom
   * rather than the boundary. `ICC` is reachable by no string rule — that is why it needed a person.
   */
  it("leaves ICC out of every computed near-duplicate family", () => {
    const families = communityNameCollisions().map((family) => family.names.map((entry) => entry.name));
    expect(families.length, "no families were derived, so this assertion is vacuous").toBeGreaterThan(3);
    expect(
      families.filter((family) => family.includes("ICC")),
      "ICC has appeared in a computed near-duplicate family. Either a key has been loosened to " +
        "satisfy the owner's ruling — which is the implementation this table exists to avoid — or " +
        "the vocabulary has changed and the standing example on both community screens is now wrong",
    ).toEqual([]);
  });

  /**
   * 🔴 **PROPERTY 3 — THE RULING IS SYMMETRIC AND MUST READ THE SAME FROM EITHER PAGE.** A reader on
   * the `ICC` page and a reader on the `Inner City Clinic` page are looking at one service; a table
   * that answered only one of them would leave the other page silently incomplete.
   */
  it("answers with every other member, from every member", () => {
    let pairsChecked = 0;
    for (const entry of RATIFIED_SERVICE_ALIASES) {
      for (const member of entry.members) {
        const others = ratifiedSameServiceNames(member);
        expect(ratifiedAliasesFor(member).length, `${member} finds no entry naming it`).toBeGreaterThan(0);
        expect(others, `${member} names itself as another service`).not.toContain(member);
        for (const sibling of entry.members.filter((name) => name !== member)) {
          expect(others, `${member} does not name ${sibling}`).toContain(sibling);
          pairsChecked += 1;
        }
      }
    }
    expect(pairsChecked, "no member pair was compared, so this ran over nothing").toBeGreaterThan(5);
  });

  /**
   * 🔴 **A DECISION IS SCOPED TO THE FIGURES IT WAS MADE ON, AND THIS RULING NEARLY LANDED AT HALF
   * ITS WIDTH.** The owner's first answer covered `ICC` and `Inner City Clinic` only; because the
   * similarity relation already groups `Inner City` with `Inner City Clinic`, sixteen further
   * suburbs would have ridden in transitively on an inference he had never been asked to make.
   *
   * **This is not a data-integrity check. It is a consent check.** The catchment figures may change
   * freely; what may not happen is a signed decision continuing to stand, unexamined, on figures its
   * signer never saw.
   */
  it("still rests on the suburb counts its decider was shown", () => {
    const shown = RATIFIED_SERVICE_ALIASES.flatMap((entry) => Object.keys(entry.shownCounts));
    expect(shown.length, "no entry records what its decider was shown, so this is vacuous").toBeGreaterThan(3);
    expect(
      ratifiedDecisionsOnMovedFigures(),
      "a ratified decision's suburb counts have moved since it was signed. The ruling is not wrong, " +
        "but it has stopped being a ruling about the thing in front of the person who made it — put " +
        "it back to them rather than updating these numbers to match",
    ).toEqual([]);
  });

  /**
   * ⚠️ **A MEMBER PRESENT IN `members` AND ABSENT FROM `shownCounts` IS A NAME NOBODY WAS SHOWN.**
   * That is the exact shape of the near-miss above — a spelling swept into a group without ever
   * appearing in the question — and it would pass every other assertion in this file.
   */
  it("shows a count for every member it merges", () => {
    for (const entry of RATIFIED_SERVICE_ALIASES) {
      expect(
        Object.keys(entry.shownCounts).slice().sort(),
        "a member was merged without a suburb count beside it in the recorded question",
      ).toEqual(entry.members.slice().sort());
    }
  });

  /**
   * ⚠️ **A MERGE OF TWO CLINICAL LISTS WITH NO ATTRIBUTION IS INDISTINGUISHABLE FROM ONE A MACHINE
   * GUESSED.** The question is recorded because what was asked determines what the answer licenses:
   * an owner shown three suburb names and two counts decided something narrower than an owner asked
   * "should we tidy these up".
   */
  it("records who decided, when, and what they were asked", () => {
    for (const entry of RATIFIED_SERVICE_ALIASES) {
      expect(entry.decidedBy.trim().length, `${entry.members[0]} has no decider`).toBeGreaterThan(0);
      expect(entry.decidedOn, `${entry.members[0]} has no ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(
        entry.question.trim().length,
        `${entry.members[0]} records no question, so the answer's scope is unknowable`,
      ).toBeGreaterThan(40);
      for (const member of entry.members) {
        expect(
          entry.question,
          `the recorded question never mentions ${member}, so that name was merged without being asked about`,
        ).toContain(member);
      }
    }
  });

  /**
   * 🔴 **THE TABLE MUST STAY A TABLE.** The failure this whole shape exists to prevent is a second
   * ratified case being absorbed by widening the first entry instead of appearing as a visible
   * second row — at which point it stops being reviewable in ten seconds and becomes a rule a
   * clinician has to simulate.
   */
  it("holds whole names, never a pattern", () => {
    const offered = new Set(communityTeamOptions());
    for (const entry of RATIFIED_SERVICE_ALIASES) {
      expect(entry.members.length, "an entry merges fewer than two names, so it decides nothing").toBeGreaterThan(1);
      expect(new Set(entry.members).size, "an entry names the same spelling twice").toBe(entry.members.length);
      for (const member of entry.members) {
        expect(typeof member, "an entry has a non-string member").toBe("string");
        expect(
          offered.has(member),
          `"${member}" is not one of the names the picker offers, exactly. A ratified alias is a ` +
            `whole name a person signed for; a second case is a second ROW, never a widened pattern`,
        ).toBe(true);
      }
    }
  });
});
