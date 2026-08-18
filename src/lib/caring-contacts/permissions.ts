// src/lib/caring-contacts/permissions.ts
import type { ActorId, TeamId } from "./ids";

export type CaringContactRole = "coordinator" | "teamLead" | "auditor";

export type CaringContactAction =
  | "viewReferral"
  | "acceptReferral"
  | "claimPlan"
  | "activatePlan"
  | "pausePlan"
  | "resumePlan"
  | "withdrawPlan"
  | "reassignPlan"
  | "moveContactWithinDay"
  | "changeContactDate"
  | "authorPathwayVersion"
  | "approvePathwayVersion"
  | "viewAccessTrail"
  | "triggerServiceSafetyStop"
  | "approveServiceRestart"
  | "generateClinicalRecordSummary";

export type Actor = { id: ActorId; teamId: TeamId; roles: readonly CaringContactRole[] };
export type Resource = { teamId: TeamId };
export type CapabilityDecision = { allowed: true } | { allowed: false; reason: string };

// Exhaustiveness guard: a `Record<CaringContactAction, true>` object literal must have
// exactly one key per union member -- TypeScript rejects it if an action is missing or if
// a stray key is added. ALL_ACTIONS is derived from this registry, so it can never drift
// from the CaringContactAction type.
const ACTION_REGISTRY: Record<CaringContactAction, true> = {
  viewReferral: true,
  acceptReferral: true,
  claimPlan: true,
  activatePlan: true,
  pausePlan: true,
  resumePlan: true,
  withdrawPlan: true,
  reassignPlan: true,
  moveContactWithinDay: true,
  changeContactDate: true,
  authorPathwayVersion: true,
  approvePathwayVersion: true,
  viewAccessTrail: true,
  triggerServiceSafetyStop: true,
  approveServiceRestart: true,
  generateClinicalRecordSummary: true,
};

export const ALL_ACTIONS: readonly CaringContactAction[] = Object.freeze(
  Object.keys(ACTION_REGISTRY) as CaringContactAction[],
);

// Actions deliberately granted to no role. Kept as an explicit registry (rather than left
// implicit) so that every action in CaringContactAction must be classified either here or
// in ROLE_ACTIONS -- a new action that is added to the type but forgotten here fails the
// table-driven completeness test instead of silently defaulting to allowed.
export const UNGRANTED_ACTIONS: readonly CaringContactAction[] = Object.freeze([]);

const COORDINATOR_ACTIONS: readonly CaringContactAction[] = Object.freeze([
  "viewReferral",
  "acceptReferral",
  "claimPlan",
  "activatePlan",
  "pausePlan",
  "resumePlan",
  "withdrawPlan",
  "moveContactWithinDay",
  "authorPathwayVersion",
  "generateClinicalRecordSummary",
  "triggerServiceSafetyStop",
]);

const TEAM_LEAD_ACTIONS: readonly CaringContactAction[] = Object.freeze([
  "viewReferral",
  "acceptReferral",
  "claimPlan",
  "activatePlan",
  "pausePlan",
  "resumePlan",
  "withdrawPlan",
  "reassignPlan",
  "moveContactWithinDay",
  "changeContactDate",
  "authorPathwayVersion",
  "approvePathwayVersion",
  "generateClinicalRecordSummary",
  "triggerServiceSafetyStop",
  "approveServiceRestart",
]);

// Rule 6 carves triggerServiceSafetyStop out for every role, auditor included -- stopping
// the service must never be blocked by a permission check. Every other action stays
// outside the auditor's grant (rule 3): the auditor may view the access trail and stop the
// service, and nothing else.
const AUDITOR_ACTIONS: readonly CaringContactAction[] = Object.freeze(["viewAccessTrail", "triggerServiceSafetyStop"]);

export const ROLE_ACTIONS: Readonly<Record<CaringContactRole, readonly CaringContactAction[]>> = Object.freeze({
  coordinator: COORDINATOR_ACTIONS,
  teamLead: TEAM_LEAD_ACTIONS,
  auditor: AUDITOR_ACTIONS,
});

/**
 * Deny-by-default capability check. Order matters:
 * 1. Team scope is checked first, so a cross-team actor learns only that the team is
 *    wrong -- never which actions exist for their role.
 * 2. An actor with no roles at all is refused with a distinct reason.
 * 3. Otherwise the action must be explicitly granted to at least one of the actor's
 *    roles in the frozen ROLE_ACTIONS map, or it is denied.
 */
export function canPerformCaringContactAction(
  actor: Actor,
  action: CaringContactAction,
  resource: Resource,
): CapabilityDecision {
  if (resource.teamId !== actor.teamId) {
    return { allowed: false, reason: "cross-team-denied" };
  }
  if (actor.roles.length === 0) {
    return { allowed: false, reason: "no-roles" };
  }
  const granted = actor.roles.some((role) => ROLE_ACTIONS[role].includes(action));
  return granted ? { allowed: true } : { allowed: false, reason: "action-not-granted" };
}

/**
 * No single actor may both author and approve the same pathway version's clinical message
 * content. Separate from the role-grant check in canPerformCaringContactAction so callers
 * combine it with an approvePathwayVersion permission check rather than the two rules
 * being conflated into one reason.
 */
export function canApproveOwnAuthoredVersion(authorId: ActorId, approverId: ActorId): CapabilityDecision {
  return authorId === approverId ? { allowed: false, reason: "self-approval-denied" } : { allowed: true };
}
