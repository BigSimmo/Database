// src/lib/caring-contacts/repository.ts
//
// The storage contract every caring-contact change passes through.
//
// Contract (decision lock, 2026-08-19):
//   * every write carries an idempotency key; replaying that key returns the ORIGINAL result and
//     performs no second change, so a retried request can never send a second caring contact;
//   * every write appends exactly one audit event, atomically with the change — if the audit
//     record cannot be produced or accepted, the change does not happen either;
//   * every write states the version it expected; a write against a stale version is refused by
//     name rather than overwriting whatever another actor did in between;
//   * a patient may have only one non-terminal plan at a time;
//   * reads are scoped to the actor's team and return EMPTY for anything outside it — never a
//     refusal that would reveal a record exists.
//
// Every refusal is a named, machine-readable reason. Nothing here is thrown for an expected
// condition; a throw means the write could not be completed at all and nothing was recorded.
//
// This module is types and named constants only. Both the in-memory store (Task 9) and the
// Postgres store (Task 11) implement it, and both are exercised by the identical contract suite.
import type { AuditEvent } from "./audit";
import type { Clock } from "./clock";
import type { HospitalStatusEvent, PlanException, PlanIncident, WithdrawalOrigin } from "./hospital-events";
import type { IdempotencyKey, PathwayVersionId, PatientId, PlanId, ReferralId } from "./ids";
import type { Contact, Plan, PlanState, SendingPreference, TransitionResult } from "./model";
import type { Actor } from "./permissions";
import type { Episode, EpisodeState } from "./episode";
import type { PlannedContact } from "./schedule";

/**
 * Episode reconciliation (carried finding from Task 8).
 *
 * `Episode` and `DeidentifiedEpisode` are adopted verbatim from ./episode; this module defines no
 * competing episode shape. The division is:
 *   * `StoredPlan` is what the datastore holds — identifiers, versions, contacts, patient detail;
 *   * `Episode` is the reporting projection assembled from a `StoredPlan` on demand
 *     (`CaringContactRepository.getEpisode`), so the domain still has exactly one episode type.
 *
 * The projection maps `Plan.state` straight onto `Episode.state`. Those two unions are declared in
 * different modules, so the assertion below pins them as the same set: if a future edit adds a
 * state to one and not the other, this line stops compiling instead of the projection silently
 * narrowing an episode's state.
 */
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const EPISODE_STATE_MATCHES_PLAN_STATE: SameUnion<PlanState, EpisodeState> = true;

/** The patient-identifying half of an `Episode`, taken from that type so it cannot drift from it. */
export type EpisodePatientDetail = Pick<
  Episode,
  "patientName" | "patientMobileNumber" | "patientIdentifiers" | "culturalIdentity"
>;

/** Every mutating call is attributed to an actor and keyed for replay. */
export type WriteContext = { actor: Actor; idempotencyKey: IdempotencyKey };

/** Every read is attributed to an actor, which is what scopes it to a team. */
export type ReadContext = { actor: Actor };

/**
 * Named refusals this layer adds on top of the domain reasons it passes through unchanged
 * (`plan-not-active`, `plan-terminal`, `third-party-withdrawal-refused`, the schedule's
 * `first-contact-out-of-range`, and so on).
 *
 * `notFound` deliberately covers both "no such plan" and "that plan belongs to another team": a
 * cross-team actor must not be able to tell those two apart.
 */
export const REPOSITORY_REFUSALS = Object.freeze({
  notFound: "not-found",
  permissionDenied: "permission-denied",
  staleVersion: "stale-version",
  duplicateActivePlan: "duplicate-active-plan",
  planAlreadyExists: "plan-already-exists",
  idempotencyKeyReused: "idempotency-key-reused-for-a-different-write",
} as const);

export type RepositoryRefusal = (typeof REPOSITORY_REFUSALS)[keyof typeof REPOSITORY_REFUSALS];

/** What the episode ended as. Held separately from `Plan.state` because it outlives the plan. */
export type PlanOutcome = "inProgress" | "withdrawn" | "cancelled" | "completed";

/**
 * A stored contact keeps its planned entry verbatim, including the real `sendAt` of an absorbed
 * entry. Sendability is carried by `contact.state`, which is set to the terminal `suppressed` at
 * creation for an absorbed entry — so an absorbed contact is not merely filtered out of a dispatch
 * list, it can never be in one.
 */
export type StoredContact = { contact: Contact; planned: PlannedContact };

/** What a read returns. Deliberately carries no patient-identifying detail — see `getEpisode`. */
export type PlanRecord = {
  plan: Plan;
  patientId: PatientId;
  referralId: ReferralId;
  pathwayVersionId: PathwayVersionId;
  dischargeAt: Date;
  /** The instant the plan reached a terminal state; null while it is still open. */
  completedAt: Date | null;
  outcome: PlanOutcome;
  contacts: readonly StoredContact[];
};

/** What the datastore holds. The patient detail is released only through `getEpisode`. */
export type StoredPlan = PlanRecord & { patientDetail: EpisodePatientDetail };

export type CreatePlanInput = {
  planId: PlanId;
  referralId: ReferralId;
  patientId: PatientId;
  pathwayVersionId: PathwayVersionId;
  dischargeAt: Date;
  sendingPreference: SendingPreference;
  firstContactDate?: string;
  firstContactReason?: string;
  patientDetail: EpisodePatientDetail;
};

export type PlanLifecycleInput = { planId: PlanId; expectedVersion: number };
export type WithdrawPlanInput = PlanLifecycleInput & { origin: WithdrawalOrigin };
export type HospitalStatusInput = PlanLifecycleInput & { event: HospitalStatusEvent };

export type HospitalStatusOutcome = {
  record: PlanRecord;
  exceptions: readonly PlanException[];
  incident?: PlanIncident;
  /** How many stored contacts this event cancelled outright. */
  contactsCancelled: number;
};

/**
 * An additional append-only destination for audit events — an external trail, for instance. It is
 * called inside the write, before anything is committed: if it throws, the change is abandoned,
 * because a change nobody can prove happened is worse than a change refused.
 */
export type AuditSink = { record(event: AuditEvent): void | Promise<void> };

export type RepositoryOptions = { auditSink?: AuditSink };

export interface CaringContactRepository {
  createPlan(input: CreatePlanInput, context: WriteContext): Promise<TransitionResult<PlanRecord>>;
  activatePlan(input: PlanLifecycleInput, context: WriteContext): Promise<TransitionResult<PlanRecord>>;
  pausePlan(input: PlanLifecycleInput, context: WriteContext): Promise<TransitionResult<PlanRecord>>;
  resumePlan(input: PlanLifecycleInput, context: WriteContext): Promise<TransitionResult<PlanRecord>>;
  withdrawPlan(input: WithdrawPlanInput, context: WriteContext): Promise<TransitionResult<PlanRecord>>;
  recordHospitalStatusEvent(
    input: HospitalStatusInput,
    context: WriteContext,
  ): Promise<TransitionResult<HospitalStatusOutcome>>;

  /** Null for a plan that does not exist AND for one belonging to another team. */
  getPlan(planId: PlanId, context: ReadContext): Promise<PlanRecord | null>;
  listPlans(context: ReadContext): Promise<PlanRecord[]>;
  listContacts(planId: PlanId, context: ReadContext): Promise<StoredContact[]>;
  /** The contacts that may actually go out. Keyed off contact state, never off `sendAt`. */
  listSendableContacts(planId: PlanId, context: ReadContext): Promise<StoredContact[]>;
  listAuditEvents(context: ReadContext): Promise<AuditEvent[]>;
  getEpisode(planId: PlanId, context: ReadContext): Promise<Episode | null>;
}

/**
 * Every store in this domain is built this way, so one contract suite can run against all of them.
 * Task 11's Postgres store returns a promise here; the in-memory store returns directly.
 */
export type CaringContactRepositoryFactory = (
  clock: Clock,
  options?: RepositoryOptions,
) => CaringContactRepository | Promise<CaringContactRepository>;

/** Deterministic contact identifier, so the same plan always produces the same contact ids. */
export function contactIdentifierFor(planId: PlanId, sequence: number): string {
  return `${planId}--contact-${sequence}`;
}
