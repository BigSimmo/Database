import { communityTeamSuburbCounts } from "@/components/ward-management/community/community-vocabulary";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";

/**
 * NAMES A PERSON HAS RULED ARE ONE SERVICE — HELD DELIBERATELY APART FROM THE SIMILARITY MACHINERY.
 *
 * 🔴 **`community-vocabulary.ts` REPORTS THAT TWO NAMES ARE CLOSE AND NEVER THAT THEY ARE THE SAME
 * SERVICE, AND THAT REMAINS TRUE.** Its header says so and the distinction is the whole safety of
 * it: *"these two strings differ by one edit"* is a property of the strings, computable and
 * checkable by anybody; *"these two are one team"* is a clinical claim about a real service. This
 * file is where the second kind lives, and it is a **table a person signed**, not a rule a machine
 * derived.
 *
 * ⚠️ **THE RULING COULD NOT HAVE BEEN REACHED BY LOOSENING A KEY, AND TRYING WOULD HAVE BEEN
 * DANGEROUS.** `ICC` → `Inner City Clinic` is not a string property. No edit distance reaches it —
 * they share three letters and differ in length by fourteen — no suffix fold produces it, and no
 * word-order key touches it. **Any rule loose enough to catch it would also merge `Alma Street
 * (Cockburn)` with `Alma Street (Melville)`, which are two sites and not two spellings.** A key
 * that could derive this ruling is a key that would invent others.
 *
 * ⚠️ **THE SOURCE DOCUMENT KNEW, AND THE MODULE DELIBERATELY DECLINED TO ACT ON IT WITHOUT A
 * HUMAN.** `docs/ward-flow-catchment-data.md` identifies `ICC` as `Inner City Clinic` abbreviated,
 * and then rules (§6.5) that the raw clinic string is KEPT so the source stays auditable, with any
 * normalisation belonging in **a separate mapping**. This file is that separate mapping, arriving
 * at last. **Record it as the mechanism working as designed, not as a gap being closed:** the
 * document identified it, the code refused to merge on its own authority, and a person decided.
 *
 * ⚠️ **NO CATCHMENT ROW IS REWRITTEN AND NO RAW STRING IS TOUCHED.** §6.5 still stands, and a
 * referral already typed under any member spelling stays findable under that spelling.
 *
 * 🔴 **AN ENTRY IS A GROUP, NOT A PAIR, AND THAT SHAPE IS THE RULING'S OWN SAFETY.** The first
 * version of this table held `{ spelling, service }` — one pair — because the first question put to
 * the owner was the narrow one. **Expressing a four-way ruling as pairs would need six rows, and
 * any reader completing the sixth from the other five would be doing transitive inference: exactly
 * the back door this file exists to close.** One decision, one row, every member named on it.
 *
 * **Four properties this table must keep, each with a guard in
 * `tests/ward-community-ratified-aliases.test.ts`:**
 *
 *  1. **Every member of every entry is a name the picker actually offers.** A member naming a
 *     spelling that is not in the vocabulary is a rule with no subject — it would read as ratified
 *     and do nothing, which is worse than an absent row.
 *  2. **It is enumerable and reviewable — one table a clinician reads in ten seconds, never a rule
 *     they must simulate.** A second ratified case is a visible second ROW. **Widening a pattern to
 *     absorb a new case is the failure this shape exists to prevent.**
 *  3. **It is not reachable from the near-duplicate relation.** `communityNameCollisions()` must not
 *     import this file, or the two kinds of claim silently become one on the page and the reader
 *     loses the ability to tell "a person decided" from "these strings look alike".
 *  4. **The figures the decider was shown must still be the figures the data yields.** See
 *     `shownCounts`.
 */

/**
 * One ratified decision. `members` are the spellings a person ruled are one service; every one must
 * be a selectable name.
 *
 * ⚠️ **`decidedBy`, `decidedOn`, `question` and `shownCounts` are not decoration.** A merge of two
 * clinical lists with no attribution is indistinguishable from one a machine guessed, and **what was
 * ASKED determines what the answer licenses.** This ruling was very nearly recorded at half its
 * width: the owner's first answer covered `ICC` and `Inner City Clinic` only, and because the
 * similarity relation already groups `Inner City` with `Inner City Clinic`, sixteen further suburbs
 * would have ridden in on an inference he had never been asked to make. He was then shown all four
 * spellings with their counts and ruled on all four. **The narrow question and the wide one have
 * different answers, and only the recorded question can tell them apart afterwards.**
 */
export type RatifiedServiceAlias = {
  readonly members: readonly string[];
  readonly decidedBy: string;
  readonly decidedOn: string;
  readonly question: string;
  /**
   * The suburb count shown against each member when the decision was made.
   *
   * 🔴 **A DECISION IS SCOPED TO THE FIGURES IT WAS MADE ON.** If the catchment data changes so that
   * a member no longer routes what the decider was shown, the ruling has not become wrong — but it
   * has stopped being a ruling about the thing in front of them, and somebody must look again. The
   * guard over this goes red saying so rather than letting a signed decision drift silently away
   * from its own evidence.
   */
  readonly shownCounts: Readonly<Record<string, number>>;
};

/**
 * 🔴 **ONE ROW. A SECOND RATIFIED CASE IS A SECOND ROW, NEVER A WIDENED RULE.**
 *
 * Twenty-one suburbs across four spellings. `Inner City` routes sixteen, `ICC` three,
 * `Inner City Clinic` one and `Inner City (central)` one. The similarity relation already groups
 * `Inner City` with `Inner City Clinic`, because that pair IS a string property. `ICC` is reachable
 * by nothing — it is an initialism, and no string rule that could exist would catch it — and it was
 * the standing example on the community prototypes of a name no check can flag, which is exactly
 * why it had to go to a person.
 */
export const RATIFIED_SERVICE_ALIASES: readonly RatifiedServiceAlias[] = [
  {
    members: ["Inner City", "ICC", "Inner City Clinic", "Inner City (central)"],
    decidedBy: "the owner",
    decidedOn: "2026-09-05",
    question:
      "All four Inner City spellings, with the suburbs each routes: Inner City 16 (Perth, Northbridge, Highgate, " +
      "Maylands, Mt Lawley and eleven more), ICC 3 (Bayswater, Bedford, Kings Park), Inner City Clinic 1 " +
      "(Noranda), Inner City (central) 1 (Central Business District). Merging ICC pulls in plain Inner City " +
      "transitively, so this asks about all sixteen of those as well. Are all four one service — or only ICC and " +
      "Inner City Clinic, or would you rather see the full suburb lists first?",
    shownCounts: {
      "Inner City": 16,
      ICC: 3,
      "Inner City Clinic": 1,
      "Inner City (central)": 1,
    },
  },
];

/** Every ratified entry naming this team, in table order. */
export function ratifiedAliasesFor(teamName: string): readonly RatifiedServiceAlias[] {
  return RATIFIED_SERVICE_ALIASES.filter((entry) => entry.members.includes(teamName));
}

/**
 * The other names a person has ruled are this same service — never the near-duplicates, which are a
 * different kind of claim and are reported separately by `nearDuplicateSpellingsOf`.
 */
export function ratifiedSameServiceNames(teamName: string): readonly string[] {
  return ratifiedAliasesFor(teamName).flatMap((entry) => entry.members.filter((name) => name !== teamName));
}

/**
 * Every member in the table that the referral picker does not actually offer.
 *
 * ⚠️ **DERIVED HERE RATHER THAN IN THE TEST** so a screen can refuse to render a ruling whose
 * subject has gone, rather than showing a sentence about a team that is not in the list.
 */
export function ratifiedAliasesWithNoSuchTeam(): readonly string[] {
  const offered = new Set(communityTeamOptions());
  return RATIFIED_SERVICE_ALIASES.flatMap((entry) => entry.members.filter((name) => !offered.has(name)));
}

/**
 * Members whose suburb count has moved since the decision was recorded, as
 * `"<name>: shown <n>, now <m>"`.
 *
 * ⚠️ **THIS IS NOT A DATA-INTEGRITY CHECK. IT IS A CONSENT CHECK.** The figures are allowed to
 * change; what is not allowed is for a signed decision to keep standing, unexamined, on figures its
 * signer never saw.
 */
export function ratifiedDecisionsOnMovedFigures(): readonly string[] {
  const counts = communityTeamSuburbCounts();
  return RATIFIED_SERVICE_ALIASES.flatMap((entry) =>
    Object.entries(entry.shownCounts)
      .filter(([name, shown]) => counts.get(name) !== shown)
      .map(([name, shown]) => `${name}: shown ${shown}, now ${counts.get(name) ?? 0}`),
  );
}
