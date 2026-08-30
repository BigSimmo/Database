"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";

import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { NOT_RECORDED_LABEL, SYNTHETIC_TRAVEL_TIMES_NOTICE } from "@/components/ward-management/ward-distance";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isWardReferral } from "@/components/ward-management/ward-eligibility";
import {
  REFERRAL_DECLINE_REASONS,
  type Referral,
  type ReferralDeclineReason,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  candidateAccepts,
  DECLINE_REASON_LABELS,
  groupCandidatesByTravelBand,
  matchReason,
  networkHasCohort,
  referralCandidates,
  referralWaitLabel,
  TRAVEL_BAND_GROUP_EMPTY_SENTENCE,
  travelBandGroupCounts,
  travelBandGroupCountsSentence,
  travelBandGroupLabel,
  type ReferralCandidate,
  type TravelBandGroup,
  type TravelBandGroupCounts,
  referralPersonFacts,
  referralDestinationLabel,
} from "@/components/ward-management/ward-referrals";
import { createBrowserStore } from "@/lib/client-store-factory";

import styles from "./referrals.module.css";

/**
 * Phase 8, Task 4. The width at which the band groups start open, matching
 * `referrals.module.css`'s own `--ri-two-col-breakpoint` / `@media (max-width: 40rem)` swap so the
 * screen has ONE breakpoint rather than a second one written here that could drift from it.
 *
 * Owner decision, 2026-08-29: shut by default at phone width, open at desktop width. The binding
 * condition on that decision is why it is safe, and it is a condition on the markup below rather
 * than on this constant: every heading and BOTH of its counts render whether the group is open or
 * shut, including for an empty group, so "there is nothing available within an hour" is answerable
 * without opening anything. Collapsing folds; it does not hide. It was approved INSTEAD of a
 * metro/rural toggle, which was declined precisely because that would have hidden beds.
 */
const BAND_GROUPS_OPEN_MEDIA_QUERY = "(min-width: 40rem)";

/**
 * Whether the band groups start open, tracked live so a rotation or a resize is honoured rather
 * than frozen at mount. On the server there is no `matchMedia` at all and the answer is `false` —
 * the phone default — so nothing width-dependent is guessed where no width is known. The `typeof`
 * guards are for a browser-like environment that lacks the API rather than for jsdom, which this
 * repository's `tests/setup/jsdom.setup.ts` always supplies with a stub (defaulting to "no match",
 * so groups mount shut unless a test installs the matching stub itself). A shut group is the
 * conservative answer in any case: every heading and both counts are inside the `<summary>`, which
 * is the part a closed disclosure still paints.
 */
const useBandGroupsOpenByDefault = createBrowserStore<boolean>(
  (onStoreChange) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(BAND_GROUPS_OPEN_MEDIA_QUERY);
    media.addEventListener("change", onStoreChange);
    return () => media.removeEventListener("change", onStoreChange);
  },
  () => (typeof window.matchMedia === "function" ? window.matchMedia(BAND_GROUPS_OPEN_MEDIA_QUERY).matches : false),
  false,
);

/**
 * The event types this view's own controls raise, and the one spelling of each in the rejection
 * banner. A refusal the reducer raises for any of them surfaces here rather than being swallowed —
 * including `RECORD_LOCAL_BED_SOUGHT`, whose control this screen owns.
 */
const MATCH_VIEW_DECISION_EVENTS = ["ACCEPT_REFERRAL", "DECLINE_REFERRAL", "RECORD_LOCAL_BED_SOUGHT"] as const;

const REJECTED_DECISION_LABELS: Record<(typeof MATCH_VIEW_DECISION_EVENTS)[number], string> = {
  ACCEPT_REFERRAL: "Acceptance",
  DECLINE_REFERRAL: "Decline",
  RECORD_LOCAL_BED_SOUGHT: "Local bed search",
};

type ReferralMatchViewProps = {
  referral: Referral;
  units: Unit[];
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  rejections: Rejection[];
};

/**
 * Task 5 (Phase 7, "The front door", spec D10): the match view. One referral, every unit in the
 * network — `referralCandidates` (`ward-referrals.ts`) never truncates, sorts or ranks it, so
 * this component must not either. Every unit renders in the exact order `units` arrives in (the
 * site table's own order, the same fixed order the morning page uses) — a table row NEVER moves
 * because it accepts the referral, because that would read as a recommendation, and D10 is
 * explicit that this view shows candidates and a human decides.
 *
 * The parent (`ReferralBoard`) mounts this keyed on `referral.id`, so switching which referral is
 * selected always remounts fresh local state here (the decline-reason draft, the rejection banner)
 * rather than carrying one referral's leftover UI state onto the next.
 */
export function ReferralMatchView({ referral, units, now, dispatch, rejections }: ReferralMatchViewProps) {
  /*
   * This whole view answers one question -- WHICH BED -- and only a psychiatric ward referral has
   * that question. An ED, a medical ward and a community team are answered by a person or a team.
   *
   * Said out loud rather than left as an empty candidate list, because the two render almost
   * identically and mean opposite things: an empty list here reads as "the network has no bed for
   * this person", which for a community referral is not a shortage, it is a category error.
   */
  if (!isWardReferral(referral)) {
    return (
      <section className={styles.matchPanel} data-testid="ward-referral-match-not-a-bed-question">
        <p className={styles.matchSummary}>
          {referral.id} is addressed to {referralDestinationLabel(referral.destination).toLowerCase()}, which is
          answered by a team rather than by matching a bed. There is no bed shortlist for this referral.
        </p>
      </section>
    );
  }
  const candidates = referralCandidates(referral, units, now);
  const accepting = candidates.filter(candidateAccepts);
  const hasCohort = networkHasCohort(referral, units);
  /*
   * Phase 8, Task 4. The grouping is asked for ONCE and everything on this screen below reads that
   * one answer — the group headings, their two counts, each row's own band, and the
   * every-candidate-unrecorded sentence. A second lookup into the fixture for any of those is how
   * one screen ends up giving two answers about the same pair, which is the defect Phase 5 shipped.
   */
  const bandGroups = groupCandidatesByTravelBand(referral, candidates);
  const bandGroupCounts = bandGroups.map(travelBandGroupCounts);
  const groupedUnitCount = bandGroupCounts.reduce((total, counts) => total + counts.units, 0);
  const notRecordedIndex = bandGroups.findIndex((group) => group.band === "not_recorded");
  /* Derived from the grouping's OWN output, never from a second read of the travel-band table. */
  const everyCandidateUnrecorded =
    groupedUnitCount > 0 && notRecordedIndex >= 0 && bandGroupCounts[notRecordedIndex].units === groupedUnitCount;

  /* Shut on a phone, open at desktop width — read through the repository's own SSR-safe external
   * store rather than by setting state in an effect, so the value is already correct on the first
   * client render and no cascading re-render is needed to reach it. */
  const bandGroupsOpenByDefault = useBandGroupsOpenByDefault();

  const [declineReason, setDeclineReason] = useState<ReferralDeclineReason>(REFERRAL_DECLINE_REASONS[0]);
  const [lastRejection, setLastRejection] = useState<Rejection | undefined>(undefined);
  // Same async-detection pattern as `referral-intake.tsx`'s own `checkToken`/`priorRejectionCountRef`
  // pair (see that file's doc comment for the full reasoning) — `dispatch` never returns whether
  // the reducer accepted or refused an event, so the only way to know is to compare `rejections`
  // before and after, on the next render.
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);

  useEffect(() => {
    if (checkToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      // Scoped to THIS referral's own ACCEPT_REFERRAL/DECLINE_REFERRAL — `Rejection.movementId`
      // carries the referral id for these two event types (see `subjectId` in
      // `ward-flow-reducer.ts`), never a movement id. A rejection some other coordinator action
      // raised elsewhere must never surface here as though it were about this referral.
      const isForThisDecision =
        newest.movementId === referral.id &&
        (MATCH_VIEW_DECISION_EVENTS as readonly string[]).includes(newest.attempted);
      setLastRejection(isForThisDecision ? newest : undefined);
    } else {
      setLastRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken, referral.id]);

  function handleAccept(unitId: string) {
    priorRejectionCountRef.current = rejections.length;
    dispatch({ type: "ACCEPT_REFERRAL", role: "coordinator", now, referralId: referral.id, unitId });
    setCheckToken((token) => token + 1);
  }

  /*
   * The optional local-bed step (spec D8-6). One control, on this screen, creating a record only
   * when it is taken — never a field on the intake form, because a form field is the one shape
   * guaranteed to read as owed. It is offered on EVERY referral, not only country ones: offering
   * it only on country referrals would assert that looking closer to home first is a country
   * practice, which is precisely the question nobody has answered.
   */
  function handleLocalBedSought() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({ type: "RECORD_LOCAL_BED_SOUGHT", role: "coordinator", now, referralId: referral.id });
    setCheckToken((token) => token + 1);
  }

  function handleDecline() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({ type: "DECLINE_REFERRAL", role: "coordinator", now, referralId: referral.id, reason: declineReason });
    setCheckToken((token) => token + 1);
  }

  if (referral.state !== "queued") {
    const acceptedUnit = units.find((unit) => unit.id === referral.acceptedUnitId);
    return (
      <section className={styles.matchPanel} data-testid="ward-referral-match-panel">
        <h2 className={styles.matchHeading}>
          {referral.id} — {referral.state === "accepted" ? "accepted" : "declined"}
        </h2>
        <p data-testid="ward-referral-match-decided">
          {referral.state === "accepted"
            ? acceptedUnit
              ? `Accepted at ${acceptedUnit.name}.`
              : `Accepted, but no synthetic unit matches "${referral.acceptedUnitId}".`
            : `Declined — ${DECLINE_REASON_LABELS[referral.declineReason as ReferralDeclineReason] ?? referral.declineReason}.`}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.matchPanel} data-testid="ward-referral-match-panel">
      <h2 className={styles.matchHeading}>{referral.id}</h2>
      {/*
       * M7 (fix round C): the brief says BOTH screens carry the prose banner. `ReferralBoard`'s
       * sits at the top of `<main>`, above two sections and two tables — on a phone a coordinator
       * making the accept decision here has scrolled well past it. This is the screen where the
       * decision is actually taken, so the sentence is repeated where it is read.
       */}
      <p className={styles.matchGovernance} data-testid="ward-referral-match-governance">
        <strong>Not a medical device.</strong> Every unit below is listed in the network&apos;s own fixed order — this
        view never ranks units by suitability and never suggests which bed is best. A coordinator decides.
      </p>
      {/*
       * The tier is its OWN element, never a field inside the dot-separated summary line below
       * (review finding I1 / Task 8 finding B). This view used to render a bare `Tier 2` inline
       * while the board row directly above it read "Tier 2 · urgent" — one field, one page, two
       * spellings, the fourth instance on this branch of the project's most expensive defect
       * class. Substituting `urgencyTierLabel` INTO the summary line would have produced
       * "Adult · Female · Tier 2 · urgent · Perth Metropolitan", where "urgent" reads as a fifth
       * dot-separated field; so the layout changed rather than the words, and the tier now sits
       * on its own exactly as it does on the board's card list.
       */}
      <p className={styles.matchTier} data-testid="ward-referral-match-tier" data-tier={referral.urgency}>
        {urgencyTierLabel(referral.urgency)}
      </p>
      <p className={styles.matchSummary} data-testid="ward-referral-match-summary">
        {referralPersonFacts(referral).join(" · ")}
      </p>
      <p className={styles.waitBadge} data-testid="ward-referral-match-wait">
        {referralWaitLabel(referral, now)}
      </p>

      {!hasCohort ? (
        <p className={styles.structuralGap} role="alert" data-testid="ward-referral-match-structural-gap">
          No {referral.ageBand.toLowerCase()} unit exists in this network.
        </p>
      ) : accepting.length === 0 ? (
        <p className={styles.noBedAccepts} role="alert" data-testid="ward-referral-match-no-bed">
          No unit accepts this referral right now — every reason is listed below.
        </p>
      ) : null}

      {/*
       * Only when the network runs this age band at all (fix round C, F6 / review finding I3).
       * "right now" asserts temporality — that this may be different at 4pm. When there is no
       * unit of this cohort anywhere it will never be different, and printing "0 of 22 units
       * accept this referral right now" one line under "No youth unit exists in this network"
       * reintroduces the operational statement the structural banner exists to avoid.
       */}
      {hasCohort ? (
        <p data-testid="ward-referral-match-accepting-count">
          {accepting.length} of {candidates.length} units accept this referral right now.
        </p>
      ) : null}

      {/*
       * Every piece of distance wording on this screen sits BELOW the structural-gap banner above.
       * "No youth unit exists in this network" is not a distance problem and must never be dressed
       * as one, so the banner is met first and the bands only afterwards.
       *
       * The one place this screen states that the travel times are invented. It is imported, never
       * retyped, and it renders once — a band shown anywhere without this sentence on the same
       * screen is a defect.
       */}
      <p className={styles.syntheticNotice} data-testid="ward-referral-match-synthetic-notice">
        {SYNTHETIC_TRAVEL_TIMES_NOTICE}
      </p>

      {everyCandidateUnrecorded ? (
        <p className={styles.allNotRecorded} data-testid="ward-referral-match-all-not-recorded">
          <strong>{NOT_RECORDED_LABEL}</strong> — This prototype holds no travel time between this person&apos;s home
          region and these sites. That is a gap in the invented data, not a statement that these beds are far away.
        </p>
      ) : null}

      <div className={styles.matchList} data-testid="ward-referral-match-list">
        {bandGroups.map((group, index) => (
          <BandGroup
            /* Includes the width default, so crossing the breakpoint re-seeds every group's
             * open/shut state by remount. The key never depends on the band or on either count —
             * the collapse state must not vary with which band this is or with what is in it. */
            key={`${group.band}-${bandGroupsOpenByDefault}`}
            group={group}
            counts={bandGroupCounts[index]}
            openByDefault={bandGroupsOpenByDefault}
            onAccept={handleAccept}
          />
        ))}
      </div>

      {/*
       * Rule 3 of the optional step, and the reason this branch has no `else` that renders
       * anything: absence renders as NOTHING AT ALL. No "Not recorded", no empty checkbox, no grey
       * placeholder, no warning icon, no amber row. A referral without the record must look exactly
       * like a referral that never needed one, because it may be one — and no figure anywhere on
       * this screen or any other counts how many referrals lack it.
       */}
      <div className={styles.localBed} data-testid="ward-referral-match-local-bed">
        {referral.localBedSought ? (
          <p className={styles.localBedRecord} data-testid="ward-referral-match-local-bed-sought-record">
            A local bed was sought and none was suitable, at {formatInstant(referral.localBedSought.at)}.
          </p>
        ) : (
          <button
            type="button"
            className={styles.localBedButton}
            data-testid="ward-referral-match-local-bed-sought"
            onClick={handleLocalBedSought}
          >
            Record that a local bed was sought and none was suitable
          </button>
        )}
      </div>

      <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls">
        <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason">
          Decline reason
        </label>
        <select
          id="ward-referral-match-decline-reason"
          data-testid="ward-referral-match-decline-reason"
          className={styles.select}
          value={declineReason}
          onChange={(event) => setDeclineReason(event.target.value as ReferralDeclineReason)}
        >
          {REFERRAL_DECLINE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {DECLINE_REASON_LABELS[reason] ?? reason}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.declineButton}
          data-testid="ward-referral-match-decline"
          onClick={handleDecline}
        >
          Decline referral
        </button>
      </div>

      {lastRejection ? (
        <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
          {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
          recorded: {lastRejection.reason}
        </p>
      ) : null}
    </section>
  );
}

/**
 * One band group: its heading, its two counts, and the rows in it.
 *
 * `<details>`/`<summary>` rather than a hand-built disclosure, deliberately. The summary — heading
 * and BOTH counts — is rendered whether the group is open or shut, and it is rendered for an empty
 * group exactly as for a populated one, which is the binding condition the owner attached to
 * collapsing at all. Nothing is omitted, nothing is reordered, and the open/shut state depends only
 * on viewport width: never on which band this is, and never on either count. Making an empty group
 * non-collapsible would be exactly that forbidden dependency, so every group behaves the same.
 *
 * The band is taken from the GROUP this row sits in rather than looked up again per row. A band
 * looked up in two places is a band that can disagree with itself, and here the heading and the
 * rows beneath it would be the two places.
 */
function BandGroup({
  group,
  counts,
  openByDefault,
  onAccept,
}: {
  group: TravelBandGroup;
  counts: TravelBandGroupCounts;
  openByDefault: boolean;
  onAccept: (unitId: string) => void;
}) {
  /* Seeded from the width default and then owned by the coordinator's own toggling. The parent
   * REMOUNTS this component when that default changes (see its `key`), which is what re-seeds every
   * group on a rotation or resize — deliberately, rather than by setting state from an effect. */
  const [open, setOpen] = useState(openByDefault);

  const label = travelBandGroupLabel(group.band);
  return (
    <details
      className={styles.bandGroup}
      data-testid={`ward-referral-match-band-group-${group.band}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.bandSummary}>
        <span className={styles.bandLabel}>{label}</span>
        {/* Two positive facts about the beds in this band, from `travelBandGroupCounts` — which
         *  counts the very candidates rendered below, so a heading cannot disagree with its own
         *  rows. Neither figure counts what is missing. The sentence itself is
         *  `travelBandGroupCountsSentence`, shared with the network diagram since Phase 8 Task 8
         *  put band groups on that screen too — one spelling, so the two surfaces cannot drift. */}
        <span className={styles.bandCounts} data-testid={`ward-referral-match-band-counts-${group.band}`}>
          {travelBandGroupCountsSentence(counts)}
        </span>
      </summary>
      {group.candidates.length === 0 ? (
        <p className={styles.bandEmpty} data-testid={`ward-referral-match-band-empty-${group.band}`}>
          {TRAVEL_BAND_GROUP_EMPTY_SENTENCE}
        </p>
      ) : (
        <ul className={styles.bandRows}>
          {group.candidates.map((candidate) => (
            <MatchRow key={candidate.unit.id} candidate={candidate} bandText={label} onAccept={onAccept} />
          ))}
        </ul>
      )}
    </details>
  );
}

function MatchRow({
  candidate,
  bandText,
  onAccept,
}: {
  candidate: ReferralCandidate;
  bandText: string;
  onAccept: (unitId: string) => void;
}) {
  const { unit } = candidate;
  return (
    <li
      className={candidateAccepts(candidate) ? styles.matchRowAccepts : styles.matchRowDeclines}
      data-testid={`ward-referral-match-row-${unit.id}`}
    >
      <div className={styles.matchRowTop}>
        <span className={styles.matchUnitName}>{unit.name}</span>
        {/* D7: a forensic bed is described so the board is honest about the network — shown with
         *  its own category, never merely absent from the accepting list without saying why. */}
        {unit.forensic ? (
          <span className={styles.forensicBadge} data-testid={`ward-referral-match-forensic-${unit.id}`}>
            Forensic
          </span>
        ) : null}
      </div>
      <p className={styles.matchBand} data-testid={`ward-referral-match-band-${unit.id}`}>
        {bandText}
      </p>
      {candidateAccepts(candidate) ? (
        <div className={styles.matchAcceptRow}>
          <span className={styles.acceptsLabel} data-testid={`ward-referral-match-accepts-${unit.id}`}>
            Accepts this referral
          </span>
          <button
            type="button"
            className={styles.acceptButton}
            data-testid={`ward-referral-match-accept-${unit.id}`}
            onClick={() => onAccept(unit.id)}
          >
            Accept at {unit.name}
          </button>
        </div>
      ) : (
        <p className={styles.matchReasonText} data-testid={`ward-referral-match-reason-${unit.id}`}>
          {matchReason(candidate)}
        </p>
      )}
    </li>
  );
}
