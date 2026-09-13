"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import {
  admissionBelongsToTeam,
  admissionsWithNoCommunityTeam,
  communityMembershipResolution,
  communityHubLists,
  communityTeamById,
  COMMUNITY_TEAM_PAGES,
  leavingDestinationLabel,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import {
  ratifiedAliasesFor,
  ratifiedSameServiceNames,
} from "@/components/ward-management/community/community-ratified-aliases";
import {
  communityTeamSuburbCounts,
  nearDuplicateSpellingsOf,
} from "@/components/ward-management/community/community-vocabulary";
import { elapsedDaysPhrase } from "@/components/ward-management/community/community-elapsed";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { daysBetween, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Referral, ReferralAddressing, Unit } from "@/components/ward-management/ward-model";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import styles from "./community.module.css";

/**
 * THE COMMUNITY HUB — one community team, and the part of the bed-flow circle it can actually see.
 *
 * The design spec asks for four lists. **This screen builds three of them, states in plain words
 * what the fourth cannot be built from, and says on itself what the three it does build are not.**
 * That is not caution for its own sake: this is the one screen in the prototype whose emptiness is
 * read as a safety statement, and the spec was written before anybody had established that the
 * follow-up fact it turns on — which does exist on the record — is written by nothing and read by
 * nothing.
 *
 * ⚠️ **THE FOUR THINGS THIS SCREEN SAYS ABOUT ITSELF, and why each is on the page rather than in a
 * document.**
 *
 *  1. **Whether follow-up has been arranged IS recorded on the admission, and NOTHING IN THE APP
 *     READS IT.** The spec's list 1 is "discharged, NO FOLLOW-UP ARRANGED".
 *
 *     ⚠️ **THIS PARAGRAPH AND THE SENTENCE IT DESCRIBES BOTH SAID SOMETHING FALSE UNTIL 2026-09-01,
 *     IN BOLD, ON A PAGE WHOSE WHOLE PURPOSE IS BEING BELIEVED.** They said the model held no
 *     follow-up field, event or vocabulary. It does: `Admission.followUp` is a
 *     `FollowUpRecord | null` (`ward-admissions.ts`, around `:452`, and in the field-presence map
 *     around `:484`), `FollowUpRecord` carries a `state`, a `recordedAt` and a `recordedBy` role, the
 *     vocabulary is `FOLLOW_UP_STATES` (`ward-admissions.ts`, around `:159`) =
 *     `["arranged", "not_arranged"]`, and the seed sets a real record on two departed admissions.
 *
 *     What is true — and it is a sharper statement than the false one, not a weaker one — is that
 *     the field has **no producer and no consumer**. No screen, derivation or reducer consumer reads
 *     it. The only mention in `ward-flow-reducer.ts` writes `followUp: null` (around `:941`, inside
 *     `case "PULL_PATIENT"` around `:811`) when it creates an admission, so no action available in
 *     this prototype can put a record there. `ward-reanchor.ts` moves the record's `recordedAt`
 *     because `INSTANT_FIELDS` NAMES `recordedAt`, explicitly and deliberately, with its own comment
 *     saying that a nested instant is exactly the kind that set loses track of and is therefore
 *     named rather than left for a reader to notice. It is not a side effect of the shift recursing,
 *     which is what this paragraph claimed until 2026-09-01 — an inverted mechanism under a sound
 *     conclusion, and the inversion mattered: "it happens to be reached" invites somebody to stop
 *     naming nested fields, which is the failure that set exists to prevent.
 *     A field nothing writes and nothing reads passes every gate and renders as a perfectly ordinary
 *     empty state, which is exactly why the wrong version of this sentence survived.
 *
 *     So the list here is "discharged to the community", and **the sentence saying the follow-up
 *     half is unavailable sits inside the section, above the list, at the same weight as the
 *     heading.** An empty list under the spec's own heading would assert that everybody discharged
 *     to this team's care is being followed up, which is the worst claim available on this screen
 *     and the one nothing else in Ward Flow could contradict. That conclusion is unchanged by the
 *     correction — only its reason is. The wording is pinned by an assertion in
 *     `tests/ward-community-index.test.ts` so the false version cannot come back.
 *  2. **The count of admissions this hub cannot place with any team.** See
 *     `admissionsWithNoCommunityTeam`. Under the owner's 2026-08-31 ruling a person belongs to the
 *     team NAMED ON THEIR REFERRAL, so anyone whose referral named no community team — and anyone
 *     admitted with no referral at all — is on no team's page anywhere. **That is most of the
 *     ward**, not an edge case, and the page must say so: a team's page is a picture of everyone
 *     this prototype can MATCH to that team, never a picture of an area.
 *
 *     ⚠️ **UNTIL 2026-09-01 THIS POINT AND THE SENTENCE IT DESCRIBES BOTH CALLED THE PAGE COMPLETE,
 *     IN BOLD, AND IT WAS NOT EARNED.** `admissionBelongsToTeam` needs the referral to be FOUND — an admission whose
 *     `referralId` resolves to nothing in the referrals this screen was handed is excluded exactly
 *     as if it had no referral at all — so completeness is conditional on that join succeeding, and
 *     the page cannot check it. The unresolved are counted in the figure this point describes, and
 *     the rendered sentence now says both halves rather than only the flattering one.
 *  3. **Referrals RAISED BY a team still cannot be attributed.** A referral records that its source
 *     was `"community"`, but the source side carries no team, so nothing says which team raised
 *     one. The receiving side is now knowable — `community_team` destinations carry `teamName` —
 *     and that list is outstanding work rather than an impossibility. The section renders with that
 *     statement and no list, because a section that says why it is empty is honest and one that is
 *     silently absent is not.
 *  4. **The team names come from one extracted source document**, the S2015 catchment table, by way
 *     of `communityTeamOptions()`. They are what a referral can name in this prototype. They are
 *     not a roster of WA community services, and no team has agreed to be represented here.
 *
 * ⚠️ **NO THRESHOLD, NO "OVERDUE", NO COLOUR BY AGE.** Nothing on this screen changes appearance
 * with a duration, nothing is compared against a target, and `formatRemaining` — which appends
 * "overdue" — is deliberately never called here. There is no follow-up interval, no contact target
 * and no breach, because no such figure exists and one invented on this screen would look more
 * authoritative than anywhere else in the prototype.
 *
 * ⚠️ **NO SECOND FREE-TEXT FIELD.** `FD-13` permits exactly one story field and it is on the
 * referral. A "handover note" box is the obvious next thing to want here and it is forbidden; there
 * is no `<textarea>`, no `<input>` and no writable control anywhere in this file. **Reported rather
 * than built:** a community team reading this screen has nowhere to record what it intends to do
 * about anybody on it, and that gap is real. Closing it is a governance decision about widening the
 * one-story-field rule, not an implementer's convenience.
 *
 * ⚠️ **ONE CLOCK AND ONE DATA SOURCE: the provider's.** `admissions`, `units` and `now` all come
 * from `useWardFlow()` in a single read. A duration computed from a re-anchored `now` against a
 * frozen seed inflated every wait on two screens in this project, and *a wrong clock looks wrong; a
 * wrong length of stay looks plausible.* The `admissions` prop below exists only so a test can
 * render populations the seed cannot produce, and it falls back to live state — the same shape and
 * the same reasoning as `OutOfAreaBoard`'s.
 *
 * ⚠️ **THIS SCREEN RENDERS NO INSTANT AT ALL — and the clock defect it was written for HAS SINCE
 * BEEN FIXED, so this paragraph now says something different from what it said.** It used to assert
 * that the re-anchor left `Admission`'s own instants behind when the demonstration clock moved, and
 * that the guard on it looked at the model file alone and so could never see them. **Both halves of
 * that are now false, and neither is repeated here in its own words: a false sentence written down
 * as history is a false sentence somebody can copy back.** `INSTANT_FIELDS` names `pulledAt`,
 * `awayAtEmergencyDepartmentSince`, `expectedDischargeAt`, `dischargeDateSetAt`,
 * `dischargeConfirmedAt`, `leftAt` and the nested `recordedAt`; and `tests/ward-reanchor.test.ts`
 * reads BOTH files — its `MODEL_FILES` lists `ward-model.ts` and `ward-admissions.ts` — which
 * `ward-reanchor.ts`'s own comment describes as a guard that reads both files. Landed by
 * `44ca08839`, "the demo clock was leaving six admission timestamps behind", which reached this
 * branch through the merge `aeff0635b`. The offset measurement this paragraph used to quote was
 * taken BEFORE that commit, and repeating it here made a repaired defect look live.
 *
 * **The two lists now state elapsed time rather than a bare "a date exists" — owner-approved
 * 2026-09-01.** Until that ruling this paragraph said the two lists could only state THAT a date
 * exists, and left whether to print it as the owner's open question. What remains true, and is the
 * reason a calendar date is still never printed: every date in this fixture is invented, so "left 14
 * August" would be a synthetic day rendered to a community team as though it were a plan. "Left 5
 * weeks ago" is different in kind, not degree — it carries the clinical signal a bare "a date is
 * recorded" cannot (a discharge with no follow-up arranged is unremarkable at a day and is the case
 * this hub exists to surface at five weeks), it cannot be mistaken for a real record of a real
 * person, and it stays correct as the demonstration clock moves with nobody maintaining it. See
 * `expectedBackLabel`'s and `departureLabel`'s own block, and `community-elapsed.ts` for the one
 * rounding rule both fields use. There is no `% 1440` anywhere in this file either.
 *
 * **A suburb is not an address (`PD-3`) — and this screen shows neither.** It renders a team name,
 * a ward, a bed state and a length of stay. No street, number or postcode; `address` remains unruled and no
 * field here approaches it. No name, no date of birth, no clinical record, no allocation, no last
 * contact, no visit frequency.
 *
 * ⚠️ **SECOND-EDITION PRESENTATION PASS, 2026-09-05 — MARKUP AND STYLE ONLY.** Every sentence this
 * screen renders, it still renders, word for word; every `data-testid` it carried, it still
 * carries. The four numbered sections below are now `WardPanel` (`ward-panel.tsx`), the same
 * primitive `community-index.tsx` adopted the same day, so the two screens in this route family
 * read as one system rather than two independently hand-rolled ones. The team switcher stays a
 * `<nav>` — it needs that landmark role, which `WardPanel` does not offer — and instead `composes`
 * `ward-panel.module.css`'s own header classes, so its chrome is pixel-identical to a real panel's
 * without becoming one. Nothing above this note changed.
 *
 * ⚠️ **THIRD EDITION, 2026-09-05 — THE OWNER'S REORDER, BUILT FROM THE APPROVED PROTOTYPE
 * (`docs/ward-flow/design/prototypes/mockup-community-team-hub-v1.html`).** This one changes what
 * the page says as well as how it looks, and every sentence the earlier two editions carried is
 * still here somewhere — moved, in several cases, never dropped or reworded. What is new:
 *
 *   1. **A figure strip above every list.** Six derived counts — waiting for an answer, longest
 *      wait, ours in a bed or holding one, expected back, admitted while already with this team,
 *      discharged into the area — each read from the same arrays the lists below it render, never
 *      typed. No figure here has a threshold or a colour keyed to it.
 *   2. **"Waiting for your answer" is now the first list.** The old page never asked who was
 *      waiting on this team; this is the team's own queue — every referral naming this team whose
 *      destination is still `"queued"` — sorted longest-waiting-first. Accept/decline is
 *      DELIBERATELY NOT WIRED here: `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` restrict which role may
 *      answer which kind of destination (`ward-flow-reducer.ts`'s `answerableBy` map, gated
 *      earlier by `EVENT_ROLE`), and neither currently admits a community-team answer. Dispatching
 *      as `ward` or `coordinator` from this screen would write a FALSE `decidedBy` — the exact
 *      defect that map's own comment names as the reason a workaround must not be built — so this
 *      screen states the referral and states the gap rather than inventing a decision-maker.
 *      Widening who may answer a community destination is a reducer-level, role-permission
 *      decision outside this file's mandate; it is reported here rather than routed around.
 *   3. **"Admitted while already with this team", the most delicate addition.** `ReferralAddressing`
 *      carries `state: "accepted"` and `decidedAt`; `Admission` carries `arrivedAt`. So "this team
 *      had already accepted them before the bed began", and the gap between the two, are real and
 *      derivable — but NOTHING IN THIS MODEL RECORDS A TEAM CLOSING SOMEBODY: no team discharge, no
 *      episode end, no closing date (checked in `ward-model.ts`, not assumed). The heading and
 *      every sentence in this section therefore say what this team ACCEPTED, never that anybody
 *      was "currently active with" or "still with" the team — a heading making that claim would
 *      assert active care no field holds, to a clinician who would reasonably believe it. Somebody
 *      the team closed a year ago still appears here, and the page says so. People referred to this
 *      team DURING the admission they are still in are a different group — the ward reaching out,
 *      not a relapse — and are excluded and named separately, never merged in.
 *   4. **A rail.** "Worth your attention" (derived prompts, never invented ones), "What this page
 *      cannot tell you" (the same limits the page already stated, gathered), "This team" (name,
 *      the real per-team suburb count from `communityTeamSuburbCounts()`, near-duplicate count),
 *      and "Go to" (three real routes — no link is invented).
 *   5. **The four original lists still render, unmoved in substance, some moved in position and
 *      one split.** "Discharged to the community" and "Referrals we have made" keep every sentence
 *      they carried. The departures footnote that used to sit inside the discharged panel now has
 *      its own panel, "Left the ward another way", because the owner's order calls for it as its
 *      own numbered item — its text is unchanged, including the closing clause that still means
 *      what it always did, because the discharged list still renders above it on this page.
 *
 * No colour or emphasis anywhere on this page is keyed to elapsed time — sorting is the only signal
 * a duration is allowed to carry, per the owner's ruling that a first draft applied silently and
 * with nothing beside it saying so.
 */
export function CommunityScreen({
  teamId,
  admissions,
  referrals,
}: {
  teamId: string;
  admissions?: Admission[];
  referrals?: Referral[];
}) {
  const { admissions: liveAdmissions, referrals: liveReferrals, units, now } = useWardFlow();
  const team = communityTeamById(teamId);
  const source = admissions ?? liveAdmissions;
  // Membership is read off the referral now, so the referrals are as much an input to this screen
  // as the admissions are. Overridable together, and from the same place, so a test cannot supply
  // one without the other and get a page that is quietly empty for the wrong reason.
  const sourceReferrals = referrals ?? liveReferrals;

  if (!team) {
    return (
      <div className={styles.screen} data-testid="ward-community-screen">
        <ClinicalRail />
        <main id="main-content" className={styles.main}>
          <h1 className={styles.notFoundHeading}>Community team not found</h1>
          <p className={styles.notFoundBody} data-testid="ward-community-unresolved">
            No community team matches &ldquo;{teamId}&rdquo;. This never falls back to a different team — showing one
            area&apos;s patients under another area&apos;s name is the worst answer this screen could give.
          </p>
        </main>
      </div>
    );
  }

  const lists = communityHubLists(source, team, sourceReferrals);
  const unattributable = admissionsWithNoCommunityTeam(source, sourceReferrals);
  /*
   * 🔴 **WHICH KIND OF EMPTY EVERY EMPTY LIST BELOW IS.** Ward Lead's ruling, 2026-09-05: a list
   * has the same two meanings a nullable figure has, and the same collapse. **"Nobody referred to
   * this team is currently in a bed" and "we cannot tell who is in a bed" must not read alike** —
   * and until today the screen said the first while the second was true for all but one team.
   *
   * ⚠️ **DERIVED PER TEAM, NEVER WRITTEN DOWN.** A hardcoded "cannot be computed" is true today
   * and becomes a FALSE GAP the day somebody writes the referral link — today's defect with its
   * sign flipped, and nothing would announce it. `tests/ward-community-membership-resolution.test.ts`
   * holds both directions, and its load-bearing case is the repaired fixture rather than this one.
   */
  const resolution = communityMembershipResolution(source, team, sourceReferrals);
  const cannotResolve = resolution.state === "not-computable";
  const nearDuplicates = nearDuplicateSpellingsOf(team.name);
  const sameService = ratifiedSameServiceNames(team.name);
  const ratifiedBy = ratifiedAliasesFor(team.name)[0];
  /**
   * ⚠️ **THE POPULATION `communityHubLists` DROPS SILENTLY, AND WHY IT IS COMPUTED HERE RATHER THAN
   * THERE.** `communityHubLists` only ever splits a matched admission into `bedIsOccupied`
   * (`pulled`/`occupied`) or `departed` — `ADMISSION_STATES` also has `waitlisted`, and a matched
   * admission still waitlisted for this team lands in neither bucket. It is also not in
   * `unattributable`: that function counts admissions matched to NO team, and this one IS matched —
   * a bed has simply not been pulled yet. So without this line such a person renders on no list and
   * is counted in no figure on this page, which is exactly the silent drop `admissionsWithNoCommunityTeam`
   * exists to prevent for the unmatched case and does not reach here. Kept narrow and local rather
   * than added to `CommunityHubLists`: the brief asks for a stated count, not a fifth list, and a
   * derivation used by exactly one paragraph belongs beside that paragraph.
   */
  const waitlistedForTeam = source.filter(
    (admission) => admission.state === "waitlisted" && admissionBelongsToTeam(admission, team, sourceReferrals),
  );

  // The team's own queue — referrals naming this team whose addressing to it has not yet been
  // answered — oldest raised first, so position alone carries "who has waited longest" with no
  // colour or threshold doing it instead.
  const waitingReferrals = [...referralsWaitingOnTeam(sourceReferrals, team)].sort((a, b) => a.raisedAt - b.raisedAt);
  const inBedCount = lists.currentlyAdmitted.filter((admission) => admission.state === "occupied").length;
  const bedPulledCount = lists.currentlyAdmitted.filter((admission) => admission.state === "pulled").length;
  const pastPlannedDateCount = lists.expectedBack.filter(
    (admission) =>
      admission.expectedDischargeAt !== null &&
      Number.isFinite(admission.expectedDischargeAt) &&
      now > admission.expectedDischargeAt,
  ).length;

  // Every admission this team can see in a bed or holding one, split into the three groups the
  // acceptance-versus-arrival comparison can actually distinguish. See `categoriseTeamAdmission`'s
  // own doc comment for why a bed-pulled admission can be in neither of the other two.
  const teamAdmissionCategories = lists.currentlyAdmitted.map((admission) =>
    categoriseTeamAdmission(admission, team, sourceReferrals, now),
  );
  const admittedWhileAlreadyWithTeam = teamAdmissionCategories
    .filter((category): category is AcceptedBeforeAdmission => category.kind === "accepted-before-admission")
    .sort((a, b) => b.gapMinutes - a.gapMinutes);
  const referredDuringThisAdmission = teamAdmissionCategories.filter(
    (category) => category.kind === "referred-during-admission",
  );
  const bedPulledNotYetArrived = teamAdmissionCategories.filter(
    (category) => category.kind === "bed-pulled-not-arrived",
  );
  const shortestAcceptanceToAdmissionGap =
    admittedWhileAlreadyWithTeam.length > 0
      ? admittedWhileAlreadyWithTeam.reduce((shortest, candidate) =>
          candidate.gapMinutes < shortest.gapMinutes ? candidate : shortest,
        )
      : null;
  const suburbsNamingTeam = communityTeamSuburbCounts().get(team.name);

  /*
   * "Worth your attention" — every entry derived from the arrays already computed above, never a
   * new figure invented for the rail. Each condition is independent, so a quiet team with nothing
   * to flag renders none of them rather than a padded list, and the panel says so in words.
   */
  const attentionItems: ReactNode[] = [];
  if (waitingReferrals.length > 0) {
    const oldest = waitingReferrals[0];
    attentionItems.push(
      <>
        <strong>{oldest.id}</strong> has waited {referralWaitLine(oldest, now)} for an answer from this team — the
        longest of the {waitingReferrals.length} referral{waitingReferrals.length === 1 ? "" : "s"} waiting.
      </>,
    );
  }
  if (shortestAcceptanceToAdmissionGap) {
    const { admission, acceptedAt, arrivedAt } = shortestAcceptanceToAdmissionGap;
    attentionItems.push(
      <>
        <strong>{admission.id}</strong> was admitted {elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} after
        this team accepted them — the shortest gap of the {admittedWhileAlreadyWithTeam.length} admitted while already
        with this team, and the one worth checking first.
      </>,
    );
  }
  if (pastPlannedDateCount > 0) {
    attentionItems.push(
      <>
        {pastPlannedDateCount} of the {lists.expectedBack.length} planned discharge{" "}
        {lists.expectedBack.length === 1 ? "date has" : "dates have"} already passed for people this team can see.
      </>,
    );
  }
  if (unattributable.length > 0) {
    attentionItems.push(
      <>
        {unattributable.length} admission{unattributable.length === 1 ? "" : "s"} could not be matched to any community
        team at all — not this one, and not another.
      </>,
    );
  }

  return (
    <div className={styles.screen} data-testid="ward-community-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          {/* "What kind of thing it is" — the identity block the second-edition layout asks for,
              above the team's own name. A category label, not a claim, so it carries no sentence
              this file's own rules govern the wording of. */}
          {/* ⚠️ ONE LINE, NOT THREE STACKED BLOCKS, 2026-09-05. An eyebrow over a heading over a
              subtitle over a figure strip put roughly 260px between the app bar and the first row
              of real content, and the owner's word for it was that the top parts were too large.
              A team hub is a working screen: the name is orientation, not a title page. Nothing was
              removed — the same three pieces sit on one baseline. */}
          <span className={styles.eyebrow}>Community team</span>
          <h1 className={styles.pageTitle}>{team.name}</h1>
          <span className={styles.headSep} aria-hidden="true">
            &middot;
          </span>
          <p className={styles.pageSubtitle}>
            Everyone referred to this team, and where they are in the bed-flow circle.
          </p>
          {/* ⚠️ THE ONE SAFETY STATEMENT THAT DID NOT MOVE TO THE FOOT. The three page-level notices
              are at the end of this component now; this stays, quietly, because burying a
              not-a-medical-device statement at the bottom of a clinical page trades a real safety
              statement for tidiness. The colour left, the sentence did not. */}
          <p className={styles.prototypeNote} data-testid="ward-community-governance">
            <span className={styles.prototypeBadge}>Synthetic prototype</span>
            This hub is <strong>not a medical device</strong>. Every patient, bed and date in it is invented, and
            nothing here has been checked against a real service.
          </p>
        </header>

        {/* ── Figures across the top — every value read from an array already computed above,
             none typed into prose. `WardFigureStrip` caps flagged tiles at two; exactly one is
             flagged here ("admitted while already with this team"), and the flag is a fixed
             property of that tile's CATEGORY, never of how large its number is — no figure on this
             page changes colour with elapsed time. ─────────────────────────────────────────── */}
        <WardFigureStrip>
          <WardFigure
            label="Waiting for your answer"
            value={`${waitingReferrals.length}`}
            sub={`referral${waitingReferrals.length === 1 ? "" : "s"} addressed to this team`}
          />
          <WardFigure
            label="Longest wait"
            value={waitingReferrals.length === 0 ? "None waiting" : referralWaitLine(waitingReferrals[0], now)}
            sub={waitingReferrals.length === 0 ? undefined : `${waitingReferrals[0].id} · since it was raised`}
          />
          <WardFigure
            label="Ours, in a bed or holding one"
            value={`${lists.currentlyAdmitted.length}`}
            sub={`${inBedCount} in the bed · ${bedPulledCount} bed pulled`}
          />
          <WardFigure
            label="Expected back"
            value={`${lists.expectedBack.length}`}
            unit={`of ${lists.currentlyAdmitted.length}`}
            sub={`${pastPlannedDateCount} planned date${pastPlannedDateCount === 1 ? "" : "s"} already passed`}
          />
          <WardFigure
            label="Admitted while already with this team"
            value={`${admittedWhileAlreadyWithTeam.length}`}
            unit={`of ${lists.currentlyAdmitted.length}`}
            sub="already accepted before the bed began"
            flagged
          />
          <WardFigure
            label="Discharged into the area"
            value={`${lists.dischargedIntoTheArea.length}`}
            sub="recorded as discharged to the community"
          />
        </WardFigureStrip>

        <div className={styles.contentGrid}>
          <div className={styles.primaryColumn}>
            {/* ── Referrals addressed to this team, not yet answered — the team's own queue ── */}
            <WardPanel
              title="Waiting for your answer"
              count={`${waitingReferrals.length}`}
              testId="ward-community-waiting"
              blurb="Referrals that name this team as a destination and have not yet been accepted or declined, oldest first. Declining is a recorded answer, not a refusal to engage — the person stays visible to everyone else who is looking."
            >
              <div className={styles.panelBody}>
                {waitingReferrals.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-waiting-empty">
                    No referral naming this team is currently waiting for an answer.
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-waiting-list">
                    {waitingReferrals.map((referral) => (
                      <li
                        key={referral.id}
                        className={styles.card}
                        data-testid={`ward-community-waiting-${referral.id}`}
                      >
                        <p className={styles.cardUnit}>
                          {referral.id} · {urgencyTierLabel(referral.urgency)}
                        </p>
                        <p className={styles.cardDetail}>{referralWaitLine(referral, now)}</p>
                        <p className={styles.cardDetail}>
                          {referral.ageBand} · {referral.homeRegion} · {referralOriginLabel(referral)}
                        </p>
                        <p className={styles.cardDetail}>
                          {referral.transportNeeded ? "Transport needed" : "No transport recorded"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {/*
                 * ⚠️ ACCEPT/DECLINE IS DELIBERATELY NOT WIRED HERE. `ward-flow-reducer.ts` gates
                 * ACCEPT_REFERRAL/DECLINE_REFERRAL by role first (EVENT_ROLE), then by which
                 * destination kind that role may answer (its own `answerableBy` map) — today only a
                 * ward, an emergency department or a coordinator may answer, and none of those is a
                 * community team. Dispatching from this screen as one of those roles would write a
                 * FALSE decision-maker, the exact defect that map's own comment names as the reason a
                 * workaround must not be built. Widening who may answer a community destination is a
                 * reducer-level role decision outside this screen, so this panel states the queue and
                 * reports the gap rather than routing around it.
                 */}
                <p className={styles.footnote} data-testid="ward-community-waiting-not-actionable">
                  Accepting or declining a referral is not available from this page. Only a ward, an emergency
                  department or a coordinator can answer a referral today, and none of those is a community team. This
                  page states the queue rather than let somebody answer as the wrong role, which would record the wrong
                  person as having decided.
                </p>
              </div>
            </WardPanel>

            {/* ── Admitted while already with this team — the owner's most delicate request ──
                 See `categoriseTeamAdmission`'s doc comment above for the exact rule this table
                 draws on, and this file's header block (third edition) for why the wording below is
                 constrained the way it is. */}
            <WardPanel
              title="Admitted while already with this team"
              count={`${admittedWhileAlreadyWithTeam.length} of ${lists.currentlyAdmitted.length}`}
              testId="ward-community-accepted-before-admission"
              blurb="People this team had already accepted before their bed began, longest-accepted-first. This says what this team accepted, never that anybody is still with it — nothing in this prototype records a community team closing somebody."
            >
              <div className={styles.panelBody}>
                {admittedWhileAlreadyWithTeam.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-accepted-before-admission-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>
                        Nobody this team can currently see in a bed or holding one was accepted before that bed began.
                      </>
                    )}
                  </p>
                ) : (
                  <WardTable
                    className={styles.table}
                    wrapperClassName={styles.tableScroll}
                    testId="ward-community-accepted-before-admission-table"
                  >
                    <caption>Admissions this team had already accepted before the bed began</caption>
                    <thead>
                      <tr>
                        <th scope="col">Admission</th>
                        <th scope="col">Unit</th>
                        <th scope="col">In a bed for</th>
                        <th scope="col">Accepted before the bed began</th>
                        <th scope="col">Accepted altogether</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admittedWhileAlreadyWithTeam.map(({ admission, acceptedAt, arrivedAt }) => (
                        <tr key={admission.id} data-testid={`ward-community-accepted-before-admission-${admission.id}`}>
                          <th scope="row">{admission.id}</th>
                          <td>{unitName(admission.unitId, units)}</td>
                          <td>{stayLabel(admission, now)}</td>
                          <td>{elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} before the bed began</td>
                          <td>{elapsedSinceOrUnderADay(daysBetween(acceptedAt, now))} since acceptance</td>
                        </tr>
                      ))}
                    </tbody>
                  </WardTable>
                )}
                {/*
                 * The two groups the table above deliberately excludes, named rather than silently
                 * dropped — a referral made from the ward is the ward reaching out, not a relapse
                 * under this team's care, and a pulled bed with nobody arrived yet has no admission
                 * start to compare an acceptance against at all.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-accepted-before-admission-other-groups">
                  {referredDuringThisAdmission.length}{" "}
                  {referredDuringThisAdmission.length === 1 ? "admission was" : "admissions were"} referred to this team
                  during the bed they are still in, and {bedPulledNotYetArrived.length}{" "}
                  {bedPulledNotYetArrived.length === 1 ? "has" : "have"} a bed pulled and not yet arrived. Both are a
                  different group from the table above and are deliberately not counted in it — a referral made from the
                  ward is the ward reaching out, not a relapse under this team&apos;s care.
                </p>
                <p className={styles.footnote} data-testid="ward-community-accepted-before-admission-not-active-claim">
                  This table says this team had accepted these people before their bed began — it does not say they were
                  still with this team on the day they were admitted. Nothing in this prototype records a community team
                  closing somebody: no team discharge, no episode end and no closing date exist anywhere on the record.
                  Somebody this team closed months ago would still appear above, and this page has no way to know. Read
                  it as a prompt to check the team&apos;s own notes, never as a statement of who is currently under this
                  team&apos;s care.
                </p>
              </div>
            </WardPanel>

            {/* ── List 2, moved — everyone of ours in a bed or holding one ─────────────────── */}
            <WardPanel
              title="Ours, in a bed or holding one"
              count={`${lists.currentlyAdmitted.length}`}
              testId="ward-community-admitted"
            >
              <div className={styles.panelBody}>
                <p className={styles.count} data-testid="ward-community-admitted-count">
                  {lists.currentlyAdmitted.length}{" "}
                  {lists.currentlyAdmitted.length === 1
                    ? "person referred to this team is"
                    : "people referred to this team are"}{" "}
                  in a bed or have one pulled for them.
                </p>
                {lists.currentlyAdmitted.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-admitted-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>Nobody referred to this team is currently in a bed.</>
                    )}
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-admitted-list">
                    {lists.currentlyAdmitted.map((admission) => (
                      <li
                        key={admission.id}
                        className={styles.card}
                        data-testid={`ward-community-admitted-${admission.id}`}
                      >
                        <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                        <p className={styles.cardDetail}>{bedStateLabel(admission)}</p>
                        <p className={styles.cardDetail}>{stayLabel(admission, now)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </WardPanel>

            {/* ── List 4, moved — of those, who the ward expects back ──────────────────────── */}
            <WardPanel
              title="Expected back"
              count={`${lists.expectedBack.length} of ${lists.currentlyAdmitted.length}`}
              testId="ward-community-expected"
            >
              <div className={styles.panelBody}>
                <p className={styles.count} data-testid="ward-community-expected-count">
                  {lists.expectedBack.length} of the {lists.currentlyAdmitted.length}{" "}
                  {lists.currentlyAdmitted.length === 1 ? "person" : "people"} above{" "}
                  {lists.expectedBack.length === 1 ? "has" : "have"} a discharge date the ward has written down.
                </p>
                {/*
                 * ⚠️ THE WORDING IS STILL CONSTRAINED BY ITS OWN GUARD, and deliberately. The natural
                 * sentence here is "not a deadline, not a target, and a passed date is not overdue" —
                 * words `tests/ward-community-hub.dom.test.tsx` refuses on sight, because a screen that
                 * names a threshold in order to disclaim it has still put the word in front of a reader
                 * who will remember the word. That guard did not go away when the date itself started
                 * rendering: `expectedBackLabel` below says how long until the plan, or how long since it
                 * passed, without ever spending the word "overdue" to do it. Saying what the elapsed time
                 * IS, in either direction, carries the same meaning as naming a threshold and leaves
                 * nothing to quote back.
                 */}
                {/*
                 * ⚠️ Corrected 2026-09-01, then acted on the same day: this justified the withheld date
                 * first with a demonstration-clock defect and then with an unresolved product question.
                 * Both are closed. `ward-reanchor.ts` shifts `expectedDischargeAt` with `now` (see this
                 * file's header block), and the owner has since ruled that elapsed time should be shown.
                 * A calendar date is still never printed — see the reason below.
                 */}
                <p className={styles.footnote} data-testid="ward-community-expected-elapsed">
                  A ward&apos;s own plan, revisable whenever the ward revises it. Nothing here measures it against a
                  target. This page states how long until that date, or how long since it passed, never the calendar
                  date itself: every date in this prototype is invented, so printing one would put a synthetic day in
                  front of a reader as though it were a plan. Elapsed time is the fact a community team can act on, and
                  it reads the same whichever direction the plan sits from now.
                </p>
                {lists.expectedBack.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-expected-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>
                        No one referred to this team who is currently in a bed or has one pulled has a discharge date
                        the ward has written down.
                      </>
                    )}
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-expected-list">
                    {lists.expectedBack.map((admission) => (
                      <li
                        key={admission.id}
                        className={styles.card}
                        data-testid={`ward-community-expected-${admission.id}`}
                      >
                        <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                        <p className={styles.cardDetail}>{expectedBackLabel(admission, now)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </WardPanel>

            {/* ── List 1, moved and renamed to the owner's wording — discharged into the area ── */}
            <WardPanel
              title="Discharged into the area"
              count={`${lists.dischargedIntoTheArea.length}`}
              testId="ward-community-discharged"
            >
              <div className={styles.panelBody}>
                {/*
                 * Point 1. INSIDE the section and ABOVE the list, so it cannot be read past on the way to
                 * an empty list, and worded as a statement about the record rather than as a caveat.
                 *
                 * ⚠️ Corrected 2026-09-01: this said "not recorded anywhere in this prototype… no field
                 * for it", which was false — see point 1 in this file's header for what was measured. The
                 * field exists; nothing writes it and nothing reads it. The conclusion below is unchanged.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-follow-up-not-recorded">
                  <strong>
                    Whether follow-up has been arranged is recorded on the admission, and nothing in this prototype
                    reads it.
                  </strong>{" "}
                  The field exists and some seeded admissions carry a value, but no screen or figure reads it and no
                  action here can set one — so there is nothing this page could show and nothing it could count. So this
                  list is everyone recorded as referred to this team and discharged to the community —{" "}
                  <strong>not</strong> everyone who is missing follow-up. An empty list here means nobody referred to
                  this team has a recorded discharge to the community. It does not mean everybody is being followed up,
                  and it must never be read that way.
                </p>

                {lists.dischargedIntoTheArea.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-discharged-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>No admission referred to this team is recorded as discharged to the community.</>
                    )}
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-discharged-list">
                    {lists.dischargedIntoTheArea.map((admission) => (
                      <li
                        key={admission.id}
                        className={styles.card}
                        data-testid={`ward-community-discharged-${admission.id}`}
                      >
                        <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                        <p className={styles.cardDetail}>{departureLabel(admission, now)}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Why the row above says HOW LONG AGO somebody left rather than a date — said here as
                    well as in the expected-back section, because a reader who scrolls straight to this
                    list would otherwise wonder why no calendar date appears.

                    ⚠️ Corrected 2026-09-01, then acted on the same day. This footnote used to justify
                    withholding the date, first with a demonstration-clock defect and then with an
                    unresolved product question. Both are closed: `ward-reanchor.ts` shifts `leftAt` with
                    `now` (see this file's header block), and the owner has since ruled that elapsed time
                    should be shown. A calendar date is still never printed — see the reason below. */}
                <p className={styles.footnote} data-testid="ward-community-departure-elapsed">
                  This screen states how long ago somebody left, never the date itself: every date in this prototype is
                  invented, so a calendar date here would be a synthetic one and nothing a community team could act on.
                  Elapsed time is different — it is the fact this hub exists to surface, and it stays true whichever day
                  the demonstration clock is re-anchored to.
                </p>
              </div>
            </WardPanel>

            {/* ── Left the ward another way — the owner's order asks for this as its own numbered
                 item. The paragraph below is the same one that used to sit as a footnote inside the
                 discharged panel above, word for word: it moved panel, not wording, and "the list
                 above" in its own text is still true because the discharged list still renders above
                 this panel on the page. ─────────────────────────────────────────────────────── */}
            <WardPanel
              title="Left the ward another way"
              count={`${lists.otherDepartures.length}`}
              testId="ward-community-other-departures-panel"
            >
              <div className={styles.panelBody}>
                {/*
                 * 🔴 **THIS SENTENCE CONTRADICTED THE ONE ABOVE IT, ON EVERY TEAM BUT ONE.** The empty
                 * state says the list CANNOT BE BUILT because a bed carries no link back to the
                 * referral; this footnote then said "No other admission referred to this team has
                 * ended" — **a conclusion drawn from the very data the sentence above says cannot be
                 * assembled.** If the list cannot be built, the page cannot know that no other
                 * admission has ended, and "no other has ended" is exactly the reassuring reading the
                 * first sentence exists to prevent.
                 *
                 * ⚠️ **AND IT IS INVISIBLE FROM THE ONE TEAM WHERE IT IS CORRECT.** On Inner City
                 * Clinic the join resolves, the list builds, and "no other" legitimately means "that is
                 * all of them". The sentence is true in one arm and false in the other, **and which arm
                 * a team is in differs per team** — which is why reading one team's page proves nothing
                 * about another's, and why it took a second reader opening both.
                 *
                 * So it renders only where the list could be built. Found by Ward Builder Three.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-other-departures">
                  {cannotResolve
                    ? "Whether any other admission referred to this team has ended cannot be told from the record either, for the same reason."
                    : lists.otherDepartures.length === 0
                      ? "No other admission referred to this team has ended."
                      : `${lists.otherDepartures.length} other ${
                          lists.otherDepartures.length === 1 ? "admission" : "admissions"
                        } referred to this team ${lists.otherDepartures.length === 1 ? "has" : "have"} ended, recorded as: ${otherDepartureDestinations(lists.otherDepartures)}. None of those records says the person came back into the community, so none is on the list above.`}
                </p>
              </div>
            </WardPanel>

            {/* ── List 3, moved to the end — the one that cannot be built ──────────────────── */}
            <WardPanel title="Referrals we have made" testId="ward-community-referrals">
              <div className={styles.panelBody}>
                {/*
                 * Point 3. Rendered as a section with a statement and no list, deliberately. Leaving the
                 * section out would let a reader assume the hub had shown everything it knows; filtering
                 * community-sourced referrals by the patient's home region would produce a list that
                 * looked exactly right and was not this team's.
                 *
                 * No count in this panel's header, deliberately: a nought would read as "no referrals
                 * raised", and nothing on this page can measure that.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-referrals-unattributable">
                  <strong>Referrals RAISED BY this team cannot be attributed.</strong> A referral records that its
                  source was a community service, but the source side carries no team, so nothing says which team raised
                  one. Referrals ADDRESSED TO this team are a different matter: they now carry the team&apos;s name,
                  which is how everyone above is on this page, and listing them here is work that has not been done
                  rather than work that cannot be. No list is shown until it is the real one.
                </p>
              </div>
            </WardPanel>
          </div>

          {/* ── The rail — worth-your-attention, the page's own limits, this team, and where to go
               next. Every figure here is read from an array already computed above; nothing new is
               derived just to fill the rail. ─────────────────────────────────────────────────── */}
          <aside className={styles.rail} aria-label="Context for this team's page">
            <WardPanel title="Worth your attention" testId="ward-community-attention">
              <div className={styles.panelBody}>
                {attentionItems.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-attention-empty">
                    Nothing on this page currently stands out beyond what the lists above already show.
                  </p>
                ) : (
                  <ul className={styles.attentionList} data-testid="ward-community-attention-list">
                    {attentionItems.map((item, index) => (
                      <li key={index} className={styles.attentionItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </WardPanel>

            <WardPanel title="What this page cannot tell you" testId="ward-community-limits">
              <div className={styles.panelBody}>
                <ul className={styles.limitsList}>
                  <li>
                    <strong>Whether this list is complete.</strong> A person appears here only if their admission points
                    at a referral this page can find. {unattributable.length}{" "}
                    {unattributable.length === 1 ? "admission is" : "admissions are"} counted rather than shown, above.
                  </li>
                  <li>
                    <strong>Whether somebody is still with this team.</strong> Nothing records a team closing a person —
                    no team discharge, no episode end, no closing date. &ldquo;Admitted while already with this
                    team&rdquo; means this team had accepted them and nothing records that ending, never that they are
                    still with it.
                  </li>
                  <li>
                    <strong>Whether anyone is being followed up.</strong> The field exists and some admissions carry a
                    value, but no screen here reads it and nothing here can set one.
                  </li>
                  <li>
                    <strong>Which referrals this team raised.</strong> A referral records that its source was a
                    community service, but the source side carries no team name, so nothing says which team raised one.
                  </li>
                  <li>
                    <strong>Everyone in this area.</strong> A person appears here only because a referral named this
                    team. Anyone whose referral asked only for a bed or an emergency department, and anyone admitted
                    with no referral at all, is on no team&apos;s page anywhere. Where a person lives is not read at
                    all.
                  </li>
                  <li>
                    <strong>Any date.</strong> Every date in this prototype is invented, so this page states how long
                    ago or how long until, never the day itself.
                  </li>
                </ul>
              </div>
            </WardPanel>

            <WardPanel title="This team" testId="ward-community-facts">
              <div className={styles.panelBody}>
                <dl className={styles.factsList}>
                  <div className={styles.factsRow}>
                    <dt>Name recorded as</dt>
                    <dd>{team.name}</dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt>Suburbs naming it</dt>
                    <dd data-testid="ward-community-suburb-count">
                      {suburbsNamingTeam === undefined ? "Not derivable from the catchment table" : suburbsNamingTeam}
                    </dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt>Entries that read alike</dt>
                    <dd>{nearDuplicates.length}</dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt>Hours, contacts, staffing</dt>
                    <dd>Not held</dd>
                  </div>
                </dl>
              </div>
            </WardPanel>

            <WardPanel title="Go to" testId="ward-community-links">
              <div className={styles.panelBody}>
                <ul className={styles.linksList}>
                  <li>
                    <Link className={styles.linksItem} href="/mockups/ward-flow/community">
                      All community teams
                    </Link>
                  </li>
                  <li>
                    <Link className={styles.linksItem} href={WARD_REFERRAL_INTAKE_HREF}>
                      Raise a referral
                    </Link>
                  </li>
                  <li>
                    <Link className={styles.linksItem} href="/mockups/ward-flow/referrals">
                      Referral board
                    </Link>
                  </li>
                </ul>
              </div>
            </WardPanel>
          </aside>
        </div>

        {/*
         * Every other team, whatever the catchment source turns out to name. A builder over
         * `COMMUNITY_TEAM_PAGES` rather than a hand-written list, for the same reason that array is
         * derived: a further team must reach this navigation by appearing in the catchment source
         * and by nothing else.
         *
         * ⚠️ **THIS SWITCHER IS NOT THE WAY IN. IT IS THE WAY ACROSS — AND THERE IS NOW A WAY IN.**
         * `/mockups/ward-flow/community` (`community-index.tsx`) is the front door: it lists every
         * team a referral can name, alphabetically, links each one, and `ward-nav.ts` carries it as
         * the `community` entry so the index is itself reachable from the rail. So a reader who is
         * not already on a team page reaches any team in two clicks, and this switcher is the
         * convenience for a reader who is.
         *
         * ⚠️ **`tests/ward-nav.test.ts` STILL RECORDS NOUGHT REACHABLE INSTANCES FOR THIS ROUTE,
         * AND THAT FIGURE NO LONGER MEANS WHAT IT SAYS ON ITS FACE.** Read the entry, not the
         * number — and note that the count of the full set is deliberately not repeated here, for
         * the reason the paragraph below gives. It now records a limit of a SOURCE SCAN, not a gap in the navigation: the index
         * builds its hrefs inside a `.map()` via `communityTeamHref`, and that scan counts a built
         * site as nought concrete instances **by design**, because reading a builder as
         * reachability is the defect class the guard exists to catch. Teaching it to count this one
         * would loosen it. What the index really covers is established by rendering it and reading
         * the links back out of the markup — `tests/ward-community-index.dom.test.tsx` pins the
         * linked set against `COMMUNITY_TEAM_PAGES` exactly and goes red on a single missing team.
         *
         * ⚠️ **THIS PARAGRAPH HAS NOW BEEN WRONG IN BOTH DIRECTIONS, WHICH IS THE POINT.** Until
         * 2026-09-01 it claimed the rail already carried a worked instance of this route — the
         * shape of `board/[unitId]`'s entry in that same test, not of this one. It was corrected to
         * say the route was an orphan reachable only by typing a URL, which was true for about an
         * hour, until `/community` landed in the merge that same evening. **A sentence describing
         * an absence is a sentence with a short shelf life**, because the absence is usually
         * somebody's next task. Cite the entry and its reasoning, never the bare figure: an
         * unchanged number whose meaning inverted is the one a careless check waves through.
         *
         * ⚠️ **AND NO COUNT OF THE TEAMS IS WRITTEN HERE.** This paragraph carried two of them — a
         * count of the other teams, and a count of the pages this switcher reaches — and both were
         * residue from the region era, when membership came from `ward-teams.ts`'s
         * `COMMUNITY_TEAMS`, a `Record<HomeRegion, string>` this hub deliberately does not read.
         * The real size is a property of the extracted catchment table, so a figure typed here has
         * no guard and goes stale the moment that source changes; the retired figures are not
         * repeated even as history, because a phrase written down is a phrase that can be copied
         * back. The list renders from the derivation; the prose describes the set.
         *
         * ⚠️ **KEPT AS ONE COMMENT WITH THE NOTE BELOW, DELIBERATELY.** `tests/ward-community-corrected-
         * claims.test.ts` locates "the switcher's own comment" by walking backward from the `<nav>`
         * to the nearest comment-close and comment-open marker pair, so a second, separate comment
         * landing between this one and the element it scans for would be captured INSTEAD of this
         * one — silently shrinking the region every absence pin below is checked against. A
         * `<nav>`, not a `WardPanel` — the
         * landmark role is what makes this switcher findable by `getByRole("navigation", ...)`, and
         * `WardPanel` renders a `<section>`. `composes` borrows the primitive's own header classes
         * instead, so the chrome matches every other panel on this page exactly rather than
         * approximately.
         */}
        <nav className={styles.teamSwitcher} aria-label="Other community teams">
          <div className={styles.teamSwitcherHeader}>
            <h2 className={styles.teamSwitcherTitle}>Other community teams</h2>
          </div>
          <ul className={styles.teamList}>
            {COMMUNITY_TEAM_PAGES.filter((other) => other.id !== team.id).map((other) => (
              <li key={other.id}>
                <Link className={styles.teamLink} href={communityTeamHref(other)}>
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/*
         * ⚠️ MOVED OFF THE TOP, 2026-09-05, AT THE OWNER'S REQUEST — "multiple warnings" was his
         * words for what stood between this page's heading and its first figure. NOT ONE SENTENCE
         * WAS CUT AND NOT ONE TESTID CHANGED, so every guard that polices this copy reads it
         * exactly where it did before.
         *
         * ⚠️ AND THE ORDER INSIDE THIS BLOCK IS UNCHANGED FOR A REASON. The comment that used to
         * sit above it recorded that these are grouped "so they read as the page's safety
         * statements rather than as loose warnings scattered among the clinical panels below".
         * That grouping is preserved; only its POSITION moved. Scattering them back among the
         * panels would undo the decision this move was careful not to touch.
         *
         * ⚠️ WHAT MUST NOT MOVE HERE: the caveats attached to a specific list stay WITH that list,
         * above it. `community-screen.tsx` has always placed the follow-up notice above the
         * discharged list so it cannot be read past on the way to an empty one. These three are
         * different — they qualify the whole page rather than one list — which is the only reason
         * they can sit at the foot at all.
         */}
        <footer className={styles.aboutPage} data-testid="ward-community-about" aria-label="About this page">
          <p className={styles.aboutHeading}>About this page</p>
          {/*
           * The two governance notices, grouped as one visual cluster so they read as the page's
           * safety statements rather than as loose warnings scattered among the clinical panels below
           * — the separation the second-edition layout asks for. Each keeps its own bordered warning
           * box; only the stacking is new.
           */}
          <div className={styles.noticeGroup}>
            {/* Point 4. Above every list, never a footnote: what the name in the heading above actually is. */}
            <p className={styles.notice} data-testid="ward-community-placeholder-notice">
              <strong>This team name comes from one source document.</strong> It is a follow-up clinic named by the
              S2015 catchment table, which is what a referral in this prototype can name. It is not a roster of Western
              Australian community services, no team has agreed to be represented here, and nothing on this page
              reflects who actually provides community care.{" "}
              {/*
               * 🔴 **OWNER RULING, 2026-09-05: SAY THAT DUPLICATE SPELLINGS EXIST, AND DO NOT MERGE
               * THEM.** The refusal is the load-bearing half — normalising these names means the
               * software deciding `Midalnd` means `Midland` and silently moving a patient from one
               * team's list to another's on a guess. **A visible split a reader has been warned about
               * is safer than an invisible merge nobody has been.**
               *
               * ⚠️ **IT SITS INSIDE THE PARAGRAPH THAT ALREADY SAYS WHERE THE NAMES CAME FROM**, not
               * in a notice of its own. That paragraph is where a reader is already being told what
               * these names are, and this page carries three advisory paragraphs before any data —
               * a fourth would be the one nobody reads. Ward Builder Three's view, and I agree with it.
               *
               * ⚠️ **AND IT IS DERIVED PER TEAM, so it appears only where it is true.** A page for a
               * team with no near-duplicate says nothing, because a warning shown where there is
               * nothing to warn about teaches a reader to skip it.
               */}
              {nearDuplicates.length > 0 ? (
                <strong data-testid="ward-community-near-duplicate-warning">
                  {" "}
                  That document also spells some teams more than one way, and this is one of them: it also contains{" "}
                  {nearDuplicates.map((name, index) => (
                    <span key={name}>
                      {index > 0 ? (index === nearDuplicates.length - 1 ? " and " : ", ") : ""}
                      <span className={styles.fieldName}>{name}</span>
                    </span>
                  ))}
                  {nearDuplicates[nearDuplicates.length - 1].endsWith(".") ? "" : "."} Those are separate pages here,
                  and each reports only the people whose referral was typed its way — so somebody referred to this team
                  under another spelling is on that page and not on this one.
                </strong>
              ) : null}
            </p>

            {/*
             * 🔴 **A PERSON'S RULING, RENDERED SEPARATELY FROM THE COMPUTED RESEMBLANCE ABOVE — AND
             * THE SEPARATION IS THE SAFETY, NOT THE DECORATION.**
             *
             * The sentence in the paragraph above says two NAMES are close. That is a property of the
             * strings, computed by a rule, checkable by anybody. **This says two names are the same
             * SERVICE, which is a clinical claim about a real clinic and which no rule in this
             * repository is entitled to make.** `ICC` and `Inner City Clinic` share three letters and
             * differ in length by fourteen: no edit distance, suffix fold or word-order key reaches
             * it, and any rule loose enough to would also merge `Alma Street (Cockburn)` with
             * `Alma Street (Melville)`, which are two sites.
             *
             * ⚠️ **IT WAS RECORDED FOR HOURS AND RENDERED NOWHERE, WHICH IS WHY THIS EXISTS.** The
             * table, its guards and its mutations all landed on 2026-09-05 and no component imported
             * them — so on the `ICC` page a reader saw NOTHING, which is precisely the gap the ruling
             * was made to close. **Both halves were individually correct; the combination was silent.**
             *
             * ⚠️ **AND IT IS A FOURTH ADVISORY BLOCK, WHICH THE COMMENT ABOVE ARGUES AGAINST.** That
             * argument is right about advisories and this is not one: it appears on FOUR of sixty-five
             * pages rather than on every page, so it cannot teach a reader to skip, and it is the only
             * thing on the page carrying a named person's decision. Stated rather than quietly
             * overridden.
             *
             * **It must read on the `ICC` page too, where there is no near-duplicate sentence to sit
             * beside** — so it carries its own context and never says "unlike the spellings above".
             */}
            {sameService.length > 0 && ratifiedBy !== undefined ? (
              <p className={styles.ratifiedNotice} data-testid="ward-community-ratified-alias">
                <strong>
                  {ratifiedBy.decidedByKind === "person"
                    ? "A person has ruled that this team and "
                    : "This team has been recorded as the same service as "}
                  {sameService.map((name, index) => (
                    <span key={name}>
                      {index > 0 ? (index === sameService.length - 1 ? " and " : ", ") : ""}
                      <span className={styles.fieldName}>{name}</span>
                    </span>
                  ))}
                  {ratifiedBy.decidedByKind === "person" ? " are one service." : ", pending review."}
                </strong>{" "}
                This is a judgement about the real clinic, not an observation that the names look alike. No rule here
                could have reached it and none did. Referrals typed under each spelling are still listed on that
                spelling&apos;s own page: the decision is recorded, and nobody has been moved.
                {/*
                 * 🔴 **TWO SENTENCES, BECAUSE ONE OF THEM WOULD BE A FABRICATED CLINICAL SIGNATURE.**
                 * Until 2026-09-06 every row here was the owner's, so this block could hard-code
                 * *"A person has ruled…"* and *"after being shown each spelling and the suburbs it
                 * routes"* and both were simply true. **The first agent-decided rows made both false
                 * without changing a character of this file** — the page would have told a clinician
                 * a named human signed a merge nobody had seen. The wording now switches on
                 * `decidedByKind`, which is a required field precisely so a new row cannot arrive
                 * claiming a signature by saying nothing.
                 *
                 * ⚠️ **THE AGENT SENTENCE NAMES ITS OWN LIMIT RATHER THAN SOFTENING IT.** "Recorded"
                 * not "ruled", "pending review" in the headline where a reader cannot miss it, and
                 * the provenance line says in terms that no person has seen the figures. A hedge
                 * that reads as confidence is worse than no hedge.
                 */}
                <span className={styles.ratifiedProvenance} data-testid="ward-community-ratified-provenance">
                  {ratifiedBy.decidedByKind === "person" ? (
                    <>
                      Decided by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}, after being shown each spelling and
                      the suburbs it routes.
                    </>
                  ) : (
                    <>
                      Recorded by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}. No person has seen these spellings
                      or the suburbs they route, and this entry is waiting to be reviewed. Treat it as a working note,
                      not as a decision anyone has signed.
                    </>
                  )}
                </span>
              </p>
            ) : null}

            {/*
             * Point 2 — the most important sentence on the page after the follow-up wording, and the
             * reason it is rendered whether the count is nought or not. A line that vanishes at nought
             * is a safety statement nobody ever sees.
             */}
            <p className={styles.notice} data-testid="ward-community-unattributable">
              <strong>
                {unattributable.length}{" "}
                {unattributable.length === 1
                  ? "admission is on no community team's page"
                  : "admissions are on no community team's page"}
                .
              </strong>{" "}
              A person appears here only because a referral NAMED this team. Anyone whose referral asked only for a bed
              or an emergency department, and anyone admitted with no referral at all, is on no team&apos;s page
              anywhere — not this one, and not any other. Expect that to be most of the ward: naming a community team is
              something a referrer does rarely and deliberately.{" "}
              <strong>
                This page shows everyone this prototype could match to this team — the people whose admission points at
                a referral it can find, and that names {team.name}. It is not a picture of an area, and it is not a
                complete picture of everyone referred here: an admission whose referral cannot be found is counted in
                the number above and appears on no team&apos;s page.
              </strong>
            </p>
          </div>

          {/*
           * How a person is associated with this team, said once, near the top, because every list
           * below depends on it and none of them is meaningful without it. Quieter than the two
           * notices above — it qualifies the lists rather than disclaiming a claim — so it stays
           * outside the warning cluster.
           */}
          <p className={styles.provenance} data-testid="ward-community-association">
            Everyone below is here because a referral named {team.name} as a destination.{" "}
            <strong>
              Anyone whose admission points at a referral this page cannot find is missing from every list below.
            </strong>{" "}
            That is the same silence as having no referral at all — the person is on no team&apos;s page anywhere, and
            is counted in the figure above rather than shown here. Where the person lives is not read at all. The owner
            ruled on 2026-08-31 that association comes from the team written on the referral and that home region is
            only a geographic guess; before that ruling this page was keyed on region, and it said so. A destination
            that was later declined or cancelled still counts here — a decline locks nobody out, and hiding those people
            would remove from this page exactly the referrals that went wrong.{" "}
            <strong>
              {waitlistedForTeam.length}{" "}
              {waitlistedForTeam.length === 1
                ? "admission is matched to this team and still waitlisted"
                : "admissions are matched to this team and still waitlisted"}
              .
            </strong>{" "}
            A bed has not yet been pulled for {waitlistedForTeam.length === 1 ? "that person" : "those people"}, so they
            appear in neither list below: not the currently-admitted list, which only holds a pulled or occupied bed,
            and not the count of admissions this hub cannot place with any team, because a waitlisted match is still a
            match.
          </p>
        </footer>
      </main>
    </div>
  );
}

/**
 * The href for a team page. One place, so the route and the links into it are one fact — the same
 * reasoning `WARD_REFERRAL_INTAKE_HREF` records for the intake form.
 */
export function communityTeamHref(team: CommunityTeam): string {
  return `/mockups/ward-flow/community/${team.id}`;
}

/**
 * The ward's own name, from the units the provider holds. Never a literal: a hospital name typed
 * into a screen is a second home for a fact the data layer owns, which
 * `tests/ward-flow-data-boundary.test.ts` exists to refuse.
 *
 * An id the unit list does not carry renders as the id rather than as a blank or a guess.
 */
function unitName(unitId: string, units: readonly Unit[]): string {
  return units.find((unit) => unit.id === unitId)?.name ?? unitId;
}

/**
 * Which of the two bed states this is, said out loud on every row — and, for an occupied bed, a
 * third fact this function used to miss entirely.
 *
 * `bedIsOccupied` is true for `"pulled"` as well as `"occupied"` — correctly, because the ward has
 * given the bed away — but a person whose bed is pulled may still be in an emergency department. A
 * row that read the same for both would tell a community team somebody is on a ward when they are
 * not.
 *
 * ⚠️ **THAT PARAGRAPH USED TO STOP THERE AND CLAIM A COMPLETENESS IT DID NOT HAVE.** It named only
 * the pulled-but-not-arrived case as the one this function exists to distinguish, and missed the
 * mirror case the model actually records for an OCCUPIED bed: `Admission.awayAtEmergencyDepartmentSince`
 * is a real, non-null-able field, and `ward-admissions.ts` (around `:408`) is explicit that the bed
 * STAYS occupied while it is set — "It is a fact about the PERSON, which is why it is a field and
 * not a state." The seed creates admissions with it set (`ward-admissions-seed.ts`, around `:426`)
 * and the reducer writes it at runtime, but until now this function never read it, so "In the bed"
 * rendered identically for somebody on the ward and somebody who has been sent to an emergency
 * department — the exact confusion the doc comment above claimed to have already prevented.
 */
function bedStateLabel(admission: Admission): string {
  if (admission.state !== "occupied") return "A bed is pulled — not yet arrived";
  if (admission.awayAtEmergencyDepartmentSince !== null) return "In the bed — currently at an emergency department";
  return "In the bed";
}

/**
 * How long this person has been in this bed, in whole days, via `daysInBed` — the one place this
 * project computes a stay, counted from `arrivedAt` and never from `pulledAt`. `null` is stated
 * rather than substituted: somebody whose bed is pulled has not arrived, and "0 days" would read as
 * "arrived this morning".
 */
function stayLabel(admission: Admission, now: Instant): string {
  const days = daysInBed(admission, now);
  if (days === null) return "Not yet arrived, so no length of stay";
  if (days === 0) return "In this bed under a day";
  return `In this bed ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * ⚠️ **BOTH FUNCTIONS BELOW NOW RENDER A DURATION, NOT AN INSTANT — A NEW OWNER RULING, NOT A
 * REVERSAL OF THE FINDING BELOW.** The demonstration-clock defect this block used to describe is
 * still closed exactly as stated: `WardFlowProvider` re-anchors the seeded state onto the hour the
 * demonstration opens by walking `INSTANT_FIELDS` (`ward-reanchor.ts`) and shifting every field it
 * names, and `INSTANT_FIELDS` names `pulledAt`, `awayAtEmergencyDepartmentSince`,
 * `expectedDischargeAt`, `dischargeDateSetAt`, `dischargeConfirmedAt`, `leftAt` and the nested
 * `recordedAt` — landed by `44ca08839` ("the demo clock was leaving six admission timestamps
 * behind"), reaching this branch through the merge `aeff0635b`. `tests/ward-reanchor.test.ts`
 * derives its expectation from BOTH `ward-model.ts` and `ward-admissions.ts` — see its `MODEL_FILES`
 * — so `now` and these dates are on ONE clock and `now - field` is sound.
 *
 * **What changed on 2026-09-01 is the question that clock defect used to gate.** Once a duration can
 * be computed soundly, the owner ruled it should be SHOWN — as elapsed time, never a calendar date.
 * A printed expected-discharge day or departure time would still be a synthetic figure rendered to a
 * community team as though it were a plan, because every date in this fixture is invented; "left 5
 * weeks ago" carries no such claim, cannot be mistaken for a real record of a real person, and stays
 * correct as the demonstration clock moves with nobody maintaining it. See this file's header block
 * for the full ruling and `community-elapsed.ts` for the one rounding rule both fields use.
 *
 * ⚠️ **THE TWO FIELDS ARE NOT THE SAME SHAPE, AND THAT IS THE TRAP HERE.** `leftAt` is set only once
 * a departure has actually happened, so `departureLabel` has exactly one direction to say. But
 * `expectedDischargeAt` is "a ward's own plan, revisable at will" (see the field's own comment in
 * `ward-admissions.ts`) and can be past OR future — `isPastExpectedDischarge` exists precisely
 * because a person can be overdue. A single past-tense renderer applied to both would print "left −3
 * days ago" for someone not yet due, which is nonsense, and would silently hide the one direction on
 * this screen that is clinically interesting: a plan that has already passed. `expectedBackLabel`
 * therefore branches on the sign of `now - expectedDischargeAt` and says "in N days/weeks" for a plan
 * still ahead, "N days/weeks ago" for one that has passed, and never spends the word "overdue" doing
 * it — that word names a followed-up-contact threshold this screen still does not have (see the "NO
 * THRESHOLD" paragraph in the file header, which this change does not touch).
 */
function expectedBackLabel(admission: Admission, now: Instant): string {
  // `null` cannot reach here — `expectedBack` filters it out — and is still stated rather than
  // substituted, because a fallback string is the one shape that could put an unrecorded plan on
  // this screen if that ever changed. Non-finite is degraded the same conservative way
  // `isPastExpectedDischarge` treats it — as no sound answer, never a guessed one.
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected) || !Number.isFinite(now)) {
    return "No discharge date recorded";
  }
  if (now > expected) {
    const days = daysBetween(expected, now);
    return days === 0
      ? "Expected discharge was earlier today"
      : `Expected discharge was ${elapsedDaysPhrase(days)} ago`;
  }
  if (now < expected) {
    const days = daysBetween(now, expected);
    return days === 0 ? "Expected discharge is later today" : `Expected discharge in ${elapsedDaysPhrase(days)}`;
  }
  return "Expected discharge is today";
}

/**
 * How long ago this admission ended, never the date it ended on. See the block above for why a
 * duration and not a date. `leftAt` is always in the past in practice (set only once a departure has
 * actually happened), so unlike `expectedBackLabel` there is exactly one direction to say — but a
 * negative or non-finite instant is still degraded to the absence wording rather than trusted, the
 * same conservative floor `daysInBed` holds for an incoherent arrival. `null` — nobody recorded a
 * departure instant — is still a distinct thing to say, and this exact wording is unchanged: an
 * absence is not a duration of zero.
 */
function departureLabel(admission: Admission, now: Instant): string {
  const leftAt = admission.leftAt;
  if (leftAt === null || !Number.isFinite(leftAt) || !Number.isFinite(now)) {
    return "Left this ward; the departure time was not recorded";
  }
  const days = Math.max(daysBetween(leftAt, now), 0);
  return days === 0 ? "Left this ward earlier today" : `Left this ward ${elapsedDaysPhrase(days)} ago`;
}

/**
 * The recorded destinations of the departures that are NOT on list 1, as a de-duplicated sentence
 * fragment in the vocabulary's own words. Derived from the same array whose length is printed
 * beside it, so the number and the words cannot describe different sets.
 */
function otherDepartureDestinations(departures: readonly Admission[]): string {
  const labels = [
    ...new Set(
      departures.map((admission) => leavingDestinationLabel(admission.leavingDestination) ?? "no destination recorded"),
    ),
  ];
  return labels.join("; ");
}

/**
 * Display labels only — never the picker's own option set. Duplicated from
 * `referral-intake.tsx`'s own (unexported) `SOURCE_LABELS`, the third time this repository has
 * made that trade rather than export a form-picker's private map for a read-only screen to import;
 * `community-vocabulary.ts`'s own near-identical duplication note records the same reasoning. A
 * source missing from this map still renders, as its own raw value, via the `??` fallback below.
 */
const REFERRAL_SOURCE_LABELS: Record<Referral["source"], string> = {
  community: "Community",
  crisis_service: "Crisis service",
  police: "Police",
  ambulance: "Ambulance",
  inter_hospital: "Inter-hospital",
};

/**
 * Where a referral says it came from, in words a coordinator reading this queue can act on: the
 * channel (`REFERRAL_SOURCE_LABELS`) and, where the record names one, the originating site
 * (`siteByCode`) — never a literal hospital name, which would be a second home for a fact
 * `wardSites` already owns. An unresolvable site code renders as the code itself rather than a
 * blank or a guess, the same discipline `unitName` holds a few functions above.
 */
function referralOriginLabel(referral: Referral): string {
  const channel = REFERRAL_SOURCE_LABELS[referral.source] ?? referral.source;
  const site = siteByCode(referral.originSiteCode);
  return site ? `${channel} · ${site.name}` : `${channel} · site ${referral.originSiteCode}`;
}

/**
 * The one addressing on `referral` that names `team` — the same match `admissionBelongsToTeam`
 * makes for an admission, read here for the referral itself rather than for who it eventually
 * admitted. `undefined` when this referral never named this team at all.
 */
function communityAddressingFor(referral: Referral, team: CommunityTeam): ReferralAddressing | undefined {
  return referral.destinations.find(
    (addressing) => addressing.destination.kind === "community_team" && addressing.destination.teamName === team.name,
  );
}

/**
 * Referrals naming `team` whose addressing to it is still `"queued"` — the team's own unanswered
 * queue. `FD-24` means a referral can be queued here while another destination has already decided
 * something else entirely; that is exactly why this reads the ADDRESSING's own state, never
 * `referralState(referral)`, which would read the referral's overall (and irrelevant) outcome.
 */
function referralsWaitingOnTeam(referrals: readonly Referral[], team: CommunityTeam): Referral[] {
  return referrals.filter((referral) => communityAddressingFor(referral, team)?.state === "queued");
}

/**
 * ⚠️ **THE MOST DELICATE DERIVATION ON THIS SCREEN, AND WHY EACH BRANCH IS WORDED AS IT IS.**
 *
 * `ReferralAddressing` carries `state: "accepted"` and `decidedAt` — WHEN this team said yes.
 * `Admission` carries `arrivedAt` — when the bed began. Comparing the two is real and derivable;
 * nothing else about "is this person still with the team" is. `ward-model.ts` holds no team
 * discharge, no episode end and no closing date for a community addressing — checked, not assumed
 * — so this function can only ever say what this team ACCEPTED and WHEN, never who is currently
 * under its care.
 *
 * Three outcomes, and they are the only three `lists.currentlyAdmitted` can produce:
 *
 *   - `"bed-pulled-not-arrived"` — `arrivedAt` is `null`. There is no admission START to compare an
 *     acceptance against, so this admission can be neither of the other two. A person here may
 *     still be in an emergency department; the bed has simply been given away.
 *   - `"accepted-before-admission"` — this team accepted, with a recorded `decidedAt`, strictly
 *     before `arrivedAt`. This is the group the owner asked for: admitted while ALREADY accepted.
 *   - `"referred-during-admission"` — everything else: no accepted addressing to this team at all,
 *     or one accepted at or after `arrivedAt`. A referral raised during the bed necessarily decides
 *     no earlier than it was raised, so it can never land in the branch above by construction —
 *     this is the ward reaching out, not a relapse under this team's care, and the two must never
 *     be merged.
 */
export type AcceptedBeforeAdmission = {
  readonly kind: "accepted-before-admission";
  readonly admission: Admission;
  readonly acceptedAt: Instant;
  /** Never null here — narrowed once, at the point this variant is built, so every reader of this
   *  type gets the real instant rather than re-deriving "this branch means arrivedAt exists". */
  readonly arrivedAt: Instant;
  /** Minutes from acceptance to the bed beginning — always positive by construction. Kept as raw
   *  minutes (not a day count) so sorting and "shortest gap" comparisons stay exact; every rendered
   *  duration is still derived from `acceptedAt`/`arrivedAt` through `daysBetween`, never from this
   *  field directly. */
  readonly gapMinutes: number;
};
type TeamAdmissionCategory =
  | AcceptedBeforeAdmission
  | { readonly kind: "referred-during-admission"; readonly admission: Admission }
  | { readonly kind: "bed-pulled-not-arrived"; readonly admission: Admission };

function categoriseTeamAdmission(
  admission: Admission,
  team: CommunityTeam,
  referrals: readonly Referral[],
  now: Instant,
): TeamAdmissionCategory {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) {
    return { kind: "bed-pulled-not-arrived", admission };
  }
  const referral =
    admission.referralId === null ? undefined : referrals.find((candidate) => candidate.id === admission.referralId);
  const addressing = referral ? communityAddressingFor(referral, team) : undefined;
  if (addressing && addressing.state === "accepted" && addressing.decidedAt !== undefined) {
    const decidedAt = addressing.decidedAt;
    if (Number.isFinite(decidedAt) && decidedAt < arrivedAt) {
      return {
        kind: "accepted-before-admission",
        admission,
        acceptedAt: decidedAt,
        arrivedAt,
        gapMinutes: arrivedAt - decidedAt,
      };
    }
  }
  return { kind: "referred-during-admission", admission };
}

/** A whole-day elapsed phrase, except that zero (or negative, or non-finite) whole days reads as
 *  "under a day" rather than "0 days" — `elapsedDaysPhrase` itself refuses a count below 1, so this
 *  is the one place on this screen that decides the same-day case its caller must decide. */
function elapsedSinceOrUnderADay(days: number): string {
  return Number.isFinite(days) && days > 0 ? elapsedDaysPhrase(days) : "under a day";
}
