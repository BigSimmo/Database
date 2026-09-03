"use client";

import Link from "next/link";

import {
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityTeamById,
  COMMUNITY_TEAM_PAGES,
  leavingDestinationLabel,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { elapsedDaysPhrase } from "@/components/ward-management/community/community-elapsed";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { daysBetween, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Referral, Unit } from "@/components/ward-management/ward-model";

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

  return (
    <div className={styles.screen} data-testid="ward-community-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-community-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This hub is <strong>not a medical device</strong>. Every patient, bed and date in it is invented, and
            nothing here has been checked against a real service.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>{team.name}</h1>
          <p className={styles.pageSubtitle}>
            Everyone referred to this team, and where they are in the bed-flow circle.
          </p>
        </header>

        {/* Point 4. Above every list, never a footnote: what the name in the heading above actually is. */}
        <p className={styles.notice} data-testid="ward-community-placeholder-notice">
          <strong>This team name comes from one source document.</strong> It is a follow-up clinic named by the S2015
          catchment table, which is what a referral in this prototype can name. It is not a roster of Western Australian
          community services, no team has agreed to be represented here, and nothing on this page reflects who actually
          provides community care.
        </p>

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
          A person appears here only because a referral NAMED this team. Anyone whose referral asked only for a bed or
          an emergency department, and anyone admitted with no referral at all, is on no team&apos;s page anywhere — not
          this one, and not any other. Expect that to be most of the ward: naming a community team is something a
          referrer does rarely and deliberately.{" "}
          <strong>
            This page shows everyone this prototype could match to this team — the people whose admission points at a
            referral it can find, and that names {team.name}. It is not a picture of an area, and it is not a complete
            picture of everyone referred here: an admission whose referral cannot be found is counted in the number
            above and appears on no team&apos;s page.
          </strong>
        </p>

        {/*
         * How a person is associated with this team, said once, near the top, because every list
         * below depends on it and none of them is meaningful without it.
         */}
        <p className={styles.provenance} data-testid="ward-community-association">
          Everyone below is here because a referral named {team.name} as a destination.{" "}
          <strong>
            Anyone whose admission points at a referral this page cannot find is missing from every list below.
          </strong>{" "}
          That is the same silence as having no referral at all — the person is on no team&apos;s page anywhere, and is
          counted in the figure above rather than shown here. Where the person lives is not read at all. The owner ruled
          on 2026-08-31 that association comes from the team written on the referral and that home region is only a
          geographic guess; before that ruling this page was keyed on region, and it said so. A destination that was
          later declined or cancelled still counts here — a decline locks nobody out, and hiding those people would
          remove from this page exactly the referrals that went wrong.
        </p>

        {/* ── List 1 ─────────────────────────────────────────────────────────────────────── */}
        <section className={styles.section} data-testid="ward-community-discharged">
          <h2 className={styles.sectionHeading}>Discharged to the community</h2>

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
              Whether follow-up has been arranged is recorded on the admission, and nothing in this prototype reads it.
            </strong>{" "}
            The field exists and some seeded admissions carry a value, but no screen or figure reads it and no action
            here can set one — so there is nothing this page could show and nothing it could count. So this list is
            everyone recorded as referred to this team and discharged to the community — <strong>not</strong> everyone
            who is missing follow-up. An empty list here means nobody referred to this team has a recorded discharge to
            the community. It does not mean everybody is being followed up, and it must never be read that way.
          </p>

          {lists.dischargedIntoTheArea.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-community-discharged-empty">
              No admission referred to this team is recorded as discharged to the community.
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
            Elapsed time is different — it is the fact this hub exists to surface, and it stays true whichever day the
            demonstration clock is re-anchored to.
          </p>

          {/*
           * The remainder, so that a short list above is visibly a consequence of what the record
           * says rather than of what this screen chose to look at. Counted from the same array it
           * describes.
           */}
          <p className={styles.footnote} data-testid="ward-community-other-departures">
            {lists.otherDepartures.length === 0
              ? "No other admission referred to this team has ended."
              : `${lists.otherDepartures.length} other ${
                  lists.otherDepartures.length === 1 ? "admission" : "admissions"
                } referred to this team ${lists.otherDepartures.length === 1 ? "has" : "have"} ended, recorded as: ${otherDepartureDestinations(lists.otherDepartures)}. None of those records says the person came back into the community, so none is on the list above.`}
          </p>
        </section>

        {/* ── List 2 ─────────────────────────────────────────────────────────────────────── */}
        <section className={styles.section} data-testid="ward-community-admitted">
          <h2 className={styles.sectionHeading}>Our patients, currently admitted</h2>
          <p className={styles.count} data-testid="ward-community-admitted-count">
            {lists.currentlyAdmitted.length}{" "}
            {lists.currentlyAdmitted.length === 1
              ? "person referred to this team is"
              : "people referred to this team are"}{" "}
            in a bed or have one pulled for them.
          </p>
          {lists.currentlyAdmitted.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-community-admitted-empty">
              Nobody referred to this team is currently in a bed.
            </p>
          ) : (
            <ul className={styles.cardList} data-testid="ward-community-admitted-list">
              {lists.currentlyAdmitted.map((admission) => (
                <li key={admission.id} className={styles.card} data-testid={`ward-community-admitted-${admission.id}`}>
                  <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                  <p className={styles.cardDetail}>{bedStateLabel(admission)}</p>
                  <p className={styles.cardDetail}>{stayLabel(admission, now)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── List 3 — the one that cannot be built ───────────────────────────────────────── */}
        <section className={styles.section} data-testid="ward-community-referrals">
          <h2 className={styles.sectionHeading}>Referrals we have made</h2>
          {/*
           * Point 3. Rendered as a section with a statement and no list, deliberately. Leaving the
           * section out would let a reader assume the hub had shown everything it knows; filtering
           * community-sourced referrals by the patient's home region would produce a list that
           * looked exactly right and was not this team's.
           */}
          <p className={styles.absenceNotice} data-testid="ward-community-referrals-unattributable">
            <strong>Referrals RAISED BY this team cannot be attributed.</strong> A referral records that its source was
            a community service, but the source side carries no team, so nothing says which team raised one. Referrals
            ADDRESSED TO this team are a different matter: they now carry the team&apos;s name, which is how everyone
            above is on this page, and listing them here is work that has not been done rather than work that cannot be.
            No list is shown until it is the real one.
          </p>
        </section>

        {/* ── List 4 ─────────────────────────────────────────────────────────────────────── */}
        <section className={styles.section} data-testid="ward-community-expected">
          <h2 className={styles.sectionHeading}>Expected back</h2>
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
            A ward&apos;s own plan, revisable whenever the ward revises it. Nothing here measures it against a target.
            This page states how long until that date, or how long since it passed, never the calendar date itself:
            every date in this prototype is invented, so printing one would put a synthetic day in front of a reader as
            though it were a plan. Elapsed time is the fact a community team can act on, and it reads the same whichever
            direction the plan sits from now.
          </p>
          {lists.expectedBack.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-community-expected-empty">
              No ward has written down a discharge date for anybody referred to this team.
            </p>
          ) : (
            <ul className={styles.cardList} data-testid="ward-community-expected-list">
              {lists.expectedBack.map((admission) => (
                <li key={admission.id} className={styles.card} data-testid={`ward-community-expected-${admission.id}`}>
                  <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                  <p className={styles.cardDetail}>{expectedBackLabel(admission, now)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

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
         */}
        <nav className={styles.teamSwitcher} aria-label="Other community teams">
          <h2 className={styles.sectionHeading}>Other community teams</h2>
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
 * Which of the two bed states this is, said out loud on every row.
 *
 * `bedIsOccupied` is true for `"pulled"` as well as `"occupied"` — correctly, because the ward has
 * given the bed away — but a person whose bed is pulled may still be in an emergency department. A
 * row that read the same for both would tell a community team somebody is on a ward when they are
 * not.
 */
function bedStateLabel(admission: Admission): string {
  return admission.state === "occupied" ? "In the bed" : "A bed is pulled — not yet arrived";
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
