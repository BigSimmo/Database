"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  changeReasonLabels,
  withdrawalReasonLabels,
  RELEASE_PULL_REASONS,
  type BedPreparationNote,
  type BedReleaseBlocker,
  type ReleasePullReason,
  OVERRIDE_REASONS,
  type OverrideReason,
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
  eligibilityWarning,
  elapsedLabel,
  isOpen,
  overridesAgainstUnit,
  restrictionNotice,
  stageCopy,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import {
  BED_RELEASE_WAITING_ON,
  DECLINE_REASONS,
  type BedReleaseWaitingOn,
  type DeclineReason,
  type Movement,
  type Rejection,
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

/** `PULL_PATIENT`'s own preconditions, named so the Pull button can never advertise an action the
 * reducer would refuse. Only rendered at all once `movement.stage === "accepted_awaiting_bed"`;
 * this covers the remaining reasons a pull could still be refused at that stage. */
function pullBlockedReason(movement: Movement, unit: Unit): string | undefined {
  if (movement.acceptedUnitId !== unit.id) {
    return `${movement.id} was accepted at a different unit, not ${unit.name}.`;
  }
  if (unit.allocatable.value <= 0) {
    return `No allocatable bed remains at ${unit.name}.`;
  }
  return undefined;
}

/**
 * Labels for the two decisions this screen dispatches that the reducer can still refuse even
 * once `referralAnswerBlocked`/`pullBlockedReason` above say go ahead — `PULL_PATIENT`'s own
 * bed-readiness and specialling gates, and a second `ACCEPT_IN_PRINCIPLE` for a movement another
 * dispatch already accepted, are both real, reducer-enforced refusals neither local check
 * mirrors. Keyed by `Rejection.attempted`, which is the event's own type string verbatim (see
 * `makeRejection` in `ward-flow-reducer.ts`) — this reads it back as the words already on the
 * button, not the SCREAMING_CASE event name.
 */
const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull a bed",
};

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
 * and appears under "accepted, pulled or en route" on the very next render, because both lists are
 * plain filters over the same live array; there is no local "it worked" flag anywhere in this
 * file for the reasons `shortlist-panel.tsx`'s own comment on `OverrideRecord` explains.
 *
 * Whole-branch review Critical 1: this screen used to resolve `unit` via `unitById(unitId)` —
 * `ward-sites.ts`'s frozen fixture — so this ward's own bed grid, its "Currently confirmed"
 * line, its capacity-input default and `pullBlockedReason`'s allocatable check never moved even
 * after this exact screen dispatched `CONFIRM_CAPACITY` against itself. `unit` now resolves from
 * the provider's live `units`, the same collection `CONFIRM_CAPACITY`/`PULL_PATIENT`/`PATIENT_ARRIVED`
 * all write to, so a ward reading its own action back is now structurally the same read as
 * anyone else reading it.
 */
export function WardScreen({ unitId }: WardScreenProps) {
  const { movements, units, bedReleases, leaveBeds, refreshRequests, now, dispatch, rejections } = useWardFlow();
  // Resolved from the provider's live `units`, not the frozen `unitById()` fixture — after
  // `CONFIRM_CAPACITY` or `PULL_PATIENT` updates `state.units`, this screen must show the current
  // bed counts (and gate `pullBlockedReason` on them) rather than the stale fixture value.
  const unit = units.find((candidate) => candidate.id === unitId);

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, and the not-found branch never touches either of these.
  /**
   * The reason a ward is recording against a refusal it has just been given. ⚠️ REACTIVE, NEVER
   * PROACTIVE, and the owner's coordinator ruled the shape: nothing appears until the engine has
   * actually refused, so the ward sees the SPECIFIC gate it failed before choosing a reason —
   * which is the right order for a clinical decision. A reason control sitting on every row before
   * anything is pressed would ask a person to justify something before they know what it is, and
   * would read as a suggestion rather than a safeguard. The ordinary accept, which is nearly all
   * of them, is untouched.
   *
   * One value, not a map: `lastActionRejection` holds a single refusal, so at most one of these
   * forms can be open at a time by construction.
   */
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineReason, setDeclineReason] = useState<DeclineReason | undefined>(undefined);
  const [capacityValue, setCapacityValue] = useState<string>(() => String(unit?.allocatable.value ?? 0));
  // Task 3: the undo the prototype has never had. Keyed by movementId, same pattern as
  // `declineOpenFor`/`declineReason` above — at most one release form and one cancel form open
  // at a time.
  const [releaseOpenFor, setReleaseOpenFor] = useState<string | undefined>(undefined);
  const [releaseReason, setReleaseReason] = useState<ReleasePullReason | undefined>(undefined);
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
  // pattern as `declineOpenFor`/`releaseOpenFor` above.
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

  /*
   * THE WARD'S OWN REFUSAL SURFACE for `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` — until now this
   * screen dispatched both and never read `rejections` at all, so a ward whose accept or pull was
   * refused (the reducer's own bed-readiness, specialling or already-accepted gates, none of
   * which `referralAnswerBlocked`/`pullBlockedReason` above mirror) saw nothing happen and had no
   * way to tell a refusal from a slow render.
   *
   * Same async-detection pattern as `referral-match.tsx`'s `checkToken`/`priorRejectionCountRef`
   * pair and `ed-screen.tsx`'s `declineRejection`: `dispatch` never reports whether the reducer
   * accepted or refused an event, so the only way to know is to compare `rejections` before and
   * after, on the next render. `checkToken === 0` guards the same case `ed-screen.tsx`'s own
   * comment names — nothing has been dispatched from this screen yet, so a rejection already in
   * state belongs to somebody else and must not be surfaced here.
   *
   * Held as ONE `Rejection`, not two — a ward user presses one button at a time — and matched
   * everywhere it is rendered by `movementId` ALONE, never narrowed to "only in the section the
   * button that caused it lives in": `Rejection.movementId` is the movement id for both these
   * events (the default case of `subjectId` in `ward-flow-reducer.ts`), and a refusal does not
   * stop being true because the movement's row has since moved to the other list — the exact
   * shape of a second `ACCEPT_IN_PRINCIPLE` refused as already-accepted, which lands the movement
   * in "accepted" before its own refusal is even rendered.
   */
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);
  const [lastActionRejection, setLastActionRejection] = useState<Rejection | undefined>(undefined);

  useEffect(() => {
    if (checkToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setLastActionRejection(
        newest.attempted === "ACCEPT_IN_PRINCIPLE" || newest.attempted === "PULL_PATIENT" ? newest : undefined,
      );
    } else {
      setLastActionRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken]);

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
  // corrected to source Confirmed/Expected from `capacityBreakdown()` rather than `unitCapacity()`'s
  // raw, state-and-timing-blind `potential` count — this screen used to be the one place still
  // showing that raw count as "Potential", which is how the same unit could read "Potential 1" here
  // and "Confirmed 1, Expected 0" one screen over, for the exact same release. This screen now reads
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
  // Accepted, pulled, or en route: this unit is the recorded destination, at any stage from
  // acceptance through transport. `isOpen` excludes `arrived` — once a patient arrives the record
  // closes and the bed shows as occupied in the grid above, not as a card here.
  const accepted = movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id);
  // What was withdrawn from this ward specifically, and why — `withdrawnReferrals` is per
  // movement, so this reads each movement's own array rather than assuming only one entry exists.
  const withdrawn = movements.filter((movement) =>
    movement.withdrawnReferrals.some((entry) => entry.unitId === unit.id),
  );

  /**
   * OD-3's read side, ward-scoped. **`overridesAgainstUnit`, never `allOverrides`** — the register
   * is filtered where it is READ, so another ward's override is never in this screen's scope at
   * all, and no future column, debug panel or stylesheet here can reveal what never arrived.
   * `tests/ward-override-register-render.dom.test.tsx` pins that structurally, by scanning this
   * file: it is not a convention anyone has to remember.
   *
   * ⚠️ **AND `unitIds` IS NARROWED TO THIS WARD, which is a second scoping and a separate rule.**
   * One override can name several units at once — the shortlist panel's refer control is a
   * multi-select, so a coordinator can refer to three wards in one act and override the gate for
   * all three. The stored `unitIds` then lists every one of them, and rendering that list here
   * would tell this ward WHERE ELSE the patient was referred: `FD-23`, the owner's ruling of
   * 2026-08-31, and the exact leak `ward-screen-fd23-leaks.dom.test.tsx` already guards on the
   * referral cards a few sections up. `ward-referral-visibility.ts` states it as "the count is as
   * forbidden as the list", so the co-addressees cannot be replaced with a number either.
   *
   * This is a PROJECTION, the same shape as `wardScopedReferral()` — the narrowing happens here,
   * before anything is rendered, so the presentation component is never handed the other wards'
   * ids and could not show them if it tried. It is not a filter applied at render.
   */
  const overridesHere = overridesAgainstUnit(movements, unit.id).map((entry) => ({
    movement: entry.movement,
    override: { ...entry.override, unitIds: entry.override.unitIds.filter((id) => id === unit.id) },
  }));

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

  /**
   * Re-runs the refused action, this time carrying the reason. ⚠️ IT RE-DISPATCHES THE EVENT THE
   * WARD ORIGINALLY PRESSED, read back from the refusal itself rather than remembered separately —
   * so the thing that gets overridden is provably the thing that was refused. Holding the intended
   * event in its own state would let the two drift apart, and a mismatch there would override a
   * different action than the one on screen.
   */
  function submitOverride(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!overrideReason || !lastActionRejection) return;
    const attempted = lastActionRejection.attempted;
    if (attempted !== "ACCEPT_IN_PRINCIPLE" && attempted !== "PULL_PATIENT") return;
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ TWO LITERAL DISPATCHES RATHER THAN ONE COMPUTED `type: attempted`, AND THE GUARD IS WHY.
    // The computed form was what I wrote first, and `ward-override-surfaces.test.ts` refused it on
    // the spot: a computed type is invisible to every literal scan, so this surface would have
    // become unreadable to the very check that decides whether it can record a reason — the
    // allowlist entry could never have come off, because nothing could see the fix. Verbosity here
    // buys visibility to the static guards, which is the trade this file should always take.
    if (attempted === "ACCEPT_IN_PRINCIPLE") {
      dispatch({
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now,
        movementId,
        unitId: wardUnitId,
        overrideReason,
      });
    } else {
      dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId, unitId: wardUnitId, overrideReason });
    }
    setCheckToken((token) => token + 1);
    setOverrideReason(undefined);
  }

  /**
   * ⚠️ RENDERED ONLY WHEN THE ENGINE SAYS A REASON IS THE WAY THROUGH, matched on the fragment the
   * reducer exports rather than on a literal of our own — see `OVERRIDE_REASON_REQUIRED`. A refusal
   * nothing can override (no bed, no specialling staff, a stale bed count) shows the refusal and NO
   * control, which is the honest rendering: offering a reason box against a physical fact would
   * promise something no reason can buy.
   *
   * ⚠️ PLACEHOLDER COPY. THE OWNER HAS NOT CHOSEN THESE WORDS. Marked here in the pattern
   * `ward-change-reasons.ts` uses, because a chosen value and a provisional value look identical in
   * code and the difference is whether anybody can find out. The SHAPE is decided; the WORDS are a
   * stand-in. `Select a reason` is a UI convention rather than a clinical statement and is mine.
   */
  function overrideReasonForm(movementId: string) {
    if (!lastActionRejection) return null;
    if (lastActionRejection.movementId !== movementId) return null;
    if (!lastActionRejection.reason.includes(OVERRIDE_REASON_REQUIRED)) return null;
    return (
      <form
        className={styles.declineForm}
        onSubmit={(event) => submitOverride(event, movementId)}
        data-testid={`ward-override-form-${movementId}`}
      >
        <fieldset className={styles.declineFieldset}>
          {/* PLACEHOLDER WORDING — owner has not chosen this. */}
          <legend className={styles.declineLegend}>Record why this is going ahead anyway</legend>
          {/* Radios, not a dropdown, and not my preference — it is the idiom this screen already
              uses for choosing a clinical reason (the decline form directly below). It also shows
              all five at once: a collapsed list hides the alternatives at the moment somebody is
              deciding between them, and none of these five is a default. */}
          {OVERRIDE_REASONS.map((reason) => (
            <label key={reason} className={styles.declineOption}>
              <input
                type="radio"
                name={`ward-override-${movementId}`}
                value={reason}
                checked={overrideReason === reason}
                onChange={() => setOverrideReason(reason)}
                data-testid={`ward-override-option-${movementId}`}
              />
              {reason}
            </label>
          ))}
          {/* Native `disabled` is correct here and is NOT the forbidden case: this is transient
              inertness while the form waits for validity, not a control unavailable for a stated
              reason. See the button-wiring convention. */}
          <button
            type="submit"
            className={styles.acceptButton}
            disabled={!overrideReason}
            data-testid={`ward-override-submit-${movementId}`}
          >
            {/* PLACEHOLDER WORDING — owner has not chosen this. */}
            Record reason and continue
          </button>
        </fieldset>
      </form>
    );
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
  // `submitBedRelease` above. `expected -> confirmed` is the only transition
  // CONFIRM_BED_RELEASE accepts; this is only ever rendered on a expected row (see the
  // legal-transition gating in the render below), so the reducer is never asked for a transition
  // the row does not itself offer.
  function confirmBedRelease(releaseId: string) {
    dispatch({ type: "CONFIRM_BED_RELEASE", role: "ward", now, releaseId, actingUnitId: unitId });
  }

  // Bed-model rework (2026-08-28): the reversal. `confirmed -> expected`, recorded like any
  // other change. What the discharge is waiting on has to be restated because a expected release
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
  // comment on the case) — accepted from `expected` and `confirmed` alike, terminal either way.
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
      type: "RELEASE_PULL",
      role: "ward",
      now,
      movementId,
      actingUnitId: unitId,
      reason: releaseReason,
    });
    setReleaseOpenFor(undefined);
    setReleaseReason(undefined);
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
            <span className={styles.bedChip} data-state="expected">
              Expected {breakdown.expectedToday}
            </span>
            {/* Bed-model rework (2026-08-28). Shown BESIDE Confirmed and Expected, never
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
            Ready, held, blocked and occupied add up to all {unit.beds} beds at {unit.name}. Confirmed, expected and
            leave beds are never counted into those four &mdash; a bed only becomes Ready once it has actually been
            released, so this figure is always one you can fill this minute. The blocked-release count sits alongside
            Confirmed and Expected rather than inside them: a discharge that is decided and stuck is still a decided
            discharge, and it keeps counting as one. <strong>Held</strong> here means a bed that is empty but not
            currently offered &mdash; it is not a bed pulled for a named patient. Those are in &ldquo;Accepted, pulled
            or en route here&rdquo; below, they are counted separately, and the two can disagree.
            <strong>Confirmed</strong> here counts discharges confirmed for today; the &ldquo;currently confirmed&rdquo;
            figure under the form below is a different thing &mdash; how many beds this ward last said it can offer.
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
                  const canConfirm = release.state === "expected";
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
                            Back to expected
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
                const eligibilityIssue = eligibilityWarning(movement, unit, now);
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
                    {/*
                      NO "PARALLEL REFERRAL" BADGE HERE. ⚠️ THE OWNER RULED THIS, 2026-08-31: a ward
                      is NOT told that a patient is also referred elsewhere, not even the bare fact
                      with nowhere named. Do not put it back.

                      It was open for about an hour and this note recorded it as open. It is not
                      open now, and the record of how it was decided is kept below rather than
                      deleted — because the arguments AGAINST this ruling are good, and a future
                      reader who rediscovers them without knowing they were already weighed would
                      reasonably think nobody had considered them.

                      This rendered `referredUnitIds.length > 1`: a badge telling a ward the patient
                      was also referred somewhere else, without saying where.

                      WHAT IS SETTLED, the owner's ruling, verbatim in `ward-referral-visibility.ts`:
                      "a ward cannot see where else a patient has been referred. The coordinator may
                      see everything." ⚠️ A BADGE SAYING ONLY THAT OTHERS EXIST DOES NOT BREAK THAT
                      SENTENCE — it names nowhere. So the ruling alone does not decide this.

                      WHAT THE OWNER ADDED, and it is the part the ruling turns on: the same module
                      adds "the count is as forbidden as the list", and I first recorded that here as
                      the ruling. ⚠️ IT IS THE IMPLEMENTER'S READING, written in the same voice one
                      line below the owner's words, and its author has since corrected me. Two live
                      readings, and they point opposite ways:

                        AGAINST a badge  visible competition invites waiting, so a patient addressed
                                         to four wards could be deprioritised by all four — each of
                                         them reading the badge correctly.
                        FOR a badge      the owner's own stated reason is "so a ward does not spend
                                         its time on a patient who is being placed elsewhere", which
                                         is an argument for telling the ward, not for hiding it.

                      ⚠️ AND THE COST OF HIDING IT IS REAL, in a window that is easy to argue away.
                      `FD-22` cancels the other referrals on the first acceptance and
                      `withdrawnReferrals` then tells this ward ("a shrinking `referredUnitIds` tells
                      nobody"). But that only pays AFTER somebody accepts. While three wards are each
                      still deliberating, nothing has fired and no ward knows it is one of three —
                      which is exactly the window in which a bed gets pulled.

                      ⚠️ THE COST IS ACCEPTED, NOT RETIRED, AND THAT DISTINCTION IS THE RULING.
                      Two sessions argued in turn that `withdrawnReferrals` already pays for hiding
                      this, so strict was "free". It does not: `ACCEPT_IN_PRINCIPLE` is the only
                      writer of that field, measured, so nothing tells a ward anything until
                      somebody accepts — and the deliberation window, the one where a ward's
                      decision is still open, is unprotected by construction. The owner was given
                      that cost in plain terms (a bed possibly pulled for a patient going elsewhere,
                      against a patient possibly deprioritised by every ward offered) and chose
                      this side of it. That is a clinical price knowingly paid.

                      If this is ever reopened and permitted, it belongs on `WardScopedReferral` as
                      its own typed field — NEVER as a `hideOtherDestinations` flag, because a flag
                      is a thing that can be passed the other way, which is why the two projections
                      are two TYPES rather than one type with a switch.
                    */}
                    {notice ? (
                      <span
                        className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                        data-testid={`ward-restriction-notice-${movement.id}`}
                        data-level={notice.level}
                      >
                        {notice.text}
                      </span>
                    ) : null}
                    {/* The sub-finding in `docs/ward-flow/the-engine-enforces-nothing.md`: the
                        reducer enforces nothing behind `ACCEPT_IN_PRINCIPLE`/`PULL_PATIENT`, so this
                        is INFORMATION for the human reading the screen, never a gate — accept below
                        still dispatches exactly as before whether or not this renders. */}
                    {eligibilityIssue ? (
                      <span
                        className={styles.noticeProminent}
                        data-testid={`ward-eligibility-warning-${movement.id}`}
                        data-level={eligibilityIssue.level}
                      >
                        {eligibilityIssue.text}
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
                            : () => {
                                // Captured immediately before THIS dispatch, never inside the
                                // effect above — see that state's own doc comment for why the
                                // count has to be read here, at the moment of the click.
                                priorRejectionCountRef.current = rejections.length;
                                dispatch({
                                  type: "ACCEPT_IN_PRINCIPLE",
                                  role: "ward",
                                  now,
                                  movementId: movement.id,
                                  unitId: unit.id,
                                });
                                setCheckToken((token) => token + 1);
                              }
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
                    {/* See `lastActionRejection`'s own doc comment above: matched by `movementId`
                        alone, so this also catches a SECOND `ACCEPT_IN_PRINCIPLE` refused as
                        already-accepted even once the row has moved to "accepted" below — the
                        identical check there is what renders it in that case. */}
                    {lastActionRejection?.movementId === movement.id ? (
                      <p
                        className={styles.noticeProminent}
                        role="alert"
                        data-testid={`ward-action-rejection-${movement.id}`}
                      >
                        {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted}{" "}
                        not recorded: {lastActionRejection.reason}
                      </p>
                    ) : null}
                    {overrideReasonForm(movement.id)}
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

        <section aria-label="Accepted, pulled or en route" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Accepted, pulled or en route here</h2>
          {accepted.length === 0 ? (
            <p className={styles.placeholder}>No patient is currently accepted, pulled or en route to {unit.name}.</p>
          ) : (
            <ul className={styles.cardList}>
              {accepted.map((movement) => {
                const notice = restrictionNotice(movement, unit);
                const eligibilityIssue = eligibilityWarning(movement, unit, now);
                const canPull = movement.stage === "accepted_awaiting_bed";
                const blocked = canPull ? pullBlockedReason(movement, unit) : undefined;
                // Task 3: each control renders ONLY when the reducer would accept it — never
                // dispatched optimistically and left for the reducer to refuse silently.
                const canRelease = movement.stage === "pulled";
                const canCancel =
                  movement.transport !== undefined &&
                  movement.transport.cancelledAt === undefined &&
                  movement.transport.collectedAt === undefined &&
                  movement.transport.arrivedAt === undefined;
                const releaseOpen = releaseOpenFor === movement.id;
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
                    {eligibilityIssue ? (
                      <span
                        className={styles.noticeProminent}
                        data-testid={`ward-eligibility-warning-${movement.id}`}
                        data-level={eligibilityIssue.level}
                      >
                        {eligibilityIssue.text}
                      </span>
                    ) : null}
                    {movement.stage === "pulled" && movement.pullExpiresAt !== undefined ? (
                      <span className={styles.cardMeta}>
                        Bed pull {formatRemaining(minutesUntil(movement.pullExpiresAt, now))}
                      </span>
                    ) : null}
                    {canPull ? (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-pull-${movement.id}`}
                          aria-disabled={blocked ? "true" : undefined}
                          aria-describedby={blocked ? `ward-pull-unavailable-${movement.id}` : undefined}
                          title={blocked ?? undefined}
                          className={styles.acceptButton}
                          onClick={
                            blocked
                              ? ignoreUnavailableActivation
                              : () => {
                                  // Same capture-then-dispatch-then-check as the accept button
                                  // above — see `lastActionRejection`'s own doc comment.
                                  priorRejectionCountRef.current = rejections.length;
                                  dispatch({
                                    type: "PULL_PATIENT",
                                    role: "ward",
                                    now,
                                    movementId: movement.id,
                                    unitId: unit.id,
                                  });
                                  setCheckToken((token) => token + 1);
                                }
                          }
                        >
                          Pull a bed
                        </button>
                        {blocked ? (
                          <span id={`ward-pull-unavailable-${movement.id}`} className="sr-only">
                            {blocked}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {/* Same movement-scoped match as the incoming section above — this is where a
                        `PULL_PATIENT` refusal (bed not ready, no specialling capacity left) shows,
                        and also where a SECOND `ACCEPT_IN_PRINCIPLE` refused as already-accepted
                        shows once the row has moved here. */}
                    {lastActionRejection?.movementId === movement.id ? (
                      <p
                        className={styles.noticeProminent}
                        role="alert"
                        data-testid={`ward-action-rejection-${movement.id}`}
                      >
                        {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted}{" "}
                        not recorded: {lastActionRejection.reason}
                      </p>
                    ) : null}
                    {overrideReasonForm(movement.id)}
                    {canRelease ? (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-release-pull-toggle-${movement.id}`}
                          aria-expanded={releaseOpen}
                          className={styles.declineButton}
                          onClick={() => toggleRelease(movement.id)}
                        >
                          Release the pulled bed
                        </button>
                      </div>
                    ) : null}
                    {canRelease && releaseOpen ? (
                      <form
                        className={styles.declineForm}
                        onSubmit={(event) => submitRelease(event, movement.id)}
                        data-testid={`ward-release-pull-${movement.id}`}
                      >
                        <label className={styles.declineLegend} htmlFor={`ward-release-pull-reason-${movement.id}`}>
                          Reason for releasing the pulled bed for {movement.id}
                        </label>
                        <select
                          id={`ward-release-pull-reason-${movement.id}`}
                          required
                          className={styles.capacityInput}
                          value={releaseReason ?? ""}
                          onChange={(event) => setReleaseReason(event.target.value as ReleasePullReason)}
                        >
                          <option value="" disabled>
                            Choose a reason
                          </option>
                          {RELEASE_PULL_REASONS.map((reason) => (
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
                    {/*
                      ⚠️ THE CANCEL CONTROL IS GONE FROM THIS SCREEN, AND THE NOTE REPLACES IT
                      RATHER THAN THE BUTTON SIMPLY VANISHING.

                      `TR-D6` (owner, 2026-08-30): a transport may be cancelled by the team that
                      BOOKED it and by the coordinator. The receiving ward may not — it did not book
                      the job, and a booking cancelled by the destination is indistinguishable on the
                      sending board from one that failed, so the sending team cannot tell "they
                      changed their mind" from "it never went through". `ward` is no longer in
                      `EVENT_ROLE.CANCEL_TRANSPORT`, so the reducer refuses this at the role gate.

                      Leaving the button would have broken this screen's OWN written rule, a few
                      lines above: a control renders only when the reducer would accept it, never
                      dispatched optimistically and left to be refused silently. And a silent
                      refusal here is invisible — the form closes, the reason clears, and the
                      transport is untouched.

                      The note names BOTH permitted parties on purpose. A ward told only that the
                      coordinator can do it will ring the coordinator when the sending department is
                      the faster route.
                    */}
                    {canCancel ? (
                      <p className={styles.notice} data-testid="ward-cancel-transport-unavailable">
                        This ward cannot cancel a transport it did not book. Ask the sending emergency department, or
                        the flow coordinator.
                      </p>
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
                    {/*
                      ⚠️ THE STORED `reason` IS NOT RENDERED, BECAUSE IT NAMES THE WARD THAT WON.

                      `ward-flow-reducer.ts` writes `reason: `withdrawn — placed at ${acceptedUnit.name}``,
                      and the seed carries the same shape ("Referral withdrawn once RGH Adult Secure
                      confirmed the bed"). Rendering it told FSH Adult Secure that RGH took the
                      patient — the exact fact `FD-23` forbids a ward-facing surface to reveal,
                      arriving through `withdrawnReferrals`, the field that exists to PROTECT this
                      ward from holding a bed. The most dangerous leak was inside the safeguard.

                      A structural guard cannot see this: `reason` is a permitted field carrying a
                      forbidden VALUE. Only reading the values finds it.

                      What the ward needs is the whole of what it can act on — this referral has
                      ended, and another unit accepted the patient — and the destination is no part
                      of that.

                      ⚠️ THE WORDING IS "ACCEPTED", NOT "PLACED", AND NOT "YOUR BED IS FREE". Both
                      of those were in my first draft and both would have been new false statements
                      on a page whose whole job here is to stop making them. `ACCEPT_IN_PRINCIPLE`
                      leaves the patient `accepted_awaiting_bed` — accepted, not moved, so "placed"
                      overstates it (the reducer's own string says "placed at" and is wrong about
                      that too). And this ward may never have pulled a bed at all; whether one is free
                      is the bed-capacity section's question, answered from the bed state, not an
                      inference anybody can draw from a withdrawal.

                      MEASURED, not assumed: `ACCEPT_IN_PRINCIPLE` is the ONLY writer of
                      `withdrawnReferrals` (one site, reducer line 636) and the seed's single entry
                      means the same thing. So "another unit accepted" is true of every entry that
                      can exist today. ⚠️ It is true CONDITIONALLY — a second withdrawal path with a
                      different cause would make this sentence quietly wrong, and nothing here would
                      catch it. A structured cause on the record is what would; see below.

                      ✅ THE DURABLE FIX LANDED, so this is no longer the containment it began as.
                      `reason` is a `WithdrawalReason` union rather than free prose, and the sentence
                      lives in `withdrawalReasonLabels` — ONE home instead of two copies drifting
                      apart. A raw render now prints a code rather than a ward's name, and the
                      seed's hand-authored entry is typed too, so the dispatched path is not the
                      only one covered.

                      The wording is unchanged from the stopgap this page shipped, and that was
                      checked byte-identical rather than assumed. What changed is that it can no
                      longer be edited here without the shared label moving with it.

                      ⚠️ STILL DO NOT "SIMPLIFY" THIS TO `{entry.reason}`. It would now print
                      `another_unit_accepted` to a charge nurse — no longer a privacy failure, but
                      an incomprehensible one, and the guard for it is in
                      `ward-screen-fd23-leaks.dom.test.tsx`.
                    */}
                    <span className={styles.cardMeta} data-testid={`ward-withdrawn-reason-${movement.id}`}>
                      {entry ? withdrawalReasonLabels[entry.reason] : "Withdrawn — reason unresolved"}
                    </span>
                    {entry ? <span className={styles.cardMeta}>{formatInstantWithDay(entry.at, now)}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/*
          OD-3: an override is visible to the party overridden. This ward reads that it was referred
          despite its own gate failing, when, by which role, and why — the same presentation the
          coordinator's register uses, from a list scoped before it got here.
        */}
        <section aria-label="Overrides recorded against this ward" className={styles.listSection}>
          <h2 className={styles.sectionHeading}>Overrides recorded against {unit.name}</h2>
          <OverrideRegister entries={overridesHere} units={units} now={now} />
        </section>
      </main>
    </div>
  );
}
