"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { clockState, formatInstant, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import {
  candidateReason,
  destinationUnit,
  eligibleCandidates,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { eligibility, type GateResult } from "@/components/ward-management/ward-eligibility";
import { PARALLEL_REFERRAL_CAP, type Movement, type Unit } from "@/components/ward-management/ward-model";
import { operationalScore } from "@/components/ward-management/ward-priority";
import { allEmergencyDepartments, unitById } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./coordinator.module.css";

type ShortlistPanelProps = {
  movement: Movement | undefined;
  now: Instant;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
};

type Confirmation =
  { kind: "confirm"; unitId: string; at: Instant } | { kind: "override"; unitId: string; at: Instant; reason: string };

/**
 * Human labels for the eight `eligibility()` gates. Order here is irrelevant — the rendered list
 * is sorted failures-first from the real `GateResult[]`, never from this map's key order.
 */
const GATE_LABELS: Record<string, string> = {
  authorisation: "Mental Health Act authorisation",
  cohort: "Cohort match",
  security: "Security level",
  sex_mix: "Sex mix",
  specialling: "Specialling capacity",
  prior_decline: "Prior decline",
  capacity_freshness: "Capacity freshness",
  allocatable_bed: "Allocatable bed",
};

function capacityLine(unit: Unit) {
  const capacity = unitCapacity(unit);
  return `Ready ${capacity.available} · Held ${capacity.held} · Blocked ${capacity.blocked} · Occupied ${capacity.occupied}`;
}

function legalFormLine(movement: Movement, now: Instant) {
  if (!movement.legalForm) return "No legal form recorded for this movement";
  const remaining = minutesUntil(movement.legalForm.dueAt, now);
  const named = `Form ${movement.legalForm.code} (${movement.legalForm.label})`;
  return remaining < 0
    ? `${named} passed its deadline ${Math.abs(remaining)} min ago`
    : `${named} due in ${remaining} min`;
}

/**
 * The explainable shortlist: where the placement decision is actually made. Every gate row states
 * its own verdict in real text (never icon-only), all eight gates render every time (never
 * `.slice()`), an ineligible candidate is never presented or styled as a recommendation, and
 * nothing is allocated until a human clicks Confirm or records an override reason.
 *
 * Controller finding this task exists to close: the whole-branch review found a green tick
 * rendered beside "is not authorised under the Mental Health Act" — a gate row whose icon was
 * driven by something other than the gate's own `pass` boolean. Every icon below reads directly
 * off `gate.pass`; nothing else is permitted to decide it (see the report's red/green proof).
 */
export function ShortlistPanel({ movement, now, selectedUnitId, onSelectUnit }: ShortlistPanelProps) {
  const shortlist = useMemo(
    () => (movement ? eligibleCandidates(movement, now, PARALLEL_REFERRAL_CAP) : []),
    [movement, now],
  );

  // The unit whose gates this panel currently explains. A selection carried over from another
  // page (the diagram shares the same `selectedUnitId` state) is honoured even when it falls
  // outside this movement's own nearest-three shortlist — the truth about an arbitrary unit
  // against this movement is still real data, never fabricated. With nothing selected, this
  // defaults to the shortlist's own first (eligible-first) candidate, so the gate list is never
  // empty the moment a movement is chosen.
  const activeUnit = useMemo(() => {
    if (selectedUnitId) return unitById(selectedUnitId);
    return shortlist[0]?.unit;
  }, [selectedUnitId, shortlist]);

  const activeVerdict = useMemo(() => {
    if (!movement || !activeUnit) return undefined;
    const cached = shortlist.find((candidate) => candidate.unit.id === activeUnit.id);
    return cached ? cached.verdict : eligibility(movement, activeUnit, now);
  }, [movement, activeUnit, shortlist, now]);

  // Failures first, stable otherwise — never a `.slice()`. All eight gates render every time.
  const sortedGates: GateResult[] = useMemo(
    () => (activeVerdict ? [...activeVerdict.gates].sort((a, b) => Number(a.pass) - Number(b.pass)) : []),
    [activeVerdict],
  );

  const [confirmation, setConfirmation] = useState<Confirmation | undefined>(undefined);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmationMovementId, setConfirmationMovementId] = useState(movement?.id);

  // A confirmation or an open override form belongs to the movement it was made against — moving
  // to a different movement must never leave a stale "Confirmed" record from the last one on
  // screen, or a half-typed override reason attached to the wrong patient. Reset during render
  // (React's documented "adjusting state when a prop changes" pattern) rather than in an effect —
  // an effect body calling `setState` synchronously forces an extra, avoidable render pass.
  if (movement?.id !== confirmationMovementId) {
    setConfirmationMovementId(movement?.id);
    setConfirmation(undefined);
    setOverrideOpen(false);
    setOverrideReason("");
  }

  if (!movement) {
    return (
      <p className={styles.placeholder}>Select a movement from the priority queue to see its explainable shortlist.</p>
    );
  }

  const originEd = allEmergencyDepartments().find((ed) => ed.id === movement.originEdId);
  // Neutral "currently at" language, never framed as an authorisation requirement — authorisation
  // gates the destination only, and a patient's current ED is never itself a compliance problem.
  const originLabel = originEd
    ? `Currently at ${originEd.siteCode} — ${originEd.name}`
    : "Currently at an unresolved department";

  const legalBreached = movement.legalForm ? clockState(movement.legalForm.dueAt, now) === "breached" : false;

  // The destination slot. `destinationUnit` conflates acceptance with an outstanding referral
  // into one field, so the accepted/referred distinction is read directly off the movement (same
  // reasoning `flow-diagram.tsx` already applies). When nothing is recorded, the top ELIGIBLE
  // candidate — never a merely-nearest ineligible one — is offered, and only ever labelled
  // "Suggested destination": a computed suggestion must never sit unlabelled in the destination
  // slot, and an ineligible nearest candidate must never be presented as a suggestion at all.
  const hasRecordedReferral = Boolean(movement.acceptedUnitId) || movement.referredUnitIds.length > 0;
  const recordedUnit = destinationUnit(movement);
  const topEligible = shortlist.find((candidate) => candidate.verdict.eligible);
  const extraReferralCount =
    !movement.acceptedUnitId && movement.referredUnitIds.length > 1 ? movement.referredUnitIds.length - 1 : 0;

  const canConfirm = activeUnit !== undefined && activeVerdict?.eligible === true;
  const canOverride = activeUnit !== undefined;
  const confirmUnavailableReason = !activeUnit
    ? "Select a candidate unit before confirming."
    : activeVerdict
      ? `Not eligible — ${candidateReason(activeVerdict)}`
      : "Eligibility could not be determined for this unit.";

  const { score, factors } = operationalScore(movement, now);

  function handleConfirm() {
    if (!activeUnit || !canConfirm) return;
    setConfirmation({ kind: "confirm", unitId: activeUnit.id, at: now });
    setOverrideOpen(false);
  }

  function handleOverrideSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUnit) return;
    const reason = overrideReason.trim();
    if (reason.length === 0) return;
    setConfirmation({ kind: "override", unitId: activeUnit.id, at: now, reason });
    setOverrideOpen(false);
    setOverrideReason("");
  }

  const confirmedUnit = confirmation ? unitById(confirmation.unitId) : undefined;

  return (
    <div className={styles.shortlistBody} data-testid={`ward-shortlist-${movement.id}`}>
      <header className={styles.shortlistHeader}>
        <div className={styles.shortlistHeaderTop}>
          <h3 className={styles.shortlistMovementId}>{movement.id}</h3>
          <span className={styles.shortlistTierBadge} data-tier={movement.urgency}>
            Tier {movement.urgency}
          </span>
        </div>
        <span className={styles.shortlistMetaLine}>
          {movement.cohort} · {movement.security}
        </span>
        <span className={styles.shortlistMetaLine}>{originLabel}</span>
        <span className={legalBreached ? styles.shortlistLegalBreach : styles.shortlistMetaLine}>
          {movement.legalStatus} · {legalFormLine(movement, now)}
        </span>

        {hasRecordedReferral ? (
          recordedUnit ? (
            <span className={movement.acceptedUnitId ? styles.shortlistAcceptedBadge : styles.shortlistReferredBadge}>
              {movement.acceptedUnitId ? "Accepted destination" : "Outstanding referral"}: {recordedUnit.name}
              {extraReferralCount > 0
                ? ` (+${extraReferralCount} more referral${extraReferralCount === 1 ? "" : "s"})`
                : ""}
            </span>
          ) : (
            <span className={styles.shortlistUnresolvedBadge}>Recorded destination could not be resolved.</span>
          )
        ) : topEligible ? (
          <span className={styles.shortlistSuggestedBadge}>Suggested destination: {topEligible.unit.name}</span>
        ) : (
          <span className={styles.shortlistUnresolvedBadge}>No eligible destination found yet.</span>
        )}
      </header>

      <section aria-label="Candidate units">
        <h4 className={styles.shortlistSectionHeading}>Nearest candidates</h4>
        {shortlist.length === 0 ? (
          <p className={styles.placeholder}>No cohort-matching units found.</p>
        ) : (
          <ul className={styles.shortlistCandidateList}>
            {shortlist.map((candidate) => {
              const selected = activeUnit?.id === candidate.unit.id;
              return (
                <li key={candidate.unit.id}>
                  <button
                    type="button"
                    data-testid={`ward-shortlist-candidate-${candidate.unit.id}`}
                    data-eligible={String(candidate.verdict.eligible)}
                    aria-pressed={selected}
                    className={styles.shortlistCandidateRow}
                    onClick={() => onSelectUnit(candidate.unit.id)}
                  >
                    <span className={styles.shortlistCandidateName}>{candidate.unit.name}</span>
                    <span className={styles.shortlistCandidateCapacity}>{capacityLine(candidate.unit)}</span>
                    <span
                      className={
                        candidate.verdict.eligible
                          ? styles.shortlistCandidateReasonOk
                          : styles.shortlistCandidateReasonBad
                      }
                    >
                      {candidateReason(candidate.verdict)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Eligibility checks">
        <h4 className={styles.shortlistSectionHeading}>
          Eligibility checks{activeUnit ? ` for ${activeUnit.name}` : ""}
        </h4>
        {sortedGates.length === 0 ? (
          <p className={styles.placeholder}>Select a candidate unit to see its eligibility checks.</p>
        ) : (
          <ol className={styles.shortlistGateList}>
            {sortedGates.map((gate) => (
              <li
                key={gate.gate}
                data-testid={`ward-gate-${gate.gate}`}
                data-pass={String(gate.pass)}
                className={styles.shortlistGateRow}
              >
                {gate.pass ? (
                  <CheckCircle2 aria-hidden="true" className={styles.shortlistGateIconOk} />
                ) : (
                  <CircleAlert aria-hidden="true" className={styles.shortlistGateIconBad} />
                )}
                <span className={styles.shortlistGateLabel}>{GATE_LABELS[gate.gate] ?? gate.gate}</span>
                <strong className={gate.pass ? styles.shortlistGateVerdictOk : styles.shortlistGateVerdictBad}>
                  {gate.pass ? "Met" : "Not met"}
                </strong>
                <span className={styles.shortlistGateDetail}>{gate.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Declines">
        <h4 className={styles.shortlistSectionHeading}>Declines</h4>
        {movement.declines.length === 0 ? (
          <p className={styles.placeholder}>No destination has declined this movement.</p>
        ) : (
          <ul className={styles.shortlistDeclineList}>
            {movement.declines.map((decline, index) => {
              const unit = unitById(decline.unitId);
              return (
                <li key={`${decline.unitId}-${index}`} className={styles.shortlistDeclineRow}>
                  <strong>{unit ? unit.name : "Unresolved unit"}</strong>
                  <span>
                    {decline.reason.replace(/_/g, " ")}
                    {decline.note ? ` — ${decline.note}` : ""}
                  </span>
                  <span>{formatInstant(decline.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className={styles.shortlistScoreDetails}>
        <summary className={styles.shortlistScoreSummary}>Operational score {score}</summary>
        <p className={styles.shortlistScoreNote}>
          Urgency tier orders the queue; this operational score only breaks ties inside a tier and never represents the
          patient&apos;s clinical presentation.
        </p>
        {factors.length === 0 ? (
          <p className={styles.placeholder}>No contributing factors currently.</p>
        ) : (
          <ul className={styles.shortlistScoreList}>
            {factors.map((factor) => (
              <li key={factor.label} className={styles.shortlistScoreFactor}>
                <strong>{factor.label}</strong> +{factor.points} — {factor.detail}
              </li>
            ))}
          </ul>
        )}
      </details>

      <footer className={styles.shortlistActions}>
        <p className={styles.shortlistAutoAllocationNote}>System suggests, you decide. No automatic allocation.</p>

        {confirmation && confirmedUnit ? (
          <p className={styles.shortlistConfirmationRecord} data-testid="ward-shortlist-confirmation-record">
            {confirmation.kind === "confirm"
              ? `Confirmed by a human coordinator: ${confirmedUnit.name} at ${formatInstant(confirmation.at)}. No bed was allocated automatically.`
              : `Overridden by a human coordinator: ${confirmedUnit.name} at ${formatInstant(confirmation.at)} — reason: "${confirmation.reason}". No bed was allocated automatically.`}
          </p>
        ) : null}

        <div className={styles.shortlistActionRow}>
          <button
            type="button"
            data-testid="ward-shortlist-confirm"
            aria-disabled={canConfirm ? undefined : "true"}
            aria-describedby={canConfirm ? undefined : "ward-shortlist-confirm-unavailable"}
            title={canConfirm ? undefined : confirmUnavailableReason}
            className={styles.shortlistConfirmButton}
            onClick={canConfirm ? handleConfirm : ignoreUnavailableActivation}
          >
            Confirm placement
          </button>
          <button
            type="button"
            data-testid="ward-shortlist-override-toggle"
            aria-disabled={canOverride ? undefined : "true"}
            aria-describedby={canOverride ? undefined : "ward-shortlist-override-unavailable"}
            title={canOverride ? undefined : "Select a candidate unit before overriding."}
            aria-expanded={overrideOpen}
            className={styles.shortlistOverrideButton}
            onClick={canOverride ? () => setOverrideOpen((open) => !open) : ignoreUnavailableActivation}
          >
            Override
          </button>
        </div>
        {!canConfirm ? (
          <span id="ward-shortlist-confirm-unavailable" className="sr-only">
            {confirmUnavailableReason}
          </span>
        ) : null}
        {!canOverride ? (
          <span id="ward-shortlist-override-unavailable" className="sr-only">
            Select a candidate unit before overriding.
          </span>
        ) : null}

        {overrideOpen && activeUnit ? (
          <form className={styles.shortlistOverrideForm} onSubmit={handleOverrideSubmit}>
            <label className={styles.shortlistOverrideLabel} htmlFor="ward-shortlist-override-reason">
              Reason for overriding the shortlist for {activeUnit.name}
            </label>
            <textarea
              id="ward-shortlist-override-reason"
              required
              className={styles.shortlistOverrideTextarea}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
            <button type="submit" className={styles.shortlistOverrideSubmit}>
              Record override
            </button>
          </form>
        ) : null}
      </footer>
    </div>
  );
}
