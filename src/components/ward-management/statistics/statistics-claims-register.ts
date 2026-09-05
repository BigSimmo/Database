/**
 * THE CLAIMS REGISTER — the statements the statistics and community screens make about the data
 * model, each either paired with the line of real source that makes it true, or listed in
 * `UNEVIDENCED_CLAIMS` with the reason no line can be cited for it.
 *
 * ⚠️ **IT IS A SWEEP OF `REGISTERED_SURFACES`, NOT A GUARANTEE THAT NOTHING ON THEM IS UNRECORDED,
 * AND THE OPENING LINE CLAIMED OTHERWISE UNTIL 2026-09-01.** It read "EVERY statement … paired with
 * the line of real source that makes it true" — an unearned absolute in the strongest position in
 * the file, in the file whose entire subject is that an overstated guarantee is worse than an
 * absent one. Two things falsify it at once: `UNEVIDENCED_CLAIMS` below is a list of statements
 * these screens make that are deliberately NOT paired with any line, and a statement inside a
 * registered surface can be carried by neither list — a false sentence on
 * `statistics-overview-screen.tsx`, a file named in `REGISTERED_SURFACES`, was found in exactly
 * that state on the same day. Exclusion class 6 below already said so; the title line now agrees
 * with the body instead of overstating it.
 *
 * ⚠️ **WHY THIS EXISTS.** On 2026-09-01 seven statements these screens make about the model were
 * found FALSE. Every one passed the entire test suite. Every one was found by a human reading, or
 * by somebody asking a question — not one by a gate. `ReferralAddressing` was said to "carry no
 * unit at all" while carrying `acceptedUnitId`; "nothing marks the moment preparation started" was
 * written while `SET_BED_PREPARATION` stamps `confirmedAt`; `Admission` was said to keep five
 * instants when it keeps seven; follow-up was said to have "no field for it" while
 * `Admission.followUp` exists and is seeded. The arithmetic on these pages has been right all day.
 * The explanations have not.
 *
 * That matters more here than it would anywhere else. These pages refuse to show figures they
 * cannot support and explain why. A reader has no way to check the explanation and every reason to
 * trust it, so **a false explanation is worse than a missing figure.**
 *
 * ⚠️ **THE MECHANISM.** Each claim is paired with an exact substring of a REAL source file, read
 * from disk at test time by `tests/ward-statistics-claims.test.ts`. The substring must appear in
 * that named file **exactly once**. A claim whose evidence has moved, been renamed, been deleted or
 * become ambiguous goes red NAMING THE CLAIM, not the string.
 *
 * The evidence is never a copy pasted in here for safekeeping. A copy cannot go stale, which is
 * precisely what would defeat the whole mechanism: the register is a set of POINTERS, and a pointer
 * into a file that has moved on is exactly the failure worth catching.
 *
 * ⚠️ **WHITESPACE IS THE ONLY THING NORMALISED.** Every run of whitespace — in the file and in the
 * citation — collapses to a single space before matching, so that Prettier re-wrapping a JSX
 * paragraph or a doc comment is not a false red. Nothing else is normalised: no case folding, no
 * punctuation stripping, no near-matching. A renamed field, a changed type, a deleted line and a
 * second copy of the same declaration all still fail.
 *
 * ⚠️ **THE CLAIM IS NOT RESTATED HERE — THE REGISTER CITES THE SCREEN.** Of the two ways round,
 * this module could hold the page's sentences and have the screens render from it, or it could
 * point at where each sentence already lives. It points. The reason is that the sentences are JSX
 * with `<code>` and `<strong>` inside them, entity escapes, and in two cases a conditional branch;
 * pulling them in here would either flatten them into strings the DOM tests could no longer pin, or
 * make this a component module instead of a readable list. So `claim` below is a one-line summary
 * IN THE REGISTER'S OWN WORDS — deliberately not the rendered sentence — and `rendered` is a short
 * locator copied from the screen file, which the test asserts appears there exactly once too. The
 * locator is a fragment of the screen rather than a second copy of the claim, and being pinned
 * exactly-once it cannot drift out of agreement silently either. Both ends are checked: the screen
 * still says it, and the source still supports it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS MECHANISM CANNOT CATCH. Be specific here rather than apologetic — a guard that
 * overstates its own reach is the same defect one level up, and this project shipped exactly that
 * defect today.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *  1. **A claim that was wrong the day it was written, and cited correspondingly wrongly.** If
 *     somebody writes "`ReferralAddressing` carries no unit" and cites the `Movement` type body as
 *     evidence, both halves agree with each other and the test is green. The register checks that
 *     evidence still says what it said; it cannot check that the claim FOLLOWS from the evidence.
 *     That inference is a reading, and only a reader does it. **The register makes a claim decay
 *     loudly. It does not make a claim true.**
 *
 *  2. **Any claim of ABSENCE.** A substring can only witness something that exists. "Nothing in the
 *     reducer stops a caller flagging a discharge that has not happened yet", "there is no role
 *     check on this route", "no instant on `Admission` marks entry to `waitlisted`" — none of these
 *     has a line to cite, because the fact is that no line is there. Adding the very field a claim
 *     denies exists therefore breaks nothing here. Those claims are listed in
 *     `UNEVIDENCED_CLAIMS` below with the reason, so the gap is countable rather than invisible;
 *     several of them are guarded by other tests, named there.
 *
 *  3. **Claims about the SEED FIXTURE — and this register no longer carries any.** A fixture is not
 *     a contract: the citation would have to be a data file, the count changes with the data, and
 *     `statistics-derivations.ts` records that this exact class of sentence has falsified itself
 *     silently four times on one paragraph. Listing such a claim in `UNEVIDENCED_CLAIMS` makes the
 *     risk countable but leaves it live on the page, so on 2026-09-01 the owner took the other
 *     route: the two that were here — one on the ED screen about how many seeded referrals carry a
 *     `triagedAt`, one on the community index about how many pages the dynamic route serves — were
 *     **removed from the prose instead of recorded as gaps**, and their entries deleted with them.
 *     The rule the pages now follow: describe what the derivation can and cannot establish, never
 *     what the seed happens to contain, and where a quantity is genuinely needed RENDER it from
 *     live state rather than typing it. A count that is rendered is fine; a count that is typed is
 *     the defect. Anything of this shape arriving here in future belongs in that rewrite, not in
 *     `UNEVIDENCED_CLAIMS`.
 *
 *  4. **Whether the claim is still ON THE PAGE.** `rendered` pins that the locator exists in the
 *     screen file — not that the sentence around it still says what `claim` summarises. Deleting a
 *     whole paragraph, locator and all, goes red. Rewriting the sentence around a surviving
 *     `data-testid` does not.
 *
 *  5. **A CITATION THAT CANNOT FAIL — this WAS the largest gap, and since 2026-09-01 it is closed
 *     by a mechanism rather than by care.** Every check here used to ask only whether the cited
 *     bytes are still present. It never asked the question that matters: **would the claim's
 *     falsity change those bytes?** An audit put all the entries below to exactly that test and
 *     TWELVE failed it — including one where THIS FILE asserted in prose that a citation was
 *     "cited whole" when it covered neither end of the body it named. Unguarded while appearing
 *     guarded is worse than unguarded, because the coverage number counts it.
 *
 *     ⚠️ **THE FIX: EVERY CLAIM SHIPS WITH ITS OWN FALSIFYING EDIT, AND THE TEST APPLIES IT.**
 *     `falsifiedBy` records a change to `sourceFile` that would make the claim FALSE.
 *     `tests/ward-statistics-claims.test.ts` applies it IN MEMORY and asserts the evidence
 *     substring is then ABSENT. Nothing is written to disk, no suite runs, no build happens — the
 *     existing check was already a substring test over file contents, so this is one string
 *     replacement and a second `includes()`, and doing it for every claim costs microseconds. That
 *     is why it is worth doing here and would not be worth doing against a real test suite.
 *
 *     What it buys is that **an unfalsifiable claim becomes impossible to register.** For a comment
 *     citation, a slice cited for an "only", or a type declaration cited for a computation, there
 *     is no edit that removes the cited bytes AND makes the claim false — and the author finds that
 *     out at registration rather than four months later.
 *
 *     ⚠️ **A CITATION CAN BE PRESENT, UNIQUE, AND RIGHT BY ACCIDENT.** The property being guarded
 *     is not "it gives the right answer today" — it is "it would stop giving the right answer if
 *     the claim stopped being true". Those come apart. A comment citation can be perfectly correct
 *     right now and the guard will still reject it, and that is the guard working, not the guard
 *     being pedantic: the comment's presence is unconnected to the fact it is standing in for, so
 *     it will go on being green after the fact changes and go red if somebody merely tidies it.
 *     The same defect exists outside this feature — `tests/route-reachability.test.ts` has been
 *     satisfied by a module's own note describing a link, with the real link mutated away.
 *
 *     ⚠️ **THE RESIDUAL, STATED RATHER THAN HIDDEN.** An author can record a WEAK falsifying edit:
 *     one that removes the cited bytes for a reason unrelated to the claim (retype a field to
 *     `never`, delete the line, rename it). Nothing closes that mechanically. It is much narrower
 *     than what it replaces, because it now takes deliberately writing a misleading edit rather
 *     than merely picking a convenient string — and `falsifiedBy.change` is where the author says
 *     in words what change to the world the edit stands for, so a reader can judge it. Where an
 *     edit only falsifies PART of a claim (the positive half of an "only", say), `change` says so.
 *
 *     ⚠️ **The reversal worth recording, because it inverts the obvious heuristic.** The citations
 *     that quote an ENTIRE TYPE BODY look loose and are the STRONGEST in the register:
 *     `COMMUNITY_TEAM_BODY` breaks if a field is added, removed or reordered, which is every change
 *     that would make its "and nothing else" false. Being large is not being loose — that one is
 *     large BECAUSE it pins an absence. The defect was in the short, tidy, specific-looking
 *     citation. Length was never the property that mattered; falsifiability was.
 *
 *     ⚠️ **AND THE PROSE ABOUT A CITATION IS NOT THE CITATION.** `WARD_DESTINATION_ARM` carried a
 *     doc comment saying the arm was "cited whole… only the whole arm can witness the never" while
 *     the string started at `sex:` and stopped at `secureBedNeeded:` — omitting `kind` and
 *     `involuntaryBedNeeded` and touching neither end. Nothing could have caught that except a
 *     reader or the falsifying-edit test, and the falsifying-edit test now does.
 *
 *  6. **Prose anywhere else.** This register covers the files listed in `REGISTERED_SURFACES`. A
 *     new statistics screen is not swept until somebody adds it, and nothing here notices that
 *     nobody did. The one thing that partly covers this: the test asserts every registered surface
 *     file exists, so a screen that is renamed or deleted fails rather than quietly dropping out.
 */

/** The surfaces this register claims to have swept. Repository-relative paths. */
export const REGISTERED_SURFACES: readonly string[] = [
  "src/components/ward-management/statistics/statistics-screen.tsx",
  "src/components/ward-management/statistics/statistics-overview-screen.tsx",
  "src/components/ward-management/statistics/statistics-compare-screen.tsx",
  "src/components/ward-management/statistics/statistics-ward-screen.tsx",
  "src/components/ward-management/statistics/statistics-ed-screen.tsx",
  "src/components/ward-management/statistics/statistics-section-frame.tsx",
  "src/components/ward-management/statistics/statistics-disclaimers.tsx",
  "src/components/ward-management/statistics/statistics-derivations.ts",
  "src/components/ward-management/community/community-index.tsx",
];

/**
 * ⚠️ **THE CHANGE THAT WOULD MAKE A CLAIM FALSE, WRITTEN AS AN EDIT THE TEST CAN ACTUALLY APPLY.**
 *
 * A find/replace pair over `sourceFile` was chosen over the alternatives (an insertion with an
 * anchor, a line number, a structured mutation) for one reason: it is the shape that is simplest to
 * write correctly for every entry, and every other shape is a special case of it. An insertion is
 * `find: "<anchor>"`, `replaceWith: "<anchor> <new line>"`. A deletion is `replaceWith: ""` on the
 * deleted fragment. A rename or a retype is the ordinary case. Nothing else was needed.
 *
 * Both halves are checked by `tests/ward-statistics-claims.test.ts`:
 *
 *   - `find` must appear in `sourceFile` **exactly once**, so an edit whose anchor has itself gone
 *     stale goes red rather than silently applying nothing and passing;
 *   - `replaceWith` must differ from `find`, so a no-op edit cannot be recorded;
 *   - after the replacement, `evidence` must be **ABSENT** from the file.
 *
 * The edit is applied to an in-memory copy. No file is written and nothing is executed.
 */
export type FalsifyingEdit = {
  /**
   * The change to the world this edit stands for, in the register's own words — what would have to
   * become true of the system for the claim to be false. This is the half no machine can check, so
   * it is where honesty is spent: if the edit only falsifies PART of the claim, say so here.
   */
  change: string;
  /** An exact substring of `sourceFile` (whitespace-collapsed), which must appear there exactly once. */
  find: string;
  /** What `find` becomes. Must differ from `find`, and the result must no longer contain `evidence`. */
  replaceWith: string;
};

export type ModelClaim = {
  /** Unique. Reads `<surface>/<where on it>/<what is claimed>`, so a red names a place and a fact. */
  id: string;
  /** Repository-relative path of the file that MAKES the claim. One of `REGISTERED_SURFACES`. */
  renderedIn: string;
  /**
   * A short locator copied from `renderedIn` — a `data-testid`, or a distinctive fragment where the
   * paragraph has none. Asserted to appear in that file exactly once. Not the claim itself.
   */
  rendered: string;
  /** What is being claimed, in one line, in the register's own words. Never the page's sentence. */
  claim: string;
  /** Repository-relative path of the file the evidence lives in. */
  sourceFile: string;
  /** An exact substring of `sourceFile`, which must appear there exactly once. */
  evidence: string;
  /**
   * The edit that would make this claim false. Applied in memory by the test, which then asserts
   * `evidence` has gone. A claim whose evidence SURVIVES its own falsifying edit is a claim nothing
   * is guarding, and it goes red naming the claim.
   */
  falsifiedBy: FalsifyingEdit;
};

const WARD_MODEL = "src/components/ward-management/ward-model.ts";
const WARD_ADMISSIONS = "src/components/ward-management/ward-admissions.ts";
const WARD_REDUCER = "src/components/ward-management/ward-flow-reducer.ts";
const WARD_STATISTICS = "src/components/ward-management/ward-statistics.ts";
const WARD_DERIVATIONS = "src/components/ward-management/ward-derivations.ts";
const WARD_REFERRALS = "src/components/ward-management/ward-referrals.ts";
const WARD_SCREEN = "src/components/ward-management/ward/ward-screen.tsx";
const WARD_SITES = "src/components/ward-management/ward-sites.ts";
const WARD_TEAMS = "src/components/ward-management/ward-teams.ts";
const STATISTICS_SCREEN = "src/components/ward-management/statistics/statistics-screen.tsx";
const OVERVIEW_SCREEN = "src/components/ward-management/statistics/statistics-overview-screen.tsx";
const COMPARE_SCREEN = "src/components/ward-management/statistics/statistics-compare-screen.tsx";
const WARD_STATS_SCREEN = "src/components/ward-management/statistics/statistics-ward-screen.tsx";
const ED_SCREEN = "src/components/ward-management/statistics/statistics-ed-screen.tsx";
const SECTION_FRAME = "src/components/ward-management/statistics/statistics-section-frame.tsx";
const DERIVATIONS = "src/components/ward-management/statistics/statistics-derivations.ts";
const SECTIONS = "src/components/ward-management/statistics/statistics-sections.ts";
const COMMUNITY_INDEX = "src/components/ward-management/community/community-index.tsx";
const WARD_NAV = "src/components/ward-management/ward-nav.ts";
const COMMUNITY_DERIVATIONS = "src/components/ward-management/community/community-derivations.ts";
const COMMUNITY_SCREEN = "src/components/ward-management/community/community-screen.tsx";
const DESTINATION_OPTIONS = "src/components/ward-management/referrals/referral-destination-options.ts";

/**
 * The whole `ReferralAddressing` type body, cited as ONE substring on purpose.
 *
 * This is the strongest entry in the register and the one that would have caught the worst of the
 * seven. The claim three screens make is not about a field being present — it is that
 * `acceptedUnitId` is the ONLY field on this record that can name a unit. No single-line citation
 * can witness an "only". Citing the entire body can: any field added, removed or renamed on the
 * record changes this string and every claim standing on it goes red at once. That is the correct
 * blast radius, because a new unit field on this record falsifies all three of them together.
 */
const REFERRAL_ADDRESSING_BODY =
  "export type ReferralAddressing = { destination: ReferralDestination; state: ReferralAddressingState; " +
  "/** When this destination answered, or when acceptance elsewhere cancelled it. */ decidedAt?: " +
  "Instant; /** A ROLE, never a person — see `WARD_FLOW_ROLE_LABELS`. Absent on a `cancelled` " +
  "addressing, * because nobody decided it: it is a consequence of an acceptance, not an act. */ " +
  "decidedBy?: string; /** Only on a `declined` addressing, and only from `REFERRAL_DECLINE_REASONS`. " +
  "*/ declineReason?: ReferralDeclineReason; /** * Only on an `accepted` addressing, and only from " +
  "`OVERRIDE_REASONS` — the SAME vocabulary the * three placement events use, deliberately not a second " +
  "one. Set when the ward accepted a * referral that failed a judgement gate (age, legal status, sex " +
  "designation, forensic, security, * sex mix), which is permitted with a reason recorded and refused " +
  "without one. * * ⚠️ Its ABSENCE on an accepted addressing means the referral passed every gate — not " +
  "that * nobody bothered to type a reason. The reducer refuses the acceptance outright in that case, " +
  "so * an accepted-and-unreasoned addressing is only ever a clean one. */ acceptOverrideReason?: " +
  "OverrideReason; /** The unit that accepted. Only ever set on a `psychiatric_ward` addressing — the " +
  "other three * are answered by a person or a team, and have no unit to name. */ acceptedUnitId?: " +
  "string; };";

/**
 * The `psychiatric_ward` destination arm, cited whole — from its `kind` discriminant to the brace
 * that closes it. Two screens say this arm records the bed's criteria "and never a unit"; only the
 * whole arm can witness the "never".
 *
 * ⚠️ **THIS CONSTANT PREVIOUSLY SAID "cited whole" AND WAS NOT.** Until 2026-09-01 the string ran
 * from `sex: Sex;` to `secureBedNeeded: boolean;` — omitting `kind` at one end and
 * `involuntaryBedNeeded` at the other, touching neither boundary of the arm. Adding
 * `preferredUnitId?: string;` left every cited byte in place, so both screens went on saying the arm
 * "carries no unit id of its own" with nothing checking it; deleting `involuntaryBedNeeded`, which
 * the claim NAMES as one of the three criteria, likewise broke nothing. The register asserting a
 * property of its own evidence that its own evidence did not have is this module's defect one level
 * up, and it is the reason `falsifiedBy` exists.
 */
const WARD_DESTINATION_ARM =
  'kind: "psychiatric_ward"; /** * Compared to a unit\'s `sexMix` and `sexDesignation` by equality. A ' +
  "fact about the person, * and the ONLY one that sits on an arm rather than on the referral itself — " +
  "it is here * because it is read solely to match a bed's designation, and no other destination has " +
  "one. */ sex: Sex; /** Whether THIS REQUEST needs a secure bed. Never a fact stored about the person. " +
  "*/ secureBedNeeded: boolean; /** * Whether THIS REQUEST needs a bed that can hold someone " +
  "involuntarily — never a fact stored * about the person, and never a legal determination. Same " +
  "convention as `secureBedNeeded` and * roadmap decision 5's cohort framing: the request needs an " +
  "adolescent bed, a secure bed, or * here, a bed that can hold someone involuntarily — the word never " +
  "attaches to the patient. * Introduces no figure, timeframe or threshold from the Mental Health Act; " +
  "a plain * Voluntary/Involuntary bed label was already permitted, and this is the same category. */ " +
  "involuntaryBedNeeded: boolean; }";

/** Shared by both screens that make the ward-destination claim, so both go red together. */
const WARD_DESTINATION_ARM_GAINS_A_UNIT_ID: FalsifyingEdit = {
  change:
    "The ward arm starts naming a unit — a `preferredUnitId` is added to it, so the arm no longer " +
    "carries only the bed's criteria and the two screens' 'no unit id of its own' becomes false.",
  find: "involuntaryBedNeeded: boolean; }",
  replaceWith: "involuntaryBedNeeded: boolean; preferredUnitId?: string; }",
};

/**
 * The whole `BedRelease` record, cited as ONE substring for the same reason `REFERRAL_ADDRESSING_BODY`
 * is: the claim standing on it is an "only". The statistics home page says the record carries a
 * SINGLE `confirmedAt` rather than one instant per act on the release, and no short citation can
 * witness that — a second instant field arriving anywhere on the record falsifies it, so the whole
 * record is what has to be pinned.
 *
 * ⚠️ **IT USED TO CITE TWO FIELDS.** `preparationNote: BedPreparationNote | null; confirmedAt:
 * Instant;` is a slice, and `preparedAt: Instant | null;` added after `confirmedBy` left it exactly
 * where it was. Four claims away, `REFERRAL_ADDRESSING_BODY` was already doing this correctly.
 */
const BED_RELEASE_BODY =
  "export type BedRelease = { id: string; unitId: string; state: BedReleaseState; expectedAt: Instant; " +
  "/** * What this discharge is still waiting on, chosen from `BED_RELEASE_WAITING_ON`. Non-null only * " +
  'while `state` is `"expected"` — a confirmed discharge is a decision, not something still * being ' +
  "waited on, and a released one has already happened. * * Renamed from `confidence` by the Q1 axis " +
  'change of 2026-08-28. Keeping the old name over the * new values would have put "Awaiting ward ' +
  'round" in a field called `confidence` on a screen a * coordinator reads as fact, which is the kind ' +
  'of quiet mismatch this project treats as a * defect rather than a cosmetic point. * * `"Nothing ' +
  'outstanding"` is a legitimate value, not an absence: it means a expected discharge * with no ' +
  "obstacle. `null` means the release is not expected at all. The two are different and * must not be " +
  "collapsed. */ waitingOn: BedReleaseWaitingOn | null; /** * **The blocked FLAG's reason** (bed-model " +
  "rework, 2026-08-28). Non-null means this discharge * is decided-or-expected AND currently stuck; it " +
  'may sit on a `"expected"` release or on a * `"confirmed"` one, and a blocked-but-confirmed release ' +
  'still counts as confirmed. Always * `null` on a `"discharged"` release — once the bed is free there ' +
  "is nothing left being held up. * * Before this rework `blocked` was a fourth STATE and this field " +
  "was legal only in it, which * is what made a stuck confirmed discharge fall out of the ward's " +
  "confirmed count entirely. * Always a `BedReleaseBlocker` — enforced by the type here, and by a " +
  "membership check against * `BED_RELEASE_BLOCKERS` in the reducer. */ blocker: BedReleaseBlocker | " +
  "null; /** * The role that recorded the block, non-null exactly when `blocker` is. A role — a unit or " +
  "* service label — never a personal name, the same discipline `confirmedBy` holds to. Kept * separate " +
  "from `confirmedBy` because the two answer different questions once a block can * outlive a state " +
  "change: `confirmedBy` is who last reported this release's stage, this is who * said it was stuck " +
  "(Q3: provenance stays a role and a timestamp, never a person). */ blockedBy: string | null; /** * Q4 " +
  "of the 2026-08-28 decisions: this bed is being MADE READY (cleaning and the like). * **Informational " +
  "only — it must NEVER gate allocation.** A bed being prepared is still * offered, still counts in " +
  "`availableNow`, and still appears in every figure, because the pull * of the next patient takes " +
  "hours anyway. See `BED_PREPARATION_NOTES` for the full reasoning. */ preparing: boolean; /** * What " +
  "the bed is waiting on to be ready, chosen from `BED_PREPARATION_NOTES` — the owner * supplied that " +
  "list on 2026-08-28, so the field is now expressible where it could previously * only be `null`. " +
  '`null` alongside `preparing: true` remains legal and means "being made ready, * reason not stated"; ' +
  '`preparing: false` forces it null, because "not being made ready, waiting * on a clean" is a ' +
  "contradiction. * * **A note here still gates NOTHING.** See `preparing` above and " +
  "`BED_PREPARATION_NOTES`. */ preparationNote: BedPreparationNote | null; confirmedAt: Instant; /** A " +
  "role — a unit or service label. Never a personal name. */ confirmedBy: string; };";

/**
 * The site lookup, cited as its signature AND its body. Two screens claim it returns nothing rather
 * than a fallback when a code matches none, and the RETURN TYPE cannot witness that: `?? wardSites[0]`
 * is still assignable to `Site | undefined`, so the declared signature is unchanged by exactly the
 * edit that makes the claim false. The `.find(...)` expression is what has to move.
 */
const SITE_BY_CODE_LOOKUP =
  "/** Returns `undefined` for an unknown code. Never falls back to a different site. */ export " +
  "function siteByCode(code: string): Site | undefined { return wardSites.find((site) => site.code === " +
  "code); }";

/** Shared by the two screens that make the site-lookup claim, so both go red together. */
const SITE_BY_CODE_GAINS_A_FALLBACK: FalsifyingEdit = {
  change:
    "The lookup starts substituting a site instead of answering nothing — `?? wardSites[0]` — which " +
    "is legal against the unchanged declared return type and is precisely what both screens deny.",
  find: "return wardSites.find((site) => site.code === code); }",
  replaceWith: "return wardSites.find((site) => site.code === code) ?? wardSites[0]; }",
};

/*
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * FALSIFYING EDITS SHARED BY SEVERAL CLAIMS.
 *
 * Where three screens state the same fact, they cite the same evidence and they should go red
 * TOGETHER when it changes — so they share one edit too. A shared edit also stops the three from
 * drifting into three different accounts of what would make the same fact false.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 */

const REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID: FalsifyingEdit = {
  change:
    "A second field on the record can name a unit — `declinedByUnitId` — so `acceptedUnitId` stops being " +
    "the only one, and every screen saying so is wrong at once.",
  find: "* are answered by a person or a team, and have no unit to name. */ acceptedUnitId?: string; };",
  replaceWith:
    "* are answered by a person or a team, and have no unit to name. */ acceptedUnitId?: string; " +
    "declinedByUnitId?: string; };",
};

const ACCEPTANCE_STOPS_RECORDING_THE_UNIT: FalsifyingEdit = {
  change:
    "The acceptance path stops recording which unit accepted, so the reducer no longer writes " +
    "`acceptedUnitId` there. (This falsifies the positive half. The 'and nowhere else' half is an " +
    "absence — a second writer added on the decline path would leave this line untouched.)",
  find: 'accepted = { ...addressing, state: "accepted", acceptedUnitId: unit.id,',
  replaceWith: 'accepted = { ...addressing, state: "accepted",',
};

const DECLINE_LOSES_ITS_UNIT: FalsifyingEdit = {
  change: "A movement decline stops naming the unit that gave it, so it no longer records a unit id at all.",
  find: "export type Decline = { unitId: string; at: Instant; reason: DeclineReason; };",
  replaceWith: "export type Decline = { at: Instant; reason: DeclineReason; };",
};

const DECLINE_GAINS_FREE_TEXT: FalsifyingEdit = {
  change: "A free-text note arrives on a movement decline, so it no longer carries a reason and nothing else.",
  find: "export type Decline = { unitId: string; at: Instant; reason: DeclineReason; };",
  replaceWith: "export type Decline = { unitId: string; at: Instant; reason: DeclineReason; note: string; };",
};

const MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST: FalsifyingEdit = {
  change:
    "A movement keeps only its most recent decline instead of a list, so it no longer records every ward " +
    "decline against it.",
  find: "declines: Decline[];",
  replaceWith: "declines: Decline | null;",
};

const MOVEMENT_ORIGIN_ED_BECOMES_OPTIONAL: FalsifyingEdit = {
  change:
    "The origin department stops being required — `originEdId: string | null;` — so a movement no longer " +
    "always names one. (Where a screen adds that the person is PHYSICALLY in that department, that is a " +
    "reading of what the field MEANS, and no substring witnesses a meaning.)",
  find: "originEdId: string;",
  replaceWith: "originEdId: string | null;",
};

const REFERRED_UNIT_IDS_BECOMES_ONE_ID: FalsifyingEdit = {
  change:
    "The field stops being a list and becomes a single id, so a movement can be live at one ward only and " +
    "the screens' 'not a single id' is false.",
  find: "referredUnitIds: string[];",
  replaceWith: "referredUnitId: string | null;",
};

const THE_PARALLEL_REFERRAL_CAP_IS_REMOVED: FalsifyingEdit = {
  change: "The cap is removed, so no constant of that name bounds how many wards one movement can be live at.",
  find: "export const PARALLEL_REFERRAL_CAP = 3;",
  replaceWith: "",
};

const REFERRAL_ID_STOPS_BEING_NULLABLE: FalsifyingEdit = {
  change: "`Admission.referralId` stops being nullable, so a null is no longer a state the record can hold at all.",
  find: "referralId: string | null;",
  replaceWith: "referralId: string;",
};

const RAISED_AT_STOPS_BEING_REQUIRED: FalsifyingEdit = {
  change: "`Referral.raisedAt` becomes optional, so a referral may carry no instant it was raised.",
  find: "source: ReferralSource; raisedAt: Instant;",
  replaceWith: "source: ReferralSource; raisedAt?: Instant;",
};

const PREPARING_STOPS_BEING_A_BOOLEAN: FalsifyingEdit = {
  change:
    "Bed readiness stops being a yes/no and becomes a state — `preparing: BedPreparationState;` — so every " +
    "page calling it a boolean is wrong.",
  find: "preparing: boolean;",
  replaceWith: "preparing: BedPreparationState;",
};

/** The whole `EmergencyDepartment` record. The ED screen claims it holds these three and no more. */
const EMERGENCY_DEPARTMENT_BODY = "export type EmergencyDepartment = { id: string; siteCode: string; name: string; };";

/** The whole `Decline` record. Three screens state its three fields by name. */
const DECLINE_BODY = "export type Decline = { unitId: string; at: Instant; reason: DeclineReason; };";

/**
 * The two capacity counts on `Unit`, cited as ONE substring with the doc comment that sits between
 * them. The statistics home page quotes both fields' meanings in the reader's own words — "the beds
 * that are physically empty per the feed", "the beds the ward says it can actually allocate" — and
 * that paraphrase is only true while the record says so. Citing the pair together also witnesses
 * their ADJACENCY, which is what makes "both are aggregate counts for the whole ward" checkable:
 * neither carries a bed id, and a per-bed field arriving between them would break this string.
 */
const UNIT_CAPACITY_COUNTS =
  "empty: CapacityFigure; " +
  "/** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */ " +
  "allocatable: CapacityFigure;";

/**
 * The derived ward-side readiness gap, cited as the two lines that compute it.
 *
 * ⚠️ **THE PAGE DELIBERATELY DOES NOT PRINT THIS FORMULA, AND THE CLAIM IS STILL ABOUT IT.** The
 * "empty but not offered beds" block says the model derives a readiness gap from those two
 * aggregate counts and nothing per-bed; the arithmetic is what makes that true, so the arithmetic
 * is what is cited. Change either line — introduce a bed id, read a third field, stop deriving it —
 * and the claim's evidence goes with it. A citation of the field `Unit.held` would NOT do: that
 * field is authored and read by nothing, so it can change freely without the derived figure moving.
 */
const HELD_IS_DERIVED_FROM_TWO_AGGREGATES =
  "const available = Math.min(unit.allocatable.value, unit.empty.value); " +
  "const held = Math.max(unit.empty.value - available, 0);";

/**
 * The whole movement-decline vocabulary, cited as one array literal — the strongest shape available
 * and the reason it is written out rather than pointed at by name. The claim the page makes is that
 * every row in its reason table comes from this list and that the row count IS the member count. No
 * single-line citation can witness a membership claim; this one breaks on any member added,
 * removed, renamed or reordered, which is every change that would falsify it.
 *
 * ⚠️ **THIS PROJECT ALREADY PAID FOR THAT ON 2026-09-01.** A task brief written against a pre-merge
 * tree named a member that a rename had since replaced. A table copied from the brief would have
 * been wrong, and a test written from the same brief would have agreed with it.
 */
const DECLINE_REASONS_LIST =
  'export const DECLINE_REASONS = [ "no_bed", "sex_mix", "specialling_unavailable", "acuity_mix", ' +
  '"capability_mismatch", "bed_pulled_for_earlier_referral", "out_of_catchment", ] as const;';

/**
 * The referral-side vocabulary, cited whole for the same reason and for one more: the claim is that
 * it is a DIFFERENT list from the one above, and difference is only witnessed by pinning both. A
 * member migrating from one list to the other would break exactly one of these two citations.
 */
const REFERRAL_DECLINE_REASONS_LIST =
  'export const REFERRAL_DECLINE_REASONS = [ "no_suitable_bed", "age_band_not_provided_here", ' +
  '"sex_designation_unavailable", "secure_bed_unavailable", "belongs_to_another_service", ' +
  '"referred_elsewhere", "another_reason", ] as const;';

/**
 * The two derived properties of a team page, cited as ONE substring so the CONTRAST between them is
 * what goes red.
 *
 * The claim is that a team's name is exactly the string a referral stores — never composed, never
 * prettified. `name,` is the shorthand property, and it IS that claim: the raw string passed
 * through untouched. Compose or prettify it and this line must become `name: something(name)`, so
 * the citation breaks on precisely the change that would make the claim false.
 *
 * The `id:` line above it is cited with it deliberately, because it does the opposite —
 * `communityTeamSlug` transforms, `name` does not. A reader who meets this red sees both halves and
 * can tell which one was supposed to change.
 *
 * ⚠️ **THIS REPLACED A CITATION THAT COULD NOT FAIL** (2026-09-01). The claim used to cite the doc
 * comment beside the field: "Exactly the string a referral stores in `teamName`. Never composed or
 * prettified here." That is prose restating the claim, not code witnessing it. Prettify the name
 * anywhere and the comment sits exactly where it is; the only edit that broke the citation was
 * DELETING the comment, which is the one action that does not make the claim false. The register's
 * own version of the defect it exists to prevent. `tests/ward-statistics-claims.test.ts` now
 * rejects a comment-only citation mechanically, so the shape cannot return unnoticed.
 */
const COMMUNITY_TEAM_PAGE_DERIVATION =
  "id: communityTeamSlug(name), " + //
  "name, }));";

/**
 * `communityTeamOptions` cited whole — signature, both loops, the tie-break and the return.
 *
 * The claim is that the vocabulary comes from ONE source document, and a "one" is an absence of a
 * second: the citation has to break when a second document's rows are read. It previously stopped
 * at the first `for (const row of S2015_CATCHMENT_ROWS) {`, so a second loop over another table
 * could be added underneath it and every cited byte survived — in a file that already models
 * several documents, which is what makes that a live edit rather than a theoretical one.
 */
const COMMUNITY_TEAM_VOCABULARY_DERIVATION =
  "export function communityTeamOptions(): readonly string[] { const spellings = new Map<string, " +
  "Map<string, number>>(); for (const row of S2015_CATCHMENT_ROWS) { for (const clinic of " +
  "parseFollowUpClinicSet(row.followUpClinicVerbatim)) { const key = communityTeamKey(clinic); if (key " +
  '=== "") continue; const counts = spellings.get(key) ?? new Map<string, number>(); counts.set(clinic, ' +
  "(counts.get(clinic) ?? 0) + 1); spellings.set(key, counts); } } const chosen = " +
  "[...spellings.values()].map( (counts) => [...counts.entries()].sort((a, b) => b[1] - a[1] || " +
  "a[0].localeCompare(b[0]))[0][0], ); return chosen.sort((a, b) => a.localeCompare(b)); }";

/** The whole `CommunityTeam` record. The community index claims it is `{ id, name }` and nothing else. */
const COMMUNITY_TEAM_BODY =
  "export type CommunityTeam = { id: string; " +
  "/** Exactly the string a referral stores in `teamName`. Never composed or prettified here. */ name: string; };";

export const MODEL_CLAIMS: readonly ModelClaim[] = [
  // ── statistics-screen.tsx — beds being made ready ─────────────────────────────────────────────
  {
    id: "statistics-screen/bed-readiness/preparing-is-a-boolean",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-readiness-timing-absent"',
    claim: "Bed readiness is held on `BedRelease.preparing`, and it is a boolean.",
    sourceFile: WARD_MODEL,
    evidence: "preparing: boolean;",
    falsifiedBy: PREPARING_STOPS_BEING_A_BOOLEAN,
  },
  {
    id: "statistics-screen/bed-readiness/preparation-stamps-confirmed-at",
    renderedIn: STATISTICS_SCREEN,
    rendered: "setting it does stamp an instant",
    claim: "Setting `preparing` writes an instant — `SET_BED_PREPARATION` stamps `confirmedAt: event.now`.",
    sourceFile: WARD_REDUCER,
    evidence: "preparationNote: event.preparing ? (event.note ?? null) : null, confirmedAt: event.now,",
    falsifiedBy: {
      change: "`SET_BED_PREPARATION` stops stamping an instant, so setting `preparing` no longer writes one.",
      find: "preparationNote: event.preparing ? (event.note ?? null) : null, confirmedAt: event.now,",
      replaceWith: "preparationNote: event.preparing ? (event.note ?? null) : null,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/confirmed-at-is-one-shared-field",
    renderedIn: STATISTICS_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. The page now says "that record's ONE
    // shared provenance field"; the evidence below still names `confirmedAt` exactly, so a second
    // instant appearing on the release record still turns this red.
    // ⚠️ Lengthened immediately after the move: "ONE shared provenance field" matched TWICE —
    // once in the rendered paragraph and once in the source comment above it that I had just
    // written using the same phrase. The register caught it and said so by name. A locator that
    // matches a comment as well as the page cannot say which paragraph makes the claim.
    rendered: "record&apos;s ONE shared provenance field",
    claim: "`BedRelease` carries a single `confirmedAt`, not one instant per act on the release.",
    sourceFile: WARD_MODEL,
    evidence: BED_RELEASE_BODY,
    falsifiedBy: {
      change:
        "The release record gains a SECOND instant — `preparedAt` — so `confirmedAt` stops being the one field " +
        "every act on the release overwrites. This is the edit the old two-field citation survived.",
      find:
        "confirmedAt: Instant; /** A role — a unit or service label. Never a personal name. */ confirmedBy: string; " +
        "};",
      replaceWith:
        "confirmedAt: Instant; preparedAt: Instant | null; /** A role — a unit or service label. Never a personal " +
        "name. */ confirmedBy: string; };",
    },
  },
  {
    id: "statistics-screen/bed-readiness/confirming-the-discharge-overwrites-it",
    renderedIn: STATISTICS_SCREEN,
    rendered: "Confirming the discharge, flagging the bed as stuck",
    claim: "`CONFIRM_BED_RELEASE` overwrites `confirmedAt`.",
    sourceFile: WARD_REDUCER,
    evidence: 'const updated: BedRelease = { ...release, state: "confirmed", waitingOn: null, confirmedAt: event.now,',
    falsifiedBy: {
      change: "`CONFIRM_BED_RELEASE` stops writing `confirmedAt`, so confirming a discharge no longer overwrites it.",
      find: 'const updated: BedRelease = { ...release, state: "confirmed", waitingOn: null, confirmedAt: event.now,',
      replaceWith: 'const updated: BedRelease = { ...release, state: "confirmed", waitingOn: null,',
    },
  },
  {
    id: "statistics-screen/bed-readiness/blocking-the-bed-overwrites-it",
    renderedIn: STATISTICS_SCREEN,
    rendered: "clearing that flag, releasing the bed and turning preparation off again all",
    claim: "`BLOCK_BED_RELEASE` overwrites `confirmedAt`.",
    sourceFile: WARD_REDUCER,
    evidence: "blockedBy: `NUM ${blockedUnit.name}`, confirmedAt: event.now,",
    falsifiedBy: {
      change: "`BLOCK_BED_RELEASE` stops writing `confirmedAt`, so flagging the bed as stuck no longer overwrites it.",
      find: "blockedBy: `NUM ${blockedUnit.name}`, confirmedAt: event.now,",
      replaceWith: "blockedBy: `NUM ${blockedUnit.name}`,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/clearing-the-block-overwrites-it",
    renderedIn: STATISTICS_SCREEN,
    rendered: "overwrite it. So the record can hold when preparation started or when it ended",
    claim: "`CLEAR_BED_RELEASE_BLOCK` overwrites `confirmedAt`.",
    sourceFile: WARD_REDUCER,
    evidence: "const unblocked: BedRelease = { ...release, blocker: null, blockedBy: null, confirmedAt: event.now,",
    falsifiedBy: {
      change: "`CLEAR_BED_RELEASE_BLOCK` stops writing `confirmedAt`, so clearing the flag no longer overwrites it.",
      find: "const unblocked: BedRelease = { ...release, blocker: null, blockedBy: null, confirmedAt: event.now,",
      replaceWith: "const unblocked: BedRelease = { ...release, blocker: null, blockedBy: null,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/releasing-the-bed-overwrites-it",
    renderedIn: STATISTICS_SCREEN,
    rendered: "There is no pair of instants to subtract",
    claim: "`RELEASE_BED` overwrites `confirmedAt`.",
    sourceFile: WARD_REDUCER,
    evidence:
      'const updatedRelease: BedRelease = { ...release, state: "discharged", waitingOn: null, blocker: null, ' +
      "blockedBy: null, confirmedAt: event.now,",
    falsifiedBy: {
      change: "`RELEASE_BED` stops writing `confirmedAt`, so releasing the bed no longer overwrites it.",
      find:
        'const updatedRelease: BedRelease = { ...release, state: "discharged", waitingOn: null, blocker: null, ' +
        "blockedBy: null, confirmedAt: event.now,",
      replaceWith:
        'const updatedRelease: BedRelease = { ...release, state: "discharged", waitingOn: null, blocker: null, ' +
        "blockedBy: null,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/preparation-begins-only-after-a-release",
    renderedIn: STATISTICS_SCREEN,
    rendered: "preparation only\n              ever begins after somebody has left",
    claim: "A newly flagged release starts `preparing: false`; preparation only ever begins after `RELEASE_BED`.",
    sourceFile: WARD_REDUCER,
    evidence:
      "// A bed nobody has yet left is not being made ready. Preparation only ever begins after " +
      "// `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case. preparing: false,",
    falsifiedBy: {
      change:
        "A newly flagged release is created ALREADY being made ready, so preparation no longer starts off. (This " +
        "falsifies the half the code carries. That preparation begins ONLY after `RELEASE_BED` is an absence — no " +
        "other reducer case sets it — and no substring can witness that.)",
      find: "see that case. preparing: false,",
      replaceWith: "see that case. preparing: true,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/only-discharged-releases-offer-the-flag",
    renderedIn: STATISTICS_SCREEN,
    rendered: "the only screen that can raise the flag offers it on released beds alone",
    claim: "The ward screen's preparation control is offered only on releases whose state is `discharged`.",
    sourceFile: WARD_SCREEN,
    evidence:
      "const dischargedBedReleases = bedReleases.filter( " +
      '(release) => release.unitId === unit.id && release.state === "discharged",',
    falsifiedBy: {
      change:
        "The ward screen stops narrowing to released beds, so the preparation control is offered on every release " +
        "rather than on discharged ones alone.",
      find:
        "const dischargedBedReleases = bedReleases.filter( (release) => release.unitId === unit.id && release.state " +
        '=== "discharged",',
      replaceWith: "const dischargedBedReleases = bedReleases.filter( (release) => release.unitId === unit.id,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/reducer-writes-the-callers-preparing-value",
    renderedIn: STATISTICS_SCREEN,
    rendered: "a bed nobody has left yet could be flagged and would be counted here",
    claim:
      "`SET_BED_PREPARATION` stores the caller's `preparing` value as given, deriving nothing from the " +
      "release's own state.",
    sourceFile: WARD_REDUCER,
    evidence: "const prepared: BedRelease = { ...release, preparing: event.preparing,",
    falsifiedBy: {
      change:
        "The reducer starts deriving the stored value from the release's own state instead of storing what the " +
        "caller sent.",
      find: "const prepared: BedRelease = { ...release, preparing: event.preparing,",
      replaceWith:
        'const prepared: BedRelease = { ...release, preparing: event.preparing && release.state === "discharged",',
    },
  },

  // ── statistics-screen.tsx — declines per ward ─────────────────────────────────────────────────
  {
    id: "statistics-screen/declines/addressing-has-one-unit-field",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-declines-withheld"',
    claim: "`ReferralAddressing` carries exactly one field that can name a unit: `acceptedUnitId`.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_ADDRESSING_BODY,
    falsifiedBy: REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  },
  {
    id: "statistics-screen/declines/ward-destination-records-bed-criteria",
    renderedIn: STATISTICS_SCREEN,
    rendered: "the sex it must suit, whether it must be secure, whether it must be able",
    claim:
      "The ward destination arm records the bed's criteria — sex, secure, able to hold somebody involuntarily — " +
      "and carries no unit id of its own.",
    sourceFile: WARD_MODEL,
    evidence: WARD_DESTINATION_ARM,
    falsifiedBy: WARD_DESTINATION_ARM_GAINS_A_UNIT_ID,
  },
  {
    id: "statistics-screen/declines/accepted-unit-id-is-written-on-acceptance",
    renderedIn: STATISTICS_SCREEN,
    rendered: "filled in only when a ward ACCEPTS",
    claim: "The reducer sets an addressing's `acceptedUnitId` on the acceptance path and nowhere else.",
    sourceFile: WARD_REDUCER,
    evidence: 'accepted = { ...addressing, state: "accepted", acceptedUnitId: unit.id,',
    falsifiedBy: ACCEPTANCE_STOPS_RECORDING_THE_UNIT,
  },
  {
    id: "statistics-screen/declines/movement-declines-name-a-unit",
    renderedIn: STATISTICS_SCREEN,
    rendered: "sits on the movement, which does name the ward",
    claim: "A movement decline records a unit id, an instant and a reason.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_BODY,
    falsifiedBy: DECLINE_LOSES_ITS_UNIT,
  },
  {
    id: "statistics-screen/declines/movement-carries-a-decline-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "A movement decline sits on",
    claim: "`Movement` carries a list of declines.",
    sourceFile: WARD_MODEL,
    evidence: "declines: Decline[];",
    falsifiedBy: MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST,
  },
  {
    id: "statistics-screen/declines/movement-declines-use-their-own-reason-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "drawn from a different list of reasons",
    claim: "A movement decline's reason comes from `DECLINE_REASONS`, a different list from the referral's.",
    sourceFile: WARD_MODEL,
    evidence: "export type DeclineReason = (typeof DECLINE_REASONS)[number];",
    falsifiedBy: {
      change:
        "Movement declines start drawing on the referral vocabulary instead of their own, so the two stop being " +
        "different lists.",
      find: "export type DeclineReason = (typeof DECLINE_REASONS)[number];",
      replaceWith: "export type DeclineReason = ReferralDeclineReason;",
    },
  },
  {
    id: "statistics-screen/declines/referral-declines-use-the-referral-reason-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "A referral decline sits on",
    claim: "A referral decline's reason comes from `REFERRAL_DECLINE_REASONS`, a separate list.",
    sourceFile: WARD_MODEL,
    evidence: "export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];",
    falsifiedBy: {
      change: "Referral declines stop having a vocabulary of their own and reuse the movement one.",
      find: "export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];",
      replaceWith: "export type ReferralDeclineReason = DeclineReason;",
    },
  },
  {
    id: "statistics-screen/declines/a-movement-is-inside-an-emergency-department",
    renderedIn: STATISTICS_SCREEN,
    rendered: "somebody who is already inside an emergency department",
    claim: "Every movement names the emergency department the person is physically in.",
    sourceFile: WARD_MODEL,
    evidence: "originEdId: string;",
    falsifiedBy: MOVEMENT_ORIGIN_ED_BECOMES_OPTIONAL,
  },

  // ── statistics-screen.tsx — empty beds that were not offered (the figure that is not built) ───
  {
    id: "statistics-screen/not-offered/a-unit-holds-two-aggregate-capacity-counts",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-not-offered-absent"',
    claim:
      "A unit record holds `empty` (physically empty beds, per the feed) and `allocatable` (beds the ward says " +
      "it can actually allocate), and both are aggregate counts for the whole ward.",
    sourceFile: WARD_MODEL,
    evidence: UNIT_CAPACITY_COUNTS,
    falsifiedBy: {
      change:
        "A per-bed field arrives between the two counts, so they stop being an adjacent pair of whole-ward " +
        "aggregates and the page's paraphrase of what each means no longer holds.",
      find: "empty: CapacityFigure; /** Beds the ward says it can actually allocate.",
      replaceWith: "empty: CapacityFigure; emptyBedIds: string[]; /** Beds the ward says it can actually allocate.",
    },
  },
  {
    id: "statistics-screen/not-offered/the-readiness-gap-is-derived-from-those-two-counts",
    renderedIn: STATISTICS_SCREEN,
    rendered: "What the model derives from the pair is a",
    claim:
      "The ward-side readiness gap is DERIVED from `empty` and `allocatable` alone — no per-bed or per-request " +
      "field enters it, so it can name neither a bed nor a request.",
    sourceFile: WARD_DERIVATIONS,
    evidence: HELD_IS_DERIVED_FROM_TWO_AGGREGATES,
    falsifiedBy: {
      change:
        "The readiness gap starts reading a per-bed field, so it is no longer derived from the two aggregate counts " +
        "alone and could name a bed.",
      find: "const held = Math.max(unit.empty.value - available, 0);",
      replaceWith: "const held = unit.emptyBedIds.filter((id) => !unit.offeredBedIds.includes(id)).length;",
    },
  },

  // ── statistics-screen.tsx — refusals so far ───────────────────────────────────────────────────
  {
    id: "statistics-screen/refused-so-far/referred-unit-ids-holds-the-wards-still-deciding",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-refused-so-far"',
    claim: "`Movement.referredUnitIds` is the list of units currently holding a live referral, not a single id.",
    sourceFile: WARD_MODEL,
    evidence: "referredUnitIds: string[];",
    falsifiedBy: REFERRED_UNIT_IDS_BECOMES_ONE_ID,
  },
  {
    id: "statistics-screen/refused-so-far/the-condition-is-nothing-pending-and-a-refusal-on-record",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-refused-so-far-count"',
    claim:
      "The counted condition is exactly `referredUnitIds` empty and `declines` non-empty — two array lengths, " +
      "no clock and no closure state.",
    sourceFile: WARD_DERIVATIONS,
    evidence: ".filter((movement) => movement.referredUnitIds.length === 0 && movement.declines.length > 0)",
    falsifiedBy: {
      change:
        "The count starts consulting a closure state as well as the two array lengths, so 'two array lengths, no " +
        "clock and no closure state' is false.",
      find: ".filter((movement) => movement.referredUnitIds.length === 0 && movement.declines.length > 0)",
      replaceWith:
        ".filter((movement) => movement.referredUnitIds.length === 0 && movement.declines.length > 0 && " +
        'movement.stage !== "closed")',
    },
  },
  {
    id: "statistics-screen/refused-so-far/a-decline-removes-the-ward-and-leaves-the-stage",
    renderedIn: STATISTICS_SCREEN,
    rendered: "takes that ward off the list of wards deciding and leaves the movement at the stage referrals are made",
    claim:
      '`case "DECLINE"` removes the declining unit from `referredUnitIds`, appends to `declines`, and leaves ' +
      "the movement in `destination_review`.",
    sourceFile: WARD_REDUCER,
    evidence:
      "referredUnitIds: movement.referredUnitIds.filter((unitId) => unitId !== event.unitId), " +
      "declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }], " +
      'stage: "destination_review",',
    falsifiedBy: {
      change:
        "A decline starts closing the movement instead of leaving it at the stage referrals are made from, so a " +
        "coordinator cannot put it to fresh wards.",
      find:
        "declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }], stage: " +
        '"destination_review",',
      replaceWith:
        "declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }], stage: " +
        '"closed",',
    },
  },
  {
    id: "statistics-screen/refused-so-far/that-stage-can-be-referred-from-again",
    renderedIn: STATISTICS_SCREEN,
    rendered: "so a coordinator can put it to fresh wards the moment a decline lands",
    claim:
      "`destination_review` — the stage a decline leaves a movement in — is one of the stages a fresh " +
      "`REFER_TO_UNITS` is allowed from.",
    sourceFile: WARD_REDUCER,
    evidence:
      'export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", ' +
      '"destination_review"];',
    falsifiedBy: {
      change:
        "`destination_review` is dropped from the stages a fresh `REFER_TO_UNITS` is allowed from, so the stage a " +
        "decline leaves a movement in stops being referrable.",
      find:
        'export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", ' +
        '"destination_review"];',
      replaceWith: 'export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested"];',
    },
  },
  {
    id: "statistics-screen/refused-so-far/the-cap-on-parallel-referrals-exists",
    renderedIn: STATISTICS_SCREEN,
    /* The page RENDERS the cap's value rather than typing it, so the numeral cannot go stale; what
       this pins is that the constant the page reads is still the cap it says it is. */
    rendered: 'data-testid="ward-statistics-refused-so-far-cap"',
    claim: "A cap on how many wards one movement can be live at exists and is named `PARALLEL_REFERRAL_CAP`.",
    sourceFile: WARD_MODEL,
    evidence: "export const PARALLEL_REFERRAL_CAP = 3;",
    falsifiedBy: THE_PARALLEL_REFERRAL_CAP_IS_REMOVED,
  },
  {
    id: "statistics-screen/refused-so-far/the-shared-derivation-classifies-escalation-first",
    renderedIn: STATISTICS_SCREEN,
    rendered: "classifies an escalation first",
    claim:
      "`handoverSnapshot` excludes every movement it has already classed `escalated` from the declined-by-all " +
      "group, so an escalated movement meeting the same condition is absent from the count.",
    sourceFile: WARD_DERIVATIONS,
    evidence:
      "const escalatedIds = new Set(escalated.map((entry) => entry.movement.id)); " +
      "const declinedByAll = open .filter((movement) => !escalatedIds.has(movement.id))",
    falsifiedBy: {
      change:
        "The declined-by-all group stops excluding movements already classed as escalated, so an escalated movement " +
        "meeting the same condition is counted here after all.",
      find:
        "const escalatedIds = new Set(escalated.map((entry) => entry.movement.id)); const declinedByAll = open " +
        ".filter((movement) => !escalatedIds.has(movement.id))",
      replaceWith: "const declinedByAll = open",
    },
  },
  {
    id: "statistics-screen/refused-so-far/an-escalation-is-recorded-unvalidated",
    renderedIn: STATISTICS_SCREEN,
    rendered: "An escalation is somebody&apos;s recorded opinion",
    claim:
      "`RECORD_ESCALATION` stores the caller's own account — the instant, the units they say they tried, and " +
      "the contact — verifying none of it against the movement's referral history.",
    sourceFile: WARD_REDUCER,
    evidence: "escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },",
    falsifiedBy: {
      change:
        "The reducer starts checking the caller's account against the movement's own referral history instead of " +
        "storing it as given.",
      find: "escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },",
      replaceWith:
        "escalation: { at: event.now, triedUnitIds: event.triedUnitIds.filter((unitId) => " +
        "movement.declines.some((decline) => decline.unitId === unitId)), contact: event.contact },",
    },
  },

  // ── statistics-screen.tsx — declines by reason ────────────────────────────────────────────────
  {
    id: "statistics-screen/declines-by-reason/the-vocabulary-is-a-closed-list-in-the-model",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-declines-by-reason-list"',
    claim:
      "The movement-decline reasons are a closed list in the model, and these are its members — so the rendered " +
      "row set can be generated from it rather than written out.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_REASONS_LIST,
    falsifiedBy: {
      change:
        "A member is added to the movement-decline vocabulary, so the rendered row set no longer matches the list " +
        "it is generated from.",
      find: '"out_of_catchment", ] as const;',
      replaceWith: '"out_of_catchment", "transport_unavailable", ] as const;',
    },
  },
  {
    id: "statistics-screen/declines-by-reason/a-decline-carries-one-reason-and-no-free-text",
    renderedIn: STATISTICS_SCREEN,
    rendered: "counted against the reason the ward gave",
    claim: "A movement decline records a unit id, an instant and a reason from that list, and carries no free text.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_BODY,
    falsifiedBy: DECLINE_GAINS_FREE_TEXT,
  },
  {
    id: "statistics-screen/declines-by-reason/the-referral-side-list-is-a-different-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "not referrals refused at the front door",
    claim:
      "`REFERRAL_DECLINE_REASONS` is a separate vocabulary with different members, about a destination refusing " +
      "a referral rather than a ward refusing a movement.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_DECLINE_REASONS_LIST,
    falsifiedBy: {
      change:
        "A member migrates from the movement vocabulary into the referral one, so the two lists stop having " +
        "different members.",
      // ⚠️ RE-ANCHORED, NOT RE-POINTED TO DODGE A FAILURE. This named the LAST member of the
      // referral list, and the owner added a seventh (`"another_reason"`) on 2026-09-02, so the
      // anchor matched nothing and the guard reported the claim as no longer falsifiable. That is
      // the guard WORKING — it fired before anything shipped. The claim itself, that the two
      // decline vocabularies have different members, is still TRUE with an empty intersection: a
      // moved string, not an invalidated claim, which is why the pin moves rather than the claim
      // being rewritten or dropped.
      find: '"another_reason", ] as const;',
      replaceWith: '"another_reason", "out_of_catchment", ] as const;',
    },
  },
  {
    id: "statistics-screen/declines-by-reason/the-existing-label-map-belongs-to-the-other-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "`DECLINE_REASON_LABELS` (`ward-referrals.ts`) is keyed by",
    claim:
      "`DECLINE_REASON_LABELS` is keyed by `ReferralDeclineReason`, so it is not a label table for the " +
      "movement-decline vocabulary and cannot be reused as one.",
    sourceFile: WARD_REFERRALS,
    evidence: "export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason, string> = {",
    falsifiedBy: {
      change:
        "The label map is re-keyed to cover both vocabularies, so it becomes reusable as a label table for movement " +
        "declines after all.",
      find: "export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason, string> = {",
      replaceWith: "export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason | DeclineReason, string> = {",
    },
  },

  // ── statistics-screen.tsx — the two patient figures ───────────────────────────────────────────
  {
    id: "statistics-screen/pull-to-arrival/the-bed-was-given-away-instant",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-pull-to-arrival"',
    claim: "The admission record keeps the instant a ward gave the bed away, and it is nullable.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "pulledAt: Instant | null;",
    falsifiedBy: {
      change:
        "The admission record stops keeping the instant the bed was given away, so there is no pull instant to " +
        "measure from.",
      find: "pulledAt: Instant | null;",
      replaceWith: "",
    },
  },
  {
    id: "statistics-screen/pull-to-arrival/the-arrival-instant",
    renderedIn: STATISTICS_SCREEN,
    rendered: "measured between the two instants the admission record",
    claim: "The admission record keeps the instant the person physically arrived, and it is nullable.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "arrivedAt: Instant | null;",
    falsifiedBy: {
      change:
        "The admission record stops keeping the instant the person arrived, so there is no arrival instant to " +
        "measure to.",
      find: "arrivedAt: Instant | null;",
      replaceWith: "",
    },
  },
  {
    id: "statistics-screen/referral-to-bed/referral-id-is-nullable",
    renderedIn: STATISTICS_SCREEN,
    // Locator moved 2026-09-06. The page now says an admission "carries the referral it came from,
    // or nothing at all" — the nullability stated in words rather than as `string | null`. The
    // evidence and falsifier below still pin the type.
    rendered: "carries the referral it came from, or nothing at all",
    claim: "`Admission.referralId` is typed `string | null`, so a null is an ordinary state.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "referralId: string | null;",
    falsifiedBy: REFERRAL_ID_STOPS_BEING_NULLABLE,
  },
  {
    id: "statistics-screen/referral-to-bed/a-null-referral-id-means-a-movement",
    renderedIn: STATISTICS_SCREEN,
    rendered: "meaning that\n              admission came from a movement rather than from a referral",
    claim: "A null `referralId` records an admission that came from a movement, which carries no referral.",
    /**
     * ⚠️ **RE-POINTED 2026-09-01 FROM A DOC COMMENT TO THE LINE THAT WRITES THE NULL.** It cited
     * `ward-admissions.ts`'s prose — "an admission created when a patient ARRIVES from an emergency
     * department came from a `Movement`, not from a `Referral`" — which is the claim restated, not
     * evidence for it. Mint a referral id for movement-originated admissions tomorrow and that
     * comment sits exactly where it is; the page goes on telling a reader what a null means when it
     * has come to mean something else. It also slipped past `isEntirelyComment`, because the slice
     * began on the SECOND line of the comment and so never opened with a comment marker — which is
     * the reason that guard is no longer load-bearing.
     *
     * ⚠️ **RE-ANCHORED 2026-09-02 AFTER THE FOLD BROKE IT, AND THE CLAIM SURVIVED — but two other
     * things did not.** The master line's one-to-one nursing work inserted
     * `specialling: movement.specialling` between `unitId` and `referralId`, so the old CONTIGUOUS
     * multi-field citation stopped matching. The reducer still writes `referralId: null` when it
     * builds an admission from a movement, so the sentence on the page is untouched.
     *
     * ⚠️ **The old comment here named the wrong event.** It said `PATIENT_ARRIVED`. The admission is
     * built in **`PULL_PATIENT`** — the only `const admission: Admission = {` in the reducer, and the
     * only place one is built from a movement. (`const departed: Admission` later is a spread of an
     * existing admission, not a build.) **That error was found only because the failure message
     * forbids re-pointing without reading; a silent re-anchor would have preserved it.**
     *
     * ⚠️ **The anchor is now ONE line, and deliberately so.** `referralId: null,` occurs exactly once
     * in the reducer, so it is unambiguous — and unlike a multi-field fragment it cannot be broken by
     * inserting an unrelated field beside it. A contiguous citation spanning several fields is a
     * citation that any neighbouring change can falsify without touching the claim.
     */
    sourceFile: WARD_REDUCER,
    evidence: "referralId: null,",
    falsifiedBy: {
      change:
        "Movement-originated admissions start being given a minted referral id, so a null `referralId` stops " +
        "meaning 'this admission came from a movement'. This is the edit the old doc-comment citation survived " +
        "untouched.",
      find: "referralId: null,",
      replaceWith: "referralId: `RF-${movement.id}`,",
    },
  },
  {
    id: "statistics-screen/referral-to-bed/referrals-carry-a-raised-instant",
    renderedIn: STATISTICS_SCREEN,
    rendered: "whether the referral\n              was raised before the person arrived",
    claim: "Every referral carries the instant it was raised, and it is required.",
    sourceFile: WARD_MODEL,
    evidence: "source: ReferralSource; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },

  // ── statistics-section-frame.tsx ──────────────────────────────────────────────────────────────
  {
    id: "statistics-section-frame/back-link/the-hub-route-is-named-once",
    renderedIn: SECTION_FRAME,
    rendered: "href={STATISTICS_HOME_HREF}",
    claim: "The back link resolves through the one constant that names the statistics hub route.",
    sourceFile: SECTIONS,
    evidence: 'export const STATISTICS_HOME_HREF = "/mockups/ward-flow/statistics";',
    falsifiedBy: {
      change:
        "The constant naming the statistics hub route is removed, so the back link cannot resolve through it. (The " +
        "'named once' half is an absence: a second hard-coded copy of the path elsewhere would leave this line " +
        "untouched.)",
      find: 'export const STATISTICS_HOME_HREF = "/mockups/ward-flow/statistics";',
      replaceWith: "",
    },
  },

  // ── statistics-overview-screen.tsx ────────────────────────────────────────────────────────────
  {
    id: "statistics-overview-screen/precedent/the-home-page-really-does-withhold-declines",
    renderedIn: OVERVIEW_SCREEN,
    rendered: 'data-testid="ward-statistics-overview-precedent"',
    claim: "The statistics home page does show a withheld-declines block, as this page says it does.",
    /** Widened 2026-09-01 from the bare `data-testid` to the enclosing figure and its heading, so
     *  that putting the block behind a condition — the cheapest way to stop showing it — has to
     *  insert characters INSIDE the cited run and cannot leave it intact. */
    sourceFile: STATISTICS_SCREEN,
    evidence:
      '<article className={styles.figure} data-testid="ward-statistics-declines"> ' +
      "<h3 className={styles.figureHeading}>Declines per ward</h3> " +
      '<p className={styles.absence} data-testid="ward-statistics-declines-withheld">',
    falsifiedBy: {
      change:
        "The withheld-declines block stops being rendered unconditionally and goes behind a flag, so the home page " +
        "no longer always shows it. (A substring witnesses presence in the FILE, not that it renders; widening the " +
        "citation to the enclosing figure is what makes a wrapping condition break it.)",
      find:
        "<h3 className={styles.figureHeading}>Declines per ward</h3> <p className={styles.absence} " +
        'data-testid="ward-statistics-declines-withheld">',
      replaceWith:
        "<h3 className={styles.figureHeading}>Declines per ward</h3> {showWithheldDeclines && ( <p " +
        'className={styles.absence} data-testid="ward-statistics-declines-withheld">',
    },
  },
  {
    id: "statistics-overview-screen/precedent/addressing-has-one-unit-field",
    renderedIn: OVERVIEW_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. The claim is unchanged and the page
    // still makes it — in words rather than identifiers. Evidence and falsifier below still name
    // `acceptedUnitId` exactly, which is what keeps this checkable.
    rendered: "the one place a ward can be named on that record is filled in only when a ward ACCEPTS",
    claim: "`ReferralAddressing` carries exactly one field that can name a unit: `acceptedUnitId`.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_ADDRESSING_BODY,
    falsifiedBy: REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  },
  {
    id: "statistics-overview-screen/precedent/movement-declines-name-a-unit",
    renderedIn: OVERVIEW_SCREEN,
    rendered: "it does name the ward,",
    claim: "A movement decline records a unit id, an instant and a reason.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_BODY,
    falsifiedBy: DECLINE_LOSES_ITS_UNIT,
  },
  {
    id: "statistics-overview-screen/precedent/a-movement-is-inside-an-emergency-department",
    renderedIn: OVERVIEW_SCREEN,
    rendered: "already inside a department",
    claim: "Every movement names the emergency department the person is physically in.",
    sourceFile: WARD_MODEL,
    evidence: "originEdId: string;",
    falsifiedBy: MOVEMENT_ORIGIN_ED_BECOMES_OPTIONAL,
  },

  // ── statistics-compare-screen.tsx ─────────────────────────────────────────────────────────────
  {
    id: "statistics-compare-screen/attributability/admissions-always-carry-a-unit",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-attributability-rule"',
    claim: "`Admission.unitId` is a required string, so anything derived from admissions attributes to a ward.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string;",
    falsifiedBy: {
      change:
        "`Admission.unitId` stops being required, so a figure derived from admissions can no longer always be " +
        "attributed to a ward.",
      find: "begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string;",
      replaceWith: "begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string | null;",
    },
  },
  {
    id: "statistics-compare-screen/declines/ward-destination-records-bed-criteria",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-declines-example"',
    claim:
      "The ward destination arm records the bed's criteria — sex, secure, able to hold somebody involuntarily — " +
      "and carries no unit id of its own.",
    sourceFile: WARD_MODEL,
    evidence: WARD_DESTINATION_ARM,
    falsifiedBy: WARD_DESTINATION_ARM_GAINS_A_UNIT_ID,
  },
  {
    id: "statistics-compare-screen/declines/addressing-has-one-unit-field",
    renderedIn: COMPARE_SCREEN,
    rendered: "The one place a ward can be named on that record is filled in only when a ward ACCEPTS",
    claim: "`ReferralAddressing` carries exactly one field that can name a unit: `acceptedUnitId`.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_ADDRESSING_BODY,
    falsifiedBy: REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  },
  {
    id: "statistics-compare-screen/declines/accepted-unit-id-is-written-on-acceptance",
    renderedIn: COMPARE_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. Both this claim and the one above are
    // now carried by the SAME sentence on the page, which is why they share a locator: the reword
    // merged two clauses that had been separate. The claims stay distinct here, with distinct
    // evidence and distinct falsifiers, so they still fail independently.
    rendered: "The one place a ward can be named on that record is filled in only when a ward ACCEPTS",
    claim: "The reducer sets an addressing's `acceptedUnitId` on the acceptance path and nowhere else.",
    sourceFile: WARD_REDUCER,
    evidence: 'accepted = { ...addressing, state: "accepted", acceptedUnitId: unit.id,',
    falsifiedBy: ACCEPTANCE_STOPS_RECORDING_THE_UNIT,
  },
  {
    id: "statistics-compare-screen/double-count/referred-unit-ids-is-a-list",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-double-count-example"',
    claim: "`Movement.referredUnitIds` is a list of unit ids, not a single id.",
    sourceFile: WARD_MODEL,
    evidence: "referredUnitIds: string[];",
    falsifiedBy: REFERRED_UNIT_IDS_BECOMES_ONE_ID,
  },
  {
    id: "statistics-compare-screen/double-count/the-parallel-referral-cap-exists",
    renderedIn: COMPARE_SCREEN,
    // Locator moved 2026-09-06. The page now says "up to a fixed cap" rather than naming the
    // constant; the evidence and falsifier below still name it exactly, so a cap that stops
    // existing still turns this red.
    rendered: "at several wards at once, up to a fixed cap",
    claim: "A cap on how many wards one referral can be live at exists and is named `PARALLEL_REFERRAL_CAP`.",
    sourceFile: WARD_MODEL,
    evidence: "export const PARALLEL_REFERRAL_CAP = 3;",
    falsifiedBy: THE_PARALLEL_REFERRAL_CAP_IS_REMOVED,
  },
  {
    id: "statistics-compare-screen/chooser/one-dynamic-route-serves-every-ward",
    renderedIn: COMPARE_SCREEN,
    rendered: "one route serves every ward and",
    claim: "Per-ward detail is one dynamic route, built by a single href helper.",
    sourceFile: SECTIONS,
    evidence: "return `/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;",
    falsifiedBy: {
      change:
        "Per-ward detail stops being one dynamic route built from the unit id and becomes a per-ward lookup table. " +
        "(The 'a SINGLE href helper' half is an absence — a second helper added beside this one would leave this " +
        "line untouched.)",
      find: "return `/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;",
      replaceWith: "return WARD_STATISTICS_HREFS[unitId];",
    },
  },
  {
    id: "statistics-compare-screen/chooser/another-serves-every-department",
    renderedIn: COMPARE_SCREEN,
    rendered: "another serves every emergency department",
    claim: "Per-department detail is a second dynamic route, built by its own href helper.",
    sourceFile: SECTIONS,
    evidence: "return `/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;",
    falsifiedBy: {
      change:
        "Per-department detail stops being one dynamic route built from the department id and becomes a " +
        "per-department lookup table. (Same absence caveat as the ward helper above.)",
      find: "return `/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;",
      replaceWith: "return ED_STATISTICS_HREFS[edId];",
    },
  },
  {
    id: "statistics-compare-screen/chooser/a-site-code-may-resolve-to-nothing",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-ward-list"',
    claim: "Site lookup returns nothing rather than a fallback site when a code matches none.",
    /** Re-pointed 2026-09-01 from the signature to the signature AND the body: `?? wardSites[0]` is
     *  still assignable to the declared `Site | undefined`, so the signature alone could not fail. */
    sourceFile: WARD_SITES,
    evidence: SITE_BY_CODE_LOOKUP,
    falsifiedBy: SITE_BY_CODE_GAINS_A_FALLBACK,
  },

  /*
   * ⚠️ SIX `statistics-ward-screen` CLAIMS WERE REMOVED ON 2026-09-05, AND THE REASON IS THE
   * REGISTER'S OWN INSTRUCTION RATHER THAN A JUDGEMENT: "if the paragraph was removed, remove the
   * register entry with it".
   *
   * Five of them recorded that `wardStatistics()` DERIVES a figure while the page carried a
   * paragraph explaining that the derivations existed and were not surfaced anywhere. The page now
   * SHOWS those five figures, so the paragraph is gone and with it the sentences those claims cited.
   * A figure on the screen is not the same kind of thing as a sentence about a figure, and pointing
   * the old locators at the new values would have recorded a claim the page no longer makes in
   * words.
   *
   * The sixth said `ward-statistics.ts` has no consumer in the app. It now has one — this page —
   * so the claim is FALSE rather than relocated. Its own guard in
   * `tests/ward-statistics-sections.test.ts` was written to "go red the day one appears", and it
   * did exactly that on the commit that added the consumer. That test is inverted in the same
   * change, because an absence guard outliving its absence is a guard that can only ever be wrong.
   *
   * The three `blocked/` claims beside them were NOT removed: their paragraph survives verbatim on
   * the built page as the `Average wait after being accepted` measure.
   */
  // ── statistics-ward-screen.tsx ────────────────────────────────────────────────────────────────
  {
    id: "statistics-ward-screen/blocked/waitlist-wait-is-always-null",
    renderedIn: WARD_STATS_SCREEN,
    // Moved 2026-09-05: the paragraph survives verbatim as the built `Average wait after being
    // accepted` measure. The register's own instruction for a reworded claim — move the locator and
    // re-read the sentence — and the sentence was re-read: it still says the figure is always null
    // and still states the property of the record's instants without enumerating them.
    rendered: 'data-testid="ward-stat-waitlist-wait"',
    claim: "`WardStatistics.averageWaitlistWaitMinutes` is returned as a literal null on every path.",
    sourceFile: WARD_STATISTICS,
    evidence: "averageWaitlistWaitMinutes: null,",
    falsifiedBy: {
      change: "The waitlist wait starts being computed, so it is no longer a literal null on every path.",
      find: "averageWaitlistWaitMinutes: null,",
      replaceWith: "averageWaitlistWaitMinutes: average(waitlistMinutes),",
    },
  },
  {
    id: "statistics-ward-screen/blocked/the-derivation-takes-admissions-only",
    renderedIn: WARD_STATS_SCREEN,
    // Locator moved 2026-09-06: the paragraph was reworded when the owner ruled the field names
    // off the prototype. The CLAIM is unchanged — the derivation is still given admissions only —
    // and the sentence was re-read at the move, as this register's failure message instructs.
    rendered: "because it is given admissions only, by design",
    claim: "`wardStatistics()` is given admissions and a clock, and no referrals.",
    sourceFile: WARD_STATISTICS,
    evidence: "export function wardStatistics(unitId: string, admissions: Admission[], now: Instant): WardStatistics {",
    falsifiedBy: {
      change: "The derivation is handed referrals as well, so it is no longer admissions and a clock only.",
      find: "export function wardStatistics(unitId: string, admissions: Admission[], now: Instant): WardStatistics {",
      replaceWith:
        "export function wardStatistics(unitId: string, admissions: Admission[], referrals: Referral[], now: " +
        "Instant): WardStatistics {",
    },
  },
  {
    id: "statistics-ward-screen/blocked/the-nearest-equivalent-measures-from-referral-raised-at",
    renderedIn: WARD_STATS_SCREEN,
    /*
     * ⚠️ LOCATOR MOVED 2026-09-06, AND THIS ONE CHANGED WHAT THE PAGE ASSERTS, SO IT IS WORTH THE
     * NOTE. It used to point at the rendered identifier `Referral.raisedAt`. The screen now says
     * "the moment a referral was raised" — the same claim about the referral record, made in
     * words a coordinator reads instead of a field name. **The claim below is therefore now
     * asserted less precisely ON THE PAGE and just as precisely HERE**, which is the whole point
     * of a register: the evidence and the falsifier still name the exact field, so this entry
     * goes red if `raisedAt` stops being required whatever the page happens to call it.
     */
    rendered: "measures from the moment a referral was raised",
    claim: "`Referral.raisedAt` exists on the referral record and is required.",
    sourceFile: WARD_MODEL,
    evidence: "source: ReferralSource; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },
  {
    id: "statistics-ward-screen/identity/a-site-code-may-resolve-to-nothing",
    renderedIn: WARD_STATS_SCREEN,
    rendered: 'data-testid="ward-statistics-ward-site"',
    claim: "Site lookup returns nothing rather than a fallback site when a code matches none.",
    /** Re-pointed 2026-09-01 from the signature to the signature AND the body: `?? wardSites[0]` is
     *  still assignable to the declared `Site | undefined`, so the signature alone could not fail. */
    sourceFile: WARD_SITES,
    evidence: SITE_BY_CODE_LOOKUP,
    falsifiedBy: SITE_BY_CODE_GAINS_A_FALLBACK,
  },

  // ── statistics-ed-screen.tsx ──────────────────────────────────────────────────────────────────
  {
    id: "statistics-ed-screen/attributable/department-record-holds-three-fields",
    renderedIn: ED_SCREEN,
    rendered: 'data-testid="ward-statistics-ed-attributable"',
    claim: "`EmergencyDepartment` holds an id, a site code and a name, and nothing else.",
    sourceFile: WARD_MODEL,
    evidence: EMERGENCY_DEPARTMENT_BODY,
    falsifiedBy: {
      change: "A fourth field arrives on the department record, so 'these three and nothing else' is false.",
      find: "export type EmergencyDepartment = { id: string; siteCode: string; name: string; };",
      replaceWith:
        "export type EmergencyDepartment = { id: string; siteCode: string; name: string; region: HomeRegion; };",
    },
  },
  {
    id: "statistics-ed-screen/attributable/origin-ed-id-is-required",
    renderedIn: ED_SCREEN,
    /*
     * ⚠️ **NARROWED 2026-09-05 BECAUSE THE BARE `<code>` STOPPED BEING UNIQUE.** A second sentence
     * added to this screen the same day names the same field, so the register found the locator
     * twice and could no longer say WHICH sentence carries the claim. It now runs on to the claim's
     * own words — "a required field, never missing" — so the locator and the claim say the same
     * thing and a rewrite that drops the guarantee takes the locator with it.
     */
    // Locator moved 2026-09-06 with the field-name removal. The GUARANTEE the note above insists
    // must stay inside the locator — "always, never missing" — is still inside it, so a rewrite
    // that drops the requiredness still takes the locator with it. That was the whole point of
    // spanning the clause rather than the identifier, and it survives the reword intact.
    rendered: "A movement says which department a person is physically in — always, never missing",
    claim: "`Movement.originEdId` is a required string, so it is never missing.",
    sourceFile: WARD_MODEL,
    evidence: "originEdId: string;",
    falsifiedBy: MOVEMENT_ORIGIN_ED_BECOMES_OPTIONAL,
  },
  {
    id: "statistics-ed-screen/attributable/a-movement-records-when-it-opened",
    renderedIn: ED_SCREEN,
    rendered: "alongside when their movement opened",
    claim: "A movement records the instant it opened.",
    sourceFile: WARD_MODEL,
    evidence: "originEdId: string; openedAt: Instant;",
    falsifiedBy: {
      change: "A movement stops recording the instant it opened.",
      find: "originEdId: string; openedAt: Instant;",
      replaceWith: "originEdId: string;",
    },
  },
  {
    id: "statistics-ed-screen/attributable/a-movement-records-its-stage",
    renderedIn: ED_SCREEN,
    rendered: "what stage it has reached",
    claim: "A movement records the stage it has reached.",
    sourceFile: WARD_MODEL,
    evidence: "stage: MovementStage;",
    falsifiedBy: {
      change: "A movement stops recording the stage it has reached.",
      find: "stage: MovementStage;",
      replaceWith: "",
    },
  },
  {
    id: "statistics-ed-screen/attributable/a-movement-records-every-ward-decline",
    renderedIn: ED_SCREEN,
    rendered: "every ward decline against it",
    claim: "`Movement` carries a list of declines.",
    sourceFile: WARD_MODEL,
    evidence: "declines: Decline[];",
    falsifiedBy: MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST,
  },
  {
    id: "statistics-ed-screen/attributable/an-ed-destination-carries-an-ed-id",
    renderedIn: ED_SCREEN,
    rendered: "names the department on its destination",
    claim: "The emergency-department destination arm carries an `edId`.",
    sourceFile: WARD_MODEL,
    evidence: "edId: string; /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */",
    falsifiedBy: {
      change: "The ED destination arm stops requiring a department id, so an ED referral need not name one.",
      find: "edId: string; /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */",
      replaceWith: "edId?: string; /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */",
    },
  },
  {
    id: "statistics-ed-screen/attributable/raised-at-is-required",
    renderedIn: ED_SCREEN,
    rendered: "the moment it was raised is always recorded",
    claim: "`Referral.raisedAt` is required.",
    sourceFile: WARD_MODEL,
    evidence: "source: ReferralSource; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },
  {
    id: "statistics-ed-screen/attributable/triaged-at-is-optional",
    renderedIn: ED_SCREEN,
    rendered: "the moment it was triaged is optional",
    claim: "`Referral.triagedAt` is optional, so a referral may carry none.",
    sourceFile: WARD_MODEL,
    evidence: "triagedAt?: Instant;",
    falsifiedBy: {
      change: "The triage instant becomes required, so a referral can no longer carry none.",
      find: "triagedAt?: Instant;",
      replaceWith: "triagedAt: Instant;",
    },
  },
  {
    id: "statistics-ed-screen/near-miss/a-movement-can-close-as-did-not-proceed",
    renderedIn: ED_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. The page now describes the outcome
    // rather than naming its enum member; the evidence and falsifier below still pin the member,
    // so a rename in the model still turns this red.
    rendered: "an outcome meaning it did not",
    claim: "A movement closure records an outcome, one of which is `did_not_proceed`.",
    sourceFile: WARD_MODEL,
    evidence: 'outcome: "arrived" | "did_not_proceed";',
    falsifiedBy: {
      change: "`did_not_proceed` is removed from the closure outcomes, so a movement can no longer close that way.",
      find: 'outcome: "arrived" | "did_not_proceed";',
      replaceWith: 'outcome: "arrived";',
    },
  },

  // ── statistics-derivations.ts doc comments ────────────────────────────────────────────────────
  {
    id: "statistics-derivations/beds-being-prepared/preparing-is-a-boolean",
    renderedIn: DERIVATIONS,
    rendered: "`BedRelease.preparing` is a boolean",
    claim: "Bed readiness is held on `BedRelease.preparing`, and it is a boolean.",
    sourceFile: WARD_MODEL,
    evidence: "preparing: boolean;",
    falsifiedBy: PREPARING_STOPS_BEING_A_BOOLEAN,
  },
  {
    id: "statistics-derivations/beds-being-prepared/expected-is-a-bed-release-state",
    renderedIn: DERIVATIONS,
    rendered: "`expected` is a member of `BED_RELEASE_STATES`",
    claim: "`expected` is one of the bed-release states, and means the discharge has not happened yet.",
    sourceFile: WARD_MODEL,
    evidence: 'export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;',
    falsifiedBy: {
      change: "`expected` is dropped from the bed-release states, so it stops being a member of that vocabulary.",
      find: 'export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;',
      replaceWith: 'export const BED_RELEASE_STATES = ["confirmed", "discharged"] as const;',
    },
  },
  {
    id: "statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-unit-guard",
    renderedIn: DERIVATIONS,
    rendered: "carries a unit guard and a note-membership check",
    claim: "`SET_BED_PREPARATION` refuses an event whose acting unit is not the release's unit.",
    sourceFile: WARD_REDUCER,
    /**
     * ⚠️ **RE-POINTED 2026-09-01: THIS CITED THE REJECTION MESSAGE, NOT THE GUARD.** The claim is that the
     * reducer REFUSES a mismatched acting unit, and the thing that refuses is the `if`. A message is a string
     * a neutered guard keeps: delete the comparison, leave the `reject(...)` call and its text exactly where
     * they are, and every byte the old citation named survived while the guard stopped guarding. That is the
     * `evidence-survives` shape this register's own header names, arrived at from the other direction — the
     * old falsifying edit deleted the message, which is not the change that makes the claim false.
     */
    evidence:
      "if (event.actingUnitId !== release.unitId) { return reject( state, event, " +
      "`SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} " +
      "belongs to unit ${release.unitId}`, ); }",
    falsifiedBy: {
      change:
        "The acting-unit comparison is neutered so the guard can refuse nothing, while its rejection message is " +
        "left exactly where it is — an event raised by another unit is accepted.",
      find:
        "if (event.actingUnitId !== release.unitId) { return reject( state, event, " +
        "`SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} " +
        "belongs to unit ${release.unitId}`, ); }",
      replaceWith:
        "if (false) { return reject( state, event, " +
        "`SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} " +
        "belongs to unit ${release.unitId}`, ); }",
    },
  },
  {
    id: "statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-note-guard",
    renderedIn: DERIVATIONS,
    rendered: "note-membership check and **no state guard**",
    claim: "`SET_BED_PREPARATION` refuses a note that is not in `BED_PREPARATION_NOTES`.",
    sourceFile: WARD_REDUCER,
    /**
     * ⚠️ **RE-POINTED 2026-09-01, THE SAME REPAIR AS ITS SIBLING ABOVE.** The old citation was the rejection
     * message alone, so a membership check emptied of its condition — `if (false)` above an untouched
     * `reject(...)` — kept every cited byte and refused nothing. The citation now opens with the condition
     * that does the refusing, and the falsifying edit neuters that condition rather than deleting the text.
     */
    evidence:
      "if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) " +
      "{ return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`); }",
    falsifiedBy: {
      change:
        "The membership condition is neutered so the guard can refuse nothing, while its rejection message is " +
        "left exactly where it is — a note outside `BED_PREPARATION_NOTES` is accepted.",
      find:
        "if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) " +
        "{ return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`); }",
      replaceWith:
        "if (false) { return reject(state, event, " +
        "`SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`); }",
    },
  },
  {
    // CORRECTED 2026-09-01, and the claim was WRONG rather than merely re-pointed. The fourth
    // admission state was renamed `"left"` -> `"departed"` in `ward-admissions.ts`, so the sentence
    // "the states are waitlisted, pulled, occupied and left" had become false; `admissionStagePosition`
    // in statistics-derivations.ts cases `"departed"` and would not compile otherwise. Re-pointing the
    // citation at the new line without changing the words would have left a false claim standing on
    // fresh evidence, which is the one move this register's header names as forbidden.
    id: "statistics-derivations/admission-stage/the-admission-states-are-the-four-cased-here",
    renderedIn: DERIVATIONS,
    rendered: "export function admissionStagePosition(admission: Admission): AdmissionStagePosition {",
    /**
     * ⚠️ RE-POINTED 2026-09-01, AFTER READING THE FILE RATHER THAN AFTER READING THE RED. The
     * `"left"` -> `"departed"` rename this switch's own doc comment had been anticipating landed
     * in the merge, so this citation went red naming the claim — and the claim was the half that
     * had to change, not only the fragment. The switch already cased `"departed"`, so the code was
     * correct throughout and only the sentence about it was stale, which is precisely the shape
     * the register exists to make loud.
     */
    claim: "The admission states this switch is exhaustive over are waitlisted, pulled, occupied and departed.",
    sourceFile: WARD_ADMISSIONS,
    evidence: 'export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed"] as const;',
    falsifiedBy: {
      change: "A fifth admission state arrives, so the switch is no longer exhaustive over exactly those four.",
      find: 'export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed"] as const;',
      replaceWith:
        'export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed", "transferred"] as const;',
    },
  },
  {
    /**
     * ⚠️ THE CLAIM WAS INVERTED, NOT MERELY RE-POINTED (2026-09-01). It read "`averageEmptyBedMinutes`'s
     * per-admission helper CLAMPS a negative pull-to-arrival gap to nought", cited
     * `return Math.max(0, arrivedAt - pulledAt);`, and was true when it was written. The owner's
     * ruling against clamping has since been applied to `ward-statistics.ts` itself, which now
     * returns `null` for a negative gap — so the divergence this module's prose described no
     * longer exists and the sentence describing it had become false. Nothing about the arithmetic
     * on this side moved; the false statement was one page's remark about another file, and the
     * register is the only thing that noticed.
     *
     * The citation is the ternary rather than the guard around it, because it is the expression
     * whose bytes change if the clamp ever comes back.
     *
     * ⚠️ **THE ID IS WARD LEAD'S, THE LOCATOR AND THE FALSIFYING EDIT ARE THIS BRANCH'S.** Both
     * sides corrected this claim independently and the merge of 2026-09-01 conflicted on it. Ward
     * Lead argued the id must describe the truth rather than negate the old falsehood — an id
     * carrying the word `clamps` is the failure message a future reader is handed, and a locator
     * asserting the opposite of the truth is a small copy of the defect this register exists to
     * catch. That argument is right and its id is taken. Their `rendered` locator is NOT taken:
     * it pointed at "measures the same two instants and clamps a negative gap to nought" and left
     * it pointing there deliberately, on the stated grounds that the sentence was still false and
     * belonged to a file they did not own. **That sentence has since been corrected** —
     * `statistics-derivations.ts` now reads "has since had the clamp removed under the same ruling
     * and now returns `null`", verified by reading the merged file, not by reading either comment.
     * So the contradiction Ward Lead wrote down no longer exists, and the locator points at the
     * corrected sentence. Their entry also carried no `falsifiedBy`, which this register now
     * requires of every claim.
     */
    id: "statistics-derivations/pull-to-arrival/ward-statistics-excludes-a-negative-gap",
    renderedIn: DERIVATIONS,
    rendered: "has since had the clamp removed under the same ruling and now",
    claim:
      "`averageEmptyBedMinutes`'s per-admission helper returns null for a negative pull-to-arrival gap — it " +
      "excludes the record rather than clamping it to nought.",
    sourceFile: WARD_STATISTICS,
    evidence: "return gap < 0 ? null : gap;",
    falsifiedBy: {
      change:
        "The clamp comes back — a negative pull-to-arrival gap is folded in as nought instead of excluding the " +
        "record — so the divergence this page's prose denies exists again.",
      find: "return gap < 0 ? null : gap;",
      replaceWith: "return Math.max(0, gap);",
    },
  },
  {
    id: "statistics-derivations/referral-to-bed/referral-id-is-nullable",
    renderedIn: DERIVATIONS,
    rendered: "`referralId` is nullable and a real `null` means",
    claim: "`Admission.referralId` is typed `string | null`, so a null is an ordinary state.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "referralId: string | null;",
    falsifiedBy: REFERRAL_ID_STOPS_BEING_NULLABLE,
  },
  {
    id: "statistics-derivations/referral-to-bed/referrals-carry-a-raised-instant",
    renderedIn: DERIVATIONS,
    rendered: "if (arrivedAt >= referral.raisedAt) chronologicallyCoherentCount += 1;",
    claim: "Every referral carries the instant it was raised, and it is required.",
    sourceFile: WARD_MODEL,
    evidence: "source: ReferralSource; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },

  // ── community-index.tsx ───────────────────────────────────────────────────────────────────────
  {
    /**
     * ⚠️ **THIS ENTRY ABSORBED A SECOND ONE ON 2026-09-01, AND THE SECOND ONE WAS DELETED RATHER
     * THAN MOVED.** `community-index/grouping/the-missing-region-field-is-enforcement` claimed that
     * `community-derivations.ts` "records the absent `region` field as enforcement, in those words",
     * and cited that comment. Phrased about the PROSE, it could only ever fail by somebody deleting
     * or rewording the comment — never by a `region` field arriving, which is the change anybody
     * cares about. It read as a second guard where there was one: `COMMUNITY_TEAM_BODY` here is the
     * guard, because it pins the whole record and breaks the moment a `region` field is added.
     * Deleted rather than recorded in `UNEVIDENCED_CLAIMS`, because it is not an unguarded claim —
     * it is a duplicate of a guarded one.
     */
    id: "community-index/grouping/team-record-is-id-and-name",
    renderedIn: COMMUNITY_INDEX,
    rendered: 'data-testid="community-index-provenance"',
    claim: "`CommunityTeam` is `{ id, name }` and carries nothing else to group by.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: COMMUNITY_TEAM_BODY,
    falsifiedBy: {
      change:
        "A `region` field arrives on the team record, so it stops being `{ id, name }` with nothing else to group " +
        "by — which is also the only edit the deleted 'missing region field is enforcement' entry was ever supposed " +
        "to catch.",
      find: "Never composed or prettified here. */ name: string; };",
      replaceWith: "Never composed or prettified here. */ name: string; region: HomeRegion; };",
    },
  },
  {
    id: "community-index/grouping/the-region-keyed-table-exists-elsewhere",
    renderedIn: COMMUNITY_INDEX,
    rendered: "The region-keyed `COMMUNITY_TEAMS` table in `ward-teams.ts`",
    claim: "A region-keyed community-team table exists in `ward-teams.ts` and is keyed by home region.",
    sourceFile: WARD_TEAMS,
    evidence: "export const COMMUNITY_TEAMS: Record<HomeRegion, string> = {",
    falsifiedBy: {
      change: "The table stops being keyed by home region, so the contrast the page draws no longer holds.",
      find: "export const COMMUNITY_TEAMS: Record<HomeRegion, string> = {",
      replaceWith: "export const COMMUNITY_TEAMS: Record<string, string> = {",
    },
  },
  {
    id: "community-index/grouping/the-id-is-a-slug-of-the-name",
    renderedIn: COMMUNITY_INDEX,
    rendered: "`id` is a slug derived from `name`",
    claim: "A team's id is computed from its name rather than authored beside it.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: "id: communityTeamSlug(name),",
    falsifiedBy: {
      change: "The id stops being computed from the name and is authored beside it instead.",
      find: "id: communityTeamSlug(name),",
      replaceWith: "id: AUTHORED_TEAM_IDS[name],",
    },
  },
  {
    id: "community-index/enumeration/pages-derive-from-the-referral-vocabulary",
    renderedIn: COMMUNITY_INDEX,
    rendered: "The teams come from `COMMUNITY_TEAM_PAGES`",
    claim: "`COMMUNITY_TEAM_PAGES` is derived from the referral picker's team vocabulary, not hand-written.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: "export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = communityTeamOptions().map((name) => ({",
    falsifiedBy: {
      change: "The page list stops being derived from the referral picker's vocabulary and is hand-written.",
      find: "export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = communityTeamOptions().map((name) => ({",
      replaceWith:
        "export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = HAND_WRITTEN_TEAM_NAMES.map((name) => ({",
    },
  },
  {
    id: "community-index/enumeration/the-vocabulary-comes-from-one-source-document",
    renderedIn: COMMUNITY_INDEX,
    rendered: "Every team listed here comes from one extracted source",
    claim: "The team vocabulary is read out of the extracted catchment rows of one source document.",
    /** Widened 2026-09-01 from the function head and its first loop to the whole function: a "one
     *  document" claim can only fail when a SECOND document is read, and a second loop appended
     *  underneath the first left every previously cited byte in place. */
    sourceFile: DESTINATION_OPTIONS,
    evidence: COMMUNITY_TEAM_VOCABULARY_DERIVATION,
    falsifiedBy: {
      change:
        "A second extracted document's rows are read into the same vocabulary, so it stops coming from one source " +
        "document. The file already models several documents, so this is a live edit rather than a theoretical one.",
      find: "spellings.set(key, counts); } }",
      replaceWith:
        "spellings.set(key, counts); } } for (const row of S2020_CATCHMENT_ROWS) { for (const clinic of " +
        "parseFollowUpClinicSet(row.followUpClinicVerbatim)) { spellings.set(communityTeamKey(clinic), new " +
        "Map([[clinic, 1]])); } }",
    },
  },
  {
    id: "community-index/enumeration/a-team-name-is-what-a-referral-stores",
    renderedIn: COMMUNITY_INDEX,
    rendered: "Every community team a referral can name in this prototype",
    claim: "A team's name is exactly the string a referral stores, never composed or prettified.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: COMMUNITY_TEAM_PAGE_DERIVATION,
    falsifiedBy: {
      change:
        "A team's name starts being prettified on the way to its page, so it stops being exactly the string a " +
        "referral stores.",
      find: "id: communityTeamSlug(name), name, }));",
      replaceWith: "id: communityTeamSlug(name), name: titleCase(name), }));",
    },
  },
  {
    id: "community-index/link/the-href-builder-lives-in-the-team-screen",
    renderedIn: COMMUNITY_INDEX,
    rendered: "`communityTeamHref` lives in\n * `community-screen.tsx`",
    claim: "The one href builder for a team page is exported from `community-screen.tsx`.",
    sourceFile: COMMUNITY_SCREEN,
    evidence: "export function communityTeamHref(team: CommunityTeam): string {",
    falsifiedBy: {
      change: "The href builder moves out of `community-screen.tsx`, so that file stops exporting it.",
      find: "export function communityTeamHref(team: CommunityTeam): string {",
      replaceWith: "",
    },
  },
  {
    id: "community-index/link/the-team-screen-is-a-client-module",
    renderedIn: COMMUNITY_INDEX,
    rendered: 'which is `"use client"`',
    claim: "`community-screen.tsx` is a client module, so its exports reach a server component as references.",
    sourceFile: COMMUNITY_SCREEN,
    evidence: '"use client";',
    falsifiedBy: {
      change:
        "The client directive is removed, so `community-screen.tsx` becomes a server module. (A directive MOVED " +
        "below the imports would falsify the claim while leaving these bytes in place — a residual this mechanism " +
        "does not close, because the directive's effect depends on being the file's FIRST statement and a substring " +
        "cannot witness position.)",
      find: '"use client";',
      replaceWith: "",
    },
  },
  {
    id: "community-index/restraint/the-team-screen-carries-the-other-teams-switcher",
    renderedIn: COMMUNITY_INDEX,
    rendered: 'renders an "Other community teams" switcher',
    claim: "The team screen does render an 'Other community teams' switcher, as this page says it does.",
    sourceFile: COMMUNITY_SCREEN,
    /*
     * ⚠️ **RE-POINTED 2026-09-05 AFTER READING THE CODE, WHICH IS THE STEP THIS GATE EXISTS TO FORCE
     * — not to turn a red test green.** The second-edition port moved the heading inside a
     * `teamSwitcherHeader` div and renamed `sectionHeading` to `teamSwitcherTitle`, so the recorded
     * fragment stopped matching. **The claim itself is unchanged and still true:** the `<nav>` is
     * there, it still carries `aria-label="Other community teams"`, and it still renders that `<h2>`
     * above a list of links to every other team.
     *
     * ⚠️ **THE FRAGMENT DELIBERATELY RUNS ON TO `teamList`, AND TWO OF US INDEPENDENTLY RE-POINTED
     * THIS LINE TONIGHT — one stopping at the `</h2>`.** The claim on the index page is that the
     * switcher LINKS every other team; a fragment ending at the heading evidences a heading and
     * nothing else, so it would keep passing the day the list itself disappeared. The longer
     * fragment is the one that carries the claim.
     *
     * Verified against `community-screen.tsx` by reading the `teamSwitcher` nav itself. **No line
     * number recorded on purpose:** the earlier version of this comment cited `:626` and the block
     * had already moved to `:972` by the time it was folded, which is what a line number in a
     * comment always does.
     */
    evidence:
      '<nav className={styles.teamSwitcher} aria-label="Other community teams"> ' +
      "<div className={styles.teamSwitcherHeader}> " +
      "<h2 className={styles.teamSwitcherTitle}>Other community teams</h2> " +
      "</div> " +
      "<ul className={styles.teamList}>",
    falsifiedBy: {
      change:
        "The switcher is removed from the team screen. (A block wrapped in a false condition would leave these " +
        "bytes in place — a substring witnesses presence in the file, not that it renders.)",
      find: '<nav className={styles.teamSwitcher} aria-label="Other community teams">',
      replaceWith: "",
    },
  },
  {
    /**
     * ⚠️ **THIS CLAIM USED TO LIVE IN `UNEVIDENCED_CLAIMS`, AS AN ABSENCE, AND THE ABSENCE STOPPED
     * BEING TRUE.** Its id was `community-index/reachability/nothing-links-to-this-index-yet` and its
     * claim was that nothing in the navigation linked to this index. `ward-nav.ts` registers a
     * `community` entry under `WARD_NAV`, and `tests/ward-community-index.dom.test.tsx` proves the
     * root rail renders it — a passing assertion, not the `it.fails` tripwire it started life as.
     * A claim that the route IS reachable is a presence, not an absence, so it can carry real
     * evidence and moved here rather than being edited in place.
     */
    id: "community-index/reachability/the-root-rail-links-this-index",
    renderedIn: COMMUNITY_INDEX,
    rendered: "the root rail renders that entry",
    claim:
      "The community index route is registered in `ward-nav.ts`'s `WARD_NAV` list and linked from the root rail, " +
      "so the team pages it lists are reachable rather than reachable only by typing an address.",
    sourceFile: WARD_NAV,
    evidence: 'id: "community", href: "/mockups/ward-flow/community",',
    falsifiedBy: {
      change:
        "The `community` entry is removed from `WARD_NAV` (or its href changes), so the root rail no longer " +
        "links this index and the claim becomes false again.",
      find: 'id: "community", href: "/mockups/ward-flow/community",',
      replaceWith: "",
    },
  },
];

/**
 * A claim these surfaces make that this mechanism CANNOT pin, and why.
 *
 * ⚠️ **This list is the honest half of the register and is not decoration.** A guard that quietly
 * omits what it cannot see reads as complete coverage, which is the same defect the register exists
 * to close, moved one level up. Every entry here is a real sentence on a real page that a reader
 * will believe and that nothing here re-checks.
 */
export type UnevidencedClaim = {
  id: string;
  renderedIn: string;
  claim: string;
  /** Why no substring can witness it, and what guards it instead if anything does. */
  reason: string;
};

export const UNEVIDENCED_CLAIMS: readonly UnevidencedClaim[] = [
  {
    id: "statistics-disclaimers/access/there-is-no-role-check-on-this-route",
    renderedIn: "src/components/ward-management/statistics/statistics-disclaimers.tsx",
    claim: "No route-level role gate exists anywhere in these mockups.",
    reason:
      "An absence. The claim is that no file contains a gate, and a substring can only witness a line that " +
      "exists. Pinning it would need a scan of every route file for an auth wrapper, which is a different " +
      "mechanism from this one and is not built.",
  },
  {
    id: "statistics-disclaimers/synthetic/every-instant-is-invented",
    renderedIn: "src/components/ward-management/statistics/statistics-disclaimers.tsx",
    claim: "Every patient, bed, referral and instant this prototype holds is invented.",
    reason:
      "A provenance claim about the whole fixture, not a claim about the model. No line of source states it, " +
      "and a line that did would be prose citing prose.",
  },
  {
    id: "statistics-screen/bed-readiness/nothing-in-the-model-enforces-it",
    renderedIn: STATISTICS_SCREEN,
    claim: "Nothing in the reducer stops a caller flagging a bed nobody has left yet as being prepared.",
    reason:
      "An absence — the claim is that SET_BED_PREPARATION has no state guard. The two guards it DOES have are " +
      "pinned above, and so is the fact that it stores the caller's value unchanged, but a guard that is not " +
      "there has no line to cite. Adding a state guard tomorrow would falsify the page and break nothing here.",
  },
  {
    /**
     * ⚠️ **THE ENTRY THAT DECIDES A HEADING, AND THE ONLY THING THAT WILL TELL WHOEVER FILLS THIS
     * ABSENCE.** The figure is headed "Referrals where every ward asked SO FAR has refused". The
     * qualifier is not caution — it is the exact reach of the data, and it is true only because of
     * something the model LACKS. Fill the absence and the heading becomes wrong in the safe-sounding
     * direction: it would go on saying "so far" about a figure that had become the stronger claim,
     * or worse, somebody would notice the number had changed and not know why.
     *
     * A closure or exhaustion marker is a reasonable thing to add. Whoever adds it will be doing
     * good work in the reducer and will have no reason on earth to open a statistics heading. This
     * line is the pointer they will not otherwise get.
     */
    id: "statistics-screen/refused-so-far/no-exhaustion-marker-exists-on-a-movement",
    renderedIn: STATISTICS_SCREEN,
    claim:
      "Nothing on a `Movement` records that the referral network has been exhausted — no closure flag, no " +
      "cap-reached marker, no 'nobody left to ask' state — which is why the heading says 'so far'.",
    reason:
      "An absence, and a load-bearing one. A substring can only witness a field that exists, and the point is " +
      "that no field does; the mechanical halves that ARE citable are pinned in MODEL_CLAIMS above (a decline " +
      "leaves the movement at a referrable stage, and the counted condition is two array lengths). ⚠️ IF A " +
      "CLOSURE OR EXHAUSTION MARKER IS EVER ADDED TO `Movement`, THIS FIGURE'S HEADING MUST CHANGE FROM 'so " +
      "far' TO 'every', its count becomes a strict subset of what it counts today, and the note explaining why " +
      "the qualifier is there must be rewritten or removed. Nothing else in this repository will say so.",
  },
  {
    id: "statistics-screen/not-offered/nothing-anywhere-records-an-offer",
    renderedIn: STATISTICS_SCREEN,
    claim:
      "No field anywhere in the model records that a bed was offered to, or held back from, a particular " +
      "person or request — no instant, no boolean, nothing.",
    reason:
      "An absence, and the reason that figure is not built rather than approximated. Measured by exact search " +
      "rather than assumed, but a search finding nothing has no line to cite. What IS pinned in MODEL_CLAIMS " +
      "above is the positive half: the two aggregate counts a unit does hold, and the fact that the nearest " +
      "derived figure is computed from those two alone. A per-bed or per-offer record arriving tomorrow would " +
      "break neither of those citations, so the day this absence is filled is the day this block should be " +
      "replaced by the figure the owner asked for.",
  },
  {
    id: "statistics-screen/referral-to-bed/a-matching-id-is-not-the-same-wait",
    renderedIn: STATISTICS_SCREEN,
    claim: "A matching referral id does not establish that two records are the two ends of one wait.",
    reason:
      "An inference about what the data can support, not a fact about a field. There is no line to cite because " +
      "the point is that no line links them.",
  },
  {
    id: "statistics-compare-screen/chooser/the-list-keeps-the-recorded-order",
    renderedIn: COMPARE_SCREEN,
    claim: "The unit list is in the order the prototype records units in, and is not sorted or ranked.",
    reason:
      "An absence: the claim is that the screen calls no sort. Guarded instead by the DOM tests in " +
      "tests/ward-statistics-sections.dom.test.tsx, which assert the rendered order against the input order.",
  },
  {
    id: "statistics-ward-screen/blocked/no-instant-marks-entry-to-waitlisted",
    renderedIn: WARD_STATS_SCREEN,
    claim: "No instant on `Admission` marks the moment somebody entered `waitlisted`.",
    reason:
      "An absence, and the one that produced the five-instants-when-there-are-seven defect. The page deliberately " +
      "no longer enumerates the instants, precisely because an enumeration is the thing that goes stale; that " +
      "restraint also removes the only substring a citation could have used.",
  },
  {
    id: "statistics-ed-screen/attributable/triage-can-precede-the-referral",
    renderedIn: ED_SCREEN,
    claim: "Where both instants exist, the triage can precede the referral being raised.",
    reason:
      "A possibility claim. `triagedAt?: Instant;` is pinned above and carries no ordering constraint, but the " +
      "absence of a constraint is again an absence: no line declares an ordering, and a line that is not there " +
      "cannot be cited. The fixture example that used to support this sentence was removed from the page on " +
      "2026-09-01 rather than recorded here — see exclusion class 3 in this file's doc comment.",
  },
  {
    /**
     * ⚠️ **MOVED HERE FROM `MODEL_CLAIMS` ON 2026-09-01, AND THAT IS A REPAIR RATHER THAN A
     * RETREAT.** It cited the doc comment on the ED destination arm — "`FD-16` records that their
     * request arrives verbally, by phone or conversation, and" — a fragment that opens with a
     * backtick and so never even reached `isEntirelyComment`'s code-token test. Two things were
     * wrong with it at once: it is prose restating the claim, and the claim is an ABSENCE (ED
     * medical staff have no account, no route, no event), which exclusion class 2 in this file's
     * doc comment already says cannot be pinned by a substring at all. The comment it cited says of
     * itself "This comment IS the carrier", which is exactly true and exactly why it is not
     * evidence. **A claim recorded here as unguarded is worth more than one guarded by something
     * that cannot fail**, because the coverage number stops counting it.
     */
    id: "statistics-ed-screen/unrecordable/ed-requests-arrive-verbally",
    renderedIn: ED_SCREEN,
    claim:
      "Emergency-department medical staff are not users of this system: their request arrives verbally and " +
      "psychiatry raise the referral.",
    reason:
      "An absence, twice over. The workflow fact — a verbal request, then psychiatry raising the referral " +
      "against themselves — is the owner's described process (FD-16), recorded in a doc comment on the ED " +
      "destination arm and nowhere else; no line of code carries it, because what makes it true is that no ED " +
      "account, ED route or ED-raised event EXISTS. Citing that comment made this claim look guarded while the " +
      "only edit that could break the citation was deleting the comment, which is the one change that does not " +
      "make the claim false. If ED staff are ever given a way into this system, this page's block must go — and " +
      "nothing here will say so.",
  },
  {
    id: "statistics-ed-screen/near-miss/did-not-proceed-usually-means-admission-was-not-needed",
    renderedIn: ED_SCREEN,
    claim: "A `did_not_proceed` closure typically records that an examination found admission was not needed.",
    reason:
      "A clinical reading of what an enum member means in practice. The member itself is pinned above; what it " +
      "usually means is not a fact any line of source states, and this page should not be the first to state it " +
      "as one.",
  },
];
