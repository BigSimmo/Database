import {
  bedIsOccupied,
  LEAVING_DESTINATIONS,
  type Admission,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * THE COMMUNITY HUB'S DERIVATIONS — who a community team can see, and, more importantly, who it
 * cannot.
 *
 * The design spec (`docs/superpowers/specs/2026-08-30-ward-flow-community-hub-design.md`) asks for
 * four lists. **Three of them are buildable from what the model holds and one is not**, and this
 * module's job is to make that difference structural rather than a note somebody has to read: the
 * unbuildable list has no function here at all, so no screen can accidentally render a plausible
 * approximation of it.
 *
 * ⚠️ **THE ASSOCIATION BETWEEN A PERSON AND A TEAM IS `admissionBelongsToTeam` AND NOTHING ELSE.**
 * One exported function, called by every list below, so the rule lives in one place and every list
 * moves together. A screen comparing anything inline would be a second home for the same rule.
 *
 * ⚠️ **THAT RULE CHANGED, AND THE CHANGE IS THE POINT OF THIS MODULE.** This hub was first written
 * against `admission.homeRegion === team.region`, and said so honestly: it recorded that the
 * owner's ruling on whether association is home region or an explicit team was OPEN, and that
 * region was the only thing the model could then express. The owner settled it on 2026-08-31 —
 * association comes from **a team named on the referral**, and home region is a geographic guess —
 * and `ReferralDestination`'s `community_team` arm now carries `teamName`, so the settled rule is
 * expressible for the first time. Region is gone from this module entirely, and it must not come
 * back: where a person lives is not who follows them up.
 *
 * ⚠️ **THE TEAMS ARE NOW THE CATCHMENT TABLE'S CLINICS, WHICH IS WHAT REFERRALS ACTUALLY NAME.**
 * The first version recorded that joining the catchment table to `COMMUNITY_TEAMS` would invent an
 * administrative fact, and it was right — but the join it refused is no longer needed. Intake
 * offers `communityTeamOptions()`, the clinics the S2015 table names, and stores the chosen one on
 * the referral; this hub reads that same vocabulary back. Nothing is mapped onto anything.
 * `COMMUNITY_TEAMS` in `ward-teams.ts` is region-keyed and is deliberately NOT read here — using it
 * would reintroduce region-derived membership under a different name.
 */

/**
 * A team page's identity: the team's name as referrals record it, and a URL-safe id.
 *
 * `id` is DERIVED from the name rather than authored beside it. A hand-written slug is a second
 * home for the name — it can disagree with the vocabulary, and the disagreement shows up as a 404
 * on one team's page while every test that iterates the list stays green.
 *
 * There is no `region` field, and its absence is enforcement rather than tidying: a screen cannot
 * fall back to region-derived membership if no team here knows a region.
 */
export type CommunityTeam = {
  id: string;
  /** Exactly the string a referral stores in `teamName`. Never composed or prettified here. */
  name: string;
};

/**
 * A team's URL segment. Lower-cased, with every run of characters that is not a letter or digit
 * collapsed to a single hyphen — these names come from an extracted source document and contain
 * spaces, slashes and brackets, none of which belong in a path segment.
 *
 * `communityTeamById` resolves by recomputing this over the real list rather than by parsing the
 * slug back, so a name that would not round-trip cannot silently resolve to the wrong team; it
 * resolves to nothing. Two names colliding on one slug is the residual risk, and
 * `tests/ward-community-hub.test.ts` pins that no two teams share one.
 */
export function communityTeamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The team pages, DERIVED from the same vocabulary intake offers — never a hand-written list.
 *
 * `communityTeamOptions()` reads the S2015 catchment rows and splits each follow-up cell, so this
 * hub has a page for exactly the teams a referral can name and for no others. A team reaches this
 * hub by appearing in that source table, and by nothing else.
 *
 * ⚠️ This is a PICKER'S VOCABULARY, not a roster of WA community services — see
 * `communityTeamOptions`' own comment. A team the table does not name can still be stored on a
 * referral, because `teamName` is a plain string, and it would have no page here. That is a known
 * edge, carried as outstanding work rather than papered over with a catch-all page that would
 * quietly collect them.
 */
export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = communityTeamOptions().map((name) => ({
  id: communityTeamSlug(name),
  name,
}));

/**
 * The team a URL segment names, or `null` — never a guess and never a fallback team, the same
 * discipline `unitById` and `siteByCode` already hold to. A community hub that silently resolved an
 * unknown id to the first team would show one team's patients under another team's name, which is
 * the worst answer this screen could give.
 */
export function communityTeamById(teamId: string): CommunityTeam | null {
  return COMMUNITY_TEAM_PAGES.find((team) => team.id === teamId) ?? null;
}

/**
 * ⚠️ **THE ONE PLACE A PERSON IS ASSOCIATED WITH A COMMUNITY TEAM.**
 *
 * The team named on the admission's referral, and deliberately nothing cleverer. This is the
 * owner's 2026-08-31 ruling implemented literally: a person belongs to the team somebody WROTE
 * DOWN, never to the team that happens to serve where they live.
 *
 * **An admission with no `referralId` belongs to no team.** So does one whose referral named no
 * community destination. Both are silent absences, which is why `admissionsWithNoCommunityTeam`
 * below exists and why the screen must state its size.
 *
 * ⚠️ **THE DESTINATION'S STATE IS NOT READ, AND THAT IS DELIBERATE.** A community destination that
 * was declined or cancelled still named this team, and `FD-24` is explicit that a decline locks
 * nobody out. Filtering on state here would quietly remove from a team's page the very people whose
 * referral went wrong — which is the population this hub exists to make visible.
 */
export function admissionBelongsToTeam(
  admission: Admission,
  team: CommunityTeam,
  referrals: readonly Referral[],
): boolean {
  if (admission.referralId === null) return false;
  const referral = referrals.find((candidate) => candidate.id === admission.referralId);
  if (referral === undefined) return false;
  return referral.destinations.some(
    (addressed) => addressed.destination.kind === "community_team" && addressed.destination.teamName === team.name,
  );
}

/** The destination labels, derived from the vocabulary rather than restated — a second copy of a
 *  fixed list is how two screens come to call the same departure two different things. */
const LEAVING_DESTINATION_LABELS: ReadonlyMap<LeavingDestination, string> = new Map(
  LEAVING_DESTINATIONS.map((destination) => [destination.id, destination.label]),
);

/** The label for a recorded departure, or `null` when nothing was recorded. Never a substituted
 *  word: an unrecorded destination is an absence and the screen says so. */
export function leavingDestinationLabel(destination: LeavingDestination | null): string | null {
  return destination === null ? null : (LEAVING_DESTINATION_LABELS.get(destination) ?? null);
}

/**
 * The ONE destination that records somebody going back into a community team's area.
 *
 * ⚠️ **A JUDGEMENT, MADE NARROWLY AND ON PURPOSE.** Only `discharged-to-the-community` states the
 * fact this list is about, in the vocabulary's own words. Every other member of
 * `LEAVING_DESTINATIONS` (`ward-admissions.ts`, the array around `:179`) says something else: two
 * are transfers to another hospital bed and the person is still an inpatient; one is a move to
 * residential care; one is a transfer into police or prison custody; one records a death on the
 * ward; one — `left-against-advice` — records only that the admission ended without the ward's
 * agreement and says nothing whatsoever about where the person went; and `did-not-return` is what a
 * ward records when it decides the bed of somebody who absconded is not coming back to them, which
 * is not a return to the community either.
 *
 * ⚠️ **NO COUNT OF THAT LIST IS WRITTEN HERE, AND THAT IS THE CORRECTION RATHER THAN A STYLE.** This
 * paragraph opened with a count of the vocabulary until 2026-09-01, when the owner added
 * `died-on-the-ward`, `transferred-to-custody` and `did-not-return` — and the sentence went stale
 * that day with nothing going red, because a figure typed into prose has no guard. The retired
 * figure is not repeated even as history, because a phrase written down is a phrase that can be
 * copied back. The judgement below never depended on the size of the list; only the enumeration did.
 *
 * Reading `left-against-advice` as "came home" would be the more generous choice and it would be an
 * invention: the record does not say it. The people it excludes are not dropped — `otherDepartures`
 * carries every remaining departure for the team and the screen states their count and their
 * recorded destinations, so nobody leaves this hub silently.
 */
function isDischargeIntoTheCommunity(admission: Admission): boolean {
  return admission.state === "departed" && admission.leavingDestination === "discharged-to-the-community";
}

/**
 * Everything one team's page renders, as arrays.
 *
 * ⚠️ **ARRAYS RATHER THAN COUNTS, so a count above a list and the list beneath it cannot disagree.**
 * Every figure on the screen is `something.length` of the array rendered directly below it. This
 * project has already shipped a heading counting one array over a list rendering another
 * (`queueStageSummaries`); returning only arrays makes that unrepresentable here.
 *
 * ⚠️ **NOTHING IS SORTED.** The fixture's own order, exactly as the out-of-area ledger keeps it and
 * for the same reason: an ordering on any of these lists reads as a priority — who to visit first,
 * who has waited longest — and nobody has decided one. There is no comparator in this module.
 */
export type CommunityHubLists = {
  /**
   * List 2 — referred to this team and in a bed now. `bedIsOccupied`, so a bed given away to
   * somebody who has not physically arrived counts: the ward has committed the bed and the
   * community team's patient is in the system. Which of the two it is shows on every row, because
   * "in a bed" and "a bed has been pulled" are different facts about a person.
   */
  currentlyAdmitted: Admission[];
  /**
   * List 4 — of those, the ones the ward has recorded an expected discharge date for. The spec
   * calls this the mechanism rather than a nicety: it exists while somebody can still act.
   *
   * A SUBSET of `currentlyAdmitted`, filtered from that same array, so the two can never describe
   * different populations.
   */
  expectedBack: Admission[];
  /**
   * List 1 — referred to this team and recorded as discharged to the community.
   *
   * ⚠️ **THIS IS NOT THE SPEC'S LIST 1 AND THE SCREEN MUST SAY SO.** The spec asks for "discharged,
   * NO FOLLOW-UP ARRANGED".
   *
   * ⚠️ **UNTIL 2026-09-01 THIS PARAGRAPH DENIED, IN BOLD, THAT THE MODEL HELD ANY FOLLOW-UP FIELD,
   * EVENT OR VOCABULARY AT ALL — AND EVERY CLAUSE OF THAT WAS FALSE.** The concept is on the
   * record: `Admission.followUp` is a `FollowUpRecord | null` (`ward-admissions.ts`, the field
   * around `:452` and the field-presence map around `:484`), `FollowUpRecord` (around `:168`)
   * carries a `state`, a `recordedAt` and a `recordedBy` role, the vocabulary is `FOLLOW_UP_STATES`
   * (around `:159`) = `["arranged", "not_arranged"]`, and `ward-admissions-seed.ts` writes a real
   * record on two departed admissions (around `:733` and `:770`).
   *
   * **This is the identical sentence that was corrected in `community-screen.tsx` on 2026-09-01 and
   * left standing here** — one file swept, its twin missed, and the false version went on being the
   * authoritative comment on the very array the screen renders.
   *
   * What IS true is narrower and sharper, and the conclusion below is unchanged by it: the field has
   * **no producer and no consumer**. Nothing in the app reads it, and the only mention in
   * `ward-flow-reducer.ts` writes `followUp: null` (around `:941`, inside `case "PULL_PATIENT"`
   * around `:811`) when it creates an admission, so no action available in this prototype can put a
   * record there. So the second half of the spec's sentence cannot be computed from anything this
   * prototype produces. Inventing one would be bad; quietly dropping it is worse, because an empty
   * list under the spec's heading asserts that everybody discharged into this team's care has
   * follow-up arranged. Nobody checked that. Nothing in this system could.
   */
  dischargedIntoTheArea: Admission[];
  /**
   * Every other recorded departure for this team, whatever it was.
   *
   * ⚠️ **THIS CARRIES DEATHS ON THE WARD AND TRANSFERS INTO POLICE OR PRISON CUSTODY.** It also
   * carries transfers to another hospital, moves to residential care, admissions that ended against
   * advice, and the bed of somebody who absconded and was recorded as not returning — but those two
   * are the ones this comment must name first, because `community-screen.tsx` renders each recorded
   * destination's label into `ward-community-other-departures` verbatim from the vocabulary. **A
   * coordinator therefore reads "Died on the ward" on this screen**, and a doc comment promising
   * something gentler is a comment that will be believed instead of the page.
   *
   * Until 2026-09-01 this named only hospital transfers, residential care and against-advice
   * endings, and offered that short list as though it were the whole of what this array holds. It
   * stopped being true the day the owner added `died-on-the-ward`, `transferred-to-custody` and
   * `did-not-return` to the vocabulary, and it stayed here after their labels were already
   * rendering — the array grew, the sentence describing it did not, and nothing could go red
   * because prose is not typechecked. The retired sentence is not repeated in its own words, so
   * that it cannot be copied back out of this note.
   *
   * Not part of list 1, and not hidden either: the screen names their count and their destinations
   * so that `dischargedIntoTheArea` being short is visibly a consequence of what the record says
   * rather than of what this module chose to look at.
   */
  otherDepartures: Admission[];
};

export function communityHubLists(
  admissions: readonly Admission[],
  team: CommunityTeam,
  referrals: readonly Referral[],
): CommunityHubLists {
  const ours = admissions.filter((admission) => admissionBelongsToTeam(admission, team, referrals));
  const currentlyAdmitted = ours.filter(bedIsOccupied);
  const departed = ours.filter((admission) => admission.state === "departed");
  return {
    currentlyAdmitted,
    expectedBack: currentlyAdmitted.filter((admission) => admission.expectedDischargeAt !== null),
    dischargedIntoTheArea: departed.filter(isDischargeIntoTheCommunity),
    otherDepartures: departed.filter((admission) => !isDischargeIntoTheCommunity(admission)),
  };
}

/**
 * ⚠️ **THE COHORT THIS HUB CANNOT SEE, AND THE REASON THE SCREEN MUST STATE ITS SIZE.**
 *
 * A referral-keyed hub shows a person only if their admission points at a referral that named a
 * community team. An admission with no `referralId` — every one created during a session by
 * `PULL_PATIENT` — and every admission whose referral asked only for a bed or an emergency department
 * appears on **no team's page, in any of the lists above**, and its absence is invisible by
 * construction: every list simply does not contain it, and every list looks exactly as it would if
 * that person did not exist.
 *
 * ⚠️ **THIS COHORT IS THE MAJORITY, AND SAYING SO IS THE WHOLE POINT.** Under the previous region
 * rule this number was 0 on the opening fixture, and the screen could fairly say "nobody is missing
 * yet". Under the owner's rule it is most of the ward, because naming a community team is something
 * a referrer does rarely and deliberately. A team's page is therefore NOT a picture of everybody in
 * that area — it is a picture of everybody this prototype can MATCH to that team, which is a smaller
 * and far better-defined claim, and the screen must make that claim rather than the larger one.
 *
 * ⚠️ **AND IT IS NOT COMPLETE IN THE UNCONDITIONAL SENSE THIS PARAGRAPH AND THE SCREEN BOTH CLAIMED
 * UNTIL 2026-09-01.** `admissionBelongsToTeam` needs the referral to be
 * FOUND: `referrals.find(...)` returning `undefined` — a `referralId` that resolves to nothing in
 * the list this hub was handed — excludes that admission from every team's page just as surely as
 * having no referral at all. Completeness is therefore conditional on the join succeeding, and the
 * unresolved are not lost: they land in this function's own result, which is the figure the screen
 * states at the top of the page.
 *
 * Whole-system rather than per-team, because there is nothing to attribute: the missing fact IS the
 * team association.
 */
export function admissionsWithNoCommunityTeam(
  admissions: readonly Admission[],
  referrals: readonly Referral[],
): Admission[] {
  return admissions.filter(
    (admission) => !COMMUNITY_TEAM_PAGES.some((team) => admissionBelongsToTeam(admission, team, referrals)),
  );
}
