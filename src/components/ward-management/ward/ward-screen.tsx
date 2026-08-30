"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  RELEASE_HOLD_REASONS,
  type BedPreparationNote,
  type BedReleaseBlocker,
  type CancelTransportReason,
  type ReleaseHoldReason,
} from "@/components/ward-management/ward-change-reasons";
import {
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import {
  BED_RELEASE_BLOCKED_FIGURE_LABEL,
  BED_RELEASE_BLOCKED_LABEL,
  bedReleaseStateLabels,
  elapsedLabel,
  isOpen,
  restrictionNotice,
  stageCopy,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import {
  BED_RELEASE_WAITING_ON,
  DECLINE_REASONS,
  type BedReleaseWaitingOn,
  type DeclineReason,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import type { Instant } from "@/components/ward-management/ward-clock";

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
 * Task 5: parses an `<input type="time">`'s `HH:MM` value into an `Instant`. This is string
 * parsing, not a wall-clock read, so it stays local to this component rather than moving into
 * `ward-clock.ts` (the one module permitted to read the wall clock — see that file's own
 * doc comment; parsing user-typed text is a different concern from reading `Date.now()`).
 * Returns `undefined` for an empty or malformed value so a caller can refuse the submit rather
 * than guessing a time.
 */
function parseTimeInputToInstant(value: string): Instant | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
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
  const { movements, units, bedReleases, leaveBeds, refreshRequests, now, dispatch } = useWardFlow();
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
  const [bedReleaseWaitingOn, setBedReleaseWaitingOn] = useState<BedReleaseWaitingOn | undefined>(undefined);
  const [bedReleaseBlocker, setBedReleaseBlocker] = useState<BedReleaseBlocker | undefined>(undefined);
  // Fix round 2 (P1): the ward's own estimate of when this bed will actually be free, collected
  // exactly like `leaveExpectedReturn` below and parsed the same way via
  // `parseTimeInputToInstant` — see `ward-flow-events.ts`'s `FLAG_BED_RELEASE.expectedAt` doc
  // comment for why this is a fact about the BED, not the departing patient.
  const [bedReleaseExpectedAt, setBedReleaseExpectedAt] = useState<string>("");
  // Task 5: the block form on an EXISTING release row. Keyed by release id, same one-open-at-a-time
  // pattern as `declineOpenFor`/`releaseOpenFor`/`cancelOpenFor` above.
  const [blockOpenFor, setBlockOpenFor] = useState<string | undefined>(undefined);
  const [blockChoice, setBlockChoice] = useState<BedReleaseBlocker | undefined>(undefined);
  // Bed-model rework (2026-08-28): the reversal form on an existing CONFIRMED release row, same
  // one-open-at-a-time pattern as the block form above. It exists because forbidding the
  // reversal never stopped wards reversing a decision — it only stopped them recording it.
  const [revertOpenFor, setRevertOpenFor] = useState<string | undefined>(undefined);
  const [revertChoice, setRevertChoice] = useState<BedReleaseWaitingOn | undefined>(undefined);
  // List 3 (2026-08-28): the preparation-note picker, one row open at a time — the same
  // open-for/choice pair the block and revert forms above already use.
  const [preparationOpenFor, setPreparationOpenFor] = useState<string | undefined>(undefined);
  const [preparationChoice, setPreparationChoice] = useState<BedPreparationNote | undefined>(undefined);
  // Task 5: the small leave-bed form. Not keyed by anything — like the flag-bed-release form
  // above, this is about this ward's own bed stock, so one form per screen is enough.
  const [leaveUsable, setLeaveUsable] = useState(false);
  const [leaveExpectedReturn, setLeaveExpectedReturn] = useState<string>("");

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
  // Visual-fix pass: the capacity board (`CapacityView` in `ward-management-modes.tsx`) was just
  // corrected to source Confirmed/Predicted from `capacityBreakdown()` rather than `unitCapacity()`'s
  // raw, state-and-timing-blind `potential` count — this screen used to be the one place still
  // showing that raw count as "Potential", which is how the same unit could read "Potential 1" here
  // and "Confirmed 1, Predicted 0" one screen over, for the exact same release. This screen now reads
  // the same breakdown so both screens describe the same beds the same way. `unitCapacity()` itself
  // is untouched — see its own doc comment on `potential` in `ward-derivations.ts`.
  const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
  // TypeScript's narrowing of `unit` above does not reach into the `submitDecline` /
  // `submitCapacity` closures defined further down (the same reason `shortlist-panel.tsx`'s
  // `handleRefer` closes over a plain `movementId` rather than re-checking `movement`), so this
  // plain string is what they close over instead.
  const wardUnitId = unit.id;

  // Task 5: this unit's own bed releases, still pending — `discharged` is terminal and drops off
  // this list (spec D10's "removes it from the pending list"), never rendered with dead controls.
  const pendingBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged",
  );

  // List 3 (2026-08-28): this unit's own beds that have already been DISCHARGED. They are the only
  // beds a preparation note applies to — the note says what a free bed is being made ready for.
  // They are deliberately a SEPARATE list from `pendingBedReleases` above rather than being
  // restored to it: `discharged` is still terminal for every lifecycle control, and nothing in this
  // section moves a stage.
  const dischargedBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === "discharged",
  );

  // Task 5: this unit's own beds currently occupied by someone on approved leave — read here only
  // to report the count on the leave-bed form below; never merged into any availability figure
  // (spec D4), and `RECORD_LEAVE_BED` (submitted by that form) is the only writer this screen has.
  const unitLeaveBeds = leaveBeds.filter((bed) => bed.unitId === unit.id);
  const unitLeaveBedsUsable = unitLeaveBeds.filter((bed) => bed.usable).length;

  // Task 5, spec D12: every REQUEST_CAPACITY_REFRESH raised against this unit, live from the
  // provider. `refreshRequests` only ever grows (the reducer never removes an entry), so the last
  // one in array order is always the most recent ask.
  const unitRefreshRequests = refreshRequests.filter((request) => request.unitId === unit.id);
  const latestRefreshRequest =
    unitRefreshRequests.length > 0 ? unitRefreshRequests[unitRefreshRequests.length - 1] : undefined;

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
    if (!bedReleaseWaitingOn) return;
    // Fix round 2 (P1): same parse-and-bail discipline as `submitLeaveBed`'s own
    // `expectedReturn` below — an empty or malformed time input refuses the submit rather than
    // guessing a value.
    const expectedAt = parseTimeInputToInstant(bedReleaseExpectedAt);
    if (expectedAt === undefined) return;
    // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above —
    // it states which ward the caller says it is; it does not prove it. FLAG_BED_RELEASE is
    // ward-only, so this comparison always runs (see the reducer's own comment on the case).
    // `blocker` is optional here (Phase 5, spec D3) — a bed flagged with a blocker records a
    // held release; a bed flagged with none is a plain prediction. Task 5 redesigns this panel
    // to make that choice explicit; this is the minimum needed to keep it compiling and honest.
    dispatch({
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      waitingOn: bedReleaseWaitingOn,
      expectedAt,
      blocker: bedReleaseBlocker,
    });
    setBedReleaseWaitingOn(undefined);
    setBedReleaseBlocker(undefined);
    setBedReleaseExpectedAt("");
  }

  // Task 5 (spec D10): the ward moving its OWN bed release through its own lifecycle —
  // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` and
  // `submitBedRelease` above. `predicted -> confirmed` is the only transition
  // CONFIRM_BED_RELEASE accepts; this is only ever rendered on a predicted row (see the
  // legal-transition gating in the render below), so the reducer is never asked for a transition
  // the row does not itself offer.
  function confirmBedRelease(releaseId: string) {
    dispatch({ type: "CONFIRM_BED_RELEASE", role: "ward", now, releaseId, actingUnitId: unitId });
  }

  // Bed-model rework (2026-08-28): the reversal. `confirmed -> predicted`, recorded like any
  // other change. What the discharge is waiting on has to be restated because a predicted release
  // carries it and a confirmed release does not — this row's own picker supplies it, defaulting to
  // nothing so the ward states the fact rather than inheriting one. "Nothing outstanding" is a
  // real choice in that picker, so a ward reversing an unobstructed discharge has a value to give.
  function revertBedRelease(event: FormEvent<HTMLFormElement>, releaseId: string) {
    event.preventDefault();
    if (!revertChoice) return;
    dispatch({
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
      waitingOn: revertChoice,
    });
    setRevertOpenFor(undefined);
    setRevertChoice(undefined);
  }

  // List 3 (2026-08-28): recording what a released bed is being made ready for.
  //
  // **This changes no bed figure and must never be made to.** `capacityBreakdown` derives
  // `availableNow` from the unit's own fields and never reads a release, and matching never reads
  // a `BedRelease` at all — the bed stays offered, stays counted, and stays allocatable the whole
  // time it is being cleaned. That is the owner's own clinical answer to Q4: pulling the next
  // patient takes hours anyway, so holding the bed back would invent a delay that does not exist.
  function submitBedPreparation(event: FormEvent<HTMLFormElement>, releaseId: string) {
    event.preventDefault();
    if (!preparationChoice) return;
    dispatch({
      type: "SET_BED_PREPARATION",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
      preparing: true,
      note: preparationChoice,
    });
    setPreparationOpenFor(undefined);
    setPreparationChoice(undefined);
  }

  // The bed has finished being made ready. `preparing: false` forces the note null in the reducer,
  // because "not being made ready, waiting on a clean" is a contradiction.
  function finishBedPreparation(releaseId: string) {
    dispatch({
      type: "SET_BED_PREPARATION",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
      preparing: false,
    });
    setPreparationOpenFor(undefined);
    setPreparationChoice(undefined);
  }

  function toggleBedPreparation(releaseId: string) {
    setPreparationOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setPreparationChoice(undefined);
  }

  // Bed-model rework (2026-08-28): lifting the blocked flag. The stage is untouched — a confirmed
  // discharge that becomes unstuck is still confirmed.
  function clearBedReleaseBlock(releaseId: string) {
    dispatch({ type: "CLEAR_BED_RELEASE_BLOCK", role: "ward", now, releaseId, actingUnitId: unitId });
  }

  // RELEASE_BED is the one transition here that changes a real bed count (see the reducer's own
  // comment on the case) — accepted from `predicted` and `confirmed` alike, terminal either way.
  function releaseBedRelease(releaseId: string) {
    dispatch({ type: "RELEASE_BED", role: "ward", now, releaseId, actingUnitId: unitId });
  }

  function toggleBlockRelease(releaseId: string) {
    setBlockOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setBlockChoice(undefined);
  }

  function toggleRevertRelease(releaseId: string) {
    setRevertOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setRevertChoice(undefined);
  }

  function submitBlockRelease(event: FormEvent<HTMLFormElement>, releaseId: string) {
    event.preventDefault();
    if (!blockChoice) return;
    // Bed-model rework (2026-08-28): this sets the blocked FLAG and moves no stage. The form
    // renders on any unreleased row, and `discharged` rows never reach this list at all.
    dispatch({ type: "BLOCK_BED_RELEASE", role: "ward", now, releaseId, actingUnitId: unitId, blocker: blockChoice });
    setBlockOpenFor(undefined);
    setBlockChoice(undefined);
  }

  // Task 5 (spec D10): a small leave-bed form — unit implied by the route, exactly like
  // `submitBedRelease` above never asking which ward it is acting as.
  function submitLeaveBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expectedReturn = parseTimeInputToInstant(leaveExpectedReturn);
    if (expectedReturn === undefined) return;
    dispatch({
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      usable: leaveUsable,
      expectedReturn,
    });
    setLeaveUsable(false);
    setLeaveExpectedReturn("");
  }

  // Task 5 addendum (binding spec's Data flow section: "Leave beds follow the same path with a
  // two-state life: recorded, then ended on return."): the second half of that life. Same
  // claim-not-proof discipline as every other control on this screen — `actingUnitId` is this
  // screen's own route parameter, and the reducer compares it against the leave bed's own
  // `unitId` before ending it.
  function endLeaveBed(leaveBedId: string) {
    dispatch({ type: "END_LEAVE_BED", role: "ward", now, leaveBedId, actingUnitId: unitId });
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
          {/*
           * The board is a view OF this ward, so its link lives on this ward's own screen rather
           * than in the rail. `ward-nav.ts` lists exactly ONE seeded board as a worked example, the
           * same convention `ward/` and `ed/` use for their dynamic routes — which left the other
           * 22 wards' boards reachable only by typing an address. By this project's own definition
           * that is 22 orphans, and the reachability guard cannot see a single one of them because
           * it does not follow dynamic routes.
           */}
          <Link className={styles.boardLink} href={`/mockups/ward-flow/board/${unit.id}`}>
            See every bed on this ward
          </Link>
        </header>

        <section aria-label="Bed capacity" className={styles.bedSection}>
          <h2 className={styles.sectionHeading}>Bed capacity</h2>
          {/* Task 5, spec D7/D12: when this unit's own allocatable count was last confirmed, and
              (when one exists) the mark that a coordinator has since asked for it to be restated.
              `unit.allocatable.source === "ward"` is the one place this model records who stood
              behind a capacity figure — a ward-confirmed count reads as "Confirmed HH:MM · NUM
              <ward>", the same role-attribution convention `bedReleases`/`leaveBeds` already use
              for their own `confirmedBy`; an unconfirmed feed-only count reads as "As at HH:MM",
              never as though a human had confirmed it. */}
          <div className={styles.capacityFreshnessRow} data-testid="ward-unit-capacity-freshness">
            <WardFreshness
              confirmedAt={unit.allocatable.confirmedAt}
              confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
              now={now}
              derived={unit.allocatable.source !== "ward"}
            />
            {latestRefreshRequest ? (
              <span className={styles.refreshRequestMark} data-testid="ward-refresh-request-mark">
                Asked to refresh at {formatInstant(latestRefreshRequest.at)} by {latestRefreshRequest.byRole}
              </span>
            ) : null}
          </div>
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
            <span className={styles.bedChip} data-state="confirmed">
              Confirmed {breakdown.confirmedToday}
            </span>
            <span className={styles.bedChip} data-state="predicted">
              Predicted {breakdown.predictedToday}
            </span>
            {/* Bed-model rework (2026-08-28). Shown BESIDE Confirmed and Predicted, never
                instead of either: every release counted here is also counted in one of them,
                because being stuck says nothing about how certain the discharge is. Under the
                old four-stage model this figure could not exist — a blocked release was counted
                nowhere at all, so the ward's numbers improved at the moment it got stuck. */}
            <span className={styles.bedChip} data-state="blocked-release" data-testid="ward-unit-blocked-releases">
              {BED_RELEASE_BLOCKED_FIGURE_LABEL} {breakdown.blockedToday}
            </span>
            <span className={styles.bedChip} data-state="leave">
              Leave (usable) {breakdown.leaveUsable}
            </span>
          </div>
          <p className={styles.bedNote}>
            Ready, held, blocked and occupied add up to all {unit.beds} beds at {unit.name}. Confirmed, predicted and
            leave beds are never counted into those four &mdash; a bed only becomes Ready once it has actually been
            released, so this figure is always one you can fill this minute. The blocked-release count sits alongside
            Confirmed and Predicted rather than inside them: a discharge that is decided and stuck is still a decided
            discharge, and it keeps counting as one.
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
                {/* The Q1 axis change (2026-08-28): this picker used to ask the ward how CONFIDENT
                    it was and now asks what the discharge is WAITING ON. Two wards' "likely" do not
                    mean the same thing; "Awaiting ward round" does. */}
                <label className={styles.declineLegend} htmlFor="ward-bed-release-waiting-on">
                  Waiting on
                </label>
                <select
                  id="ward-bed-release-waiting-on"
                  required
                  className={styles.capacityInput}
                  value={bedReleaseWaitingOn ?? ""}
                  onChange={(event) => setBedReleaseWaitingOn(event.target.value as BedReleaseWaitingOn)}
                >
                  <option value="" disabled>
                    Choose what it is waiting on
                  </option>
                  {BED_RELEASE_WAITING_ON.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {/* Fix round 2 (P1): the ward's own estimate of when this bed will be free,
                    collected exactly like the leave-bed form's own "Expected return" input
                    below — same `<input type="time">`, same `parseTimeInputToInstant` parse. */}
                <label className={styles.declineLegend} htmlFor="ward-bed-release-expected-at">
                  Expected free
                </label>
                <input
                  id="ward-bed-release-expected-at"
                  data-testid="ward-bed-release-expected-at"
                  type="time"
                  required
                  className={styles.capacityInput}
                  value={bedReleaseExpectedAt}
                  onChange={(event) => setBedReleaseExpectedAt(event.target.value)}
                />
              </div>
              <div>
                <label className={styles.declineLegend} htmlFor="ward-bed-release-blocker">
                  Blocker
                </label>
                <select
                  id="ward-bed-release-blocker"
                  className={styles.capacityInput}
                  value={bedReleaseBlocker ?? ""}
                  onChange={(event) =>
                    setBedReleaseBlocker(
                      event.target.value === "" ? undefined : (event.target.value as BedReleaseBlocker),
                    )
                  }
                >
                  <option value="">No blocker</option>
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
                disabled={!bedReleaseWaitingOn}
              >
                Flag bed coming free
              </button>
            </div>
            <p className={styles.capacityConfirmed}>
              Records what the discharge is waiting on, an expected free time and a blocker only &mdash; nothing about
              the departing patient. Writes to {unit.name} only &mdash; never any other ward.
            </p>
          </form>

          {/* Task 5 (spec D10): this unit's own bed releases moving through their own lifecycle.
              Each row offers only the transitions CONFIRM_BED_RELEASE/BLOCK_BED_RELEASE/RELEASE_BED
              would actually accept from its current state (ward-flow-reducer.ts's own case
              comments) — never a control the reducer would refuse. `discharged` is terminal and
              drops off this list entirely (`pendingBedReleases` above), so it renders no row and
              no controls at all. */}
          <div className={styles.capacityForm} data-testid="ward-bed-release-list">
            <span className={styles.capacityLabel}>Bed releases at {unit.name}</span>
            {pendingBedReleases.length === 0 ? (
              <p className={styles.placeholder}>No bed release currently pending at {unit.name}.</p>
            ) : (
              <ul className={styles.cardList}>
                {pendingBedReleases.map((release) => {
                  // Bed-model rework (2026-08-28). Every gate below is now about the STAGE
                  // alone, except the two block controls, which are about the FLAG alone —
                  // that separation is the change. `discharged` rows never reach this list
                  // (`pendingBedReleases`), so no control here has to test for it.
                  const canConfirm = release.state === "predicted";
                  const canRevert = release.state === "confirmed";
                  const isBlocked = release.blocker !== null;
                  const canBlock = !isBlocked;
                  const canRelease = true;
                  const blockOpen = blockOpenFor === release.id;
                  const revertOpen = revertOpenFor === release.id;
                  return (
                    <li key={release.id} data-testid={`ward-bed-release-${release.id}`} className={styles.card}>
                      <header className={styles.cardHeader}>
                        {/* The stage and the flag are rendered as two separate facts, deliberately.
                            A blocked-but-confirmed release reads "Confirmed" AND "Blocked" here —
                            under the four-stage model the second erased the first, on the screen
                            and in the ward's confirmed count alike. */}
                        <strong>{bedReleaseStateLabels[release.state]}</strong>
                        {isBlocked ? (
                          <strong data-testid={`ward-bed-release-blocked-flag-${release.id}`}>
                            {BED_RELEASE_BLOCKED_LABEL}
                          </strong>
                        ) : null}
                        <span className={styles.cardMeta}>Expected {formatInstant(release.expectedAt)}</span>
                      </header>
                      {release.blocker ? <span className={styles.cardMeta}>{release.blocker}</span> : null}
                      {release.blockedBy ? (
                        <span className={styles.cardMeta}>Blocked by {release.blockedBy}</span>
                      ) : null}
                      <WardFreshness
                        confirmedAt={release.confirmedAt}
                        confirmedByRole={release.confirmedBy}
                        now={now}
                      />
                      <div className={styles.actionRow}>
                        {canConfirm ? (
                          <button
                            type="button"
                            data-testid={`ward-bed-release-confirm-${release.id}`}
                            className={styles.acceptButton}
                            onClick={() => confirmBedRelease(release.id)}
                          >
                            Confirm
                          </button>
                        ) : null}
                        {canRevert ? (
                          <button
                            type="button"
                            data-testid={`ward-bed-release-revert-toggle-${release.id}`}
                            aria-expanded={revertOpen}
                            className={styles.declineButton}
                            onClick={() => toggleRevertRelease(release.id)}
                          >
                            Back to predicted
                          </button>
                        ) : null}
                        {canBlock ? (
                          <button
                            type="button"
                            data-testid={`ward-bed-release-block-toggle-${release.id}`}
                            aria-expanded={blockOpen}
                            className={styles.declineButton}
                            onClick={() => toggleBlockRelease(release.id)}
                          >
                            Blocked
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid={`ward-bed-release-unblock-${release.id}`}
                            className={styles.declineButton}
                            onClick={() => clearBedReleaseBlock(release.id)}
                          >
                            No longer blocked
                          </button>
                        )}
                        {canRelease ? (
                          <button
                            type="button"
                            data-testid={`ward-bed-release-release-${release.id}`}
                            className={styles.declineButton}
                            onClick={() => releaseBedRelease(release.id)}
                          >
                            Discharged
                          </button>
                        ) : null}
                      </div>
                      {canRevert && revertOpen ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => revertBedRelease(event, release.id)}
                          data-testid={`ward-bed-release-revert-form-${release.id}`}
                        >
                          <label
                            className={styles.declineLegend}
                            htmlFor={`ward-bed-release-revert-select-${release.id}`}
                          >
                            Waiting on, once reverted
                          </label>
                          <select
                            id={`ward-bed-release-revert-select-${release.id}`}
                            data-testid={`ward-bed-release-revert-waiting-on-${release.id}`}
                            required
                            className={styles.capacityInput}
                            value={revertChoice ?? ""}
                            onChange={(event) => setRevertChoice(event.target.value as BedReleaseWaitingOn)}
                          >
                            <option value="" disabled>
                              Choose what it is waiting on
                            </option>
                            {BED_RELEASE_WAITING_ON.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            data-testid={`ward-bed-release-revert-submit-${release.id}`}
                            disabled={!revertChoice}
                            className={styles.declineSubmit}
                          >
                            Confirm reversal
                          </button>
                        </form>
                      ) : null}
                      {canBlock && blockOpen ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => submitBlockRelease(event, release.id)}
                          data-testid={`ward-bed-release-block-form-${release.id}`}
                        >
                          <label
                            className={styles.declineLegend}
                            htmlFor={`ward-bed-release-blocker-select-${release.id}`}
                          >
                            Blocker for this release
                          </label>
                          <select
                            id={`ward-bed-release-blocker-select-${release.id}`}
                            data-testid={`ward-bed-release-blocker-${release.id}`}
                            required
                            className={styles.capacityInput}
                            value={blockChoice ?? ""}
                            onChange={(event) => setBlockChoice(event.target.value as BedReleaseBlocker)}
                          >
                            <option value="" disabled>
                              Choose a blocker
                            </option>
                            {BED_RELEASE_BLOCKERS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            data-testid={`ward-bed-release-block-submit-${release.id}`}
                            disabled={!blockChoice}
                            className={styles.declineSubmit}
                          >
                            Confirm blocked
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* List 3 (2026-08-28): what a DISCHARGED bed is being made ready for. The picker exists
              because the owner supplied `BED_PREPARATION_NOTES`; before that the array was empty
              and there was nothing to offer.

              **Every bed in this list is still available.** The note is informational and gates
              nothing — see `submitBedPreparation` above and `BED_PREPARATION_NOTES` for the
              owner's own clinical reasoning. No control here moves a lifecycle stage: `discharged`
              is still terminal. */}
          <div className={styles.capacityForm} data-testid="ward-bed-preparation-list">
            <span className={styles.capacityLabel}>Beds being made ready at {unit.name}</span>
            {dischargedBedReleases.length === 0 ? (
              <p className={styles.placeholder}>No bed has come free at {unit.name} yet.</p>
            ) : (
              <ul className={styles.cardList}>
                {dischargedBedReleases.map((release) => {
                  const preparationOpen = preparationOpenFor === release.id;
                  return (
                    <li key={release.id} data-testid={`ward-bed-preparation-${release.id}`} className={styles.card}>
                      <header className={styles.cardHeader}>
                        <strong>{bedReleaseStateLabels[release.state]}</strong>
                        {release.preparing ? (
                          <strong data-testid={`ward-bed-preparation-flag-${release.id}`}>Being made ready</strong>
                        ) : null}
                        <span className={styles.cardMeta}>Still available</span>
                      </header>
                      {release.preparationNote ? (
                        <span className={styles.cardMeta} data-testid={`ward-bed-preparation-note-${release.id}`}>
                          {release.preparationNote}
                        </span>
                      ) : null}
                      <WardFreshness
                        confirmedAt={release.confirmedAt}
                        confirmedByRole={release.confirmedBy}
                        now={now}
                      />
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-bed-preparation-toggle-${release.id}`}
                          aria-expanded={preparationOpen}
                          className={styles.declineButton}
                          onClick={() => toggleBedPreparation(release.id)}
                        >
                          {release.preparing ? "Change what it is waiting on" : "Being made ready"}
                        </button>
                        {release.preparing ? (
                          <button
                            type="button"
                            data-testid={`ward-bed-preparation-finish-${release.id}`}
                            className={styles.declineButton}
                            onClick={() => finishBedPreparation(release.id)}
                          >
                            Ready
                          </button>
                        ) : null}
                      </div>
                      {preparationOpen ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => submitBedPreparation(event, release.id)}
                          data-testid={`ward-bed-preparation-form-${release.id}`}
                        >
                          <label className={styles.declineLegend} htmlFor={`ward-bed-preparation-select-${release.id}`}>
                            What this bed is waiting on
                          </label>
                          <select
                            id={`ward-bed-preparation-select-${release.id}`}
                            data-testid={`ward-bed-preparation-note-select-${release.id}`}
                            required
                            className={styles.capacityInput}
                            value={preparationChoice ?? ""}
                            onChange={(event) => setPreparationChoice(event.target.value as BedPreparationNote)}
                          >
                            <option value="" disabled>
                              Choose what it is waiting on
                            </option>
                            {BED_PREPARATION_NOTES.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            data-testid={`ward-bed-preparation-submit-${release.id}`}
                            disabled={!preparationChoice}
                            className={styles.declineSubmit}
                          >
                            Confirm being made ready
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className={styles.capacityConfirmed}>
              A bed being made ready is still offered and still counts as available &mdash; the note says what it is
              waiting on, never that it is held back. Writes to {unit.name} only &mdash; never any other ward.
            </p>
          </div>

          {/* Task 5 (spec D10): a small form for a bed occupied by someone on approved leave —
              unit implied by the route, exactly like the two forms above. Never asks anything
              about the person on leave (spec D11): `usable` and `expectedReturn` are both facts
              about the BED. */}
          <form className={styles.capacityForm} onSubmit={submitLeaveBed} data-testid="ward-leave-bed-form">
            <span className={styles.capacityLabel}>Record a bed on leave at {unit.name}</span>
            <div className={styles.capacityRow}>
              <label className={styles.declineOption} htmlFor="ward-leave-bed-usable">
                <input
                  id="ward-leave-bed-usable"
                  data-testid="ward-leave-bed-usable"
                  type="checkbox"
                  checked={leaveUsable}
                  onChange={(event) => setLeaveUsable(event.target.checked)}
                />
                Usable while away
              </label>
              <div>
                <label className={styles.declineLegend} htmlFor="ward-leave-bed-expected-return">
                  Expected return
                </label>
                <input
                  id="ward-leave-bed-expected-return"
                  data-testid="ward-leave-bed-expected-return"
                  type="time"
                  required
                  className={styles.capacityInput}
                  value={leaveExpectedReturn}
                  onChange={(event) => setLeaveExpectedReturn(event.target.value)}
                />
              </div>
              <button type="submit" data-testid="ward-leave-bed-submit" className={styles.capacitySubmit}>
                Record leave bed
              </button>
            </div>
            <p className={styles.capacityConfirmed}>
              {unitLeaveBeds.length} bed{unitLeaveBeds.length === 1 ? "" : "s"} currently on leave at {unit.name}
              {unitLeaveBeds.length > 0 ? `, ${unitLeaveBedsUsable} usable while away` : ""}. Never merged into
              available beds. Records nothing about the person on leave.
            </p>
          </form>

          {/* Task 5 addendum: the second half of a leave bed's two-state life (binding spec's
              Data flow section) — recorded above, ended here. Each row is about the BED only:
              usable or not, and when it is expected back. Nothing about the person on leave
              appears anywhere below (spec D11), and `unitLeaveBeds` is read live from
              `useWardFlow()`, never a frozen fixture. */}
          <div className={styles.capacityForm} data-testid="ward-leave-bed-list">
            <span className={styles.capacityLabel}>Beds currently on leave at {unit.name}</span>
            {unitLeaveBeds.length === 0 ? (
              <p className={styles.placeholder}>No bed currently on leave at {unit.name}.</p>
            ) : (
              <ul className={styles.cardList}>
                {unitLeaveBeds.map((leaveBed) => (
                  <li key={leaveBed.id} data-testid={`ward-leave-bed-${leaveBed.id}`} className={styles.card}>
                    <header className={styles.cardHeader}>
                      <strong>{leaveBed.usable ? "Usable while away" : "Not usable while away"}</strong>
                      <span className={styles.cardMeta}>Expected return {formatInstant(leaveBed.expectedReturn)}</span>
                    </header>
                    <WardFreshness
                      confirmedAt={leaveBed.confirmedAt}
                      confirmedByRole={leaveBed.confirmedBy}
                      now={now}
                    />
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        data-testid={`ward-leave-bed-end-${leaveBed.id}`}
                        className={styles.declineButton}
                        onClick={() => endLeaveBed(leaveBed.id)}
                      >
                        Ended
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                    {entry ? <span className={styles.cardMeta}>{formatInstantWithDay(entry.at, now)}</span> : null}
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
