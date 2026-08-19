// src/lib/caring-contacts/access-audit.ts
//
// Typed access-audit events -- the read-side half of the audit trail.
//
// Contract (decision lock, 2026-08-19, spec §4.2): the audit trail must record "every search,
// view, decision, mutation, write-back and administrative access". `buildAuditEvent` (see
// audit.ts) already covers mutations and write-backs because `runWrite` calls it directly. This
// module gives the remaining kinds -- view, search, export, and administrative access -- a typed
// shape and a single constructor path, so a read can enter the same patient-data-free trail a
// write already does.
//
// `buildAccessAuditEvent` delegates to `buildAuditEvent` rather than constructing an `AuditEvent`
// itself: there must be exactly one audit-event constructor in this codebase, so a future change
// to the audit shape (a new required field, a stricter guard) cannot miss the access path by
// having its own parallel construction to forget.
//
// A denied read is still an access attempt and still belongs in the trail -- `outcome` is part of
// `AccessRecord` precisely so a caller can record "denied" rather than dropping the event.
import { buildAuditEvent, type AuditEvent, type AuditOutcome } from "./audit";
import { awstIsoTimestamp, type Clock } from "./clock";
import { idempotencyKey as makeIdempotencyKey, type ActorId, type TeamId } from "./ids";

export type AccessKind = "view" | "search" | "export" | "administrative";

export type AccessedObjectType = "plan" | "contact" | "episode" | "auditTrail" | "report" | "patientDirectory";

export type AccessRecord = {
  actorId: ActorId;
  actorRoles: readonly string[];
  teamId: TeamId;
  kind: AccessKind;
  objectType: AccessedObjectType;
  objectId: string;
  outcome: AuditOutcome;
};

/** The action-name prefix every access-audit event carries, distinguishing it from a write action. */
export const ACCESS_ACTION_PREFIX = "access" as const;

/**
 * `access:<kind>:<objectType>` -- lets a trail be filtered to reads (or to one read kind, or one
 * object type) with a string match instead of a second table or a boolean column.
 */
export function accessActionName(kind: AccessKind, objectType: AccessedObjectType): string {
  return `${ACCESS_ACTION_PREFIX}:${kind}:${objectType}`;
}

/**
 * Builds a frozen `AuditEvent` for a read/administrative access, through the same constructor a
 * write uses. `buildAuditEvent` runs the patient-data guard, so a search term or a name reaching
 * `objectId` throws `AuditEventContainsPatientDataError` before anything is written -- this
 * function does not run a second scan, so there is exactly one place the guard can drift.
 */
export function buildAccessAuditEvent(record: AccessRecord, clock: Clock): AuditEvent {
  const action = accessActionName(record.kind, record.objectType);
  const timestamp = awstIsoTimestamp(clock.now());
  const idempotencyKey = makeIdempotencyKey(
    `access:${record.actorId}:${record.objectType}:${record.objectId}:${timestamp}`,
  );

  return buildAuditEvent(
    {
      actorId: record.actorId,
      actorRoles: record.actorRoles,
      teamId: record.teamId,
      action,
      objectType: record.objectType,
      objectId: record.objectId,
      outcome: record.outcome,
      idempotencyKey,
    },
    clock,
  );
}
