"use client";

import Link from "next/link";

import {
  bedsBeingPrepared,
  blockedDischargesByReason,
  declinesByReason,
  pullToArrival,
  referralToBedJoin,
  refusedAndNothingPending,
} from "@/components/ward-management/statistics/statistics-derivations";
import {
  CoordinatorAccessDisclaimer,
  SyntheticFiguresDisclaimer,
} from "@/components/ward-management/statistics/statistics-disclaimers";
import { STATISTICS_SECTIONS } from "@/components/ward-management/statistics/statistics-sections";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, Movement, Referral } from "@/components/ward-management/ward-model";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";

import styles from "./statistics.module.css";

/**
 * THE COORDINATOR STATISTICS SCREEN — how the system is performing, and what is happening to
 * patients, kept apart because they are two different questions asked by two different people.
 *
 * ⚠️ **THIS PAGE IS ALSO THE HUB.** Above the figures it indexes the statistics sections, reading
 * every label, description and href from `statistics-sections.ts` and typing none of them here.
 * Before that index existed the section pages were reachable only by knowing their addresses. The
 * index adds navigation and nothing else: no count, no badge, no number of any kind — see the block
 * comment on it below for why a self-counting index would be unsafe on this particular page.
 *
 * ⚠️ **THIS IS THE SURFACE WHERE A WRONG NUMBER WOULD BE BELIEVED HARDEST AND QUESTIONED LEAST.**
 * Everywhere else in this prototype a figure sits beside the record it came from, and a reader who
 * doubts it can look. Here the figures ARE the page. A number that is merely plausible is worse
 * than a blank, because nobody re-checks a number that renders. So:
 *
 *   1. **Every figure on this page is computed from provider state on every render**, by
 *      `statistics-derivations.ts`. Nothing is stored, cached, seeded as a display value, or
 *      carried in this file's own state.
 *   2. **A count of zero renders AS A ZERO.** "No bed is being prepared" and "bed preparation
 *      cannot be timed" are completely different statements and this page never blurs them: a
 *      measured count keeps its own element and its own wording whatever its value, and an
 *      unmeasurable figure never renders a numeral at all. That distinction is in the markup, not
 *      only in the prose — see the `measuredCount` / `absence` treatments below.
 *   3. **An empty state says WHY, mechanically.** "Not yet collected" would be useless and would
 *      invite somebody to fill the gap later with a plausible number. Each absence below names the
 *      field, says what the record actually holds, and says where the fix would have to be made.
 *
 * ⚠️ **THE TWO SECTIONS ARE NOT A LAYOUT CHOICE.** The owner named the two audiences separately: a
 * policy maker, a state government or a ward coordinator asks *how is the system performing*; a
 * clinician asks *what is happening to patients*. Four equivalent tiles in a row would answer
 * neither question, because the reader would not know which of them was theirs. Each section says
 * whose question it answers, in its own words, above its figures.
 *
 * ⚠️ **NOTHING HERE IS A TARGET, A THRESHOLD OR A RANKING.** No figure changes colour with its
 * value, no ward is compared with another, and no number is called good or bad. A benchmark
 * invented on this page would carry more authority than one invented anywhere else in the
 * prototype.
 *
 * ⚠️ **ONE STATISTIC THE OWNER ASKED FOR IS DELIBERATELY ABSENT: declines per ward.** It is not
 * omitted because it does not matter — it is the headline system question — and it is not omitted
 * because the data is missing. It is omitted because the model holds declines in two different
 * places that mean two different things, and only one of them can name a ward:
 * `ReferralAddressing` records a decline against a destination KIND plus its bed criteria (`sex`,
 * `secureBedNeeded`, `involuntaryBedNeeded`); its only unit field is `acceptedUnitId`, set solely
 * when a ward ACCEPTS, so an acceptance names a ward and a decline cannot — while
 * `Movement.declines` records `{ unitId, at, reason }` for a patient already inside a department.
 * (The clause here and on the page read "carries no unit at all" until 2026-09-01. It was false —
 * `acceptedUnitId` is on the record — and the conclusion it supported was right, which is the
 * combination nothing catches: a wrong stated reason with every test green.) Choosing between
 * them decides what the published number MEANS, and that is the product owner's decision rather
 * than an implementer's. It is handed back rather than guessed.
 *
 * ⚠️ **AND THE PAGE SAYS SO, which this comment alone did not.** Until 2026-09-01 the refusal was
 * argued only here and there was simply nothing on screen where the owner's first-named statistic
 * should be. That silence was the one asymmetry a reader could not detect: `Movement.declines` is
 * seeded non-empty, so a coordinator who knows this prototype records declines and finds no decline
 * figure cannot tell "withheld pending a ruling" from "not recorded" from "nobody declined". The
 * `ward-statistics-declines` block below is that sentence. Saying it invents no number, which is
 * exactly why it is safe to say and unsafe to leave out.
 *
 * The four optional props exist only so a test can render populations the seed cannot produce.
 * They fall back to live state, following `CommunityScreen`'s own shape and its reasoning: a ROUTE
 * must never pass any of them, because a route that did would pin this screen to a fixture and
 * quietly override the live world.
 *
 * ⚠️ **`units` AND `now` ARE READ FROM LIVE STATE ONLY, AND ARE DELIBERATELY NOT PROPS.** Neither
 * changes any figure on this page. `handoverSnapshot` requires both for its own other sections;
 * the count this page takes from it is scoped by `isOpen` — which reads `closure` and `stage` and
 * no clock — and decided by two array lengths. Adding a seam nothing behind it can move would
 * suggest to a later reader that the figure moves with the clock, which is the sort of wrong
 * impression this page exists to avoid.
 */
export function StatisticsScreen({
  admissions,
  referrals,
  bedReleases,
  movements,
}: {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
} = {}) {
  const {
    admissions: liveAdmissions,
    referrals: liveReferrals,
    bedReleases: liveBedReleases,
    movements: liveMovements,
    units,
    now,
  } = useWardFlow();

  const sourceAdmissions = admissions ?? liveAdmissions;
  const sourceReferrals = referrals ?? liveReferrals;
  const sourceBedReleases = bedReleases ?? liveBedReleases;
  const sourceMovements = movements ?? liveMovements;

  const arrivals = pullToArrival(sourceAdmissions);
  const join = referralToBedJoin(sourceAdmissions, sourceReferrals);
  const preparingCount = bedsBeingPrepared(sourceBedReleases);
  const refused = refusedAndNothingPending(sourceMovements, units, now);
  const declines = declinesByReason(sourceMovements);
  const blocked = blockedDischargesByReason(sourceAdmissions);

  return (
    <div className={styles.screen} data-testid="ward-statistics-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-statistics-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            <SyntheticFiguresDisclaimer />
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Statistics</h1>
          <p className={styles.pageSubtitle}>
            What this prototype can and cannot count about the flow of people through beds.
          </p>
        </header>

        {/* The access claim and the fact that nothing enforces it, at the top and before any figure.
            The sentence is shared with the four section pages; the reason it reads the way it does —
            including why it no longer names figures specifically — is in `statistics-disclaimers.tsx`. */}
        <p className={styles.notice} data-testid="ward-statistics-access">
          <CoordinatorAccessDisclaimer />
        </p>

        {/*
         * ── THE HUB INDEX ───────────────────────────────────────────────────────────────────
         *
         * ⚠️ **EVERY WORD OF EVERY ENTRY COMES FROM `STATISTICS_SECTIONS`, AND NONE OF IT IS TYPED
         * HERE.** A section name written into this file is a second copy of a fact the section list
         * already holds, and the failure it produces is silent: the hub promises "Across all
         * services" and the page it opens is headed something else, with nothing red anywhere.
         * `tests/ward-statistics.dom.test.tsx` compares the rendered entries against the module as
         * whole lists, so a section added to the module and not to this page fails here rather than
         * being quietly missed.
         *
         * ⚠️ **NO COUNT, NO BADGE, NO NUMBER OF ANY KIND.** Not "3 sections", not a per-section item
         * count. This page's whole safety property is that it withholds figures it cannot support
         * and says so; an index that counted itself would invite a reader to take every number on
         * the page as measured. The index is navigation and nothing else.
         *
         * ⚠️ **THE HREF IS RENDERED EXACTLY AS THE MODULE GIVES IT, FRAGMENT AND ALL.** One of the
         * three sections is served by two dynamic per-unit routes and so has no page of its own; the
         * module points it at the unit chooser on the comparisons page via a fragment. Dropping that
         * fragment lands the reader at the top of a page that opens with two sections about why no
         * comparison exists, with the list they wanted below the fold — a defect fix round 1 found in
         * four other places. Nothing here rewrites, trims or rebuilds an href.
         *
         * ⚠️ **THE FIGURES BELOW DO NOT MOVE.** The index sits above them; it does not replace them
         * and no figure is migrated into a section page. That is a content migration and it is out
         * of scope by a recorded ruling.
         */}
        <nav
          className={styles.index}
          aria-labelledby="ward-statistics-index-heading"
          data-testid="ward-statistics-index"
        >
          <h2 id="ward-statistics-index-heading" className={styles.indexHeading}>
            Where to look
          </h2>
          {/* Written so it stays true whatever the section list becomes: it names no section, no
              position and no destination, and says only what an entry does. A sentence naming "the
              third one" would be wrong the day a fourth is added, and nothing would fail. */}
          <p className={styles.indexIntro}>
            Each entry opens that section. Where a section has no page of its own, its entry opens the chooser the
            section is reached from instead — nothing here is a link to a page that does not exist.
          </p>
          <ul className={styles.indexList}>
            {STATISTICS_SECTIONS.map((section) => (
              <li key={section.id} className={styles.indexItem}>
                <Link
                  href={section.href}
                  className={styles.indexLink}
                  data-testid={`ward-statistics-index-entry-${section.id}`}
                >
                  <span className={styles.indexLabel}>{section.label}</span>
                  <span className={styles.indexDescription}>{section.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Audience 1 ─────────────────────────────────────────────────────────────────── */}
        <WardPanel title="How the system is performing" testId="ward-statistics-system">
          <div className={styles.panelBody}>
            <p className={styles.sectionAudience} data-testid="ward-statistics-system-audience">
              The question a policy maker, a state government or a ward coordinator asks. These figures are about the
              network and about wards. None of them is about a person.
            </p>

            <article className={styles.figure} data-testid="ward-statistics-bed-readiness">
              {/*
                ⚠️ **"BEING MADE READY" HAD TO GO, AND IT IS THE RULING BEING EXECUTED RATHER THAN
                AMENDED.** The owner ruled on 2026-09-04 that "Ready" names ONE number: the beds a
                coordinator can put somebody in, `min(allocatable, empty)`. This figure counts beds
                being CLEANED — beds nobody can be put in yet, close to the opposite — and it wore a
                near-identical phrase. As every other screen adopted "Ready", this one would have read
                more and more like the same word for the same thing.

                **The ruled word is untouched; the smaller surface moved.** This phrase was never
                ruled on and was already a description rather than a label, so "cleaned" says what
                `bedsBeingPrepared()` actually counts and claims nothing further. Deliberately not
                anything more interesting than that.
              */}
              <h3 className={styles.figureHeading}>Beds being cleaned</h3>

              <p className={styles.measuredCount} data-testid="ward-statistics-preparing-count">
                <span className={styles.measuredValue}>{preparingCount}</span>{" "}
                {preparingCount === 1 ? "bed is" : "beds are"} currently marked as being cleaned.
              </p>
              {/*
               * ⚠️ THE WORD "EXPECTED" WAS HERE UNTIL 2026-09-01 AND IT INVERTED A CAPACITY FACT.
               * `expected` is a member of `BED_RELEASE_STATES` meaning the discharge has not happened
               * yet, so "N expected beds are being made ready" told a coordinator the bed was NOT yet
               * available when it already is — preparation only ever begins after `RELEASE_BED`. The
               * count was right and the word was wrong, which is the same defect class as a wrong
               * number and harder to catch: a wrong count invites a second look and confident prose
               * does not. The wording now matches `ward-screen.tsx`'s own.
               */}
              {/*
               * ⚠️ "THESE BEDS ARE ALREADY FREE" WAS STATED FLAT HERE UNTIL 2026-09-01, AND IT IS
               * NOT A GUARANTEE THE MODEL MAKES. `SET_BED_PREPARATION` checks the acting ward and
               * the chosen note and never the release's stage, so nothing in the reducer stops a
               * caller flagging a discharge that has not happened yet. Today the claim holds because
               * of who calls it, not because of what the reducer allows — which is the same capacity
               * inversion as the "expected bed" defect above, arriving from the other direction.
               */}
              <p className={styles.figureNote}>
                A measured count, whatever its value. Nought here means no bed is currently marked as being prepared —
                it does not mean the count is unavailable. Every bed counted here should already be free: preparation
                only ever begins after somebody has left, so this should never be a count of discharges still to come.
                Should, rather than is — the only screen that can raise the flag offers it on released beds alone, but
                nothing in the model enforces that, so a bed nobody has left yet could be flagged and would be counted
                here. This page counts the flag as it finds it rather than quietly filtering to the beds it expects,
                because a filter would drop such a record and hide the very inversion it was meant to prevent.
              </p>

              {/*
               * EMPTY STATE 1, and it says why mechanically rather than saying "not yet collected".
               *
               * ⚠️ THIS SAID "NOTHING MARKS THE MOMENT PREPARATION STARTED" UNTIL 2026-09-01 AND THAT
               * WAS FALSE. `SET_BED_PREPARATION` writes `confirmedAt: event.now` on the same object it
               * writes `preparing` to, so an instant IS stamped. The refusal survives on a stronger
               * reason: `confirmedAt` is ONE shared provenance field, and `CONFIRM_BED_RELEASE`,
               * `BLOCK_BED_RELEASE`, `CLEAR_BED_RELEASE_BLOCK`, `RELEASE_BED` and the preparation
               * event itself all overwrite it — so the start is destroyed by the act that ends it,
               * and a start and an end can never both exist on the record at once.
               *
               * ⚠️ FIELD NAMES CAME OFF THIS PARAGRAPH ON 2026-09-06, ON THE OWNER'S RULING, AND THEY
               * LIVE HERE SO THE CLAIM STAYS CHECKABLE BY THE READER WHO NEEDS THEM:
               *
               *     the yes/no readiness flag        BedRelease.preparing
               *     the ONE shared provenance field   BedRelease.confirmedAt
               *
               * A coordinator needs to know WHICH RECORD cannot answer and why; a developer needs the
               * identifier. Those are different readers, and the screen was serving only the second.
               */}
              <p className={styles.absence} data-testid="ward-statistics-readiness-timing-absent">
                <strong>
                  How long a bed takes to go from being cleaned to being open cannot be measured here, and the reason is
                  not that nobody writes a time down.
                </strong>{" "}
                Bed readiness is recorded on the bed-release record as a yes/no flag, and setting it does stamp an
                instant — but into that record&apos;s ONE shared provenance field, the same one every other act on the
                release also writes. Confirming the discharge, flagging the bed as stuck, clearing that flag, releasing
                the bed and turning preparation off again all overwrite it. So the record can hold when preparation
                started or when it ended, never both: the start is destroyed by the act that ends it. There is no pair
                of instants to subtract, rather than a pair whose values were never filled in — so no amount of data
                entry against today&apos;s model would produce this figure. Measuring it needs the record to gain
                instants of its own, which is a change to the bed model, not to this page.
              </p>
            </article>

            {/*
             * ⚠️ THE OWNER CALLED THIS THE MOST POLITICALLY SENSITIVE FIGURE IN THE SET, AND IT IS
             * THE ONE THIS PAGE MUST NOT APPROXIMATE.
             *
             * There is no `offered` field anywhere in the model — no instant, no boolean, nothing
             * recording that a ward offered a bed or withheld one. The nearest signal is a DERIVED
             * ward-side readiness gap computed by `unitCapacity` (`ward-derivations.ts`) out of two
             * aggregate counts, `Unit.empty` and `Unit.allocatable`. It is a fact about a ward's own
             * readiness across all its beds; it names no bed and no request, and it cannot, because
             * neither appears in the arithmetic.
             *
             * ⚠️ **THE DERIVED FIGURE IS NOT RENDERED BESIDE THIS EXPLANATION, AND THE ARITHMETIC IS
             * NOT SHOWN HERE EITHER.** A number sitting under this heading is read as this heading's
             * figure however the paragraph beneath it is worded — that is the proxy-with-a-disclaimer
             * shape, and it is exactly what would be quoted outside the room it was computed in. The
             * formula has the same problem one step removed: a reader carries it away with the wrong
             * name attached to it. Its audience is the owner deciding whether to add a field, not a
             * clinician skimming a page whose whole context asserts "these are the numbers", so it
             * travels in the task report under its own name instead of on this page.
             */}
            <article className={styles.figure} data-testid="ward-statistics-not-offered">
              <h3 className={styles.figureHeading}>Empty beds that were not offered</h3>

              <p className={styles.absence} data-testid="ward-statistics-not-offered-absent">
                <strong>
                  Nothing in this prototype records an offer, so this figure cannot be produced at all — and no number
                  on this page is standing in for it.
                </strong>{" "}
                A ward record carries the beds that are physically empty per the feed, and separately the beds the ward
                says it can actually allocate. Both are aggregate counts for the whole ward. What the model derives from
                the pair is a ward-side readiness gap — the part of a ward&apos;s empty capacity the ward has not yet
                said it can allocate, summed across every bed it has. That is a statement about one ward&apos;s own
                readiness at one moment. It is not a record of a bed being offered to, or held back from, any particular
                person or request, and it could not become one: neither a bed nor a request appears in it to be named.
                Answering the question as it was asked needs the model to gain a record per bed or per offer — a change
                to the bed model, not a change to this page. Until that exists this heading carries no figure,
                deliberately, because a number published under it would be quoted as the thing it is not.
              </p>
            </article>

            {/*
             * ⚠️ THE HEADING SAYS "SO FAR" AND EVERY OTHER SPELLING OF THIS FIGURE MUST SAY IT TOO —
             * the blurb, the notes, the testid, this comment.
             *
             * The test that settles the name is mechanical rather than a matter of taste: **if the
             * missing exhaustion marker were added tomorrow, would this number change?** It would —
             * it would become a strict subset. A figure whose value moves when the model gains the
             * concept its name implies is not measuring the thing its name says. And the misleading
             * reading is the ORDINARY case here, not the rare one: nothing closes a movement, a
             * fresh referral can follow a decline immediately, and `PARALLEL_REFERRAL_CAP` is small.
             *
             * ⚠️ **A CAVEAT UNDER A WRONG NAME IS THE SHAPE THIS PAGE REJECTED FOR THE FIGURE
             * ABOVE.** "So far" costs a reader nothing and keeps everything, so the qualifier is in
             * the name rather than in a note under it; the note explains WHY the qualifier is there,
             * which is what makes a reader carry it with them when they repeat the number.
             *
             * ⚠️ **THE NOTE BELOW CLAIMED A DISTRIBUTION NOTHING MEASURES, UNTIL 2026-09-01.** It said "MOST of
             * what is counted here has been put to that many out of the whole network". The counted population is
             * whatever `handoverSnapshot` classifies as declined-by-all — at least one decline and nothing
             * pending — which a movement carrying a SINGLE decline satisfies. Nothing in that derivation, and
             * nothing on this page, records how many wards a counted movement was put to, so "most" was an
             * assertion about a distribution no line of source can witness. The cap bounds the figure from above
             * and says nothing whatever about the mode, so the note now says "at most", which is what the cap
             * earns. `statistics-derivations.ts` carried the same soft claim in its own words and was corrected
             * with it.
             */}
            <article className={styles.figure} data-testid="ward-statistics-refused-so-far">
              <h3 className={styles.figureHeading}>Referrals where every ward asked so far has refused</h3>
              <p className={styles.figureBlurb}>
                Each one is a movement — somebody waiting in an emergency department for a bed — with at least one
                ward&apos;s refusal on record and no ward currently deciding.
              </p>

              <p className={styles.measuredCount} data-testid="ward-statistics-refused-so-far-count">
                <span className={styles.measuredValue} data-testid="ward-statistics-refused-so-far-value">
                  {refused.count}
                </span>{" "}
                of <span data-testid="ward-statistics-refused-so-far-open-count">{refused.openMovementCount}</span> open{" "}
                {refused.openMovementCount === 1 ? "movement" : "movements"}, as at this render.
              </p>

              <p className={styles.figureNote} data-testid="ward-statistics-refused-so-far-why-so-far">
                <strong>
                  The heading says &ldquo;so far&rdquo; because that is as far as the record goes, not because the
                  figure is being hedged.
                </strong>{" "}
                Nothing on a movement marks the network as exhausted — there is no closure flag, no cap-reached marker
                and no &ldquo;nobody left to ask&rdquo; state anywhere on the record — so exhaustion is not a thing this
                data can express, and the count above is exactly what it says: refusals on record, nothing pending. A
                refusal takes that ward off the list of wards deciding and leaves the movement at the stage referrals
                are made from, so a coordinator can put it to fresh wards the moment a decline lands; a movement counted
                here now can be back with several wards a minute later. A movement can be live at only{" "}
                <span data-testid="ward-statistics-refused-so-far-cap">{PARALLEL_REFERRAL_CAP}</span> wards{" "}
                <em>at once</em>, and that is a limit on how many can be deciding together — not on how many have been
                asked. A movement declined by one set of wards can be put to a fresh set, and again after that, so there
                is no ceiling here at all: nothing on the record measures how many wards a movement has actually been
                put to over its life. This is a worklist of who needs a decision today. It is not a count of patients
                nobody would take, and the model cannot produce that count.
              </p>

              <p className={styles.measuredCount} data-testid="ward-statistics-refused-so-far-escalated">
                <span className={styles.measuredValue}>{refused.escalatedCount}</span> open{" "}
                {refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation instead.
                The derivation this page shares with the handover screen classifies an escalation first, so any of those
                that also meet the condition above are absent from the count — which makes the count a floor rather than
                the whole of it. An escalation is somebody&apos;s recorded opinion that the network was exhausted, never
                a derived fact, so it is disclosed here and relied on for nothing.
              </p>
            </article>

            {/*
             * ⚠️ THE STATISTIC THE OWNER NAMED FIRST, AND THE REASON IT IS NOT HERE — ON THE PAGE,
             * because a reader of the page will never open this file.
             *
             * Until 2026-09-01 the argument lived only in this component's doc comment and there was
             * simply NOTHING on screen where the figure should be. That silence is the one asymmetry
             * a reader cannot detect: `Movement.declines` IS seeded non-empty, so a coordinator who
             * knows this prototype records declines and sees no decline figure cannot tell
             * "withheld pending a ruling" from "not recorded" from "nobody declined". This page's
             * whole safety property is that an absence explains itself; it did that twice and skipped
             * it on the item that mattered most.
             *
             * Saying so invents no number, which is why it is safe to say and unsafe to omit.
             */}
            <article className={styles.figure} data-testid="ward-statistics-declines">
              <h3 className={styles.figureHeading}>Declines per ward</h3>

              <p className={styles.absence} data-testid="ward-statistics-declines-withheld">
                <strong>
                  This figure is withheld pending an owner ruling. It is not that no ward declines, and not that
                  declines go unrecorded — both happen, and both are in the data right now.
                </strong>{" "}
                The model holds declines in two places that mean different things, and only one of them can name a ward.
                A referral decline sits on the referral itself, whose ward destination records the BED&apos;S CRITERIA —
                the sex it must suit, whether it must be secure, whether it must be able to hold somebody involuntarily
                — and never a ward. That record does have one place a ward can be named, and it is filled in only when a
                ward ACCEPTS. So an acceptance is attributable to a named ward and a decline is not, from the same
                record: the field that would name the ward is populated by the outcome that is not a decline. A movement
                decline sits on the movement, which does name the ward, but describes a ward refusing somebody who is
                already inside an emergency department, drawn from a different list of reasons. Publishing one of them
                under this heading would quietly decide what &ldquo;declines per ward&rdquo; means, and that is the
                owner&apos;s decision rather than an implementer&apos;s. Until it is taken, this page shows no decline
                figure at all — deliberately, and never as a nought.
              </p>
            </article>

            {/*
             * ⚠️ THE ROWS ARE GENERATED FROM THE MODEL'S OWN REASON LIST AND NOT ONE WORD OF THAT
             * LIST IS TYPED HERE — not as a label map, not in the prose, not in a test literal.
             *
             * A hand-written table checked by a hand-written test proves only that one author was
             * consistent with themselves, and this project has already been bitten tonight: a brief
             * written against a pre-merge tree named a member that a rename had since replaced, and
             * a table copied from it would have been wrong with everything green. There is also no
             * label map here on purpose. `DECLINE_REASON_LABELS` (`ward-referrals.ts`) is keyed by
             * `REFERRAL_DECLINE_REASONS`, a DIFFERENT and shorter list about a different act, so
             * using it here would label a value from one vocabulary out of the other's map; and a
             * new map written here would be a second copy of the vocabulary, free to drift. The
             * member is displayed as the model spells it, exactly as the ward screen's own decline
             * picker does.
             *
             * ⚠️ **THIS COUNTS MOVEMENT DECLINES AND NOTHING ELSE.** No figure on this page is a
             * distribution over `REFERRAL_DECLINE_REASONS`: which of those a referral can even be
             * given depends on which screen is doing the declining, so its shape would be a fact
             * about the software rather than about the service, and a reader would take members that
             * one surface cannot offer for members that never happen.
             */}
            <article className={styles.figure} data-testid="ward-statistics-declines-by-reason">
              <h3 className={styles.figureHeading}>Declines by reason</h3>
              <p className={styles.figureBlurb}>
                All the refusals wards have recorded in this prototype, counted against the reason the ward gave. This
                names no ward — the figure above says why a per-ward number is withheld — and it counts wards approached
                through the coordinator&apos;s matching, not referrals refused at the front door.
              </p>

              <p className={styles.measuredCount} data-testid="ward-statistics-declines-by-reason-population">
                <span className={styles.measuredValue} data-testid="ward-statistics-declines-by-reason-total">
                  {declines.totalCount}
                </span>{" "}
                {declines.totalCount === 1 ? "decline" : "declines"} on record, from{" "}
                <span data-testid="ward-statistics-declines-by-reason-movements-with">
                  {declines.movementsWithDeclinesCount}
                </span>{" "}
                of the <span data-testid="ward-statistics-declines-by-reason-movements">{declines.movementCount}</span>{" "}
                {declines.movementCount === 1 ? "movement" : "movements"} this page examined.
              </p>

              <ul className={styles.tallyList} data-testid="ward-statistics-declines-by-reason-list">
                {declines.tallies.map((tally) => (
                  <li
                    key={tally.reason}
                    className={styles.tallyRow}
                    data-testid={`ward-statistics-decline-${tally.reason}`}
                  >
                    <span className={styles.tallyReason}>{tally.reason.replace(/_/g, " ")}</span>
                    <span className={styles.tallyCount} data-testid={`ward-statistics-decline-${tally.reason}-count`}>
                      {tally.count}
                    </span>
                  </li>
                ))}
              </ul>

              {/*
               * ⚠️ **A NOUGHT IS RENDERED, AND THAT IS NOT A BREACH OF "NULL IS NEVER ZERO".** That
               * rule is about an AVERAGE: a ward with no discharges has no average length of stay,
               * and a nought there would assert every discharge was instantaneous.
               * `ward-statistics.ts` documents the exemption in its own words — count-based figures
               * are genuine counts, so nought is a true and correct answer when there is no data.
               * A decline count is a genuine count.
               *
               * ⚠️ **AND THE RULE IS "EVERY MEMBER OF A SMALL CLOSED VOCABULARY", NOT "EVERY EMPTY
               * CATEGORY".** Seven rows a reader can count is a table. Seventy rows of which
               * sixty-three are nought is a page nobody reads, and burying the seven that happened
               * is its own way of hiding them. A longer vocabulary needs a different answer, decided
               * then — not inherited from here.
               */}
              <p className={styles.figureNote} data-testid="ward-statistics-declines-by-reason-generated">
                <strong>
                  Every one of the{" "}
                  <span data-testid="ward-statistics-declines-by-reason-vocabulary-size">
                    {declines.vocabularySize}
                  </span>{" "}
                  reasons the model allows has a row above, including any sitting at nought.
                </strong>{" "}
                A nought means the count ran over that reason and found none, which is a true answer about a genuine
                count. Leaving the row out instead would read three ways at once — the reason does not exist, or nobody
                used it, or this page does not track it — and it would look identical to a table that had failed to
                generate that row at all, with nothing going red. The rows come from the model&apos;s own list of
                reasons rather than from anything written on this page, so a reason added to the model appears here on
                its own and a reason removed cannot linger; the row count and the number above are the same number, and
                a reader can check that by counting.
              </p>
              <p className={styles.figureNote}>
                The order is the model&apos;s own and is not a ranking — nothing here sorts a reason to the top for
                being common. Historical rather than a picture of tonight: a refusal is a thing that happened and still
                counts after the movement it was made against has reached a bed, so movements that have since closed are
                included.
              </p>
            </article>

            {/*
             * ⚠️ THIS COUNTS `Admission.blockReason`, NOT `Movement.blocker` — a deferral commit named
             * the wrong field, and this figure exists because that was corrected rather than repeated.
             * `Movement.blocker` is free prose about a referral struggling to find a placement;
             * `blockReason` is a closed enum about a bed that will not yet let its occupant go, and the
             * two are unrelated facts that happen to share a nearby name. See
             * `statistics-derivations.ts` for the full argument, including why `BedRelease.blocker` — a
             * second field carrying the same vocabulary — is deliberately not merged in here: it has no
             * `admissionId` to join back to a specific admission without risking a double count.
             *
             * ⚠️ THE ROWS ARE GENERATED FROM `BED_RELEASE_BLOCKERS` AND NOT ONE WORD OF THAT LIST IS
             * TYPED HERE, for the same reason declines-by-reason above does not type out its own list.
             *
             * ⚠️ SCOPED TO ADMISSIONS STILL ON THE WARD. A departed admission is no longer being held
             * from leaving whatever `blockReason` still says — the same scoping `wardStatistics`
             * applies to `readyToLeaveCannot`, reused here rather than re-argued.
             */}
            <article className={styles.figure} data-testid="ward-statistics-blocked-discharges-by-reason">
              <h3 className={styles.figureHeading}>Blocked discharges by blocker</h3>
              <p className={styles.figureBlurb}>
                Everyone still on the ward whose bed will not yet let them go, counted against the reason recorded for
                it. This is the blocker recorded against the ADMISSION, not the one recorded against a movement — a
                referral still finding a placement is a different fact from a bed that will not yet release its
                occupant.
              </p>

              <p className={styles.measuredCount} data-testid="ward-statistics-blocked-discharges-by-reason-population">
                <span className={styles.measuredValue} data-testid="ward-statistics-blocked-discharges-by-reason-total">
                  {blocked.totalCount}
                </span>{" "}
                blocked {blocked.totalCount === 1 ? "discharge" : "discharges"}, out of{" "}
                <span data-testid="ward-statistics-blocked-discharges-by-reason-admissions">
                  {blocked.admissionCount}
                </span>{" "}
                {blocked.admissionCount === 1 ? "admission" : "admissions"} still on the ward.
              </p>

              <ul className={styles.tallyList} data-testid="ward-statistics-blocked-discharges-by-reason-list">
                {blocked.tallies.map((tally) => (
                  <li
                    key={tally.reason}
                    className={styles.tallyRow}
                    data-testid={`ward-statistics-blocked-discharge-${tally.reason}`}
                  >
                    <span className={styles.tallyReason}>{tally.reason}</span>
                    <span
                      className={styles.tallyCount}
                      data-testid={`ward-statistics-blocked-discharge-${tally.reason}-count`}
                    >
                      {tally.count}
                    </span>
                  </li>
                ))}
              </ul>

              {/*
               * ⚠️ A NOUGHT IS RENDERED, AND THAT IS NOT A BREACH OF "NULL IS NEVER ZERO" — the same
               * exemption declines-by-reason documents above: this is a genuine count, and count-based
               * figures render `0` as a true answer rather than an absence.
               */}
              <p className={styles.figureNote} data-testid="ward-statistics-blocked-discharges-by-reason-generated">
                <strong>
                  Every one of the{" "}
                  <span data-testid="ward-statistics-blocked-discharges-by-reason-vocabulary-size">
                    {blocked.vocabularySize}
                  </span>{" "}
                  blockers the model allows has a row above, including any sitting at nought.
                </strong>{" "}
                A nought means the count ran over that blocker and found none, which is a true answer about a genuine
                count — not that the figure is unavailable. The rows come from the model&apos;s own list of blockers
                rather than from anything written on this page, so the row count and the number above are the same
                number, and a reader can check that by counting.
              </p>
            </article>
          </div>
        </WardPanel>

        {/* ── Audience 2 ─────────────────────────────────────────────────────────────────── */}
        <WardPanel title="What is happening to patients" testId="ward-statistics-patients">
          <div className={styles.panelBody}>
            <p className={styles.sectionAudience} data-testid="ward-statistics-patients-audience">
              The question a clinician asks. These figures are about time a person spent waiting, not about how a ward
              scored.
            </p>

            <article className={styles.figure} data-testid="ward-statistics-pull-to-arrival">
              <h3 className={styles.figureHeading}>From a bed being given away to the person arriving in it</h3>
              <p className={styles.figureBlurb}>
                A ward gives the bed away at the pull; the person is still somewhere else, usually an emergency
                department, until they arrive. This is that gap, measured between the two instants the admission record
                keeps for it and no others.
              </p>

              {arrivals.averageMinutes === null ? (
                /*
                 * NOT an empty state of the "cannot be measured" kind, and worded so it can never be
                 * read as one. The measurement is possible; this population simply has nothing in it
                 * yet. An average of nothing is absent, never nought — a mean of 0m would say every
                 * person arrived the instant their bed was given away.
                 */
                <p className={styles.nothingToAverage} data-testid="ward-statistics-arrival-nothing-to-average">
                  <strong>No admission on record carries both instants, so there is no average to show.</strong> This
                  figure can be measured — the record holds both clocks — there is simply nothing yet to average. It is
                  not nought minutes: an average of nought would say people arrive the moment their bed is given away.
                </p>
              ) : (
                <>
                  <p className={styles.headlineValue} data-testid="ward-statistics-arrival-average">
                    {splitDuration(arrivals.averageMinutes)}
                  </p>
                  <p className={styles.headlineCaption}>
                    average, across{" "}
                    <span data-testid="ward-statistics-arrival-measured-count">{arrivals.measuredCount}</span>{" "}
                    {arrivals.measuredCount === 1 ? "admission" : "admissions"} carrying both instants.
                  </p>

                  {/*
                   * The range sits beside the average deliberately. These are synthetic instants and
                   * a seeded population can carry the same gap for everybody — in which case the
                   * shortest and the longest are the average, and a reader can see for themselves
                   * that there is no spread. An average shown alone would look measured.
                   */}
                  {/* Each end carries its OWN testid rather than sitting inside one sentence: an
                      adversarial check swapped shortest and longest and nothing failed, because the
                      assertion looked for both strings anywhere in the paragraph. The seeded world
                      has no spread, so the swap would not show in the app either. */}
                  <p className={styles.figureNote} data-testid="ward-statistics-arrival-range">
                    Shortest{" "}
                    <span data-testid="ward-statistics-arrival-shortest">
                      {arrivals.shortestMinutes === null ? "—" : splitDuration(arrivals.shortestMinutes)}
                    </span>
                    , longest{" "}
                    <span data-testid="ward-statistics-arrival-longest">
                      {arrivals.longestMinutes === null ? "—" : splitDuration(arrivals.longestMinutes)}
                    </span>
                    . The range is shown beside the average on purpose: where the two ends meet, every measured gap is
                    identical, and an average alone would read as though it had spread behind it.
                  </p>

                  {/*
                   * ⚠️ **THE CAUSE, ON THE PAGE — because until 2026-09-01 it lived only in the
                   * comment above and no reader of the page could reach it.** The paragraph above
                   * explains the DISPLAY CHOICE ("the range is shown on purpose") and stops there,
                   * which showed the reader the symptom and withheld the reason for it. Every other
                   * gap on this page names its cause and says whose change would fix it; this was
                   * the only figure that did not, and it is the figure most likely to be quoted,
                   * because it is the only one that renders a confident-looking headline number.
                   *
                   * ⚠️ **CONDITIONAL ON THE TWO ENDS BEING EQUAL, and that is the whole point.** An
                   * unconditional sentence would pass every test in the world this fixture happens
                   * to be in today and would become a lie the moment somebody gives the instants
                   * real variety — sitting there being false with nothing to catch it. Written this
                   * way it disappears on its own, which is the same self-invalidating property the
                   * referral-to-bed paragraph already has.
                   *
                   * The null checks are not decoration: this branch cannot reach here with a null
                   * end (a non-null average implies at least one measured gap), but `null === null`
                   * is true, so an equality test alone would render this against an empty
                   * population if the guard above ever changed shape.
                   *
                   * ⚠️ **`measuredCount > 1` IS PART OF THE CONDITION, NOT AN OPTIMISATION.** With
                   * exactly one measured admission the two ends meet TRIVIALLY — one gap is its own
                   * shortest and its own longest — and there is no constancy to report at all. The
                   * paragraph below talks about every measured gap agreeing with every other; said
                   * over a population of one that is not a hedge that reads oddly, it is a claim
                   * about agreement where there is nothing to agree with. The seeded world cannot
                   * reach this (it carries hundreds), but this screen is generic and its callers
                   * are not, so the case is real.
                   *
                   * ⚠️ **AND THE COPY CLAIMS ONLY WHAT THE CONDITION ENTAILS.** An earlier draft
                   * stated as settled fact that the fixture derives one instant from the other by a
                   * fixed offset. That is true of today's seed — and the page cannot know it. All
                   * this branch observes is that the ends coincide; independently generated gaps
                   * that happened to agree would satisfy it identically. Asserting the mechanism
                   * from the symptom would have been the very defect this paragraph exists to close,
                   * moved out of a number and into a cause. So the offset is offered below as the
                   * explanation the shape points at, explicitly not as a finding — while still
                   * saying plainly that the figure must not be read as a measurement of a service.
                   */}
                  {arrivals.measuredCount > 1 &&
                  arrivals.shortestMinutes !== null &&
                  arrivals.longestMinutes !== null &&
                  arrivals.shortestMinutes === arrivals.longestMinutes ? (
                    <p className={styles.figureNote} data-testid="ward-statistics-arrival-constant-gap">
                      <strong>
                        Every measured gap here is the same length, so this average is describing no variation at all:
                        it is one value repeated, not a measurement of how long beds take to fill.
                      </strong>{" "}
                      What this page can see is that the two ends coincide, never why they do. The likeliest reason is a
                      fixture that derives one of the two instants from the other by a fixed offset, because a real
                      service does not hand back the same gap for everybody — but that is an explanation this shape
                      points at rather than a finding the page has established. Either way nothing here can widen the
                      figure: if these gaps are meant to differ, they have to be written that way on the admissions
                      side, which is a change to the fixture rather than to this page, and the moment they do differ the
                      two ends part and this paragraph disappears on its own.
                    </p>
                  ) : null}
                </>
              )}

              <p className={styles.figureNote} data-testid="ward-statistics-arrival-population">
                Historical, not a picture of tonight:{" "}
                <span data-testid="ward-statistics-arrival-ended-count">{arrivals.endedCount}</span> of the measured
                admissions have since ended, and their completed gap still counts. A further{" "}
                <span data-testid="ward-statistics-arrival-awaiting-count">{arrivals.awaitingArrivalCount}</span>{" "}
                {arrivals.awaitingArrivalCount === 1 ? "person has" : "people have"} a bed given away and have not
                arrived; their gap is still running, so it is not yet a measured fact and contributes nothing above.
              </p>

              {/*
               * The excluded-and-counted half of the chronology guard, and it must be VISIBLE or the
               * exclusion is as invisible as the clamp it replaces. Ward Lead's ruling, 2026-09-01:
               * a clamp "does not make a bad number safe, it makes it invisible". Rendering the count
               * rather than silently dropping the record is what keeps that true on the page.
               */}
              <p className={styles.measuredCount} data-testid="ward-statistics-arrival-incoherent">
                <span className={styles.measuredValue}>{arrivals.incoherentCount}</span>{" "}
                {arrivals.incoherentCount === 1 ? "admission records an arrival" : "admissions record an arrival"}{" "}
                EARLIER than the bed was given away. That cannot be true, so{" "}
                {arrivals.incoherentCount === 1 ? "it is" : "they are"} excluded from every figure above and counted
                here instead — never folded in as a wait of no time at all.
              </p>
            </article>

            <article className={styles.figure} data-testid="ward-statistics-referral-to-bed">
              <h3 className={styles.figureHeading}>From a referral being raised to a bed being taken</h3>

              {/*
               * EMPTY STATE 2, and the one paragraph on this page that has been rewritten twice for
               * the same underlying mistake: it kept explaining the refusal by describing the FIXTURE.
               *
               * ⚠️ **A SENTENCE ABOUT WHAT THE SEED CONTAINS IS A PIN THAT FALSIFIES ITSELF SILENTLY.**
               * This paragraph asserted, at various points, that the matching records were not the
               * same person, that their ids collided by accident, that the front door had been
               * numbered separately, and that arrivals preceded referrals by weeks. Every one was
               * checked against the fixture, was wrong or became wrong, and left the refusal — which
               * was correct throughout — standing on a false account of the data. Nothing went red
               * for any of them, because a fixture is not a contract and no test watches prose.
               *
               * ⚠️ **SO THIS PARAGRAPH NOW DESCRIBES WHAT THE DERIVATION CAN AND CANNOT ESTABLISH,
               * AND NOTHING ELSE.** No count, no id shape, no provenance, no magnitude, no date. That
               * sentence is true whether the join finds many pairs or none, and it stays true across
               * the next fixture change. Quantities belong to the elements below, which recompute on
               * every render — rendered, never written.
               *
               * ⚠️ FIELD NAMES CAME OFF THIS PARAGRAPH ON 2026-09-06, ON THE OWNER'S RULING, AND THEY
               * LIVE HERE SO THE CLAIM STAYS CHECKABLE BY THE READER WHO NEEDS THEM:
               *
               *     the admission's pointer at its referral   Admission.referralId
               *
               * The claim above turns on that pointer being nullable and on a match being exact, and
               * both are properties of the field rather than of the fixture — which is the whole point
               * of the paragraph. `statistics-claims-register.ts` pins them to `ward-model.ts`.
               */}
              <p className={styles.absence} data-testid="ward-statistics-referral-join-absent">
                <strong>
                  This page publishes no referral-to-bed duration, and the reason is not that the join finds nothing. It
                  is that a matching id does not establish that the two records are the two ends of one wait.
                </strong>{" "}
                An admission carries the referral it came from, or nothing at all — and nothing at all is an ordinary
                state here, meaning that admission came from a movement rather than from a referral. Matching it against
                the referrals on record is exact, so a pair either exists or it does not, and the counts below are that
                measurement taken on this render. What a matched pair cannot say for itself is whether the referral it
                names is the request that PRODUCED the bed. A referral raised about somebody already in the bed carries
                a perfectly good instant, matches a perfectly good id, and dates the wrong event; all the arithmetic can
                see is whether the referral was raised before the person arrived, which is why that count is reported on
                its own rather than folded into an average. So this page counts what it can establish and stops there.
                Squaring an incoherent pair away with an absolute value or a floor of nought would turn the wrong event
                into a confident average, on the one screen where a plausible figure is never re-checked. Publishing the
                duration needs the front-door request recorded as such, and the admission pointed at it — a change to
                the data rather than to this page.
              </p>

              <p className={styles.measuredCount} data-testid="ward-statistics-join-count">
                {/* Its own testid so a test can assert EQUALITY rather than `toContain` on the whole
                    sentence. An adversarial check found the old containment assertion passed by luck:
                    the substituted value was `267`, which happens to contain no "0" — `260`, `100` or
                    `30` would all have slipped through. */}
                <span className={styles.measuredValue} data-testid="ward-statistics-join-coherent-count">
                  {join.chronologicallyCoherentCount}
                </span>{" "}
                of <span data-testid="ward-statistics-join-matched-count">{join.joinedCount}</span> matched{" "}
                {join.joinedCount === 1 ? "pair" : "pairs"} could carry a duration at all — that is, the person arrived
                no earlier than the referral was raised.
              </p>
              <p className={styles.measuredCount} data-testid="ward-statistics-join-population">
                Matched from <span data-testid="ward-statistics-join-with-id-count">{join.withReferralIdCount}</span>{" "}
                {join.withReferralIdCount === 1 ? "admission" : "admissions"} carrying a referral id, against{" "}
                <span data-testid="ward-statistics-join-referrals-searched">{join.referralsSearchedCount}</span>{" "}
                {join.referralsSearchedCount === 1 ? "referral" : "referrals"} on record.
              </p>
              <p className={styles.figureNote}>
                Every one of those is a real measurement taken on this render, not a statement of intent — and they are
                rendered here rather than written into the paragraph above on purpose. A sentence stating how many pairs
                match would be a claim about today&apos;s data that nothing goes red to correct; these numbers correct
                themselves.
              </p>
            </article>
          </div>
        </WardPanel>
      </main>
    </div>
  );
}
