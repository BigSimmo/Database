"use client";

import { useState, type FormEvent } from "react";

import {
  BED_RELEASE_BLOCKERS,
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  RELEASE_HOLD_REASONS,
  type BedReleaseBlocker,
  type CancelTransportReason,
  type ReleaseHoldReason,
} from "@/components/ward-management/ward-change-reasons";
import { formatInstant, formatRemaining, minutesUntil } from "@/components/ward-management/ward-clock";
import {
  elapsedLabel,
  isOpen,
  restrictionNotice,
  stageCopy,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import {
  BED_RELEASE_CONFIDENCE_LEVELS,
  DECLINE_REASONS,
  type BedReleaseConfidence,
  type DeclineReason,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./ward.module.css";

type WardScreenProps = { unitId: string };

/**
 * `ACCEPT_IN_PRINCIPLE` and `DECLINE` refuse for exactly the same reasons in
 * `wardFlowReducer` — outside `destination_review`, an already-accepted movement, or this unit
 * holding no live referral for it. Computed once so the two buttons on an incoming-referral card
 * can never advertise different verdicts about whether the reducer would take the action (the
 * defect class this whole phase exists to close — see `shortlist-panel.tsx`'s `canRefer`).
 */
function referralAnswerBlocked(movement: Movement, unit: Unit): string | undefined {
  if (movement.stage !== "destination_review") {
    return `${movement.id} is ${stageCopy[movement.stage].label.toLowerCase()}, not awaiting a destination decision.`;
  }
  if (movement.acceptedUnitId) {
    return `${movement.id} already has an accepted destination.`;
  }
  if (!movement.referredUnitIds.includes(unit.id)) {
    return `${unit.name} does not currently hold a live referral for ${movement.id}.`;
  }
  return undefined;
}

/** `HOLD_BED`'s own preconditions, named so the Hold button can never advertise an action the
 * reducer would refuse. Only rendered at all once `movement.stage === "accepted_awaiting_bed"`;
 * this covers the remaining reasons a hold could still be refused at that stage. */
function holdBlockedReason(movement: Movement, unit: Unit): string | undefined {
  if (movement.acceptedUnitId !== unit.id) {
    return `${movement.id} was accepted at a different unit, not ${unit.name}.`;
  }
  if (unit.allocatable.value <= 0) {
    return `No allocatable bed remains at ${unit.name}.`;
  }
  return undefined;
}

/**
 * Task 8: one inpatient unit's own view — the ward answering what the coordinator refers,
 * never a filtered copy of the coordinator's statewide screen. Everything here is scoped to
 * exactly one `Unit`, resolved from the provider's live `units`. An id that resolves to nothing
 * renders an explicit empty state naming the id (Global Constraint, addendum R40) — never a
 * substituted unit, never `?? allUnits()[0]`.
 *
 * Every figure is derived fresh from the live `movements`/`units` the provider hands back on
 * every render, never cached in local state — the same discipline `ward-flow-queue-selection`
 * proves for the coordinator screen. Once a referral is accepted, it disappears from "incoming"
 * and appears under "accepted, held or en route" on the very next render, because both lists are
 * plain filters over the same live array; there is no local "it worked" flag anywhere in this
 * file for the reasons `shortlist-panel.tsx`'s own comment on `OverrideRecord` explains.
 *
 * Whole-branch review Critical 1: this screen used to resolve `unit` via `unitById(unitId)` —
 * `ward-sites.ts`'s frozen fixture — so this ward's own bed grid, its "Currently confirmed"
 * line, its capacity-input default and `holdBlockedReason`'s allocatable check never moved even
 * after this exact screen dispatched `CONFIRM_CAPACITY` against itself. `unit` now resolves from
 * the provider's live `units`, the same collection `CONFIRM_CAPACITY`/`HOLD_BED`/`PATIENT_ARRIVED`
 * all write to, so a ward reading its own action back is now structurally the same read as
 * anyone else reading it.
 */
export function WardScreen({ unitId }: WardScreenProps) {
  const { movements, units, bedReleases, now, dispatch } = useWardFlow();
  // Resolved from the provider's live `units`, not the frozen `unitById()` fixture — after
  // `CONFIRM_CAPACITY` or `HOLD_BED` updates `state.units`, this screen must show the current
  // bed counts (and gate `holdBlockedReason` on them) rather than the stale fixture value.
  const unit = units.find((candidate) => candidate.id === unitId);

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, and the not-found branch never touches either of these.
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineReason, setDeclineReason] = useState<DeclineReason | undefined>(undefined);
  const [capacityValue, setCapacityValue] = useState<string>(() => String(unit?.allocatable.value ?? 0));
  // Task 3: the undo the prototype has never had. Keyed by movementId, same pattern as
  // `declineOpenFor`/`declineReason` above — at most one release form and one cancel form open
  // at a time.
  const [releaseOpenFor, setReleaseOpenFor] = useState<string | undefined>(undefined);
  const [releaseReason, setReleaseReason] = useState<ReleaseHoldReason | undefined>(undefined);
  const [cancelOpenFor, setCancelOpenFor] = useState<string | undefined>(undefined);
  const [cancelReason, setCancelReason] = useState<CancelTransportReason | undefined>(undefined);
  // Task 11 (spec item 9): the bed-release flag. Not keyed by movement id — unlike decline,
  // release and cancel above, this is not about any one referral, it is about this ward's own
  // bed stock, so one form per screen is enough.
  const [bedReleaseConfidence, setBedReleaseConfidence] = useState<BedReleaseConfidence | undefined>(undefined);
  const [bedReleaseBlocker, setBedReleaseBlocker] = useState<BedReleaseBlocker | undefined>(undefined);

  if (!unit) {
    return (
      <div className={styles.screen} data-testid="ward-unit-screen">
        <ClinicalRail />
        <main id="main-content" className={styles.main}>
          <h1 className={styles.notFoundHeading}>Ward not found</h1>
          <p className={styles.notFoundBody} data-testid="ward-unit-unresolved">
            No synthetic unit matches &ldquo;{unitId}&rdquo;. It may have been renamed or removed, or the id in the
            address is incorrect — this never falls back to a different ward.
          </p>
        </main>
      </div>
    );
  }

  const site = siteByCode(unit.siteCode);
  const capacity = unitCapacity(unit, bedReleases);
  // TypeScript's narrowing of `unit` above does not reach into the `submitDecline` /
  // `submitCapacity` closures defined further down (the same reason `shortlist-panel.tsx`'s
  // `handleRefer` closes over a plain `movementId` rather than re-checking `movement`), so this
  // plain string is what they close over instead.
  const wardUnitId = unit.id;

  // Awaiting an answer: this unit holds a live referral and nothing has been decided yet.
  const incoming = movements.filter(
    (movement) =>
      isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unit.id),
  );
  // Accepted, held, or en route: this unit is the recorded destination, at any stage from
  // acceptance through transport. `isOpen` excludes `arrived` — once a patient arrives the record
  // closes and the bed shows as occupied in the grid above, not as a card here.
  const accepted = movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id);
  // What was withdrawn from this ward specifically, and why — `withdrawnReferrals` is per
  // movement, so this reads each movement's own array rather than assuming only one entry exists.
  const withdrawn = movements.filter((movement) =>
    movement.withdrawnReferrals.some((entry) => entry.unitId === unit.id),
  );

  function toggleDecline(movementId: string) {
    setDeclineOpenFor((current) => (current === movementId ? undefined : movementId));
    setDeclineReason(undefined);
  }

  function submitDecline(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!declineReason) return;
    dispatch({ type: "DECLINE", role: "ward", now, movementId, unitId: wardUnitId, reason: declineReason });
    setDeclineOpenFor(undefined);
    setDeclineReason(undefined);
  }

  function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(capacityValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    // `actingUnitId` is this screen's own route parameter — the unit this screen is displaying and
    // acting as. It states which ward the caller says it is; it does not prove it, and the
    // reducer's comment on the matching check says the same. On this screen the two ids are equal
    // by construction (`unit` was resolved by matching the route id), so this guard is not what
    // stops *this* caller misusing the event — it is what stops any other call site writing to a
    // unit it did not claim to be acting as, and what puts that claim on the event where the
    // reducer can compare it.
    dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      value: Math.floor(parsed),
    });
  }

  function submitBedRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bedReleaseConfidence || !bedReleaseBlocker) return;
    // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above —
    // it states which ward the caller says it is; it does not prove it. FLAG_BED_RELEASE is
    // ward-only, so this comparison always runs (see the reducer's own comment on the case).
    dispatch({
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      confidence: bedReleaseConfidence,
      blocker: bedReleaseBlocker,
    });
    setBedReleaseConfidence(undefined);
    setBedReleaseBlocker(undefined);
  }

  function toggleRelease(movementId: string) {
    setReleaseOpenFor((current) => (current === movementId ? undefined : movementId));
    setReleaseReason(undefined);
  }

  function submitRelease(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!releaseReason) return;
    // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above —
    // it states which ward the caller says it is; it does not prove it.
    dispatch({
      type: "RELEASE_HOLD",
      role: "ward",
      now,
      movementId,
      actingUnitId: unitId,
      reason: releaseReason,
    });
    setReleaseOpenFor(undefined);
    setReleaseReason(undefined);
  }

  function toggleCancel(movementId: string) {
    setCancelOpenFor((current) => (current === movementId ? undefined : movementId));
    setCancelReason(undefined);
  }

  function submitCancel(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!cancelReason) return;
    dispatch({
      type: "CANCEL_TRANSPORT",
      role: "ward",
      now,
      movementId,
      actingUnitId: unitId,
      reason: cancelReason,
    });
    setCancelOpenFor(undefined);
    setCancelReason(undefined);
  }

  return (
    <div className={styles.screen} data-testid="ward-unit-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-unit-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This is {unit.name}&apos;s own view. Every figure and referral below belongs to this ward &mdash; never
            another one. No bed is ever allocated automatically; a human here confirms every step.
          </p>
        </div>

        <header className={styles.unitCard} data-testid={`ward-unit-card-${unit.id}`}>
          <h1 className={styles.unitName}>{unit.name}</h1>
          <p className={styles.unitMeta}>
            {site ? `${site.name} (${site.code})` : unit.siteCode} &middot; {unit.cohort} &middot; {unit.security}
            {unit.authorised ? "" : " · Not authorised under the Mental Health Act 2014"}
          </p>
        </header>

        <section aria-label="Bed capacity" className={styles.bedSection}>
          <h2 className={styles.sectionHeading}>Bed capacity</h2>
          <div className={styles.bedGrid} data-testid="ward-unit-beds">
            <span className={styles.bedChip} data-state="available">
              Ready {capacity.available}
            </span>
            <span className={styles.bedChip} data-state="held">
              Held {capacity.held}
            </span>
            <span className={styles.bedChip} data-state="blocked">
              Blocked {capacity.blocked}
            </span>
            <span className={styles.bedChip} data-state="occupied">
              Occupied {capacity.occupied}
            </span>
            <span className={styles.bedChip} data-state="potential">
              Potential {capacity.potential}
            </span>
          </div>
          <p className={styles.bedNote}>
            Ready, held, blocked and occupied add up to all {unit.beds} beds at {unit.name}. Potential is beds expected
            to free up &mdash; it is never counted into the four above.
          </p>

          <form className={styles.capacityForm} onSubmit={submitCapacity} data-testid="ward-capacity-form">
            <label className={styles.capacityLabel} htmlFor="ward-capacity-input">
              Confirm allocatable beds for {unit.name}
            </label>
            <div className={styles.capacityRow}>
              <input
                id="ward-capacity-input"
                data-testid="ward-capacity-input"
                type="number"
                min={0}
                max={unit.beds}
                value={capacityValue}
                onChange={(event) => setCapacityValue(event.target.value)}
                className={styles.capacityInput}
              />
              <button type="submit" data-testid="ward-capacity-submit" className={styles.capacitySubmit}>
                Confirm capacity
              </button>
            </div>
            <p className={styles.capacityConfirmed}>
              Currently confirmed {unit.allocatable.value} at {formatInstant(unit.allocatable.confirmedAt)}. Writes to{" "}
              {unit.name} only &mdash; never any other ward.
            </p>
          </form>

          {/* Task 11 (spec item 9): a ward can now flag its own bed coming free, rather than
              `potential` only ever moving through the frozen fixture. Always available — unlike
              the incoming-referral and accepted-movement controls below, FLAG_BED_RELEASE carries
              no movement-stage precondition to gate on, so this control renders unconditionally
              rather than checking a `blocked` reason that does not exist. */}
          <form className={styles.capacityForm} onSubmit={submitBedRelease} data-testid="ward-flag-bed-release">
            <span className={styles.capacityLabel}>Flag a bed coming free at {unit.name}</span>
            <div className={styles.capacityRow}>
              <div>
                <label className={styles.declineLegend} htmlFor="ward-bed-release-confidence">
                  Confidence
                </label>
                <select
                  id="ward-bed-release-confidence"
                  required
                  className={styles.capacityInput}
                  value={bedReleaseConfidence ?? ""}
                  onChange={(event) => setBedReleaseConfidence(event.target.value as BedReleaseConfidence)}
                >
                  <option value="" disabled>
                    Choose confidence
                  </option>
                  {BED_RELEASE_CONFIDENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.declineLegend} htmlFor="ward-bed-release-blocker">
                  Blocker
                </label>
                <select
                  id="ward-bed-release-blocker"
                  required
                  className={styles.capacityInput}
                  value={bedReleaseBlocker ?? ""}
                  onChange={(event) => setBedReleaseBlocker(event.target.value as BedReleaseBlocker)}
                >
                  <option value="" disabled>
                    Choose blocker
                  </option>
                  {BED_RELEASE_BLOCKERS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                data-testid="ward-flag-bed-release-submit"
                className={styles.capacitySubmit}
                disabled={!bedReleaseConfidence || !bedReleaseBlocker}
              >
                Flag bed coming free
              </button>
            </div>
            <p className={styles.capacityConfirmed}>
              Records confidence and blocker only &mdash; nothing about the departing patient. Writes to {unit.name}{" "}
              only &mdash; never any other ward.
            </p>
          </form>
        </section>

        <section aria-label="Incoming referrals" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Incoming referrals awaiting an answer</h2>
          {incoming.length === 0 ? (
            <p className={styles.placeholder}>No referral is currently awaiting an answer from {unit.name}.</p>
          ) : (
            <ul className={styles.cardList}>
              {incoming.map((movement) => {
                const blocked = referralAnswerBlocked(movement, unit);
                const notice = restrictionNotice(movement, unit);
                const parallel = movement.referredUnitIds.length > 1;
                const declineOpen = declineOpenFor === movement.id;
                return (
                  <li key={movement.id} data-testid={`ward-incoming-${movement.id}`} className={styles.card}>
                    <header className={styles.cardHeader}>
                      <strong>{movement.id}</strong>
                      <span className={styles.cardMeta}>
                        {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                        {movement.legalStatus}
                      </span>
                      <span className={styles.cardMeta}>{elapsedLabel(movement, now)}</span>
                    </header>
                    {parallel ? <span className={styles.parallelBadge}>Parallel referral</span> : null}
                    {notice ? (
                      <span
                        className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                        data-testid={`ward-restriction-notice-${movement.id}`}
                        data-level={notice.level}
                      >
                        {notice.text}
                      </span>
                    ) : null}
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        data-testid={`ward-accept-${movement.id}`}
                        aria-disabled={blocked ? "true" : undefined}
                        aria-describedby={blocked ? `ward-accept-unavailable-${movement.id}` : undefined}
                        title={blocked ?? undefined}
                        className={styles.acceptButton}
                        onClick={
                          blocked
                            ? ignoreUnavailableActivation
                            : () =>
                                dispatch({
                                  type: "ACCEPT_IN_PRINCIPLE",
                                  role: "ward",
                                  now,
                                  movementId: movement.id,
                                  unitId: unit.id,
                                })
                        }
                      >
                        Accept in principle
                      </button>
                      <button
                        type="button"
                        data-testid={`ward-decline-toggle-${movement.id}`}
                        aria-disabled={blocked ? "true" : undefined}
                        aria-describedby={blocked ? `ward-decline-unavailable-${movement.id}` : undefined}
                        title={blocked ?? undefined}
                        aria-expanded={declineOpen}
                        className={styles.declineButton}
                        onClick={blocked ? ignoreUnavailableActivation : () => toggleDecline(movement.id)}
                      >
                        Decline
                      </button>
                    </div>
                    {blocked ? (
                      <>
                        <span id={`ward-accept-unavailable-${movement.id}`} className="sr-only">
                          {blocked}
                        </span>
                        <span id={`ward-decline-unavailable-${movement.id}`} className="sr-only">
                          {blocked}
                        </span>
                      </>
                    ) : null}
                    {declineOpen && !blocked ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitDecline(event, movement.id)}
                        data-testid={`ward-decline-form-${movement.id}`}
                      >
                        <fieldset className={styles.declineFieldset}>
                          <legend className={styles.declineLegend}>Decline reason for {movement.id}</legend>
                          {DECLINE_REASONS.map((reason) => (
                            <label key={reason} className={styles.declineOption}>
                              <input
                                type="radio"
                                name={`decline-reason-${movement.id}`}
                                value={reason}
                                checked={declineReason === reason}
                                onChange={() => setDeclineReason(reason)}
                              />
                              {reason.replace(/_/g, " ")}
                            </label>
                          ))}
                        </fieldset>
                        <button type="submit" disabled={!declineReason} className={styles.declineSubmit}>
                          Confirm decline
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Accepted, held or en route" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Accepted, held or en route here</h2>
          {accepted.length === 0 ? (
            <p className={styles.placeholder}>No patient is currently accepted, held or en route to {unit.name}.</p>
          ) : (
            <ul className={styles.cardList}>
              {accepted.map((movement) => {
                const notice = restrictionNotice(movement, unit);
                const canHold = movement.stage === "accepted_awaiting_bed";
                const blocked = canHold ? holdBlockedReason(movement, unit) : undefined;
                // Task 3: each control renders ONLY when the reducer would accept it — never
                // dispatched optimistically and left for the reducer to refuse silently.
                const canRelease = movement.stage === "bed_held";
                const canCancel =
                  movement.transport !== undefined &&
                  movement.transport.cancelledAt === undefined &&
                  movement.transport.collectedAt === undefined &&
                  movement.transport.arrivedAt === undefined;
                const releaseOpen = releaseOpenFor === movement.id;
                const cancelOpen = cancelOpenFor === movement.id;
                return (
                  <li key={movement.id} data-testid={`ward-accepted-${movement.id}`} className={styles.card}>
                    <header className={styles.cardHeader}>
                      <strong>{movement.id}</strong>
                      <span className={styles.cardMeta}>{stageCopy[movement.stage].label}</span>
                    </header>
                    {notice ? (
                      <span
                        className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                        data-testid={`ward-restriction-notice-${movement.id}`}
                        data-level={notice.level}
                      >
                        {notice.text}
                      </span>
                    ) : null}
                    {movement.stage === "bed_held" && movement.bedHeldUntil !== undefined ? (
                      <span className={styles.cardMeta}>
                        Bed hold {formatRemaining(minutesUntil(movement.bedHeldUntil, now))}
                      </span>
                    ) : null}
                    {canHold ? (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-hold-${movement.id}`}
                          aria-disabled={blocked ? "true" : undefined}
                          aria-describedby={blocked ? `ward-hold-unavailable-${movement.id}` : undefined}
                          title={blocked ?? undefined}
                          className={styles.acceptButton}
                          onClick={
                            blocked
                              ? ignoreUnavailableActivation
                              : () =>
                                  dispatch({
                                    type: "HOLD_BED",
                                    role: "ward",
                                    now,
                                    movementId: movement.id,
                                    unitId: unit.id,
                                  })
                          }
                        >
                          Hold a bed
                        </button>
                        {blocked ? (
                          <span id={`ward-hold-unavailable-${movement.id}`} className="sr-only">
                            {blocked}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {canRelease ? (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-release-hold-toggle-${movement.id}`}
                          aria-expanded={releaseOpen}
                          className={styles.declineButton}
                          onClick={() => toggleRelease(movement.id)}
                        >
                          Release the held bed
                        </button>
                      </div>
                    ) : null}
                    {canRelease && releaseOpen ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitRelease(event, movement.id)}
                        data-testid={`ward-release-hold-${movement.id}`}
                      >
                        <label className={styles.declineLegend} htmlFor={`ward-release-hold-reason-${movement.id}`}>
                          Reason for releasing the held bed for {movement.id}
                        </label>
                        <select
                          id={`ward-release-hold-reason-${movement.id}`}
                          required
                          className={styles.capacityInput}
                          value={releaseReason ?? ""}
                          onChange={(event) => setReleaseReason(event.target.value as ReleaseHoldReason)}
                        >
                          <option value="" disabled>
                            Choose a reason
                          </option>
                          {RELEASE_HOLD_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {changeReasonLabels[reason]}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!releaseReason} className={styles.declineSubmit}>
                          Confirm release
                        </button>
                      </form>
                    ) : null}
                    {canCancel ? (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-cancel-transport-toggle-${movement.id}`}
                          aria-expanded={cancelOpen}
                          className={styles.declineButton}
                          onClick={() => toggleCancel(movement.id)}
                        >
                          Cancel transport
                        </button>
                      </div>
                    ) : null}
                    {canCancel && cancelOpen ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitCancel(event, movement.id)}
                        data-testid={`ward-cancel-transport-${movement.id}`}
                      >
                        <label className={styles.declineLegend} htmlFor={`ward-cancel-transport-reason-${movement.id}`}>
                          Reason for cancelling transport for {movement.id}
                        </label>
                        <select
                          id={`ward-cancel-transport-reason-${movement.id}`}
                          required
                          className={styles.capacityInput}
                          value={cancelReason ?? ""}
                          onChange={(event) => setCancelReason(event.target.value as CancelTransportReason)}
                        >
                          <option value="" disabled>
                            Choose a reason
                          </option>
                          {CANCEL_TRANSPORT_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {changeReasonLabels[reason]}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!cancelReason} className={styles.declineSubmit}>
                          Confirm cancellation
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Withdrawn referrals" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Withdrawn from {unit.name}</h2>
          {withdrawn.length === 0 ? (
            <p className={styles.placeholder}>No referral to {unit.name} has been withdrawn.</p>
          ) : (
            <ul className={styles.cardList}>
              {withdrawn.map((movement) => {
                // A movement carries one `withdrawnReferrals` entry per unit it withdrew from —
                // this reads the one that names THIS unit, never assuming index 0 (the same
                // reasoning `flow-diagram.tsx`'s `recordedDestinationIds` applies to referrals).
                const entry = movement.withdrawnReferrals.find((candidate) => candidate.unitId === unit.id);
                return (
                  <li key={movement.id} data-testid={`ward-withdrawn-${movement.id}`} className={styles.card}>
                    <strong>{movement.id}</strong>
                    <span className={styles.cardMeta}>{entry ? entry.reason : "Withdrawn — reason unresolved"}</span>
                    {entry ? <span className={styles.cardMeta}>{formatInstant(entry.at)}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
