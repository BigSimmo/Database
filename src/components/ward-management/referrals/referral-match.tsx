"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
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
  matchReason,
  networkHasCohort,
  referralCandidates,
  referralWaitLabel,
  type ReferralCandidate,
} from "@/components/ward-management/ward-referrals";

import styles from "./referrals.module.css";

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
  const candidates = referralCandidates(referral, units, now);
  const accepting = candidates.filter(candidateAccepts);
  const hasCohort = networkHasCohort(referral, units);

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
        (newest.attempted === "ACCEPT_REFERRAL" || newest.attempted === "DECLINE_REFERRAL");
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
        {referral.ageBand} · {referral.sex} · {referral.homeRegion}
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

      <ul className={styles.matchList} data-testid="ward-referral-match-list">
        {candidates.map((candidate) => (
          <MatchRow key={candidate.unit.id} candidate={candidate} onAccept={handleAccept} />
        ))}
      </ul>

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
          {lastRejection.attempted === "ACCEPT_REFERRAL" ? "Acceptance" : "Decline"} not recorded:{" "}
          {lastRejection.reason}
        </p>
      ) : null}
    </section>
  );
}

function MatchRow({ candidate, onAccept }: { candidate: ReferralCandidate; onAccept: (unitId: string) => void }) {
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
