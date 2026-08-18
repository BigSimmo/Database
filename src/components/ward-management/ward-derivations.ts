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
import { eligibility, type EligibilityVerdict } from "@/components/ward-management/ward-eligibility";
import {
  MOVEMENT_STAGES,
  PARALLEL_REFERRAL_CAP,
  type HealthService,
  type Movement,
  type MovementStage,
  type TransportJob,
  type Unit,
} from "@/components/ward-management/ward-model";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments, allUnits, siteByCode, unitById } from "@/components/ward-management/ward-sites";

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

/** Counts are derived from `wardMovements` so the pipeline strip can never advertise a
 * count no other surface can show. */
export function stageSummaries(movements: Movement[]) {
  return MOVEMENT_STAGES.map((id) => ({
    id,
    ...stageCopy[id],
    count: movements.filter((movement) => movement.stage === id).length,
  }));
}

export const movementStageSummary = stageSummaries(wardMovements);

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
 * The unit a movement is *actually* recorded against — accepted, or else the first live
 * referral. Never falls back to a different unit, and never returns a merely-suggested
 * candidate: callers that want a suggestion when this is `undefined` must ask for one
 * explicitly (see `eligibleCandidates`) and label it as a suggestion, not a destination.
 */
export function destinationUnit(movement: Movement): Unit | undefined {
  const id = movement.acceptedUnitId ?? movement.referredUnitIds[0];
  return id ? unitById(id) : undefined;
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
 */
export function unitCapacity(unit: Unit) {
  const available = Math.min(unit.allocatable.value, unit.empty.value);
  const held = Math.max(unit.empty.value - available, 0);
  const notEmpty = Math.max(unit.beds - unit.empty.value, 0);
  const blocked = Math.min(Math.max(unit.blocked, 0), notEmpty);
  const occupied = Math.max(notEmpty - blocked, 0);
  return {
    available,
    held,
    potential: bedReleases.filter((release) => release.unitId === unit.id).length,
    blocked,
    occupied,
  };
}

/**
 * Cohort-matching units ranked eligible-first, using the real eligibility gates. This is a
 * shortlist of candidates, never a destination — a unit appearing here has not been referred
 * or accepted; see `destinationUnit` for the movement's actual recorded destination.
 */
export function eligibleCandidates(movement: Movement, now: Instant, limit = 3) {
  return allUnits()
    .filter((unit) => unit.cohort === movement.cohort)
    .map((unit) => ({ unit, verdict: eligibility(movement, unit, now) }))
    .sort((a, b) => Number(b.verdict.eligible) - Number(a.verdict.eligible))
    .slice(0, limit);
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

/** Every item here is computed from real movement fields — nothing is authored. */
export function buildActionInbox(movements: Movement[], now: Instant): InboxItem[] {
  const items: InboxItem[] = [];

  const breachedLegal = movements.find(
    (movement) => movement.legalForm && clockState(movement.legalForm.dueAt, now) === "breached",
  );
  if (breachedLegal?.legalForm) {
    items.push({
      id: `legal-${breachedLegal.id}`,
      tone: "danger",
      icon: CircleAlert,
      title: "Legal timing breached",
      detail: `${breachedLegal.id} · ${formatRemaining(minutesUntil(breachedLegal.legalForm.dueAt, now))}`,
      owner: breachedLegal.owner,
      movementId: breachedLegal.id,
    });
  }

  // This only detects that three parallel referrals were declined, not that the network is
  // actually exhausted — a movement can hit the cap with eligible units still untried. Name
  // it for what it measures rather than implying a broader search than was actually run.
  const exhaustedReferrals = movements.find((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP);
  if (exhaustedReferrals) {
    items.push({
      id: `declines-${exhaustedReferrals.id}`,
      tone: "danger",
      icon: CircleAlert,
      title: "Parallel referral cap reached",
      detail: `${exhaustedReferrals.id} · ${exhaustedReferrals.declines.length} declines`,
      owner: exhaustedReferrals.owner,
      movementId: exhaustedReferrals.id,
    });
  }

  const stalledTransport = movements.find(
    (movement) =>
      movement.transport?.acceptedAt !== undefined &&
      movement.transport.enRouteAt === undefined &&
      movement.transport.cancelledAt === undefined,
  );
  if (stalledTransport?.transport) {
    items.push({
      id: `transport-${stalledTransport.id}`,
      tone: "warning",
      icon: Truck,
      title: "Transport awaiting departure",
      detail: `${stalledTransport.id} · accepted ${formatInstant(stalledTransport.transport.acceptedAt as Instant)}`,
      owner: stalledTransport.owner,
      movementId: stalledTransport.id,
    });
  }

  return items;
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
