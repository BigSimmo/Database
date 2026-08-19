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
import { buildAuditEvent, type AuditEvent, type AuditOutcome } from "./audit";
import type { Clock } from "./clock";
import { fingerprintOf } from "./fingerprint";
import { applyHospitalStatusEvent, applyWithdrawalRequest, sendableContacts } from "./hospital-events";
import { contactId } from "./ids";
import type { PlanId, TeamId } from "./ids";
import { applyContactTransition, applyPlanTransition } from "./model";
import type { Contact, ContactAction, ContactState, Plan, PlanState, TransitionResult } from "./model";
import {
  actorRoleNames,
  canPerformCaringContactAction,
  type CaringContactAction,
  type CaringContactActor,
} from "./permissions";
import {
  REPOSITORY_REFUSALS,
  contactIdentifierFor,
  type CaringContactRepository,
  type ContactProviderStatusInput,
  type ContactStatusInput,
  type CreatePlanInput,
  type HospitalStatusInput,
  type HospitalStatusOutcome,
  type PlanLifecycleInput,
  type PlanOutcome,
  type PlanRecord,
  type ReadContext,
  type RepositoryOptions,
  type StoredContact,
  type StoredPlan,
  type WithdrawPlanInput,
  type WriteContext,
} from "./repository";
import type { Episode } from "./episode";
import { buildApprovedSchedule, type PlannedContact } from "./schedule";

const TERMINAL_PLAN_STATES: readonly PlanState[] = ["withdrawn", "cancelled", "completed"];

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
} as const satisfies Record<string, CaringContactAction>);

type StagedWrite<T> = { value: T; nextPlan: StoredPlan | null };

type WriteSpec<T> = {
  /** Part of the idempotency fingerprint, so one key cannot cover two different operations. */
  method: string;
  input: unknown;
  context: WriteContext;
  auditAction: string;
  objectId: string;
  /** What the audit event says was acted on. Defaults to the plan. */
  objectType?: string;
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

      const staged: TransitionResult<StagedWrite<T>> = previous
        ? { ok: false, reason: REPOSITORY_REFUSALS.idempotencyKeyReused }
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
      if (staged.ok && staged.value.nextPlan) plans.set(staged.value.nextPlan.plan.id, staged.value.nextPlan);
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
        return { ok: true, value: { value: cloneStoredContact(contacts[index]), nextPlan } };
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
        return { ok: true, value: { value: toPlanRecord(nextPlan), nextPlan } };
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
          return { ok: true, value: { value: toPlanRecord(nextPlan), nextPlan } };
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
          return { ok: true, value: { value: toPlanRecord(nextPlan), nextPlan } };
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
          return { ok: true, value: { value, nextPlan } };
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
