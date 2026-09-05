// tests/ward-delay-cause-vocabulary.test.ts
//
// 🔴 **A DELAY CAUSE'S NOTE MUST NOT CALL ITS OWN EVENT BY A NAME ITS TITLE HAS RETIRED.**
//
// `bed_pull_expired` carried `title: "Bed pull expired"` beside `note: "the hold lapsed before the
// bed was used"` until 2026-09-06 — **the same event named two ways inside one object literal**,
// and that object is the authority the rest of the tree cites for the word "pull". I cited its
// title to another chat as the precedent for a rename while never reading its note.
//
// ⚠️ **NOTHING IN THE REPOSITORY ASSERTED ANYTHING ABOUT ANY NOTE.** Not this one — none of them.
// Every existing guard pins titles: `ward-delays-screen.dom.test.tsx` requires "Bed pull expired"
// on the screen and forbids "Bed hold expired", and both passed happily for as long as the note
// underneath contradicted the title above it. **A half-renamed entry looks finished from every
// angle anybody was looking from.** Found by Ward Verifier, who then measured that
// `awaiting_bed_ready` and `awaiting_coordinator` were equally unguarded.
//
// ⚠️ **THIS IS NOT A BAN ON THE WORD "hold", AND MUST NOT BECOME ONE.** "The hold lapsed before the
// bed was used" is honest English about a bed RESERVATION rather than about detaining a person, and
// a repository-wide ban would go red on truthful copy — at which point the tempting repair is to
// weaken the guard, and the honest guards go with it in the same tidy-up. The rule below is
// RELATIONAL: a note may say "hold" freely under a title that makes no claim about the event's
// name, and may not under a title that has already called the same event a pull. The second control
// asserts exactly that, so a future narrowing to a bare word-ban goes red rather than passing.
//
// A rename tomorrow needs one line changed in `RETIRED_BY_TITLE` — not a rewritten assertion.
//
// Being a table-walking test it imports the copy table directly rather than `delayGroups()`, which
// returns only causes the fixture populates. An entry nothing renders is exactly where a
// half-renamed pair survives longest.
import { describe, expect, it } from "vitest";

import { DELAY_CAUSE_COPY } from "@/components/ward-management/delays/delays-derivations";

/**
 * The vocabulary rulings, as relations rather than prohibitions.
 *
 * `canonical` is the word a title uses to name an event. `retired` are the words that named the
 * same event before the owner ruled, and which must not survive in that entry's own note.
 *
 * Matching is on a word STEM at a word boundary, so "hold" also catches "holds" and "holding" —
 * the family, not the exact token. That is deliberate: a rename defeated by adding "ing" is not a
 * rename.
 */
const RETIRED_BY_TITLE: readonly {
  readonly canonical: string;
  readonly retired: readonly string[];
  readonly ruling: string;
}[] = [
  {
    canonical: "pull",
    retired: ["hold"],
    ruling: "2026-09-06: the owner ruled a reserved bed is a PULL, the word he had already chosen once",
  },
];

const startsWord = (haystack: string, stem: string): boolean => new RegExp(`\\b${stem}`, "iu").test(haystack);

/** The violations in a catalogue, as sentences a reader can act on. */
function contradictions(
  entries: readonly { readonly cause: string; readonly title: string; readonly note: string }[],
): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.note.trim() === "") continue;
    for (const { canonical, retired, ruling } of RETIRED_BY_TITLE) {
      if (!startsWord(entry.title, canonical)) continue;
      for (const word of retired) {
        if (!startsWord(entry.note, word)) continue;
        found.push(
          `${entry.cause}: title "${entry.title}" calls it a ${canonical}, but its own note says ` +
            `"${word}" — "${entry.note}". Reword either field; they must agree. (${ruling})`,
        );
      }
    }
  }
  return found;
}

describe("a delay cause's note agrees with its own title about what the event is called", () => {
  it("walks a real catalogue with real notes, and a rule that engages on it (anti-vacuity)", () => {
    // ⚠️ THREE FLOORS, ALL ON THE POPULATION AND NONE ON THE FINDINGS. A floor on violations sits
    // at zero and can never fail. What must not silently shrink is what this walked at all — and
    // this guard has three separate ways to become inert, so it has three floors.
    //
    // 🔴 **AND EVERY NUMBER BELOW HAS DELIBERATE HEADROOM, BECAUSE MY FIRST DRAFT DID NOT.** I wrote
    // `toBeGreaterThan(8)` against a catalogue of exactly 9 — a floor sitting precisely on today's
    // count, with no room at all. `delayGroups` says in terms that the membership of this list is a
    // clinical question the owner has NOT ruled on, **so a cause may legitimately be added or
    // removed — and a floor with no headroom goes red on the correct change.** A guard that fires on
    // legitimate work is one somebody lowers or deletes, and the honest guards go with it. These
    // numbers catch a COLLAPSE, which is the failure that would make this suite inert; they are not
    // a pin on the catalogue's size, which is not this test's business.
    expect(
      DELAY_CAUSE_COPY.length,
      `only ${DELAY_CAUSE_COPY.length} delay causes — the catalogue has collapsed rather than been ` +
        "edited, so everything below is walking almost nothing",
    ).toBeGreaterThan(5);
    expect(
      DELAY_CAUSE_COPY.filter((entry) => entry.note.trim() !== "").length,
      "fewer than two catalogue entries carry a note, so the rule below has almost nothing to " +
        "police and would pass over a near-empty set",
    ).toBeGreaterThanOrEqual(2);
    expect(
      DELAY_CAUSE_COPY.filter((entry) => RETIRED_BY_TITLE.some((rule) => startsWord(entry.title, rule.canonical)))
        .length,
      "no title uses any canonical term in RETIRED_BY_TITLE, so no rule can engage on this " +
        "catalogue at all. Either a title was reworded away from a ruling, or the rules are stale.",
      // If this ever fires because the ruling changed, update RETIRED_BY_TITLE — do not delete it.
    ).toBeGreaterThanOrEqual(1);
  });

  it("catches a note that contradicts its own title, and leaves honest copy alone", () => {
    // 🔴 WITHOUT THIS THE GUARD IS DECORATION. The catalogue is correct now, so the real assertion
    // below passes over an empty list — indistinguishable from a detector that matches nothing.
    // Both directions, because a widening that disarms the rule must go red rather than pass.
    const planted = contradictions([
      { cause: "planted_contradiction", title: "Bed pull expired", note: "the hold lapsed before the bed was used" },
    ]);
    expect(planted, "the detector no longer finds a note contradicting its own title").toHaveLength(1);
    expect(planted[0]).toContain("planted_contradiction");

    // ⚠️ AND THE HALF THAT STOPS THIS BECOMING A WORD BAN. Every one of these says "hold" or a
    // relative of it, legitimately, because no title beside it claims the event is a pull. If a
    // future simplification turns the rule into `/hold/i`, THIS goes red — which is the point.
    expect(
      contradictions([
        { cause: "honest_reservation", title: "Awaiting the bed itself", note: "the ward is holding it" },
        { cause: "honest_detention", title: "Legal authority running out", note: "the patient is held under section" },
        { cause: "honest_verb", title: "Awaiting a ward's answer", note: "the record holds the moment it ran out" },
        { cause: "pull_note_agrees", title: "Bed pull expired", note: "the pull lapsed before the bed was used" },
      ]),
      "honest copy was reported as a contradiction. A note may say hold under a title that makes no " +
        "claim about the event's name — this rule is relational, and narrowing it to a word ban is " +
        "the failure it exists to prevent.",
    ).toEqual([]);
  });

  it("no entry in the live catalogue contradicts itself", () => {
    const found = contradictions(DELAY_CAUSE_COPY);
    expect(
      found,
      "these delay causes name one event two ways inside a single entry:\n" +
        found.join("\n") +
        "\n\nThe title is the ruling's spelling; bring the note to it. Do NOT resolve this by " +
        "banning the retired word elsewhere — it is honest English under a title that makes no " +
        "claim about the event's name.",
    ).toEqual([]);
  });
});
