/**
 * Pure derivations shared by the three Ward Flow view files (console, modes, network). Nothing
 * here depends on React — no hooks, no browser APIs — so this module carries no "use client"
 * directive and cannot itself become a client/server boundary problem. It is the single place
 * these three files can drift out of sync if a formula changes, so a change here changes every
 * consumer at once rather than needing three coordinated edits.
 */
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Truck } from "lucide-react";

import {
  clockState,
  formatElapsed,
  formatInstant,
  formatRemaining,
  minutesUntil,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  eligibility,
  requiresAuthorisedDestination,
  type EligibilityVerdict,
} from "@/components/ward-management/ward-eligibility";
import {
  changeReasonLabels,
  type CancelTransportReason,
  type ReleaseHoldReason,
} from "@/components/ward-management/ward-change-reasons";
import {
  MOVEMENT_STAGES,
  PARALLEL_REFERRAL_CAP,
  type BedRelease,
  type BedReleaseState,
  type HealthService,
  type Movement,
  type MovementStage,
  type TransportJob,
  type Unit,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";

/** UI-only role concept; not part of the domain model. */
export type WardRole = "flow" | "ed" | "ward";

export const stageCopy: Record<MovementStage, { label: string; shortLabel: string }> = {
  placement_requested: { label: "Placement requested", shortLabel: "Requested" },
  destination_review: { label: "Destination review", shortLabel: "Review" },
  accepted_awaiting_bed: { label: "Accepted, awaiting bed", shortLabel: "Accepted" },
  bed_held: { label: "Bed held", shortLabel: "Held" },
  handover_ready: { label: "Handover ready", shortLabel: "Ready" },
  moving: { label: "Moving", shortLabel: "Moving" },
  arrived: { label: "Arrived", shortLabel: "Arrived" },
};

/** Same reason `stageCopy` exists: `BedReleaseState`'s own values (`BED_RELEASE_STATES` in
 *  ward-model.ts) are raw lowercase lifecycle identifiers, never sentence-case display text.
 *  A screen renders this label, never `release.state` directly (defect fix, visual pass). */
export const bedReleaseStateLabels: Record<BedReleaseState, string> = {
  predicted: "Predicted",
  confirmed: "Confirmed",
  blocked: "Blocked",
  released: "Released",
};

/** Counts are derived from whatever `movements` list the caller passes — every screen now
 * passes the live provider state (Task 6), so the pipeline strip can never advertise a count
 * a different surface would compute differently from the same instant. */
export function stageSummaries(movements: Movement[]) {
  return MOVEMENT_STAGES.map((id) => ({
    id,
    ...stageCopy[id],
    count: movements.filter((movement) => movement.stage === id).length,
  }));
}

export const wardServiceOrder: HealthService[] = ["North Metro", "East Metro", "South Metro", "WACHS", "Private"];

export const roleLabels: Record<WardRole, string> = {
  flow: "Flow coordinator",
  ed: "ED mental health",
  ward: "Ward manager",
};

export const roleTaskLabel: Record<WardRole, string> = {
  flow: "Review & confirm",
  ed: "Confirm ED readiness",
  ward: "Accept and hold bed",
};

/**
 * The health service that owns the ED a movement originated in. This is the origin service,
 * not the patient's catchment — catchment is determined by where a patient lives, not where
 * they presented (see the glossary and Accepted ADR 3). `Movement` has no catchment field;
 * adding one is Phase 2 model work, not a derivation this module can safely invent.
 */
export function movementHealthService(movement: Movement): HealthService | undefined {
  const ed = allEmergencyDepartments().find((candidate) => candidate.id === movement.originEdId);
  return ed ? siteByCode(ed.siteCode)?.service : undefined;
}

/**
 * Duration since the movement opened. This is elapsed wait time, not a countdown to a
 * deadline — `formatElapsed` (never `formatRemaining`) is what keeps it from reading as a
 * breach on every row of every queue.
 */
export function elapsedLabel(movement: Movement, now: Instant) {
  return formatElapsed(minutesUntil(now, movement.openedAt));
}

/**
 * A movement is open while it is still travelling through the pathway. Per spec §7, arrival
 * closes the record and the patient leaves the system — so a movement is closed once it
 * carries a `closure` (whatever the outcome) or has reached the `arrived` stage, and open
 * counts/tables must never include it. `closure` is checked independently of `stage` because
 * a movement can close before ever reaching `arrived` (e.g. self-discharge from ED).
 */
export function isOpen(movement: Movement): boolean {
  return !movement.closure && movement.stage !== "arrived";
}

/**
 * A movement whose CURRENT legal status requires an authorised destination, but whose already
 * accepted unit is not authorised. This is a real situation created by a mid-flight status
 * change, and it is surfaced as an exception for a human to resolve. It NEVER re-sorts,
 * re-suggests or un-accepts the patient: nothing in this prototype auto-allocates, and that
 * rule does not bend because the trigger was a status change.
 */
export function destinationNoLongerLawful(movement: Movement, units: Unit[]): Unit | undefined {
  if (!isOpen(movement)) return undefined;
  if (!requiresAuthorisedDestination(movement.legalStatus)) return undefined;
  // Redundant by behaviour, kept for readability: the `find` below would return `undefined` for an
  // undefined id anyway, so removing this line is behaviour-preserving and no test can observe it.
  // Recorded rather than deleted so a future reader does not mistake it for load-bearing — and
  // recorded rather than left silent because mutating it is the one mutation in this function that
  // does not kill its test, which is a property of the line, not a gap in the test.
  if (movement.acceptedUnitId === undefined) return undefined;
  const unit = units.find((candidate) => candidate.id === movement.acceptedUnitId);
  if (unit === undefined) return undefined;
  return unit.authorised ? undefined : unit;
}

/**
 * Whether `wardFlowReducer`'s `REFER_TO_UNITS` case would actually accept a referral for this
 * movement right now, and if not, why — named from the movement's own real stage via `stageCopy`,
 * never a generic string. Built on the reducer's own exported `REFERRABLE_MOVEMENT_STAGES`
 * (not a second, hand-copied stage list) so a UI surface's pre-check and the reducer's own guard
 * can never silently drift apart.
 *
 * Task 5 fix round 1: `ShortlistPanel` used to dispatch `REFER_TO_UNITS` and unconditionally
 * render "Referred by a human coordinator" regardless of what the reducer actually did with it.
 * Nine of the eighteen hand-authored fixture movements sit in a non-referable stage (e.g.
 * `bed_held`) while still open and still offering eligible candidates — for every one of them the
 * old code showed a successful referral that never happened. This lets the Refer control state
 * the real reason up front instead of advertising an action it cannot perform.
 */
export function referralBlockedReason(movement: Movement): string | undefined {
  if (REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) return undefined;
  return `${movement.id} cannot be referred while it is ${stageCopy[movement.stage].label.toLowerCase()} — referral is only available while placement is requested or a destination is under review.`;
}

/**
 * The unit a movement is *actually* recorded against — accepted, or else the first live
 * referral. Never falls back to a different unit, and never returns a merely-suggested
 * candidate: callers that want a suggestion when this is `undefined` must ask for one
 * explicitly (see `eligibleCandidatesAmong`) and label it as a suggestion, not a destination.
 *
 * Whole-branch review Critical 1: takes the caller's own `units` rather than resolving via
 * `unitById` (the frozen `ward-sites.ts` fixture). Every live surface must pass the provider's
 * live `units` here — a ward that has just dropped its own allocatable beds to zero, or received
 * a patient, must be reflected the instant this is called next, not only at first paint.
 */
export function destinationUnit(movement: Movement, units: Unit[]): Unit | undefined {
  const id = movement.acceptedUnitId ?? movement.referredUnitIds[0];
  return id ? units.find((unit) => unit.id === id) : undefined;
}

export function unitSiteCode(unit: Unit) {
  return siteByCode(unit.siteCode)?.code ?? unit.siteCode;
}

export function transportStatusLabel(transport: TransportJob | undefined) {
  if (!transport) return "Not yet requested";
  if (transport.cancelledAt !== undefined) return "Cancelled";
  if (transport.arrivedAt !== undefined) return "Arrived";
  if (transport.collectedAt !== undefined) return "Collected";
  if (transport.enRouteAt !== undefined) return "En route";
  if (transport.acceptedAt !== undefined) return `${transport.provider} accepted, awaiting departure`;
  return `${transport.provider} requested`;
}

/** The five discrete stages a transport job progresses through, in order. */
export type TransportLeg = "Requested" | "Accepted" | "En route" | "Collected" | "Arrived";

/**
 * The discrete transport leg, separated from `transportStatusLabel`'s provider narrative.
 *
 * `transportStatusLabel` mixes two different things into one string: the leg the job has
 * reached, and prose naming the provider once it has accepted. That is deliberate for the
 * views that read it today, but it means the field can never be matched against a fixed leg
 * pattern — two of its seven possible outputs contain provider prose (`"<provider> accepted,
 * awaiting departure"`, `"<provider> requested"`) rather than one of the five capitalised leg
 * names. This function returns only the leg, using the exact same precedence order as
 * `transportStatusLabel` (cancelled beats every stamp; the furthest-progressed stamp wins
 * otherwise) so the two never disagree about what stage a job is in.
 *
 * `undefined` means "no transport job at all" — a movement with no transport has not reached
 * `"Requested"`, it has no leg, so absence is never collapsed into one of the five leg names.
 */
export function transportLeg(transport: TransportJob | undefined): TransportLeg | "Cancelled" | undefined {
  if (!transport) return undefined;
  if (transport.cancelledAt !== undefined) return "Cancelled";
  if (transport.arrivedAt !== undefined) return "Arrived";
  if (transport.collectedAt !== undefined) return "Collected";
  if (transport.enRouteAt !== undefined) return "En route";
  if (transport.acceptedAt !== undefined) return "Accepted";
  return "Requested";
}

/**
 * The five-state bed grid, built entirely from real unit and bed-release fields.
 *
 * The glossary requires every bed to carry exactly one of the five states, so this must
 * partition `unit.beds` exactly: `available + held + blocked + occupied === unit.beds`.
 * `available` and `held` are both drawn from within the physically-empty pool (`unit.empty`)
 * — `available` is the ward-confirmed allocatable subset, and whatever empty capacity is not
 * yet confirmed allocatable is `held` rather than silently uncounted. `blocked` is drawn from
 * within the non-empty remainder, with whatever is left over being `occupied`. Both splits
 * are clamped so authored data that already over- or under-counts (e.g. a stale `unit.held`
 * literal that no longer fits once `available` is subtracted) can never push the total past
 * `unit.beds` or leave a bed unaccounted for.
 *
 * `bedReleases` is now a parameter rather than a module-level import (Task 11, spec item 9):
 * releases live in `WardFlowState.bedReleases` so a ward's own `FLAG_BED_RELEASE` actually moves
 * `potential`, and every caller passes whichever collection it currently holds — the live
 * reducer state where one is available, or the raw fixture for a check that has no reducer state
 * at all (`tests/ward-capacity-reconciliation.test.ts`, `tests/ward-model.test.ts`).
 */
export function unitCapacity(unit: Unit, bedReleases: BedRelease[]) {
  const available = Math.min(unit.allocatable.value, unit.empty.value);
  const held = Math.max(unit.empty.value - available, 0);
  const notEmpty = Math.max(unit.beds - unit.empty.value, 0);
  const blocked = Math.min(Math.max(unit.blocked, 0), notEmpty);
  const occupied = Math.max(notEmpty - blocked, 0);
  return {
    available,
    held,
    /**
     * Task 7 (Phase 5, spec D6): this is a raw count of every bed release for the unit
     * regardless of state or timing — it does not distinguish confirmed from predicted from
     * blocked, and it does not exclude a release that falls beyond tonight. The capacity
     * headline (`CapacityView` in `ward-management-modes.tsx`) no longer shows this figure at
     * all — it renders `capacityBreakdown()`'s five separate figures instead. This field is
     * NOT deleted and its arithmetic is unchanged: `coordinator/flow-diagram.tsx`,
     * `ward-management-network.tsx` and `ward/ward-screen.tsx` still render it, and updating
     * those three is a recorded follow-up outside this task's scope, not something to do here.
     */
    potential: bedReleases.filter((release) => release.unitId === unit.id).length,
    blocked,
    occupied,
  };
}

/**
 * Whole-branch review Important 5: the security gate passes a Secure ward for an Open movement
 * on purpose — a locked ward can physically hold an open-status patient, so it is not a
 * *failure*. But it is also not a neutral match: placing a voluntary or open-status patient on
 * a locked ward is a real clinical decision, and the gate row reads "Met" with the affirmative
 * detail "Secure ward meets an open requirement", which hides that decision behind a tick.
 *
 * `ward-eligibility.ts` is a protected surface, so the gate's pass/fail semantics are deliberately
 * untouched. This is the separate, surfaced fact the shortlist and the diagram render alongside
 * the passing gate so a coordinator sees it before confirming.
 */
export function isMoreRestrictiveThanRequired(movement: Movement, unit: Unit): boolean {
  return movement.security === "Open" && unit.security === "Secure";
}

/** The wording used wherever `isMoreRestrictiveThanRequired` is surfaced, so it reads identically
 * on the shortlist row, the gate note, the suggestion badge and the diagram node. */
export const MORE_RESTRICTIVE_NOTE = "More restrictive than required — a locked ward for an open-status movement";

export type RestrictionNotice = { level: "voluntary_on_locked" | "more_restrictive"; text: string };

/**
 * A ward tighter than the patient needs raises one of two warnings, and they are different things.
 * A voluntary person who cannot leave a locked ward is detained in fact without an order, which is
 * sharper than merely over-restrictive and gets its own flag. Neither blocks a placement and
 * neither touches an eligibility gate — `ward-eligibility.ts` is a protected surface.
 */
export function restrictionNotice(movement: Movement, unit: Unit): RestrictionNotice | undefined {
  if (unit.security !== "Secure") return undefined;
  if (movement.legalStatus === "Voluntary") {
    return {
      level: "voluntary_on_locked",
      text: "Voluntary patient on a locked ward — review legal status before admission",
    };
  }
  if (movement.security === "Open") {
    return { level: "more_restrictive", text: "More restrictive than this movement requires" };
  }
  return undefined;
}

/**
 * The units among `units` whose cohort matches this movement's, ranked eligible-first using the
 * real eligibility gates, then truncated to `limit`.
 *
 * This is NOT a proximity ranking, and must never be described as one. `Unit` carries no
 * distance, geo, locality or catchment field, and `Movement` carries no catchment either
 * (see `movementHealthService`), so no surface in this prototype can honestly claim a
 * "nearest" anything. Whole-branch review Critical 1 found exactly that claim on screen:
 * WF-018, sitting in SCGH's own emergency department, was offered "RPH Older Adult" first and
 * its own SCGH ward second under a heading reading "Nearest candidates". The tie order below is
 * simply `units`' own array order.
 *
 * Task 5: within that same top-`limit` set, a candidate matching the movement's own security
 * requirement is ranked ahead of a restricted one — see the two-pass reasoning in the body below.
 *
 * This is a shortlist of candidates, never a destination — a unit appearing here has not been
 * referred or accepted; see `destinationUnit` for the movement's actual recorded destination.
 *
 * Whole-branch review Critical 1: this is the function root-caused by the review as reading the
 * frozen fixture on every live surface (a ward's own confirmed capacity could drop to zero and
 * the coordinator's shortlist would still read "Eligible now" for it). It now takes `units` as a
 * parameter instead of reading `allUnits()` itself — every live caller must pass the provider's
 * live `units`, never the frozen fixture. `units` is REQUIRED and deliberately has no default —
 * a defaulted `units = allUnits()` would let every existing call site keep compiling while
 * silently reading frozen capacity again, which is precisely how the original defect survived.
 * The frozen wrapper this comment used to point at was deleted in R70; nothing reads the fixture
 * at render time any more, and `tests/ward-flow-single-source.test.ts` enforces that with a
 * TypeScript-parser walk rather than a text scan.
 */
export function eligibleCandidatesAmong(movement: Movement, units: Unit[], now: Instant, limit = 3) {
  // Eligible-first cut FIRST, restrictiveness reorder SECOND, deliberately in two passes rather
  // than one combined sort. A single combined sort could pull in a unit that was previously
  // outside the top `limit` (a candidate ranked 4th purely because it is restrictive would climb
  // into a 3-slot shortlist ahead of one that was already in it) — a real membership change, not
  // just a reorder, and `/mockups/ward-flow/network` shows this same shortlist. Truncating on
  // eligibility alone first keeps the returned SET identical to before this ordering rule
  // existed; only the ORDER within that set can move.
  const eligibleFirst = units
    .filter((unit) => unit.cohort === movement.cohort)
    .map((unit) => ({ unit, verdict: eligibility(movement, unit, now) }))
    .sort((a, b) => Number(b.verdict.eligible) - Number(a.verdict.eligible))
    .slice(0, limit);
  // Within that fixed set, a candidate matching the movement's own security requirement is
  // ranked ahead of one `restrictionNotice` flags as tighter than required (Task 5) — a locked
  // ward can still genuinely hold an open-status patient, it just should not be the one a
  // coordinator is steered toward first. Eligibility stays the primary key here too, so this
  // pass can never demote an eligible candidate below an ineligible one. `Array.prototype.sort`
  // is stable, so any remaining tie falls back to the eligible-first cut's own order, which is
  // itself `units`' own array order.
  return [...eligibleFirst].sort((a, b) => {
    const eligibleDiff = Number(b.verdict.eligible) - Number(a.verdict.eligible);
    if (eligibleDiff !== 0) return eligibleDiff;
    const aRestricted = restrictionNotice(movement, a.unit) ? 1 : 0;
    const bRestricted = restrictionNotice(movement, b.unit) ? 1 : 0;
    return aRestricted - bRestricted;
  });
}

/**
 * A binary, non-ordinal description of a verdict: eligible, or the specific gate that failed.
 * Eligibility gates are not commensurable (failing `authorisation` is a legal hard stop;
 * failing `capacity_freshness` is a staleness warning), so this deliberately never collapses
 * them into a "N of M passed" fraction — that shape reads as a score, and higher/lower
 * comparisons across two verdicts are not meaningful.
 */
export function candidateReason(verdict: EligibilityVerdict) {
  if (verdict.eligible) return "Eligible now";
  const failed = verdict.gates.find((gate) => !gate.pass);
  return failed ? failed.detail : "Not eligible";
}

export type InboxTone = "danger" | "warning";
export type InboxItem = {
  id: string;
  tone: InboxTone;
  icon: LucideIcon;
  title: string;
  detail: string;
  owner: string;
  movementId: string;
};

/**
 * Every item here is computed from real movement fields — nothing is authored.
 *
 * RULING (Task 8): each category uses `.filter()`, never `.find()`. A `.find()`-based inbox
 * reported exactly one item per category regardless of how many movements qualified, silently
 * understating the coordinator's work list.
 *
 * Re-measured against the real fixture at `NOW_ANCHOR` on 2026-08-23: **zero** movements carry a
 * breached legal deadline, one has reached the parallel-referral cap, and two have transport
 * accepted but not departed. The legal category is empty because the 2026-08-23 product-owner
 * correction removed every `dueAt` from Forms 1A and 3B (see `LegalForm`'s own doc comment in
 * ward-model.ts), and the only deadlines left in this fixture — the transport/transfer forms 4A
 * and 4C — are not currently in the past. An earlier version of this comment claimed five
 * movements carried a breached statutory deadline; that number described the deleted fabrication
 * and is not true of any figure in this model.
 *
 * The `.filter()` shape stays regardless, for two reasons: the transport category alone still
 * qualifies two movements today, so `.find()` would still understate the list; and the legal
 * category is dormant rather than removed, so it must count correctly the moment a form that
 * legitimately carries a deadline falls due. This is the coordinator's work list, not a report:
 * every qualifying movement gets its own row.
 */
export function buildActionInbox(movements: Movement[], now: Instant, units: Unit[]): InboxItem[] {
  const items: InboxItem[] = [];

  // A legal status change can make an already-accepted destination unlawful — see
  // `destinationNoLongerLawful`'s own doc comment. This never re-sorts or un-accepts the
  // patient; it only surfaces the fact for a human, exactly like every other category here.
  const noLongerLawful = movements
    .map((movement) => ({ movement, unit: destinationNoLongerLawful(movement, units) }))
    .filter((entry): entry is { movement: Movement; unit: Unit } => entry.unit !== undefined);
  for (const { movement, unit } of noLongerLawful) {
    items.push({
      id: `destination-unlawful-${movement.id}`,
      tone: "danger",
      icon: CircleAlert,
      title: "Accepted destination no longer lawful",
      detail: `${movement.id} · ${unit.name} is not authorised under the Mental Health Act for ${movement.legalStatus}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  // A form with no `dueAt` is never breached and contributes nothing here; `undefined` must never
  // reach `clockState`'s arithmetic. As of the 2026-08-23 product-owner correction that is every
  // Form 1A and every Form 3B in this model — the record carries no deadline for them. Stated
  // that way deliberately: what this model holds is a fact about the record, whereas what the
  // Mental Health Act does or does not require is a legal claim this prototype is not entitled to
  // make in either direction. The question was settled for the 3B by the clinician (Task 6A:
  // "It is just counting how long they have been in ED determining priority. So counting up") and
  // for the 1A by the product owner on 2026-08-23. See `LegalForm`'s doc comment in ward-model.ts.
  const breachedLegal = movements.filter(
    (movement) => movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
  );
  for (const movement of breachedLegal) {
    const dueAt = movement.legalForm?.dueAt;
    if (dueAt === undefined) continue;
    items.push({
      id: `legal-${movement.id}`,
      tone: "danger",
      icon: CircleAlert,
      title: "Legal timing breached",
      detail: `${movement.id} · ${formatRemaining(minutesUntil(dueAt, now))}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  const expiredBedHolds = movements.filter(
    (movement) => movement.stage === "bed_held" && movement.bedHeldUntil !== undefined && movement.bedHeldUntil < now,
  );
  for (const movement of expiredBedHolds) {
    const bedHeldUntil = movement.bedHeldUntil;
    if (bedHeldUntil === undefined) continue;
    items.push({
      id: `bed-hold-${movement.id}`,
      tone: "danger",
      icon: CircleAlert,
      title: "Bed hold expired",
      detail: `${movement.id} · ${formatRemaining(minutesUntil(bedHeldUntil, now))}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  // Whole-branch review Important 4: this counts DECLINES, and the title used to claim the
  // PARALLEL REFERRAL CAP had been reached — two different denominators (`ward-priority.ts`
  // documents the same distinction for the score). WF-009 carries five declines and zero live
  // referrals, so the drawer announced a referral cap reached for a movement with nothing
  // referred anywhere. The threshold is unchanged; only the claim is, so it now names exactly
  // what it measures. `PARALLEL_REFERRAL_CAP` is still the threshold because three refusals is
  // the point at which a coordinator should widen the search, not because three referrals are
  // outstanding.
  const heavilyDeclined = movements.filter((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP);
  for (const movement of heavilyDeclined) {
    items.push({
      id: `declines-${movement.id}`,
      tone: "danger",
      icon: CircleAlert,
      title: "Multiple destinations declined",
      detail: `${movement.id} · ${movement.declines.length} destinations have declined`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  const stalledTransport = movements.filter(
    (movement) =>
      movement.transport?.acceptedAt !== undefined &&
      movement.transport.enRouteAt === undefined &&
      movement.transport.cancelledAt === undefined,
  );
  for (const movement of stalledTransport) {
    if (!movement.transport) continue;
    items.push({
      id: `transport-${movement.id}`,
      tone: "warning",
      icon: Truck,
      title: "Transport awaiting departure",
      detail: `${movement.id} · accepted ${formatInstant(movement.transport.acceptedAt as Instant)}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  return items;
}

/**
 * Task 4 (spec item 1): the shift handover — a point-in-time, printable summary a coordinator
 * hands to the incoming coordinator, built from four fixed sections in a product-owner-approved
 * order. This function is a pure derivation, exactly like every other one in this module — `now`
 * arrives as a parameter, nothing here reads the wall clock — but the FREEZE that makes it a
 * handover rather than a live view is the caller's responsibility, not this function's: a page
 * must call this exactly once, in a `useState` initialiser, so what a coordinator reads never
 * changes under them while the shift clock keeps ticking in the background. Calling this
 * function itself is always safe and always pure; only the page can break the freeze.
 *
 * Every section is scoped to OPEN movements (`isOpen`) — a shift handover is about the live
 * caseload being handed over, not movements that have already arrived or otherwise closed.
 *
 * `longestWaits` carries every open movement, ranked by wait, with deliberately NO threshold:
 * measured against the real fixture at NOW_ANCHOR, zero of the open movements are past the
 * 24-hour departmental access target, so a breach-led ranking would render this section empty.
 * Ranking by wait alone always has something to hand over.
 *
 * `placementGoneWrong` names exactly two situations, neither of them a legal claim:
 * - `"escalated"` — the movement carries a recorded `escalation`: a human already declared the
 *   referral network exhausted and rang the state bed coordination desk.
 * - `"declined_by_all"` — the movement has a decline on record and nothing still pending
 *   (`referredUnitIds` empty, `declines` non-empty). `ward-flow-reducer.ts`'s own `case
 *   "DECLINE"` only ever removes a unit from `referredUnitIds` in the same update that adds the
 *   matching `declines` entry, so this condition is exactly "every unit this movement was ever
 *   referred to has since said no, and none of them are still deciding".
 * A movement can satisfy both at once; the escalation check runs first, so it is listed once,
 * as `"escalated"`, never twice.
 */
export type HandoverSnapshot = {
  frozenAt: Instant;
  longestWaits: { movement: Movement; unit: Unit | undefined }[];
  heldBeds: { movement: Movement; unit: Unit | undefined; expired: boolean }[];
  inTransit: { movement: Movement; leg: TransportLeg | "Cancelled" | undefined }[];
  placementGoneWrong: { movement: Movement; kind: "escalated" | "declined_by_all" }[];
};

export function handoverSnapshot(movements: Movement[], units: Unit[], now: Instant): HandoverSnapshot {
  const open = movements.filter(isOpen);

  const longestWaits = [...open]
    .sort((a, b) => now - b.openedAt - (now - a.openedAt))
    .map((movement) => ({ movement, unit: destinationUnit(movement, units) }));

  const heldBeds = open
    .filter((movement) => movement.bedHeldUntil !== undefined)
    .map((movement) => {
      const bedHeldUntil = movement.bedHeldUntil as Instant;
      return { movement, unit: destinationUnit(movement, units), expired: bedHeldUntil <= now };
    });

  const inTransit = open
    .filter((movement) => movement.transport !== undefined)
    .map((movement) => ({ movement, leg: transportLeg(movement.transport) }));

  const escalated = open
    .filter((movement) => movement.escalation !== undefined)
    .map((movement) => ({ movement, kind: "escalated" as const }));
  const escalatedIds = new Set(escalated.map((entry) => entry.movement.id));
  const declinedByAll = open
    .filter((movement) => !escalatedIds.has(movement.id))
    .filter((movement) => movement.referredUnitIds.length === 0 && movement.declines.length > 0)
    .map((movement) => ({ movement, kind: "declined_by_all" as const }));

  return {
    frozenAt: now,
    longestWaits,
    heldBeds,
    inTransit,
    placementGoneWrong: [...escalated, ...declinedByAll],
  };
}

/**
 * Task 5 (spec item 4): the escalation board — one place showing every patient whose placement
 * has gone wrong. Two groups, computed independently, and a movement can genuinely appear in
 * both: `escalated` is a fact about the RECORD (a human already declared the network exhausted
 * and rang a contact); `nowhereEligible` is a fact about the LIVE network right now
 * (`eligibleCandidatesAmong`, evaluated against every unit so nothing is truncated). WF-009
 * satisfies both at once in the real fixture — it has a recorded escalation and, independently,
 * still has zero eligible wards — and that overlap is correct, not a bug: the two lists answer
 * different questions and neither implies or excludes the other.
 *
 * THIS BOARD RECORDS AND SHOWS. IT SUGGESTS NOTHING (spec D4). No "least-bad options", no
 * ranking of wards the patient does not fit, no statement of what would need to change for a
 * ward to work. `nowhereEligible` names WHICH movements have nowhere eligible; it never names
 * which ward almost fit, or what gate is closest to passing — that would be exactly the
 * near-miss computation item 4 explicitly prohibits. `escalated` shows `triedUnitIds` resolved
 * to real `Unit` objects purely as a record of what was already tried, never as live candidates.
 *
 * Scoped to OPEN movements only (`isOpen`) — a closed movement's placement cannot still be
 * "going wrong" in a way this board exists to surface.
 */
export type EscalationBoard = {
  escalated: { movement: Movement; triedUnits: Unit[] }[];
  nowhereEligible: Movement[];
};

export function escalationBoard(movements: Movement[], units: Unit[], now: Instant): EscalationBoard {
  const open = movements.filter(isOpen);

  const escalated = open
    .filter((movement) => movement.escalation !== undefined)
    .map((movement) => {
      const triedUnitIds = movement.escalation?.triedUnitIds ?? [];
      const triedUnits = triedUnitIds
        .map((unitId) => units.find((unit) => unit.id === unitId))
        .filter((unit): unit is Unit => unit !== undefined);
      return { movement, triedUnits };
    });

  // A large, explicit limit — never the default of 3 — so this counts every unit in the
  // network rather than reading a truncated shortlist length as an eligibility count. That
  // exact mistake (counting `eligibleCandidatesAmong(...).length` instead of filtering to
  // `.verdict.eligible`) produced a false "nowhereEligible is empty on the standard night" claim
  // in an earlier draft of this task's own brief — see tests/ward-scenarios.test.ts's comment.
  const nowhereEligible = open.filter(
    (movement) =>
      eligibleCandidatesAmong(movement, units, now, units.length).filter((candidate) => candidate.verdict.eligible)
        .length === 0,
  );

  return { escalated, nowhereEligible };
}

/**
 * Task 7 (spec item 5): patient search — a plain, pure, case-insensitive filter over the OPEN
 * caseload. Pure and synchronous: no clock read, no debounce, no fetch — the page component owns
 * the query state and calls this on every keystroke/select change.
 *
 * `stage` and `edId` are exact-value filters (a coordinator picking a stage or a department wants
 * that stage or that department, not a substring of it); `text` is the only substring match, and
 * it is checked against five real fields: the movement id, `originEdId`, the resolved destination
 * unit's `id` and `name` (via `destinationUnit`, so this reads the same "actual destination" every
 * other screen does — never a mere shortlist candidate), the stage's own display label (via
 * `stageCopy`, so a coordinator can type what the results table actually shows, e.g. "Bed held",
 * rather than the raw enum `bed_held`), and `owner`. An empty (or whitespace-only) `text` matches
 * every open movement, so the stage/department selects can filter alone with no text typed.
 *
 * ABSOLUTE RULE, enforced first and unconditionally: `isOpen` is applied before anything else.
 * A closed movement can never reach the result set, even when every other field of the query
 * — including the movement's own id typed verbatim — would otherwise match it. Search existing
 * for a patient who has already left the system must read as "not found", not as a stale hit.
 */
export type MovementSearchQuery = {
  text: string;
  stage?: MovementStage;
  edId?: string;
};

export function searchMovements(movements: Movement[], units: Unit[], query: MovementSearchQuery): Movement[] {
  const needle = query.text.trim().toLowerCase();

  return movements
    .filter(isOpen)
    .filter((movement) => query.stage === undefined || movement.stage === query.stage)
    .filter((movement) => query.edId === undefined || movement.originEdId === query.edId)
    .filter((movement) => {
      if (needle === "") return true;
      const destination = destinationUnit(movement, units);
      const haystack = [
        movement.id,
        movement.originEdId,
        destination?.id,
        destination?.name,
        stageCopy[movement.stage].label,
        movement.owner,
      ].filter((value): value is string => value !== undefined);
      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
}

/** A real, per-movement audit trail built from actual fields — never generic flavour text. */
export function movementTimeline(movement: Movement) {
  const events: Array<{ at: Instant; label: string }> = [{ at: movement.openedAt, label: "Movement opened" }];
  for (const change of movement.statusChanges) {
    events.push({ at: change.at, label: `Legal status changed: ${change.from} → ${change.to} (${change.by})` });
  }
  for (const decline of movement.declines) {
    events.push({ at: decline.at, label: `Declined by referral: ${decline.reason.replace(/_/g, " ")}` });
  }
  if (movement.transport?.acceptedAt !== undefined) {
    events.push({ at: movement.transport.acceptedAt, label: `Transport accepted by ${movement.transport.provider}` });
  }
  if (movement.transport?.enRouteAt !== undefined) {
    events.push({ at: movement.transport.enRouteAt, label: "Transport en route" });
  }
  if (movement.transport?.collectedAt !== undefined) {
    events.push({ at: movement.transport.collectedAt, label: "Patient collected" });
  }
  if (movement.transport?.arrivedAt !== undefined) {
    events.push({ at: movement.transport.arrivedAt, label: "Arrived at destination" });
  }
  if (movement.closure) {
    events.push({ at: movement.closure.at, label: movement.closure.reason });
  }
  return events.sort((a, b) => a.at - b.at);
}

/**
 * Task 9 (spec item 7): the governance board's audit of changes — every urgency change, legal
 * status change, hold release and transport cancellation across ALL movements, not one patient's
 * own timeline (`movementTimeline` above stays scoped to a single movement; this is the
 * statewide counterpart). Newest first, so the most recent decision is the one a reviewer sees
 * without scrolling.
 */
export type ChangeAuditEntry = {
  at: Instant;
  movementId: string;
  kind: "urgency" | "legal_status" | "hold_released" | "transport_cancelled";
  by: string;
  detail: string;
};

export function changeAudit(movements: Movement[]): ChangeAuditEntry[] {
  const entries: ChangeAuditEntry[] = [];
  for (const movement of movements) {
    for (const change of movement.statusChanges) {
      entries.push({
        at: change.at,
        movementId: movement.id,
        kind: "legal_status",
        by: change.by,
        detail: `${change.from} → ${change.to} · ${changeReasonLabels[change.reason]}`,
      });
    }
    for (const change of movement.urgencyChanges) {
      entries.push({
        at: change.at,
        movementId: movement.id,
        kind: "urgency",
        by: change.by,
        detail: `Tier ${change.from} → Tier ${change.to} · ${changeReasonLabels[change.reason]}`,
      });
    }
    for (const unwind of movement.unwinds) {
      // `UnwindRecord.reason` is typed as a plain `string` on `Movement` (ward-model.ts) because
      // `RELEASE_HOLD` and `CANCEL_TRANSPORT` share one record shape for two different fixed
      // reason lists. The reducer only ever writes a `ReleaseHoldReason` into a "hold_released"
      // entry and a `CancelTransportReason` into a "transport_cancelled" one (ward-flow-reducer.ts),
      // so this assertion narrows back to that guarantee rather than inventing one — it does not
      // widen what values can reach the screen. Never render `unwind.reason` unlabelled: that is
      // the raw snake_case defect this file's own doc comment on `changeReasonLabels` exists to
      // prevent.
      const reason = unwind.reason as ReleaseHoldReason | CancelTransportReason;
      entries.push({
        at: unwind.at,
        movementId: movement.id,
        kind: unwind.kind,
        by: unwind.by,
        detail: changeReasonLabels[reason],
      });
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Minutes from referral to a ward accepting, for one movement — `undefined` when that duration
 * cannot be recovered from this record.
 *
 * `Movement.acceptedAt` (added fix round 1, Task 9) is the direct, reliable source: it is
 * stamped by `ACCEPT_IN_PRINCIPLE` (ward-flow-reducer.ts) the instant a unit is accepted, for
 * every acceptance reached from now on. It is preferred whenever present. Before that field
 * existed, the only place an acceptance instant survived was `withdrawnReferrals` — the same
 * reducer branch withdraws every OTHER referred unit in the same update, stamping each
 * withdrawal with `event.now`, so a movement accepted while more than one unit held a live
 * referral leaves the acceptance instant behind as a side effect. That fallback still applies to
 * the hand-authored seed fixture (`ward-movements.ts`), which sets `acceptedUnitId` directly
 * rather than via a dispatched event and so never carries `acceptedAt` — its one recoverable
 * acceptance (WF-006) is only found this way, and the fixture is deliberately never backfilled
 * with an invented `acceptedAt` to manufacture a bigger sample. A movement accepted with only one
 * referred unit and no `acceptedAt` withdraws nothing and leaves no timestamp anywhere in this
 * model — that movement reached acceptance but genuinely has no recoverable "when", so it is
 * excluded here rather than guessed.
 */
function acceptanceDurationMinutes(movement: Movement): number | undefined {
  if (movement.acceptedUnitId === undefined) return undefined;
  if (movement.acceptedAt !== undefined) return movement.acceptedAt - movement.openedAt;
  if (movement.withdrawnReferrals.length === 0) return undefined;
  return movement.withdrawnReferrals[0].at - movement.openedAt;
}

/** Distinct units this movement has ever referred to: currently referred, declined, withdrawn on
 *  acceptance, and the accepted unit itself. `undefined` when the movement has never referred to
 *  any unit, so it never contributes a fabricated zero to an average. */
function unitsContactedCount(movement: Movement): number | undefined {
  const contacted = new Set<string>([
    ...movement.referredUnitIds,
    ...movement.declines.map((decline) => decline.unitId),
    ...movement.withdrawnReferrals.map((withdrawn) => withdrawn.unitId),
  ]);
  if (movement.acceptedUnitId !== undefined) contacted.add(movement.acceptedUnitId);
  return contacted.size === 0 ? undefined : contacted.size;
}

/**
 * Fix round 1 (Task 9): a computed figure alone is not honest without the basis it was drawn
 * from. `sampleSize` is how many movements actually contributed an observation; `population` is
 * how many movements COULD have — every acceptance for the acceptance measure, every movement
 * passed in for the units-contacted measure. A median or average over a small `sampleSize`
 * against a much larger `population` (this fixture: 1 of 27 acceptances) is a guess wearing the
 * clothes of a measurement unless that gap renders next to the number.
 */
export type EffectivenessMeasure = {
  value: number | undefined;
  sampleSize: number;
  population: number;
};

/**
 * Task 9 (spec item 7), D7: the governance board's two live effectiveness numbers. Conservative
 * failure applies to each independently — a measure this cannot compute returns `undefined`,
 * never `0`, because zero minutes to acceptance or zero units contacted both read as a real
 * result rather than as "unknown". Both describe the current synthetic scenario only; nothing
 * here is a claim about the prototype's real-world effectiveness. Both carry their own basis
 * (`EffectivenessMeasure`) so a thin sample is never presented bare.
 */
export function effectivenessNumbers(movements: Movement[]): {
  medianMinutesToAcceptance: EffectivenessMeasure;
  averageUnitsContacted: EffectivenessMeasure;
} {
  const totalAcceptances = movements.filter((movement) => movement.acceptedUnitId !== undefined).length;
  const acceptanceDurations = movements
    .map((movement) => acceptanceDurationMinutes(movement))
    .filter((minutes): minutes is number => minutes !== undefined);

  const contactedCounts = movements
    .map((movement) => unitsContactedCount(movement))
    .filter((count): count is number => count !== undefined);

  const averageUnitsContacted =
    contactedCounts.length === 0
      ? undefined
      : contactedCounts.reduce((total, count) => total + count, 0) / contactedCounts.length;

  return {
    medianMinutesToAcceptance: {
      value: median(acceptanceDurations),
      sampleSize: acceptanceDurations.length,
      population: totalAcceptances,
    },
    averageUnitsContacted: {
      value: averageUnitsContacted,
      sampleSize: contactedCounts.length,
      population: movements.length,
    },
  };
}
