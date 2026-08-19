// src/lib/caring-contacts/service-state.ts
//
// The service-wide safety stop: one control that halts ALL caring-contact sending, across every
// patient and every team, the moment a confirmed wrong-recipient message, duplicate send,
// unauthorised content, material privacy or security incident, or loss of audit integrity is
// found (spec §4.2).
//
// Two properties this module exists to guarantee, and neither is recoverable elsewhere:
//
//   1. The stop holds. A stop is a service-wide fact, not a per-patient one, and the FIRST record
//      of it is permanent -- a second stop is refused rather than allowed to overwrite the reason,
//      the actor, or the time the first responder recorded. `serviceStopBlocksDispatch` is the
//      single question every dispatch path must ask, and it is true for exactly as long as the
//      service is stopped.
//
//   2. The restart cannot be a single person's decision. Restarting requires recorded approval
//      from all three of the incident lead, the privacy/security owner, and the clinical
//      programme lead -- three ROLES held by three DIFFERENT people. One actor cannot supply a
//      second approval by changing which role they are wearing, and the service does not restart
//      until the approval that completes the third distinct role arrives. There is deliberately
//      no other route back to running: no force flag, no override, no single-actor path.
//
// This is a pure transition module. It reads no ambient time (the caller injects a `Clock`),
// touches no storage, and performs no permission check -- the caller has already asked
// `canPerformCaringContactAction`. Recording the transition in the audit trail is likewise the
// caller's job; see ./audit.
import { awstIsoTimestamp, type Clock } from "./clock";
import type { ActorId, TeamId } from "./ids";
import type { TransitionResult } from "./model";

export type ServiceStopReason =
  | "wrong-recipient"
  | "duplicate-send"
  | "unauthorised-content"
  | "privacy-or-security-incident"
  | "audit-integrity-loss";

export type ServiceRestartApprovalRole = "incidentLead" | "privacySecurityOwner" | "clinicalProgrammeLead";

export type ServiceRestartApproval = {
  role: ServiceRestartApprovalRole;
  actorId: ActorId;
  /** AWST ISO-8601 instant with an explicit `+08:00` offset -- the same form ./audit records. */
  approvedAt: string;
};

export type ServiceState =
  | { stopped: false; teamId: TeamId }
  | {
      stopped: true;
      teamId: TeamId;
      reason: ServiceStopReason;
      stoppedBy: ActorId;
      /** AWST ISO-8601 instant with an explicit `+08:00` offset -- the same form ./audit records. */
      stoppedAt: string;
      note: string;
      restartApprovals: readonly ServiceRestartApproval[];
    };

/** The five confirmed events that stop the whole service under spec §4.2. */
export const SERVICE_STOP_REASONS: readonly ServiceStopReason[] = Object.freeze([
  "wrong-recipient",
  "duplicate-send",
  "unauthorised-content",
  "privacy-or-security-incident",
  "audit-integrity-loss",
]);

/**
 * All three must be recorded, by three different people, before sending resumes. Shortening this
 * list -- or letting one person cover two entries -- converts a three-person governance decision
 * into one person's call, which is the specific failure this module exists to prevent.
 */
export const REQUIRED_RESTART_APPROVAL_ROLES: readonly ServiceRestartApprovalRole[] = Object.freeze([
  "incidentLead",
  "privacySecurityOwner",
  "clinicalProgrammeLead",
]);

/** Plain-words wording for the banner. Deliberately describes the event, never the patient. */
const STOP_REASON_WORDING: Readonly<Record<ServiceStopReason, string>> = Object.freeze({
  "wrong-recipient": "a message reached the wrong recipient",
  "duplicate-send": "the same message was sent more than once",
  "unauthorised-content": "a message went out with content nobody had approved",
  "privacy-or-security-incident": "a privacy or security incident was confirmed",
  "audit-integrity-loss": "the record of what was sent can no longer be trusted",
});

const APPROVAL_ROLE_WORDING: Readonly<Record<ServiceRestartApprovalRole, string>> = Object.freeze({
  incidentLead: "the incident lead",
  privacySecurityOwner: "the privacy and security owner",
  clinicalProgrammeLead: "the clinical programme lead",
});

export function runningService(teamId: TeamId): ServiceState {
  return Object.freeze({ stopped: false as const, teamId });
}

/**
 * Records a service-wide stop.
 *
 * Refuses `service-already-stopped` when the service is already stopped: the first record is the
 * account of the incident and is never overwritten, so a later responder cannot replace the
 * original reason, actor, time, or note. Refuses `service-stop-note-required` when the note is
 * blank -- the categorised reason answers "what kind of failure", the note answers "which one",
 * and an incident with no "which one" cannot be reviewed afterwards.
 */
export function applyServiceStop(
  state: ServiceState,
  input: { reason: ServiceStopReason; actorId: ActorId; note: string },
  clock: Clock,
): TransitionResult<ServiceState> {
  if (state.stopped) return { ok: false, reason: "service-already-stopped" };
  if (input.note.trim() === "") return { ok: false, reason: "service-stop-note-required" };

  return {
    ok: true,
    value: Object.freeze({
      stopped: true as const,
      teamId: state.teamId,
      reason: input.reason,
      stoppedBy: input.actorId,
      stoppedAt: awstIsoTimestamp(clock.now()),
      note: input.note,
      restartApprovals: Object.freeze([]),
    }),
  };
}

/**
 * Records one restart approval, and restarts the service only on the approval that completes all
 * three required roles.
 *
 * Refusals:
 *   * `service-not-stopped` -- there is nothing to approve a restart of.
 *   * `restart-approval-role-already-recorded` -- that role has already spoken; a second holder of
 *     the same role does not add a second independent check.
 *   * `restart-approval-actor-already-recorded` -- this person has already approved in some role.
 *     Without this check, one person could supply all three approvals by changing role, and the
 *     interface would permit a single-person restart.
 *
 * Two approvals leave the service stopped with both approvals recorded; only the third distinct
 * role returns a running service.
 */
export function applyServiceRestartApproval(
  state: ServiceState,
  input: { role: ServiceRestartApprovalRole; actorId: ActorId },
  clock: Clock,
): TransitionResult<ServiceState> {
  if (!state.stopped) return { ok: false, reason: "service-not-stopped" };
  if (state.restartApprovals.some((approval) => approval.role === input.role)) {
    return { ok: false, reason: "restart-approval-role-already-recorded" };
  }
  if (state.restartApprovals.some((approval) => approval.actorId === input.actorId)) {
    return { ok: false, reason: "restart-approval-actor-already-recorded" };
  }

  const approvals: readonly ServiceRestartApproval[] = Object.freeze([
    ...state.restartApprovals,
    Object.freeze({ role: input.role, actorId: input.actorId, approvedAt: awstIsoTimestamp(clock.now()) }),
  ]);

  const everyRequiredRoleApproved = REQUIRED_RESTART_APPROVAL_ROLES.every((role) =>
    approvals.some((approval) => approval.role === role),
  );
  if (everyRequiredRoleApproved) return { ok: true, value: runningService(state.teamId) };

  return { ok: true, value: Object.freeze({ ...state, restartApprovals: approvals }) };
}

/**
 * The single question every dispatch path asks before sending anything. True for exactly as long
 * as the service is stopped -- there is no reason, actor, or approval count that makes a stopped
 * service dispatchable.
 */
export function serviceStopBlocksDispatch(state: ServiceState): boolean {
  return state.stopped;
}

/**
 * Banner text: why sending is stopped and how far the restart approvals have got. `null` while the
 * service is running.
 *
 * This is rendered on every screen, including ones showing no patient at all, so it carries no
 * patient information -- no name, no mobile number, no plan or patient identifier. In particular
 * it never includes the free-text `note`, which is written by a responder mid-incident and can
 * name the patient or the number involved.
 */
export function describeServiceStop(state: ServiceState): string | null {
  if (!state.stopped) return null;

  const recorded = state.restartApprovals.length;
  const total = REQUIRED_RESTART_APPROVAL_ROLES.length;
  const outstanding = REQUIRED_RESTART_APPROVAL_ROLES.filter(
    (role) => !state.restartApprovals.some((approval) => approval.role === role),
  ).map((role) => APPROVAL_ROLE_WORDING[role]);

  const stillNeeded =
    outstanding.length === 0
      ? "All approvals are in."
      : `Still needed: ${formatList(outstanding)}, each from a different person.`;

  return (
    `All caring-contact sending is stopped for the whole service because ${STOP_REASON_WORDING[state.reason]}. ` +
    `${recorded} of ${total} restart approvals recorded. ${stillNeeded}`
  );
}

function formatList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
