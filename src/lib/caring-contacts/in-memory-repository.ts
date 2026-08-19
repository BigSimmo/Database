// src/lib/caring-contacts/in-memory-repository.ts
//
// The in-memory caring-contact store. It is the reference implementation of the contract in
// ./repository.ts, and it is deliberately written so the Postgres store (Task 11) can satisfy the
// identical suite: every guarantee here maps onto one Postgres already has.
//
//   idempotency  -> a unique (team, key) row holding the original result, read inside the same
//                   transaction, so a replay returns the first answer and writes nothing;
//   atomic audit -> the change and its audit row are written in one transaction; if the audit
//                   record cannot be produced or accepted, the transaction never commits;
//   concurrency  -> `UPDATE ... WHERE version = $expected`, which is what the serialised write
//                   queue below reproduces in a single process;
//   team scope   -> a team predicate on every read, matching row-level security.
//
// Composition only: the plan and contact lifecycles live in ./model, hospital events in
// ./hospital-events, the calendar in ./schedule, capability checks in ./permissions, the audit
// record in ./audit, and the episode projection uses ./episode's own `Episode` type. Nothing here
// reimplements any of them.
import { buildAccessAuditEvent, type AccessRecord } from "./access-audit";
import { applyAssignmentAction, unassigned, type AssignmentAction, type PlanAssignment } from "./assignment";
import { buildAuditEvent, type AuditEvent, type AuditOutcome } from "./audit";
import type { Clock } from "./clock";
import { changeContactDate, moveContactWithinDay } from "./contact-rescheduling";
import { fingerprintOf } from "./fingerprint";
import { applyHospitalStatusEvent, applyWithdrawalRequest, sendableContacts } from "./hospital-events";
import { contactId, teamId } from "./ids";
import type { ActorId, ContactId, PathwayVersionId, PlanId, TeamId } from "./ids";
import { applyContactTransition, applyPlanTransition } from "./model";
import type { Contact, ContactAction, ContactState, Plan, PlanState, Referral, TransitionResult } from "./model";
import { defaultNotificationPreferences, type NotificationPreferences } from "./notification-preferences";
import { applyPathwayVersionTransition, type PathwayVersion } from "./pathway-versions";
import {
  actorRoleNames,
  canPerformCaringContactAction,
  type CaringContactAction,
  type CaringContactActor,
} from "./permissions";
import { applyReferralTransition } from "./referrals";
import {
  applyServiceRestartApproval,
  applyServiceStop,
  runningService,
  serviceStopBlocksDispatch,
  type ServiceRestartApprovalRole,
  type ServiceState,
  type ServiceStopReason,
} from "./service-state";
import { emptyTrainingRecord, recordCompetency, type TrainingCompetency, type TrainingRecord } from "./training";
import {
  REPOSITORY_REFUSALS,
  contactIdentifierFor,
  type AccessTrailQuery,
  type CaringContactRepository,
  type ContactProviderStatusInput,
  type ContactStatusInput,
  type CreatePlanInput,
  type CreateReferralInput,
  type DispatchRecord,
  type HospitalStatusInput,
  type HospitalStatusOutcome,
  type PathwayVersionTransitionInput,
  type PlanLifecycleInput,
  type PlanOutcome,
  type PlanRecord,
  type ReadContext,
  type ReferralTransitionInput,
  type RepositoryOptions,
  type ResolveDiscrepancyInput,
  type SavePathwayVersionInput,
  type StoredContact,
  type StoredPlan,
  type WithdrawPlanInput,
  type WriteContext,
} from "./repository";
import type { Episode } from "./episode";
import { buildApprovedSchedule, type PlannedContact } from "./schedule";

const TERMINAL_PLAN_STATES: readonly PlanState[] = ["withdrawn", "cancelled", "completed"];

/**
 * Names no real team. Seeds the running-service singleton before any stop has ever been raised,
 * so `reportedByTeamId` never accidentally reads as a genuine team's identifier before one exists.
 */
const SERVICE_STATE_UNSET_TEAM: TeamId = teamId("service-state-unset");

/** Contact states that mean the message already left. Used only for reporting counts. */
const DISPATCHED_CONTACT_STATES: readonly ContactState[] = [
  "sent",
  "delivered",
  "notDelivered",
  "numberInvalid",
  "contactChanged",
  "statusUnavailable",
];

/**
 * Reads an actor may make. Kept as a map rather than inline so every read surface has to name the
 * capability it requires, and a new read cannot default to visible.
 */
const READ_ACTIONS = Object.freeze({
  plan: "viewReferral",
  contacts: "viewReferral",
  auditTrail: "viewAccessTrail",
  episode: "generateClinicalRecordSummary",
  referral: "viewReferral",
} as const satisfies Record<string, CaringContactAction>);

/** Either governance action reading a pathway version's content is granted by. */
const PATHWAY_VERSION_READ_ACTIONS: readonly CaringContactAction[] = Object.freeze([
  "authorPathwayVersion",
  "approvePathwayVersion",
]);

type StagedWrite<T> = {
  value: T;
  /**
   * Applies the write's side effect to the store's maps. Synchronous and called exactly once,
   * inside the same unbroken commit block as the audit-event push -- see `runWrite`. Absent for a
   * write that changes nothing storage-side (there is currently none, but the type does not
   * require one).
   */
  commit?: () => void;
};

type WriteSpec<T> = {
  /** Part of the idempotency fingerprint, so one key cannot cover two different operations. */
  method: string;
  input: unknown;
  context: WriteContext;
  auditAction: string;
  objectId: string;
  /** What the audit event says was acted on. Defaults to the plan. */
  objectType?: string;
  /**
   * True only for `stopService`, `approveServiceRestart`, and `recordHospitalStatusEvent` -- the
   * three writes that must always be reachable regardless of the service-wide safety stop. Every
   * other write is gated inside `runWrite` itself, so a future method cannot forget the gate by
   * simply not checking for it.
   */
  bypassServiceStopGate?: boolean;
  stage: () => TransitionResult<StagedWrite<T>>;
};

function clonePlanned(planned: PlannedContact): PlannedContact {
  const copy: PlannedContact = {
    sequence: planned.sequence,
    cadenceLabel: planned.cadenceLabel,
    calendarDay: planned.calendarDay,
    sendAt: new Date(planned.sendAt.getTime()),
    messageType: planned.messageType,
  };
  if (planned.suppressed) copy.suppressed = { reason: planned.suppressed.reason };
  return copy;
}

function cloneStoredContact(stored: StoredContact): StoredContact {
  return { contact: { ...stored.contact }, planned: clonePlanned(stored.planned) };
}

/** Strips the patient detail: a plan read must not carry it. Only `getEpisode` releases that. */
function toPlanRecord(stored: StoredPlan): PlanRecord {
  return {
    plan: { ...stored.plan },
    patientId: stored.patientId,
    referralId: stored.referralId,
    pathwayVersionId: stored.pathwayVersionId,
    dischargeAt: new Date(stored.dischargeAt.getTime()),
    completedAt: stored.completedAt === null ? null : new Date(stored.completedAt.getTime()),
    outcome: stored.outcome,
    contacts: stored.contacts.map(cloneStoredContact),
  };
}

function isTerminalPlan(state: PlanState): boolean {
  return TERMINAL_PLAN_STATES.includes(state);
}

/** Storage key for one contact's one dispatch attempt. */
function dispatchKey(id: ContactId, attempt: number): string {
  return `${id}::${attempt}`;
}

/** Storage key for a per-actor, per-team record (notification preferences, training). */
function actorScopeKey(teamId: TeamId, actorId: ActorId): string {
  return `${teamId}::${actorId}`;
}

function outcomeFor(state: PlanState): PlanOutcome {
  return state === "withdrawn" || state === "cancelled" || state === "completed" ? state : "inProgress";
}

/**
 * Cancels every contact the contact lifecycle still accepts a cancellation for — that is, every
 * non-terminal one. There is deliberately no comparison of `sendAt` to now and no filter on how
 * soon a contact was due: on a recorded death, a filter is exactly the defect that would let a
 * message reach someone afterwards.
 */
function cancelAllNonTerminalContacts(contacts: readonly StoredContact[]): {
  contacts: StoredContact[];
  cancelled: number;
} {
  let cancelled = 0;
  const next = contacts.map((stored) => {
    const transition = applyContactTransition(stored.contact, { type: "cancel" });
    if (!transition.ok) return stored;
    cancelled += 1;
    return { contact: transition.value, planned: stored.planned };
  });
  return { contacts: next, cancelled };
}

export function createInMemoryRepository(clock: Clock, options: RepositoryOptions = {}): CaringContactRepository {
  const plans = new Map<string, StoredPlan>();
  const auditEvents: AuditEvent[] = [];
  const idempotency = new Map<string, { fingerprint: string; result: TransitionResult<unknown> }>();

  // Group 1 storage. Each is its own map/singleton -- Task 10 adds a home for every rule Tasks
  // 1-9 built, and delegates every transition to the module that owns the rule; nothing here
  // re-derives a decision one of those modules already makes.
  const referrals = new Map<string, Referral>();
  const pathwayVersions = new Map<string, PathwayVersion>();
  const assignments = new Map<string, PlanAssignment>();
  const dispatches = new Map<string, DispatchRecord>();
  /** Latest dispatch attempt number recorded for a contact, so the next one can be numbered. */
  const dispatchAttempts = new Map<string, number>();
  const notificationPreferences = new Map<string, NotificationPreferences>();
  const trainingRecords = new Map<string, TrainingRecord>();
  const retentionCleared = new Set<string>();

  /**
   * The one service-wide safety-stop record (Ruling 3: never one per team). `reportedByTeamId` on
   * the running state is bookkeeping only -- overwritten with the reporting team the moment a stop
   * is actually raised -- and is seeded with a value that names no real team so an unstopped store
   * cannot be mistaken for one that has ever recorded an incident.
   */
  let serviceState: ServiceState = runningService(SERVICE_STATE_UNSET_TEAM);

  // Serialises writes so two calls issued at once cannot interleave between reading a version and
  // committing the next one. This is what `UPDATE ... WHERE version = $expected` gives the
  // Postgres store; without it, "simultaneous" here would be a false green.
  let queue: Promise<unknown> = Promise.resolve();
  function serialise<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work, work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function mayRead(actor: CaringContactActor, action: CaringContactAction, resourceTeamId: TeamId): boolean {
    return canPerformCaringContactAction(actor, action, { teamId: resourceTeamId }).allowed;
  }

  /** True if the actor holds ANY of the given read capabilities for the resource's team. */
  function mayReadAny(actor: CaringContactActor, actions: readonly CaringContactAction[], resourceTeamId: TeamId): boolean {
    return actions.some((action) => mayRead(actor, action, resourceTeamId));
  }

  /** Null for absent AND for another team's plan — a read must not tell those apart. */
  function visiblePlan(planId: PlanId, context: ReadContext, action: CaringContactAction): StoredPlan | null {
    const stored = plans.get(planId);
    if (!stored) return null;
    if (!mayRead(context.actor, action, stored.plan.teamId)) return null;
    return stored;
  }

  /**
   * The one path every write takes. Order is the guarantee: the change is fully computed, then the
   * audit event is built and offered to the sink, and only then is anything committed. A throw at
   * any point before the commit block leaves the store byte-identical and does not consume the
   * idempotency key, so the caller may retry.
   */
  async function runWrite<T>(spec: WriteSpec<T>): Promise<TransitionResult<T>> {
    return serialise(async () => {
      const { actor, idempotencyKey } = spec.context;
      // Keys are scoped per team, so one team can never replay another team's result.
      const scope = `${actor.teamId}::${idempotencyKey}`;
      const fingerprint = fingerprintOf({ method: spec.method, input: spec.input });
      const previous = idempotency.get(scope);

      // A true replay returns the original answer and appends nothing at all.
      if (previous && previous.fingerprint === fingerprint) return previous.result as TransitionResult<T>;

      // The service-wide safety-stop gate. Lives here, not in each method, so a future write
      // cannot forget it by simply not checking `serviceStopBlocksDispatch` itself. Checked after
      // the replay short-circuit (a replay reports the ORIGINAL decision, not today's), and before
      // `spec.stage()` so a refused write still produces exactly one "denied" audit event through
      // the same path every other refusal does.
      const blockedByServiceStop = !spec.bypassServiceStopGate && !previous && serviceStopBlocksDispatch(serviceState);

      const staged: TransitionResult<StagedWrite<T>> = previous
        ? { ok: false, reason: REPOSITORY_REFUSALS.idempotencyKeyReused }
        : blockedByServiceStop
          ? { ok: false, reason: REPOSITORY_REFUSALS.serviceStopped }
          : spec.stage();

      const outcome: AuditOutcome = staged.ok ? "allowed" : "denied";
      const event = buildAuditEvent(
        {
          actorId: actor.id,
          actorRoles: actorRoleNames(actor),
          teamId: actor.teamId,
          action: spec.auditAction,
          objectType: spec.objectType ?? "plan",
          objectId: spec.objectId,
          outcome,
          idempotencyKey,
        },
        clock,
      );
      await options.auditSink?.record(event);

      // Commit. Synchronous and unbroken: nothing may await between these statements, or a
      // change could become visible without its audit record.
      if (staged.ok) staged.value.commit?.();
      auditEvents.push(event);
      const result: TransitionResult<T> = staged.ok ? { ok: true, value: staged.value.value } : staged;
      // A key reused for a different request must not overwrite the original write's result.
      if (!previous) idempotency.set(scope, { fingerprint, result });
      return result;
    });
  }

  /**
   * Resolves an existing plan for a write: team scope first, then capability, then version.
   * `actions` is a list because one write may be reachable by more than one capability -- a
   * recorded death is the case, and it is a safety property rather than a convenience.
   */
  function resolveForWrite(
    input: PlanLifecycleInput,
    actor: CaringContactActor,
    actions: readonly CaringContactAction[],
  ): TransitionResult<StoredPlan> {
    const stored = plans.get(input.planId);
    if (!stored || stored.plan.teamId !== actor.teamId) {
      return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
    }
    const permitted = actions.some(
      (action) => canPerformCaringContactAction(actor, action, { teamId: stored.plan.teamId }).allowed,
    );
    if (!permitted) {
      return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
    }
    if (stored.plan.version !== input.expectedVersion) {
      return { ok: false, reason: REPOSITORY_REFUSALS.staleVersion };
    }
    return { ok: true, value: stored };
  }

  /** Applies a plan transition and carries the terminal bookkeeping the episode projection needs. */
  function withPlan(stored: StoredPlan, plan: Plan, contacts?: StoredContact[]): StoredPlan {
    const reachedTerminal = isTerminalPlan(plan.state) && !isTerminalPlan(stored.plan.state);
    return {
      ...stored,
      plan,
      contacts: contacts ?? stored.contacts,
      completedAt: reachedTerminal ? clock.now() : stored.completedAt,
      outcome: outcomeFor(plan.state),
    };
  }

  /** Resolves one stored contact for a write: team scope, capability, then the contact's version. */
  function resolveContactForWrite(
    input: ContactStatusInput,
    actor: CaringContactActor,
    action: CaringContactAction,
  ): TransitionResult<{ stored: StoredPlan; index: number }> {
    const stored = plans.get(input.planId);
    if (!stored || stored.plan.teamId !== actor.teamId) {
      return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
    }
    if (!canPerformCaringContactAction(actor, action, { teamId: stored.plan.teamId }).allowed) {
      return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
    }
    const index = stored.contacts.findIndex((entry) => entry.contact.id === input.contactId);
    if (index < 0) return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
    if (stored.contacts[index].contact.version !== input.expectedContactVersion) {
      return { ok: false, reason: REPOSITORY_REFUSALS.staleVersion };
    }
    return { ok: true, value: { stored, index } };
  }

  /**
   * The one path every contact-status write takes. `requiresActivePlan` is true only for the write
   * that BEGINS a dispatch: a plan change that lands while a contact is already `processing` must
   * let that one contact finish, because the contact lifecycle has no exit from `processing` other
   * than sending, and a contact stranded there would be neither sent nor accounted for.
   */
  function contactStatusWrite(
    method: string,
    permission: CaringContactAction,
    input: ContactStatusInput,
    action: ContactAction,
    context: WriteContext,
    requiresActivePlan: boolean,
    /** Extra side effect committed alongside the plan write -- reconciliation bookkeeping only. */
    onCommitted?: (updated: StoredContact) => void,
  ): Promise<TransitionResult<StoredContact>> {
    return runWrite<StoredContact>({
      method,
      input,
      context,
      auditAction: method,
      objectType: "contact",
      objectId: input.contactId,
      stage: () => {
        const resolved = resolveContactForWrite(input, context.actor, permission);
        if (!resolved.ok) return resolved;
        const { stored, index } = resolved.value;

        if (requiresActivePlan && stored.plan.state !== "active") {
          return { ok: false, reason: REPOSITORY_REFUSALS.contactDispatchRequiresActivePlan };
        }

        const moved = applyContactTransition(stored.contacts[index].contact, action);
        if (!moved.ok) return moved;

        const contacts = [...stored.contacts];
        contacts[index] = { contact: moved.value, planned: contacts[index].planned };
        const nextPlan: StoredPlan = { ...stored, contacts };
        const updated = contacts[index];
        return {
          ok: true,
          value: {
            value: cloneStoredContact(updated),
            commit: () => {
              plans.set(nextPlan.plan.id, nextPlan);
              onCommitted?.(updated);
            },
          },
        };
      },
    });
  }

  function lifecycleWrite(
    method: string,
    action: CaringContactAction,
    transition: "activate" | "pause" | "resume",
    input: PlanLifecycleInput,
    context: WriteContext,
  ): Promise<TransitionResult<PlanRecord>> {
    return runWrite<PlanRecord>({
      method,
      input,
      context,
      auditAction: method,
      objectId: input.planId,
      stage: () => {
        const resolved = resolveForWrite(input, context.actor, [action]);
        if (!resolved.ok) return resolved;
        const moved = applyPlanTransition(resolved.value.plan, { type: transition });
        if (!moved.ok) return moved;
        const nextPlan = withPlan(resolved.value, moved.value);
        return { ok: true, value: { value: toPlanRecord(nextPlan), commit: () => plans.set(nextPlan.plan.id, nextPlan) } };
      },
    });
  }

  return {
    async createPlan(input: CreatePlanInput, context: WriteContext) {
      return runWrite<PlanRecord>({
        method: "createPlan",
        input,
        context,
        auditAction: "createPlan",
        objectId: input.planId,
        stage: () => {
          const { actor } = context;
          if (!canPerformCaringContactAction(actor, "claimPlan", { teamId: actor.teamId }).allowed) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          if (plans.has(input.planId)) return { ok: false, reason: REPOSITORY_REFUSALS.planAlreadyExists };

          // Checked across every team, not just this one. Two teams each running a plan for one
          // person is the same duplicate-message hazard as one team doing it twice, and it is the
          // hazard this rule exists for. The refusal names nothing but the caller's own input.
          const open = [...plans.values()].some(
            (stored: StoredPlan) => stored.patientId === input.patientId && !isTerminalPlan(stored.plan.state),
          );
          if (open) return { ok: false, reason: REPOSITORY_REFUSALS.duplicateActivePlan };

          const schedule = buildApprovedSchedule({
            dischargeAt: input.dischargeAt,
            sendingPreference: input.sendingPreference,
            firstContactDate: input.firstContactDate,
            firstContactReason: input.firstContactReason,
          });
          if (!schedule.ok) return schedule;

          // Sendability comes from `sendableContacts`, never from `sendAt`: an absorbed entry
          // carries a real send instant and would otherwise go out as a second message that day.
          // Storing it in the terminal `suppressed` state means it cannot be dispatched at all.
          const sendable = new Set(sendableContacts(schedule.contacts).map((planned) => planned.sequence));
          const contacts: StoredContact[] = schedule.contacts.map((planned) => ({
            contact: {
              id: contactId(contactIdentifierFor(input.planId, planned.sequence)),
              planId: input.planId,
              state: sendable.has(planned.sequence) ? ("scheduled" as ContactState) : ("suppressed" as ContactState),
              version: 1,
            } satisfies Contact,
            planned: clonePlanned(planned),
          }));

          const nextPlan: StoredPlan = {
            plan: { id: input.planId, teamId: actor.teamId, state: "draft", version: 1 },
            patientId: input.patientId,
            referralId: input.referralId,
            pathwayVersionId: input.pathwayVersionId,
            dischargeAt: new Date(input.dischargeAt.getTime()),
            completedAt: null,
            outcome: "inProgress",
            contacts,
            patientDetail: {
              patientName: input.patientDetail.patientName,
              patientMobileNumber: input.patientDetail.patientMobileNumber,
              patientIdentifiers: [...input.patientDetail.patientIdentifiers],
              culturalIdentity: input.patientDetail.culturalIdentity,
            },
          };
          return { ok: true, value: { value: toPlanRecord(nextPlan), commit: () => plans.set(nextPlan.plan.id, nextPlan) } };
        },
      });
    },

    async activatePlan(input, context) {
      return lifecycleWrite("activatePlan", "activatePlan", "activate", input, context);
    },

    async pausePlan(input, context) {
      return lifecycleWrite("pausePlan", "pausePlan", "pause", input, context);
    },

    async resumePlan(input, context) {
      return lifecycleWrite("resumePlan", "resumePlan", "resume", input, context);
    },

    async withdrawPlan(input: WithdrawPlanInput, context: WriteContext) {
      return runWrite<PlanRecord>({
        method: "withdrawPlan",
        input,
        context,
        auditAction: "withdrawPlan",
        objectId: input.planId,
        stage: () => {
          const resolved = resolveForWrite(input, context.actor, ["withdrawPlan"]);
          if (!resolved.ok) return resolved;
          // The third-party refusal lives in ./hospital-events and is not restated here.
          const withdrawal = applyWithdrawalRequest(resolved.value.plan, { origin: input.origin });
          if (!withdrawal.ok) return withdrawal;
          const cancelled = cancelAllNonTerminalContacts(resolved.value.contacts);
          const nextPlan = withPlan(resolved.value, withdrawal.value.plan, cancelled.contacts);
          return { ok: true, value: { value: toPlanRecord(nextPlan), commit: () => plans.set(nextPlan.plan.id, nextPlan) } };
        },
      });
    },

    async recordHospitalStatusEvent(input: HospitalStatusInput, context: WriteContext) {
      // Every hospital status event is a recordHospitalStatusEvent: a recorded death is a death in
      // the trail, not a service safety stop, and it was only ever routed through the stop because
      // no action covered hospital events at all.
      //
      // A death and its correction additionally accept triggerServiceSafetyStop, the one capability
      // every role holds. That is not a convenience: recording a death must never be blocked by a
      // permission check, and a refusal here would leave a plan sending to someone who has died.
      const actions: readonly CaringContactAction[] =
        input.event.type === "death" || input.event.type === "deathCorrection"
          ? ["recordHospitalStatusEvent", "triggerServiceSafetyStop"]
          : ["recordHospitalStatusEvent"];

      return runWrite<HospitalStatusOutcome>({
        method: "recordHospitalStatusEvent",
        input,
        context,
        auditAction: `recordHospitalStatusEvent:${input.event.type}`,
        objectId: input.planId,
        // A death must always be recordable -- the same reasoning as the always-available
        // triggerServiceSafetyStop capability above. A refusal here would leave a plan sending to
        // someone who has died.
        bypassServiceStopGate: true,
        stage: () => {
          const resolved = resolveForWrite(input, context.actor, actions);
          if (!resolved.ok) return resolved;

          const applied = applyHospitalStatusEvent(resolved.value.plan, input.event);
          if (!applied.ok) return applied;

          const { contactOutcome } = applied.value;
          const stopsEverything = contactOutcome.type === "cancelUnsent" || contactOutcome.type === "stopAll";
          const { contacts, cancelled } = stopsEverything
            ? cancelAllNonTerminalContacts(resolved.value.contacts)
            : { contacts: [...resolved.value.contacts], cancelled: 0 };

          const nextPlan = withPlan(resolved.value, applied.value.plan, contacts);
          const value: HospitalStatusOutcome = {
            record: toPlanRecord(nextPlan),
            exceptions: applied.value.exceptions,
            contactsCancelled: cancelled,
          };
          if (applied.value.incident) value.incident = applied.value.incident;
          return { ok: true, value: { value, commit: () => plans.set(nextPlan.plan.id, nextPlan) } };
        },
      });
    },

    async startContactDispatch(input: ContactStatusInput, context: WriteContext) {
      return contactStatusWrite(
        "startContactDispatch",
        "startContactDispatch",
        input,
        { type: "startProcessing" },
        context,
        true,
        // Opens the reconciliation record this attempt will be resolved against. Numbered from
        // the last attempt recorded for this contact, so a later manual re-dispatch (if the
        // contact lifecycle ever grows one) would not collide with an earlier attempt's record.
        (updated) => {
          const nextAttempt = (dispatchAttempts.get(updated.contact.id) ?? 0) + 1;
          dispatchAttempts.set(updated.contact.id, nextAttempt);
          dispatches.set(dispatchKey(updated.contact.id, nextAttempt), {
            contactId: updated.contact.id,
            planId: input.planId,
            attempt: nextAttempt,
            startedAt: clock.now(),
            expectedStatus: null,
            reportedStatus: null,
            discrepancyResolvedAt: null,
            discrepancyResolution: null,
          });
        },
      );
    },

    async recordContactSent(input: ContactStatusInput, context: WriteContext) {
      return contactStatusWrite("recordContactSent", "recordContactSent", input, { type: "markSent" }, context, false);
    },

    async recordContactProviderStatus(input: ContactProviderStatusInput, context: WriteContext) {
      return contactStatusWrite(
        "recordContactProviderStatus",
        "recordContactProviderStatus",
        input,
        { type: "providerStatus", status: input.status },
        context,
        false,
        // Records what the provider actually reported against the open attempt, the half of the
        // reconciliation pair `resolveDispatchDiscrepancy` compares against.
        (updated) => {
          const attempt = dispatchAttempts.get(updated.contact.id);
          if (attempt === undefined) return;
          const key = dispatchKey(updated.contact.id, attempt);
          const record = dispatches.get(key);
          if (record) dispatches.set(key, { ...record, reportedStatus: input.status });
        },
      );
    },

    async recordContactMissed(input: ContactStatusInput, context: WriteContext) {
      // Not gated on an active plan: a window that closed while the plan was paused still has to be
      // recorded as missed, and recording it sends nothing.
      return contactStatusWrite(
        "recordContactMissed",
        "recordContactMissed",
        input,
        { type: "markMissed" },
        context,
        false,
      );
    },

    async rescheduleContact(input, context: WriteContext) {
      const permission: CaringContactAction = "toHour" in input.change ? "moveContactWithinDay" : "changeContactDate";
      return runWrite<StoredContact>({
        method: "rescheduleContact",
        input,
        context,
        auditAction: "rescheduleContact",
        objectType: "contact",
        objectId: input.contactId,
        stage: () => {
          const resolved = resolveContactForWrite(
            { planId: input.planId, contactId: input.contactId, expectedContactVersion: input.expectedContactVersion },
            context.actor,
            permission,
          );
          if (!resolved.ok) return resolved;
          const { stored, index } = resolved.value;
          const currentPlanned = stored.contacts[index].planned;

          // The stored `planned` is the source of truth, never the caller's copy: a request built
          // from a stale or fabricated PlannedContact must not be able to smuggle a different
          // calendarDay/sendAt past the two rules below.
          const moved =
            "toHour" in input.change
              ? moveContactWithinDay({ contact: currentPlanned, toHour: input.change.toHour, toMinute: input.change.toMinute })
              : changeContactDate(
                  {
                    contact: currentPlanned,
                    toCalendarDay: input.change.toCalendarDay,
                    reason: input.change.reason,
                    teamLeadApprovalActorId: input.change.teamLeadApprovalActorId,
                  },
                  clock,
                );
          if (!moved.ok) return moved;

          const contacts = [...stored.contacts];
          // Only `planned` changes; `contact.state` is untouched. The version still advances, so a
          // second, concurrent reschedule of the same contact is refused as stale, the same
          // optimistic-concurrency guarantee every other contact write gives.
          const updatedContact: Contact = { ...contacts[index].contact, version: contacts[index].contact.version + 1 };
          contacts[index] = { contact: updatedContact, planned: moved.value };
          const nextPlan: StoredPlan = { ...stored, contacts };
          return {
            ok: true,
            value: { value: cloneStoredContact(contacts[index]), commit: () => plans.set(nextPlan.plan.id, nextPlan) },
          };
        },
      });
    },

    // ---------------------------------------------------------------------
    // Referrals
    // ---------------------------------------------------------------------

    async createReferral(input: CreateReferralInput, context: WriteContext) {
      return runWrite<Referral>({
        method: "createReferral",
        input,
        context,
        auditAction: "createReferral",
        objectType: "referral",
        objectId: input.referralId,
        stage: () => {
          if (!canPerformCaringContactAction(context.actor, "createReferral", { teamId: context.actor.teamId }).allowed) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          if (referrals.has(input.referralId)) {
            return { ok: false, reason: REPOSITORY_REFUSALS.referralAlreadyExists };
          }
          const referral: Referral = {
            id: input.referralId,
            teamId: context.actor.teamId,
            patientId: input.patientId,
            state: "awaitingHandover",
            pathwayVersionId: null,
          };
          return { ok: true, value: { value: { ...referral }, commit: () => referrals.set(input.referralId, referral) } };
        },
      });
    },

    async transitionReferral(input: ReferralTransitionInput, context: WriteContext) {
      const permission: CaringContactAction =
        input.action.type === "accept"
          ? "acceptReferral"
          : input.action.type === "returnForClarification"
            ? "returnReferralForClarification"
            : "declineReferral";
      return runWrite<Referral>({
        method: "transitionReferral",
        input,
        context,
        auditAction: "transitionReferral",
        objectType: "referral",
        objectId: input.referralId,
        stage: () => {
          const stored = referrals.get(input.referralId);
          if (!stored || stored.teamId !== context.actor.teamId) {
            return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
          }
          if (!canPerformCaringContactAction(context.actor, permission, { teamId: stored.teamId }).allowed) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          const transitioned = applyReferralTransition(stored, input.action);
          if (!transitioned.ok) return transitioned;
          return {
            ok: true,
            value: { value: { ...transitioned.value }, commit: () => referrals.set(input.referralId, transitioned.value) },
          };
        },
      });
    },

    async listReferrals(context: ReadContext) {
      return [...referrals.values()]
        .filter((referral) => mayRead(context.actor, READ_ACTIONS.referral, referral.teamId))
        .map((referral) => ({ ...referral }));
    },

    // ---------------------------------------------------------------------
    // Pathway versions
    // ---------------------------------------------------------------------

    async savePathwayVersion(input: SavePathwayVersionInput, context: WriteContext) {
      return runWrite<PathwayVersion>({
        method: "savePathwayVersion",
        input,
        context,
        auditAction: "savePathwayVersion",
        objectType: "pathwayVersion",
        objectId: input.version.id,
        stage: () => {
          if (
            !canPerformCaringContactAction(context.actor, "authorPathwayVersion", { teamId: context.actor.teamId }).allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          if (pathwayVersions.has(input.version.id)) {
            return { ok: false, reason: REPOSITORY_REFUSALS.pathwayVersionAlreadyExists };
          }
          // The author's own team owns the version, regardless of whatever teamId the caller's
          // object carries -- the same trust boundary createPlan draws around `actor.teamId`.
          const version: PathwayVersion = { ...input.version, teamId: context.actor.teamId };
          return {
            ok: true,
            value: { value: { ...version }, commit: () => pathwayVersions.set(version.id, version) },
          };
        },
      });
    },

    async transitionPathwayVersion(input: PathwayVersionTransitionInput, context: WriteContext) {
      const permission: CaringContactAction =
        input.action.type === "submitForReview"
          ? "authorPathwayVersion"
          : input.action.type === "approve"
            ? "approvePathwayVersion"
            : input.action.type === "publish"
              ? "publishPathwayVersion"
              : "retirePathwayVersion";
      return runWrite<PathwayVersion>({
        method: "transitionPathwayVersion",
        input,
        context,
        auditAction: "transitionPathwayVersion",
        objectType: "pathwayVersion",
        objectId: input.pathwayVersionId,
        stage: () => {
          const stored = pathwayVersions.get(input.pathwayVersionId);
          if (!stored || stored.teamId !== context.actor.teamId) {
            return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
          }
          if (!canPerformCaringContactAction(context.actor, permission, { teamId: stored.teamId }).allowed) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          const transitioned = applyPathwayVersionTransition(stored, input.action, clock);
          if (!transitioned.ok) return transitioned;
          return {
            ok: true,
            value: {
              value: { ...transitioned.value },
              commit: () => pathwayVersions.set(input.pathwayVersionId, transitioned.value),
            },
          };
        },
      });
    },

    async getPathwayVersion(id: PathwayVersionId, context: ReadContext) {
      const stored = pathwayVersions.get(id);
      if (!stored) return null;
      if (!mayReadAny(context.actor, PATHWAY_VERSION_READ_ACTIONS, stored.teamId)) return null;
      return { ...stored };
    },

    async listPathwayVersions(context: ReadContext) {
      return [...pathwayVersions.values()]
        .filter((version) => mayReadAny(context.actor, PATHWAY_VERSION_READ_ACTIONS, version.teamId))
        .map((version) => ({ ...version }));
    },

    // ---------------------------------------------------------------------
    // Service state — one record for the whole store, never one per team (Ruling 3).
    // ---------------------------------------------------------------------

    async getServiceState() {
      return serviceState;
    },

    async stopService(input: { reason: ServiceStopReason; note: string }, context: WriteContext) {
      return runWrite<ServiceState>({
        method: "stopService",
        input,
        context,
        auditAction: "stopService",
        objectType: "serviceState",
        objectId: "service",
        bypassServiceStopGate: true,
        stage: () => {
          if (
            !canPerformCaringContactAction(context.actor, "triggerServiceSafetyStop", { teamId: context.actor.teamId })
              .allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          // The reporting team is stamped onto the pre-stop snapshot here, not inside
          // applyServiceStop -- that function only ever carries `reportedByTeamId` forward, it
          // never learns of one. It never scopes the stop: every team is blocked regardless.
          const seeded: ServiceState = { ...serviceState, reportedByTeamId: context.actor.teamId };
          const applied = applyServiceStop(seeded, { reason: input.reason, actorId: context.actor.id, note: input.note }, clock);
          if (!applied.ok) return applied;
          return { ok: true, value: { value: applied.value, commit: () => (serviceState = applied.value) } };
        },
      });
    },

    async approveServiceRestart(input: { role: ServiceRestartApprovalRole }, context: WriteContext) {
      return runWrite<ServiceState>({
        method: "approveServiceRestart",
        input,
        context,
        auditAction: "approveServiceRestart",
        objectType: "serviceState",
        objectId: "service",
        bypassServiceStopGate: true,
        stage: () => {
          if (
            !canPerformCaringContactAction(context.actor, "approveServiceRestart", { teamId: context.actor.teamId }).allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          const applied = applyServiceRestartApproval(serviceState, { role: input.role, actorId: context.actor.id }, clock);
          if (!applied.ok) return applied;
          return { ok: true, value: { value: applied.value, commit: () => (serviceState = applied.value) } };
        },
      });
    },

    // ---------------------------------------------------------------------
    // Assignment
    // ---------------------------------------------------------------------

    async getAssignment(planId: PlanId, context: ReadContext) {
      const stored = visiblePlan(planId, context, READ_ACTIONS.plan);
      if (!stored) return null;
      return assignments.get(planId) ?? unassigned();
    },

    async applyAssignment(input: { planId: PlanId; action: AssignmentAction }, context: WriteContext) {
      const permission: CaringContactAction =
        input.action.type === "claim"
          ? "claimPlan"
          : input.action.type === "reassign"
            ? "reassignPlan"
            : "coverCoordinator";
      return runWrite<PlanAssignment>({
        method: "applyAssignment",
        input,
        context,
        auditAction: "applyAssignment",
        objectId: input.planId,
        stage: () => {
          const stored = plans.get(input.planId);
          if (!stored || stored.plan.teamId !== context.actor.teamId) {
            return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
          }
          if (!canPerformCaringContactAction(context.actor, permission, { teamId: stored.plan.teamId }).allowed) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          const current = assignments.get(input.planId) ?? unassigned();
          const transitioned = applyAssignmentAction(current, input.action, clock);
          if (!transitioned.ok) return transitioned;
          return {
            ok: true,
            value: { value: { ...transitioned.value }, commit: () => assignments.set(input.planId, transitioned.value) },
          };
        },
      });
    },

    // ---------------------------------------------------------------------
    // Reconciliation
    // ---------------------------------------------------------------------

    async listDispatches(input: { fromIso: string; toIso: string }, context: ReadContext) {
      if (
        !canPerformCaringContactAction(context.actor, "reconcileProviderDispatch", { teamId: context.actor.teamId }).allowed
      ) {
        return [];
      }
      const from = new Date(input.fromIso).getTime();
      const to = new Date(input.toIso).getTime();
      return [...dispatches.values()]
        .filter((record) => plans.get(record.planId)?.plan.teamId === context.actor.teamId)
        .filter((record) => record.startedAt.getTime() >= from && record.startedAt.getTime() <= to)
        .map((record) => ({ ...record }));
    },

    async resolveDispatchDiscrepancy(input: ResolveDiscrepancyInput, context: WriteContext) {
      return runWrite<DispatchRecord>({
        method: "resolveDispatchDiscrepancy",
        input,
        context,
        auditAction: "resolveDispatchDiscrepancy",
        objectType: "contact",
        objectId: input.contactId,
        stage: () => {
          const key = dispatchKey(input.contactId, input.attempt);
          const record = dispatches.get(key);
          if (!record || plans.get(record.planId)?.plan.teamId !== context.actor.teamId) {
            return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
          }
          if (
            !canPerformCaringContactAction(context.actor, "reconcileProviderDispatch", { teamId: context.actor.teamId })
              .allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          if (record.discrepancyResolvedAt !== null) {
            return { ok: false, reason: REPOSITORY_REFUSALS.dispatchDiscrepancyAlreadyResolved };
          }
          if (input.note.trim() === "") {
            return { ok: false, reason: REPOSITORY_REFUSALS.dispatchDiscrepancyNoteRequired };
          }
          // Only the resolution and its timestamp are recorded. Nothing here touches `contact` at
          // all -- there is no re-dispatch, for any resolution including `unresolvedNoResend`.
          const resolved: DispatchRecord = {
            ...record,
            discrepancyResolvedAt: clock.now(),
            discrepancyResolution: input.resolution,
          };
          return { ok: true, value: { value: { ...resolved }, commit: () => dispatches.set(key, resolved) } };
        },
      });
    },

    // ---------------------------------------------------------------------
    // Access trail
    // ---------------------------------------------------------------------

    async recordAccess(record: AccessRecord) {
      // Deliberately outside runWrite: this is a best-effort append with no refusal to report (the
      // interface returns void), no idempotency key, and no service-stop gate -- see the interface
      // doc comment on why blocking it would be exactly the wrong thing to do mid-incident.
      await serialise(async () => {
        const event = buildAccessAuditEvent(record, clock);
        await options.auditSink?.record(event);
        auditEvents.push(event);
      });
    },

    async listAccessTrail(input: AccessTrailQuery, context: ReadContext) {
      if (!mayRead(context.actor, READ_ACTIONS.auditTrail, context.actor.teamId)) return [];
      const from = input.fromIso ? new Date(input.fromIso).getTime() : null;
      const to = input.toIso ? new Date(input.toIso).getTime() : null;
      const filtered = auditEvents
        .filter((event) => event.teamId === context.actor.teamId)
        .filter((event) => (from === null ? true : new Date(event.timestamp).getTime() >= from))
        .filter((event) => (to === null ? true : new Date(event.timestamp).getTime() <= to))
        .filter((event) => (input.actorId === undefined ? true : event.actorId === input.actorId))
        .filter((event) => (input.objectType === undefined ? true : event.objectType === input.objectType));
      return filtered.slice(input.offset, input.offset + input.limit);
    },

    // ---------------------------------------------------------------------
    // Preferences, training, retention
    // ---------------------------------------------------------------------

    async getNotificationPreferences(context: ReadContext) {
      const key = actorScopeKey(context.actor.teamId, context.actor.id);
      return notificationPreferences.get(key) ?? defaultNotificationPreferences(context.actor.id);
    },

    async saveNotificationPreferences(input: NotificationPreferences, context: WriteContext) {
      return runWrite<NotificationPreferences>({
        method: "saveNotificationPreferences",
        input,
        context,
        auditAction: "saveNotificationPreferences",
        objectType: "notificationPreferences",
        objectId: context.actor.id,
        stage: () => {
          if (input.actorId !== context.actor.id) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          if (
            !canPerformCaringContactAction(context.actor, "manageNotificationPreferences", { teamId: context.actor.teamId })
              .allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          const key = actorScopeKey(context.actor.teamId, context.actor.id);
          const saved: NotificationPreferences = Object.freeze({
            actorId: input.actorId,
            optedIn: Object.freeze([...input.optedIn]),
          });
          return { ok: true, value: { value: saved, commit: () => notificationPreferences.set(key, saved) } };
        },
      });
    },

    async getTrainingRecord(context: ReadContext) {
      const key = actorScopeKey(context.actor.teamId, context.actor.id);
      return trainingRecords.get(key) ?? emptyTrainingRecord(context.actor.id);
    },

    async recordTrainingCompetency(input: { competency: TrainingCompetency }, context: WriteContext) {
      return runWrite<TrainingRecord>({
        method: "recordTrainingCompetency",
        input,
        context,
        auditAction: "recordTrainingCompetency",
        objectType: "trainingRecord",
        objectId: context.actor.id,
        stage: () => {
          if (
            !canPerformCaringContactAction(context.actor, "enterTrainingMode", { teamId: context.actor.teamId }).allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          const key = actorScopeKey(context.actor.teamId, context.actor.id);
          const current = trainingRecords.get(key) ?? emptyTrainingRecord(context.actor.id);
          const updated = recordCompetency(current, input.competency);
          return { ok: true, value: { value: updated, commit: () => trainingRecords.set(key, updated) } };
        },
      });
    },

    async markRetentionCleared(input: { planId: PlanId }, context: WriteContext) {
      return runWrite<void>({
        method: "markRetentionCleared",
        input,
        context,
        auditAction: "markRetentionCleared",
        objectId: input.planId,
        stage: () => {
          const stored = plans.get(input.planId);
          if (!stored || stored.plan.teamId !== context.actor.teamId) {
            return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
          }
          if (
            !canPerformCaringContactAction(context.actor, "generateClinicalRecordSummary", { teamId: stored.plan.teamId })
              .allowed
          ) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }
          return { ok: true, value: { value: undefined, commit: () => retentionCleared.add(input.planId) } };
        },
      });
    },

    async getPlan(planId: PlanId, context: ReadContext) {
      const stored = visiblePlan(planId, context, READ_ACTIONS.plan);
      return stored ? toPlanRecord(stored) : null;
    },

    async listPlans(context: ReadContext) {
      return [...plans.values()]
        .filter((stored) => mayRead(context.actor, READ_ACTIONS.plan, stored.plan.teamId))
        .map(toPlanRecord);
    },

    async listContacts(planId: PlanId, context: ReadContext) {
      const stored = visiblePlan(planId, context, READ_ACTIONS.contacts);
      return stored ? stored.contacts.map(cloneStoredContact) : [];
    },

    async listSendableContacts(planId: PlanId, context: ReadContext) {
      const stored = visiblePlan(planId, context, READ_ACTIONS.contacts);
      if (!stored) return [];
      // Keyed off the stored contact state, which was set from `sendableContacts` at creation and
      // then only ever moved by the lifecycle. Nothing here looks at `sendAt`.
      return stored.contacts.filter((entry) => entry.contact.state === "scheduled").map(cloneStoredContact);
    },

    async listAuditEvents(context: ReadContext) {
      if (!mayRead(context.actor, READ_ACTIONS.auditTrail, context.actor.teamId)) return [];
      return auditEvents.filter((event) => event.teamId === context.actor.teamId);
    },

    async getEpisode(planId: PlanId, context: ReadContext): Promise<Episode | null> {
      const stored = visiblePlan(planId, context, READ_ACTIONS.episode);
      if (!stored) return null;

      // ./episode's `Episode`, assembled — not a second episode shape. `plan.state` maps straight
      // onto `episode.state`; repository.ts pins those two unions as the same set.
      return {
        state: stored.plan.state,
        patientName: stored.patientDetail.patientName,
        patientMobileNumber: stored.patientDetail.patientMobileNumber,
        patientIdentifiers: [...stored.patientDetail.patientIdentifiers],
        culturalIdentity: stored.patientDetail.culturalIdentity,
        planDates: {
          dischargeAt: new Date(stored.dischargeAt.getTime()),
          completedAt: stored.completedAt === null ? null : new Date(stored.completedAt.getTime()),
        },
        pathwayVersionId: stored.pathwayVersionId,
        teamId: stored.plan.teamId,
        outcome: stored.outcome,
        counts: {
          contactsScheduled: stored.contacts.filter((entry) => entry.planned.suppressed === undefined).length,
          contactsSent: stored.contacts.filter((entry) => DISPATCHED_CONTACT_STATES.includes(entry.contact.state))
            .length,
          contactsDelivered: stored.contacts.filter((entry) => entry.contact.state === "delivered").length,
        },
      };
    },
  };
}
