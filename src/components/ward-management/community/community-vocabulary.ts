import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";

/**
 * WHICH TEAM NAMES IN THE REFERRAL PICKER ARE NEARLY THE SAME AS ANOTHER ONE.
 *
 * 🔴 **THE DEFECT THIS EXISTS FOR: THE COMMUNITY INDEX IS HEADED "ALL COMMUNITY TEAMS" AND LISTS
 * EVERY DISTINCT SPELLING, SO A READER COUNTS SERVICES AND GETS THE NUMBER OF SPELLINGS.** The
 * sharpest instance is a transposition: `Midalnd` and `Midland` are both selectable, one of them
 * routes two suburbs and the other sixty-eight, and on the page they sit one row apart looking like
 * two teams. Anybody referred to the typo lands on a team page nobody reads, and nothing on that
 * page can tell that from a genuinely quiet team.
 *
 * ⚠️ **THE SOURCE DOCUMENT ALREADY KNEW, WHICH IS WHY NO DATA IS CHANGED HERE.**
 * `docs/ward-flow-catchment-data.md` names `Midalnd` as a transposition typo, records "six ways of
 * writing what appears to be the same Armadale-area service", identifies `ICC` as `Inner City
 * Clinic` abbreviated — and then rules deliberately (§6.5) that the raw clinic string is KEPT so
 * the source value stays auditable, with any normalisation belonging in a separate mapping column.
 * That ruling stands and this module does not touch it. **The gap was never the data. It was that
 * the screen said none of it.**
 *
 * ⚠️ **THIS MODULE REPORTS THAT TWO NAMES ARE CLOSE. IT NEVER SAYS THEY ARE THE SAME SERVICE.**
 * That distinction is the whole safety of it. "These two strings differ by one edit" is a property
 * of the strings, computable and checkable by anybody. "These two are one team" is a clinical claim
 * about a real service, and nothing in this repository is entitled to make it — `Alma Street
 * (Cockburn)` and `Alma Street (Melville)` are two sites, not two spellings, and a module confident
 * enough to merge the typos is a module that would merge those too.
 */

/**
 * The same normalisation `communityTeamOptions()` (`referral-destination-options.ts`) uses to fold
 * spelling variants of one clinic into one pickable option — case, whitespace and punctuation to a
 * single space.
 *
 * Duplicated rather than imported, for the third time in this repository and for the reason
 * `community-teams-table.tsx` and `tests/ward-community-team-count.test.ts` both record: that
 * function's key builder is unexported, and a check on a derived vocabulary wants a SECOND
 * independent derivation over the same rows rather than the production function vouching for
 * itself. Four lines is a cheap price for a check that cannot be silenced by the thing it checks.
 */
function communityTeamKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

/**
 * Every name the picker can offer, with how many catchment rows route to it — keyed exactly as
 * `communityTeamOptions()` keys them, so a count here belongs to the option a referrer actually
 * sees rather than to one spelling of it.
 *
 * The displayed spelling is the most frequent one, ties broken alphabetically. That is
 * `communityTeamOptions()`'s own rule, reproduced rather than assumed: a different choice here
 * would report collisions between names that are not on the screen.
 */
export function communityTeamSuburbCounts(): ReadonlyMap<string, number> {
  const spellings = new Map<string, Map<string, number>>();
  for (const row of S2015_CATCHMENT_ROWS) {
    for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
      const key = communityTeamKey(clinic);
      if (key === "") continue;
      const counts = spellings.get(key) ?? new Map<string, number>();
      counts.set(clinic, (counts.get(clinic) ?? 0) + 1);
      spellings.set(key, counts);
    }
  }
  const totals = new Map<string, number>();
  for (const counts of spellings.values()) {
    const entries = [...counts.entries()];
    const display = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    totals.set(
      display,
      entries.reduce((sum, [, occurrences]) => sum + occurrences, 0),
    );
  }
  return totals;
}

/**
 * A second, harder key that additionally folds the health-service suffixes and the `Nth`/`North.`
 * abbreviations the 2015 document uses inconsistently.
 *
 * ⚠️ **IT DELIBERATELY DOES NOT TOUCH A BRACKETED QUALIFIER**, because those are the one part of
 * this vocabulary that reliably means something: `Eudoria Street (Gosnells)` and `Eudoria Street
 * (Thornlie)` are two named sites under one hospital, and `Alma Street` carries four of them. A key
 * that stripped brackets would report every one of those as a collision, and a screen that cries
 * collision on real distinctions teaches its reader to ignore the warning.
 */
/**
 * The same folding as `healthServiceFamilyKey`, but the words are SORTED before they are joined, so
 * `Mead Centre (Armadale)` and `Armadale (Mead Centre)` — the same words in a different order —
 * produce the same key. Used as an additional relation, never as a replacement; see the comment at
 * the grouping loop for the measurement that settled that.
 */
function wordOrderKey(mergeKey: string): string {
  return mergeKey
    .replace(/\b(?:h s|hs|health service|clinic|centre|center)\b/gu, " ")
    .replace(/\bnth\b/gu, "north")
    .trim()
    .split(/\s+/gu)
    .sort()
    .join("");
}

function healthServiceFamilyKey(mergeKey: string): string {
  return (
    mergeKey
      .replace(/\b(?:h s|hs|health service|clinic|centre|center)\b/gu, " ")
      .replace(/\bnth\b/gu, "north")
      /*
       * 🔴 **WHITESPACE IS REMOVED, NOT COLLAPSED, AND THE DIFFERENCE WAS A LIVE DEFECT.** This line
       * collapsed runs of whitespace to ONE space until 2026-09-05, which left `Wheat Belt` and
       * `Wheatbelt HS` in different families — **so the team page for `Wheat Belt` told a reader its
       * name was spelled only one way, while `Wheatbelt HS` sat a few rows below it on the index.**
       * That is the silent direction: an absent warning looks exactly like a team that genuinely has
       * no near-duplicate, and nothing on either page could contradict it.
       *
       * ⚠️ **NOBODY DESIGNED A RULE WHERE A SPACE MAKES TWO TEAMS DIFFERENT.** The key already folds
       * punctuation, case and the service words above; stopping one character short of folding the
       * space was an oversight, not a decision, and it survived because this key is only ever
       * compared with itself.
       *
       * ⚠️ **AND THE GUARD OVER THIS CANNOT SEE IT, BY CONSTRUCTION.**
       * `tests/ward-community-near-duplicate-warning.dom.test.tsx` is a biconditional between what
       * this predicate says and what the page renders, so changing the predicate moves BOTH sides —
       * verified, not assumed: the mutation that introduced this very fix survived every assertion.
       * **What found it was Ward Builder Three implementing the same rule independently for the
       * community gateway and laying the two name lists side by side.** Two counts would have shown
       * only that we disagreed; the names showed which of us was wrong.
       *
       * Measured before and after, by name and not by count: this adds exactly one family
       * (`Wheat Belt` + `Wheatbelt HS`) — 10 families to 11, 22 names to 24 — and merges nothing else.
       */
      .replace(/\s+/gu, "")
  );
}

/**
 * Damerau distance: a TRANSPOSITION counts as one edit, where plain Levenshtein charges two.
 *
 * ⚠️ **THAT IS NOT A REFINEMENT, IT IS THE DIFFERENCE BETWEEN SEEING THE WORST MEMBER AND BURYING
 * IT.** The one genuinely dangerous name in this vocabulary is a transposition — `Midalnd` for
 * `Midland`. Under Levenshtein it scores 2, exactly the same as `Western H.S.` against
 * `Western HS`, so the typo that misroutes a referral sorts in among the punctuation noise. Under
 * Damerau it scores 1 and stands alone.
 */
function damerauDistance(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const ceiling = a.length + b.length;
  const lastSeen = new Map<string, number>();
  const distance: number[][] = Array.from({ length: a.length + 2 }, () =>
    new Array<number>(b.length + 2).fill(ceiling),
  );
  for (let i = 0; i <= a.length; i += 1) distance[i + 1][1] = i;
  for (let j = 0; j <= b.length; j += 1) distance[1][j + 1] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let lastMatch = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const swapRow = lastSeen.get(b[j - 1]) ?? 0;
      const swapColumn = lastMatch;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (cost === 0) lastMatch = j;
      distance[i + 1][j + 1] = Math.min(
        distance[i][j] + cost,
        distance[i + 1][j] + 1,
        distance[i][j + 1] + 1,
        distance[swapRow][swapColumn] + (i - swapRow - 1) + 1 + (j - swapColumn - 1),
      );
    }
    lastSeen.set(a[i - 1], i);
  }
  return distance[a.length + 1][b.length + 1];
}

/** How close two names must be before a reader could plausibly pick the wrong one. */
const NEAR_DUPLICATE_EDIT_LIMIT = 2;

/**
 * Whether two picker options are close enough that a referrer could pick the wrong one.
 *
 * 🔴 **EXPORTED BECAUSE THE LIMIT ABOVE IS INERT AGAINST TODAY'S DATA, AND A MUTATION IS WHAT SAID
 * SO.** Narrowing `NEAR_DUPLICATE_EDIT_LIMIT` from 2 to 1 changes not one family in the current
 * catchment table: every pair two edits apart — `Gascoyne H.S.`/`Gascoyne HS`,
 * `Western H.S.`/`Western HS`, the two Nth Goldfield spellings — is ALSO folded by the suffix-family
 * key, and the only pairs the sweep reaches on its own, `Midalnd` and `Meade`, are one edit apart.
 * So the constant sat there reading as load-bearing while nothing depended on it, **which is the
 * same shape as a table min-width set below its own intrinsic minimum: correct-looking in the
 * source, provably doing nothing, and identical in every place anybody would check.**
 *
 * ⚠️ **THE ANSWER IS NOT TO NARROW IT TO 1.** Two edits is the coverage this vocabulary should have
 * against the NEXT extraction, not a description of the current one — a two-character typo is
 * exactly as plausible as the one-character typo already sitting in it. So the limit stays, and the
 * behaviour it buys is asserted against synthetic names instead of against data that happens not to
 * exercise it. A guard over live data alone cannot tell an unused branch from an absent one.
 */
export function namesAreNearDuplicates(left: string, right: string): boolean {
  return damerauDistance(left, right) <= NEAR_DUPLICATE_EDIT_LIMIT;
}

/** A set of picker options that are near-identical to each other, with the rows routing to each. */
export type CommunityNameCollision = {
  /** Every colliding option, most-routed first, then alphabetical. Always at least two. */
  readonly names: readonly { readonly name: string; readonly suburbs: number }[];
};

/**
 * The families of near-identical options, derived from the catchment rows on every call.
 *
 * ⚠️ **TWO INDEPENDENT DETECTORS, UNIONED — AND NEITHER IS REDUNDANT, WHICH WAS MEASURED RATHER
 * THAN ASSUMED.** The family key catches `Inner City` against `Inner City Clinic`, six characters
 * apart and far outside any edit limit. The distance sweep catches `Meade Centre (Armadale)`
 * against `Mead Centre (Armadale)`, which the family key cannot fold because the difference is a
 * letter inside a word rather than a suffix around it. **Each one alone misses the case the other
 * exists for**, so a future simplification down to one of them is a silent narrowing.
 *
 * Names are linked transitively: three spellings of North Goldfield are one family, not three
 * pairs, because a reader choosing between them is making one choice.
 */
export function communityNameCollisions(): readonly CommunityNameCollision[] {
  const counts = communityTeamSuburbCounts();
  const names = [...counts.keys()].sort((left, right) => left.localeCompare(right));

  const parent = new Map<string, string>(names.map((name) => [name, name]));
  const find = (name: string): string => {
    let root = name;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    return root;
  };
  const union = (left: string, right: string): void => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a, b);
  };

  /*
   * 🔴 **TWO KEYS, NOT ONE, AND THEY PULL IN OPPOSITE DIRECTIONS — WHICH IS WHY BOTH ARE HERE.**
   *
   * `familyKey` removes whitespace and keeps word ORDER. `wordOrderKey` sorts the words first, so
   * the same words in a different order collide. **Neither alone is enough, and each one loses a
   * real family the other finds.** Measured over the 65 names, by name and not by count:
   *
   *   order-preserving only   `Wheat Belt` ↔ `Wheatbelt HS` found;
   *                           `Mead Centre (Armadale)` and `Armadale (Mead Centre)` stay apart,
   *                           so one service is split across TWO families of two
   *   sorted only             the four Armadale/Mead spellings collapse into one family, correctly;
   *                           `Wheat Belt` ↔ `Wheatbelt HS` is LOST, because sorting reorders
   *                           `wheat belt` and cannot reorder the single token `wheatbelt`
   *
   * ⚠️ **THE SORTED KEY WAS PROPOSED AS A REPLACEMENT AND MEASURING IT IS WHAT STOPPED THAT.** As a
   * replacement it is a net loss: 11 families to 9 and 24 names to 22. As an ADDITIONAL relation
   * unioned beside the other two it is a gain, because union-find takes the transitive closure of
   * every relation rather than the verdict of the last one.
   *
   * ⚠️ **AND THE FIRST ATTEMPT AT THIS MEASUREMENT WAS INERT AND LOOKED CONCLUSIVE.** Sorting was
   * applied AFTER the whitespace had already been removed, so every key was a single token, the
   * sort did nothing, and the run came back "no change" — which reads exactly like "sorting makes
   * no difference here" rather than "this mutation never executed".
   */
  const byFamily = new Map<string, string[]>();
  const byWordOrder = new Map<string, string[]>();
  for (const name of names) {
    const merge = communityTeamKey(name);
    const family = healthServiceFamilyKey(merge);
    byFamily.set(family, [...(byFamily.get(family) ?? []), name]);
    const sorted = wordOrderKey(merge);
    byWordOrder.set(sorted, [...(byWordOrder.get(sorted) ?? []), name]);
  }
  for (const group of [...byFamily.values(), ...byWordOrder.values()]) {
    for (const other of group.slice(1)) union(group[0], other);
  }

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      if (namesAreNearDuplicates(names[i], names[j])) union(names[i], names[j]);
    }
  }

  const grouped = new Map<string, string[]>();
  for (const name of names) {
    const root = find(name);
    grouped.set(root, [...(grouped.get(root) ?? []), name]);
  }

  return [...grouped.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      names: group
        .map((name) => ({ name, suburbs: counts.get(name) ?? 0 }))
        .sort((left, right) => right.suburbs - left.suburbs || left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.names[0].name.localeCompare(right.names[0].name));
}

/**
 * How many picker options sit in one of those families — rendered, never written into prose.
 *
 * A figure typed into a sentence has no guard and goes stale the first time the source document is
 * replaced, which is how a count of teams on an approved prototype came to disagree with the list
 * printed beside it.
 */
export function communityNamesInCollisions(): number {
  return communityNameCollisions().reduce((total, collision) => total + collision.names.length, 0);
}

/**
 * The other spellings in the picker that are near-identical to this team's name.
 *
 * 🔴 **THE OWNER RULED ON 2026-09-05 THAT THESE ARE NOT TO BE MERGED, AND THAT THE PAGE MUST SAY
 * THEY EXIST.** Ward Builder Three put both halves to him and quoted the question; the answer was
 * yes to both. **The refusal is the load-bearing half and it is now standing:** normalising these
 * names means the software deciding that `Midalnd` means `Midland` and silently moving a patient
 * from one team's list to another's on a guess. **A visible split a reader has been warned about is
 * safer than an invisible merge nobody has been.**
 *
 * ⚠️ **THE HARM IS SPECIFIC AND IT IS WHY A WARNING IS NOT DECORATION.** Each spelling is its own
 * team page. Two referrals to one real team, typed differently, put those patients on two pages —
 * **and each page then truthfully reports that it has no record of the other's patient.** Every
 * sentence on both pages is individually correct and the pair is misleading. Somebody checking
 * whether their team is following a patient up can be looking at the wrong page and be told,
 * accurately, that nobody is there.
 */
export function nearDuplicateSpellingsOf(teamName: string): readonly string[] {
  const family = communityNameCollisions().find((collision) =>
    collision.names.some((entry) => entry.name === teamName),
  );
  if (family === undefined) return [];
  return family.names.filter((entry) => entry.name !== teamName).map((entry) => entry.name);
}
