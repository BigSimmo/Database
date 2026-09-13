import { describe, expect, it } from "vitest";

import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import {
  communityNameCollisions,
  communityNamesInCollisions,
  nearDuplicateSpellingsOf,
} from "@/components/ward-management/community/community-vocabulary";

/**
 * WHAT THE SHARED NEAR-DUPLICATE DERIVATION ACTUALLY CATCHES — asserted over the real team list.
 *
 * This is deliberately a test ABOUT THE DERIVATION rather than about any screen. Two surfaces now
 * lean on `communityNameCollisions()` — the gateway and each team's own page — and the whole point
 * of Ward Lead's one-derivation ruling is that neither screen carries its own copy. A property
 * proved here is proved for both; a property proved on one screen is proved for one screen.
 *
 * ⚠️ **WHY THIS FILE EXISTS AT ALL: A FIX BROKE A CASE IT WAS NOT ABOUT, AND NO COUNT MOVED.**
 * On 2026-09-05 the gateway prototype's own copy of this rule gained "clinic" and "centre" in its
 * list of stripped service words — a correct fix for `Inner City Clinic` sitting unflagged beside
 * `Inner City`. That shortened every key containing one of those words, and
 * `Meade Centre (Armadale)` and `Mead Centre (Armadale)` became the four-character keys "meade"
 * and "mead", which the length gate then refused to compare at all. **The misspelling the feature
 * exists to catch fell out of its own group as a side effect of an unrelated correction.** The
 * group count was 13 before and 13 after. Only re-reading the NAMES showed it.
 *
 * So the assertions below are about NAMED PAIRS, never about how many groups there are. A count
 * cannot fail this way, which is exactly why a count must not be the guard.
 */
/**
 * 🔴 READ THIS FIRST IF THIS FILE HAS JUST GONE RED. IT IS PROBABLY DOING ITS JOB.
 *
 * The owner is replacing the community team data wholesale (told to Ward Builder One, 2026-09-05).
 * **When that lands, most of the assertions below SHOULD fail**, because every one of them pins a
 * NAMED PAIR out of the current list: `Wheat Belt` / `Wheatbelt HS`, the four-way Mead family,
 * `Gascoyne`'s three, `Midalnd` / `Midland`, and the ICC absence. Those names may simply not exist
 * in the new data.
 *
 * ⚠️ **THE RIGHT RESPONSE IS TO RE-DERIVE, NEVER TO MAKE GREEN.** Concretely, and in this order:
 *
 *   1. Read the NEW list and find, by eye, the pairs a human can see are the same service written
 *      twice — a transposition, a misspelling, a spacing difference, a service word dropped.
 *   2. Pin those, by name, in both directions.
 *   3. ⚠️ **NEVER paste the output of `communityNameCollisions()` in as the expected value.** That
 *      recreates the exact tautology this file exists to replace: a baseline taken from the subject
 *      cannot disagree with it, so the test passes for any predicate, including a broken one.
 *      `RECORDED_COLLISIONS` in `ward-community-vocabulary.test.ts` carries the same warning and the
 *      same requirement to be re-derived BY HAND.
 *
 * ⚠️ **AND DO NOT DELETE THIS FILE AS REDUNDANT, WHICH IS THE OBVIOUS TIDY-UP.** It overlaps with
 * the near-duplicate guard on the team pages, and that overlap is the only coverage the predicate
 * has. Measured by Ward Builder One on 2026-09-05, on their own guard, and written into the top of
 * their file at `31514fdfa`: truncating `communityNameCollisions()` to five families drops five
 * real ones — `Midland`/`Midalnd` among them — and **every assertion in their biconditional stays
 * green.** It proves the page agrees with the predicate and nothing about whether the predicate is
 * right.
 *
 * **Both of the real bugs found on 2026-09-05 were found by a SECOND implementation disagreeing
 * with the first, name by name — never by a count.** Two counts agreeing would have found neither.
 * When the new data lands, run an independent implementation over it and take the symmetric
 * difference BY NAME; that comparison is what found the whitespace gap leaving `Wheat Belt`
 * unflagged, and the missing service words leaving `Inner City Clinic` unflagged.
 */
describe("the shared near-duplicate derivation", () => {
  const teams = communityTeamOptions();
  const groups = communityNameCollisions();

  /*
   * FLOORED ON THE POPULATION WALKED. Every assertion below reads a name out of the real team
   * list; if that list ever came back empty, or produced no collisions at all, each of them would
   * be asking a question about nothing. Both floors are asserted rather than assumed.
   */
  it("has a real team list and finds real collisions in it, or nothing below means anything", () => {
    expect(teams.length, "the derived team list is empty").toBeGreaterThan(0);
    expect(groups.length, "no near-duplicate groups at all — every assertion below is vacuous").toBeGreaterThan(0);
    expect(
      communityNamesInCollisions(),
      "no team name is in a collision group, so the marking behaviour is untested",
    ).toBeGreaterThan(0);
  });

  /**
   * The canonical case, and the one the owner has seen: a transposition sitting adjacent to the
   * name it transposes, looking exactly as legitimate. If this ever stops being caught, the
   * feature has no reason to exist.
   */
  it("catches a transposed spelling — Midalnd beside Midland", () => {
    expect(teams, "the fixture no longer holds Midalnd, so this case is untested").toContain("Midalnd");
    expect(teams, "the fixture no longer holds Midland, so this case is untested").toContain("Midland");
    expect(nearDuplicateSpellingsOf("Midalnd"), "Midalnd is not grouped with Midland").toContain("Midland");
    expect(nearDuplicateSpellingsOf("Midland"), "Midland is not grouped with Midalnd").toContain("Midalnd");
  });

  /**
   * ⚠️ THE REGRESSION THIS FILE WAS WRITTEN FOR. `Meade` is a misspelling of `Mead`, and both
   * names contain a service word the key strips — which is what made the pair fragile in the
   * prototype. Asserted in BOTH directions, because a one-way grouping would read as correct from
   * whichever page happened to be open.
   */
  it("catches a misspelling whose key is short after the service word is stripped — Meade Centre", () => {
    const misspelled = "Meade Centre (Armadale)";
    const correct = "Mead Centre (Armadale)";
    expect(teams, `the fixture no longer holds "${misspelled}", so this case is untested`).toContain(misspelled);
    expect(teams, `the fixture no longer holds "${correct}", so this case is untested`).toContain(correct);
    expect(nearDuplicateSpellingsOf(misspelled), `"${misspelled}" is grouped with nothing`).toContain(correct);
    expect(nearDuplicateSpellingsOf(correct), `"${correct}" is grouped with nothing`).toContain(misspelled);
  });

  /**
   * ⚠️ THE TWO PAIRS BELOW EXIST TO CATCH ONE SPECIFIC WRONG FIX, AND ONLY BOTH TOGETHER DO IT.
   *
   * Three relations are unioned to build a family: a key that removes whitespace and keeps word
   * ORDER, a Damerau sweep over the raw names, and a key that SORTS the words before joining.
   * Ward Builder One measured what happens if the sorting key REPLACES the ordered one instead of
   * joining it: the four Mead spellings merge, and `Wheat Belt` ↔ `Wheatbelt HS` is silently lost —
   * sorting reorders the two tokens of "wheat belt" and cannot reorder the single token
   * "wheatbelt". Families went 11 to 9. **A tidy-up that reads as a simplification, that fixes the
   * case in front of you, and that drops a different pair you were not looking at.**
   *
   * Pinning only the Mead family would pass that wrong fix. Pinning only Wheat Belt would pass the
   * bug it was written for. The pair is the guard.
   */
  it("groups all four spellings of the Mead service into ONE family, not two", () => {
    const spellings = [
      "Mead Centre (Armadale)",
      "Meade Centre (Armadale)",
      "Armadale (Mead Centre)",
      "Armadale (Mead)",
    ];
    for (const spelling of spellings) {
      expect(teams, `the fixture no longer holds "${spelling}", so this case is untested`).toContain(spelling);
    }
    /*
     * ⚠️ WHY THIS IS ASSERTED AS ONE FAMILY RATHER THAN AS SIX PAIRS. Before the sorting relation
     * existed these four sat in TWO families that never mentioned each other, so a reader on the
     * `Mead Centre (Armadale)` page was warned about `Meade Centre (Armadale)` and told nothing
     * about either `Armadale (…)` spelling. A warning that names SOME of a team's other spellings
     * and stops reads as complete, which is worse than no warning at all.
     */
    for (const spelling of spellings) {
      const siblings = nearDuplicateSpellingsOf(spelling);
      for (const other of spellings) {
        if (other === spelling) continue;
        expect(
          siblings,
          `"${spelling}" is not warned about "${other}" — its warning reads as complete and is not`,
        ).toContain(other);
      }
    }
  });

  it("still groups a pair that differs only by a space — Wheat Belt and Wheatbelt HS", () => {
    expect(teams, "the fixture no longer holds Wheat Belt").toContain("Wheat Belt");
    expect(teams, "the fixture no longer holds Wheatbelt HS").toContain("Wheatbelt HS");
    expect(
      nearDuplicateSpellingsOf("Wheat Belt"),
      "Wheat Belt is not grouped with Wheatbelt HS — if the word-sorting key has REPLACED the " +
        "order-keeping one rather than joining it, this is the pair that silently disappears",
    ).toContain("Wheatbelt HS");
  });

  /**
   * Every grouping is symmetric. A pair that reads alike from one page and unique from the other
   * is worse than no marking, because each page looks authoritative on its own.
   */
  it("is symmetric for every pair it groups", () => {
    let pairsChecked = 0;
    for (const group of groups) {
      // `names` holds `{ name, suburbs }`, not strings. An earlier draft of this loop compared the
      // objects against the strings `nearDuplicateSpellingsOf` returns, and the failure it produced
      // read as an asymmetry in the derivation rather than as a mistake in the test — the message
      // said `"[object Object]" is grouped with "[object Object]"`, which is the tell.
      const names = group.names.map((entry) => entry.name);
      for (const name of names) {
        for (const other of names) {
          if (name === other) continue;
          pairsChecked += 1;
          expect(
            nearDuplicateSpellingsOf(name),
            `"${name}" is grouped with "${other}", but "${other}" is not listed as its sibling`,
          ).toContain(other);
        }
      }
    }
    expect(pairsChecked, "no pair was checked, so symmetry is untested").toBeGreaterThan(0);
  });

  /**
   * ⚠️ THIS PIN'S SUBJECT CHANGED ON 2026-09-05 AND THE ASSERTION DID NOT. Read this before
   * touching it, because the same line now guards a different and more important property.
   *
   * IT WAS WRITTEN AS AN HONEST MISS: `ICC` and `Inner City Clinic` are plainly one service to a
   * human, no spelling rule reaches an initialism, and both screens cited ICC in words as the live
   * proof that an unmarked name is no guarantee. The pin existed so that teaching the rule about
   * abbreviations would go red and send somebody to fix that copy first.
   *
   * ⚠️ **THE OWNER HAS SINCE RULED THAT ALL FOUR INNER CITY SPELLINGS ARE ONE SERVICE** — `Inner
   * City` (16 suburbs), `ICC` (3), `Inner City Clinic` (1), `Inner City (central)` (1), 21 suburbs
   * — and an owner-confirmed alias table records it. So the "miss" is closed as a FACT while
   * remaining open as a COMPUTATION, and that gap is deliberate: the alias table is unreachable
   * from the similarity relation on purpose, so a human decision can never be mistaken for a rule's
   * guess. **A reader must be able to tell "a person decided these are one service" from "these
   * strings look alike", and folding the table into the relation erases exactly that.**
   *
   * SO WHAT THIS NOW PINS is that separation: the similarity rule has NOT absorbed the human
   * decision. If this goes red, somebody has wired the alias table into `communityNameCollisions()`
   * and the two authorities have been merged into one — which is the thing the ruling exists to
   * prevent, not a limitation to celebrate closing.
   *
   * ⚠️ AND NOTHING MECHANICAL WILL EVER TELL YOU THE SCREEN COPY IS STALE. This pin passes either
   * way; it always did. The prototypes that cited ICC as an uncaught name were corrected by hand
   * on 2026-09-05 because a peer said so, not because anything went red. **If you change what the
   * alias table covers, go and read the copy yourself.**
   */
  it("keeps the human alias decision OUT of the computed similarity relation", () => {
    expect(teams, "the fixture no longer holds ICC").toContain("ICC");
    expect(teams, "the fixture no longer holds Inner City Clinic").toContain("Inner City Clinic");
    expect(
      nearDuplicateSpellingsOf("ICC"),
      "ICC is now inside a COMPUTED near-duplicate family. The owner-confirmed alias table is " +
        "supposed to be unreachable from the similarity relation, so that a reader can tell a " +
        "person's decision from a string comparison. If the two have been merged, that distinction " +
        "is gone from every surface at once — fix the wiring, not this assertion.",
    ).toHaveLength(0);
  });
});
