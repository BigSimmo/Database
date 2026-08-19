// src/lib/caring-contacts/db/postgres-repository.ts
//
// The Postgres caring-contact store. It implements the same contract as the in-memory store in
// ../in-memory-repository, and it is exercised by the SAME suite -- one contract, two factories --
// because every proof made in Tasks 9 and 10 was made against the in-memory store, and a Postgres
// store that behaved differently would carry none of them over.
//
// Two behaviours are reproduced deliberately rather than incidentally, because Task 10's findings
// depend on them:
//
//   * VERSION-CHECK ORDERING. A contact-status write resolves plan scope, then capability, then
//     the CONTACT's version, and only then asks whether the plan is still active. So a death that
//     lands while a contact is `processing` refuses on `stale-version` (the cancellation bumped
//     the contact) rather than on the plan gate -- and a dispatcher that re-reads the fresh
//     version is then refused by the contact lifecycle. Both guards are load-bearing; swapping
//     the order would silently retire one of them.
//   * THE ACTIVE-PLAN DISPATCH GATE applies to `startContactDispatch` and to nothing else. Once a
//     contact is `processing` the send is committed, and a plan change arriving mid-flight must
//     let that one contact finish rather than strand it in a state with no exit.
//
// How the database carries each contract guarantee:
//
//   idempotency  -> a (team_id, idempotency_key) primary key holding the ORIGINAL result, read
//                   inside the same transaction, so a replay returns the first answer and writes
//                   nothing;
//   atomic audit -> the change and its audit row commit together. A deferred constraint trigger
//                   fires at commit and fails the transaction if the change carries no audit event,
//                   so a direct UPDATE that bypasses this module cannot commit either;
//   concurrency  -> `SELECT ... FOR UPDATE` then `UPDATE ... WHERE version = $expected`, which is
//                   what the in-memory store's serialised write queue approximates in one process;
//   team scope   -> a transaction-local team setting plus row-level security. A cross-team read
//                   returns zero rows before this module's own capability check ever runs, so the
//                   database and the domain refuse it independently.
//
// This module names no SQL driver. It takes a minimal connection abstraction so the domain stays
// free of a `pg` dependency (the driver is a devDependency, used only by the test adapter) and so
// ../../caring-contacts remains importable without one.
import { buildAuditEvent, type AuditEvent, type AuditOutcome } from "../audit";
import type { Clock } from "../clock";
import { applyHospitalStatusEvent, applyWithdrawalRequest, sendableContacts } from "../hospital-events";
import { fingerprintOf } from "../fingerprint";
import { actorId as toActorId, contactId, idempotencyKey as toIdempotencyKey, teamId as toTeamId } from "../ids";
import type { PathwayVersionId, PatientId, PlanId, ReferralId, TeamId } from "../ids";
import { applyContactTransition, applyPlanTransition } from "../model";
import type { Contact, ContactAction, ContactState, Plan, PlanState, TransitionResult } from "../model";
import {
  actorRoleNames,
  canPerformCaringContactAction,
  type CaringContactAction,
  type CaringContactActor,
} from "../permissions";
import {
  REPOSITORY_REFUSALS,
  contactIdentifierFor,
  type CaringContactRepository,
  type ContactProviderStatusInput,
  type ContactStatusInput,
  type CreatePlanInput,
  type EpisodePatientDetail,
  type HospitalStatusInput,
  type HospitalStatusOutcome,
  type PlanLifecycleInput,
  type PlanOutcome,
  type PlanRecord,
  type ReadContext,
  type RepositoryOptions,
  type StoredContact,
  type WithdrawPlanInput,
  type WriteContext,
} from "../repository";
import type { Episode } from "../episode";
import { buildApprovedSchedule, type PlannedContact } from "../schedule";

// ---------------------------------------------------------------------------
// The connection abstraction
// ---------------------------------------------------------------------------

export type SqlValue = string | number | boolean | Date | null | readonly string[];
export type SqlRow = Record<string, unknown>;
export type SqlResult = { rows: SqlRow[]; rowCount: number };

/** One connection, held for the length of a transaction. */
export type SqlConnection = { query(text: string, values?: readonly SqlValue[]): Promise<SqlResult> };

/**
 * A source of connections. `withConnection` must hold ONE connection for the whole callback --
 * every transaction here spans several statements, and a pool that handed out a different
 * connection per statement would break both the transaction and the transaction-local team scope.
 */
export type SqlConnectionPool = { withConnection<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T> };

// ---------------------------------------------------------------------------
// Shared constants (kept identical to the in-memory store on purpose)
// ---------------------------------------------------------------------------

const TERMINAL_PLAN_STATES: readonly PlanState[] = ["withdrawn", "cancelled", "completed"];

const DISPATCHED_CONTACT_STATES: readonly ContactState[] = [
  "sent",
  "delivered",
  "notDelivered",
  "numberInvalid",
  "contactChanged",
  "statusUnavailable",
];

const READ_ACTIONS = Object.freeze({
  plan: "viewReferral",
  contacts: "viewReferral",
  auditTrail: "viewAccessTrail",
  episode: "generateClinicalRecordSummary",
} as const satisfies Record<string, CaringContactAction>);

const PLAN_COLUMNS = `id, team_id, patient_id, referral_id, pathway_version_id, state, version, outcome,
  discharge_at, completed_at, sending_preference, patient_name, patient_mobile_number, patient_identifiers`;

const CONTACT_COLUMNS = `id, plan_id, team_id, sequence, state, version, cadence_label, calendar_day,
  send_at, message_type, suppressed_reason`;

// ---------------------------------------------------------------------------
// Result storage
//
// A replay must return the ORIGINAL result, not a freshly derived one: by the time a `createPlan`
// is replayed the plan may have been activated, and re-deriving would answer a different question.
// JSON cannot carry a Date, so instants are marked and revived.
// ---------------------------------------------------------------------------

const DATE_MARKER = "__caringContactInstant";

function encodeStoredValue(value: unknown): unknown {
  if (value instanceof Date) return { [DATE_MARKER]: value.getTime() };
  if (Array.isArray(value)) return value.map(encodeStoredValue);
  if (value !== null && typeof value === "object") {
    const encoded: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue;
      encoded[key] = encodeStoredValue(entry);
    }
    return encoded;
  }
  return value;
}

function decodeStoredValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeStoredValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record[DATE_MARKER] === "number") return new Date(record[DATE_MARKER] as number);
    const decoded: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) decoded[key] = decodeStoredValue(entry);
    return decoded;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function textOf(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function numberOf(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function instantOf(value: unknown): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
}

function toPlan(row: SqlRow): Plan {
  return {
    id: textOf(row.id) as PlanId,
    teamId: toTeamId(textOf(row.team_id)),
    state: textOf(row.state) as PlanState,
    version: numberOf(row.version),
  };
}

function toPlanned(row: SqlRow): PlannedContact {
  const planned: PlannedContact = {
    sequence: numberOf(row.sequence),
    cadenceLabel: textOf(row.cadence_label),
    calendarDay: textOf(row.calendar_day),
    sendAt: instantOf(row.send_at),
    messageType: textOf(row.message_type) as PlannedContact["messageType"],
  };
  // Present only when the entry really was absorbed, so a stored contact round-trips to exactly
  // the shape the in-memory store produces.
  if (row.suppressed_reason !== null && row.suppressed_reason !== undefined) {
    planned.suppressed = { reason: textOf(row.suppressed_reason) as "absorbedByFirstContact" };
  }
  return planned;
}

function toStoredContact(row: SqlRow): StoredContact {
  const contact: Contact = {
    id: contactId(textOf(row.id)),
    planId: textOf(row.plan_id) as PlanId,
    state: textOf(row.state) as ContactState,
    version: numberOf(row.version),
  };
  return { contact, planned: toPlanned(row) };
}

function toPlanRecord(planRow: SqlRow, contactRows: readonly SqlRow[]): PlanRecord {
  return {
    plan: toPlan(planRow),
    patientId: textOf(planRow.patient_id) as PatientId,
    referralId: textOf(planRow.referral_id) as ReferralId,
    pathwayVersionId: textOf(planRow.pathway_version_id) as PathwayVersionId,
    dischargeAt: instantOf(planRow.discharge_at),
    completedAt:
      planRow.completed_at === null || planRow.completed_at === undefined ? null : instantOf(planRow.completed_at),
    outcome: textOf(planRow.outcome) as PlanOutcome,
    contacts: contactRows.map(toStoredContact),
  };
}

function toAuditEvent(row: SqlRow): AuditEvent {
  return {
    actorId: toActorId(textOf(row.actor_id)),
    actorRoles: Object.freeze([...((row.actor_roles as string[] | null) ?? [])]),
    teamId: toTeamId(textOf(row.team_id)),
    action: textOf(row.action),
    objectType: textOf(row.object_type),
    objectId: textOf(row.object_id),
    outcome: textOf(row.outcome) as AuditOutcome,
    idempotencyKey: toIdempotencyKey(textOf(row.idempotency_key)),
    timestamp: textOf(row.occurred_at),
  };
}

function isTerminalPlan(state: PlanState): boolean {
  return TERMINAL_PLAN_STATES.includes(state);
}

function outcomeFor(state: PlanState): PlanOutcome {
  return state === "withdrawn" || state === "cancelled" || state === "completed" ? state : "inProgress";
}

/** Transaction audit tokens. Deterministic per store instance, unique within it. */
function auditTokenFactory(): () => string {
  let issued = 0;
  const prefix = Math.floor(Math.random() * 0xffff_ffff)
    .toString(16)
    .padStart(8, "0");
  return () => {
    issued += 1;
    return `${prefix}-0000-4000-8000-${String(issued).padStart(12, "0")}`;
  };
}

type WriteSpec<T> = {
  /** Part of the idempotency fingerprint, so one key cannot cover two different operations. */
  method: string;
  input: unknown;
  context: WriteContext;
  auditAction: string;
  objectId: string;
  objectType?: string;
  stage: (connection: SqlConnection) => Promise<TransitionResult<T>>;
};

export function createPostgresRepository(
  pool: SqlConnectionPool,
  clock: Clock,
  options: RepositoryOptions = {},
): CaringContactRepository {
  const nextAuditToken = auditTokenFactory();

  /**
   * Opens a transaction scoped to one team, as the non-privileged application role.
   *
   * `set local role` is what makes row-level security apply at all: the migration role is a
   * superuser and bypasses every policy, so a store that skipped this would be team-scoped only by
   * its own SQL — one forgotten predicate away from cross-team disclosure.
   */
  async function inTransaction<T>(
    team: TeamId,
    auditToken: string | null,
    work: (connection: SqlConnection) => Promise<T>,
  ): Promise<T> {
    return pool.withConnection(async (connection) => {
      await connection.query("begin");
      try {
        await connection.query("select set_config('caring_contacts.team_id', $1, true)", [team]);
        await connection.query("select set_config('caring_contacts.audit_token', $1, true)", [auditToken ?? ""]);
        await connection.query("set local role caring_contacts_app");
        const value = await work(connection);
        await connection.query("commit");
        return value;
      } catch (error) {
        await connection.query("rollback").catch(() => undefined);
        throw error;
      }
    });
  }

  function mayRead(actor: CaringContactActor, action: CaringContactAction, resourceTeamId: TeamId): boolean {
    return canPerformCaringContactAction(actor, action, { teamId: resourceTeamId }).allowed;
  }

  /** The team is the actor's own: a read of another team's row returns nothing, never a refusal. */
  function mayReadOwnTeam(context: ReadContext, action: CaringContactAction): boolean {
    return mayRead(context.actor, action, context.actor.teamId);
  }

  async function ensureTeam(connection: SqlConnection, team: TeamId): Promise<void> {
    await connection.query("insert into caring_contacts.teams (id) values ($1) on conflict (id) do nothing", [team]);
  }

  async function selectPlanForUpdate(connection: SqlConnection, planId: PlanId): Promise<SqlRow | null> {
    const result = await connection.query(
      `select ${PLAN_COLUMNS} from caring_contacts.plans where id = $1 for update`,
      [planId],
    );
    return result.rows[0] ?? null;
  }

  async function selectContacts(connection: SqlConnection, planId: PlanId): Promise<SqlRow[]> {
    const result = await connection.query(
      `select ${CONTACT_COLUMNS} from caring_contacts.contacts where plan_id = $1 order by sequence`,
      [planId],
    );
    return result.rows;
  }

  async function selectContactsForUpdate(connection: SqlConnection, planId: PlanId): Promise<SqlRow[]> {
    const result = await connection.query(
      `select ${CONTACT_COLUMNS} from caring_contacts.contacts where plan_id = $1 order by sequence for update`,
      [planId],
    );
    return result.rows;
  }

  /** Applies a plan transition row, asserting the optimistic guard actually matched. */
  async function writePlan(connection: SqlConnection, plan: Plan, completedAt: Date | null): Promise<void> {
    const result = await connection.query(
      `update caring_contacts.plans
         set state = $2, version = $3, outcome = $4, completed_at = $5
       where id = $1 and version = $6`,
      [plan.id, plan.state, plan.version, outcomeFor(plan.state), completedAt, plan.version - 1],
    );
    if (result.rowCount !== 1) {
      throw new Error(`caring-contacts: plan ${plan.id} moved under an optimistic write that held a row lock`);
    }
  }

  async function writeContact(connection: SqlConnection, contact: Contact): Promise<void> {
    const result = await connection.query(
      "update caring_contacts.contacts set state = $2, version = $3 where id = $1 and version = $4",
      [contact.id, contact.state, contact.version, contact.version - 1],
    );
    if (result.rowCount !== 1) {
      throw new Error(`caring-contacts: contact ${contact.id} moved under an optimistic write that held a row lock`);
    }
  }

  /**
   * Cancels every contact the lifecycle still accepts a cancellation for. As in the in-memory
   * store, nothing here compares `send_at` to now: on a recorded death, such a filter is exactly
   * the defect that lets a message reach someone afterwards.
   */
  async function cancelAllNonTerminalContacts(connection: SqlConnection, rows: readonly SqlRow[]): Promise<number> {
    let cancelled = 0;
    for (const row of rows) {
      const stored = toStoredContact(row);
      const transition = applyContactTransition(stored.contact, { type: "cancel" });
      if (!transition.ok) continue;
      await writeContact(connection, transition.value);
      cancelled += 1;
    }
    return cancelled;
  }

  /**
   * The one path every write takes.
   *
   * Order is the guarantee, exactly as in the in-memory store: the change is fully staged, then
   * the audit event is built and offered to the sink, and only then is anything committed. A throw
   * anywhere before the commit rolls the transaction back, so the store is left byte-identical and
   * the idempotency key is NOT consumed — the caller may retry.
   */
  async function runWrite<T>(spec: WriteSpec<T>): Promise<TransitionResult<T>> {
    const { actor, idempotencyKey } = spec.context;
    const token = nextAuditToken();
    const fingerprint = fingerprintOf({ method: spec.method, input: spec.input });

    return inTransaction(actor.teamId, token, async (connection) => {
      await ensureTeam(connection, actor.teamId);

      const existing = await connection.query(
        `select fingerprint, result from caring_contacts.idempotency_records
         where team_id = $1 and idempotency_key = $2`,
        [actor.teamId, idempotencyKey],
      );
      const previous = existing.rows[0] ?? null;

      // A true replay returns the original answer and appends nothing at all.
      if (previous && textOf(previous.fingerprint) === fingerprint) {
        return decodeStoredValue(previous.result) as TransitionResult<T>;
      }

      const staged: TransitionResult<T> = previous
        ? { ok: false, reason: REPOSITORY_REFUSALS.idempotencyKeyReused }
        : await spec.stage(connection);

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

      await connection.query(
        `insert into caring_contacts.audit_events
           (team_id, actor_id, actor_roles, action, object_type, object_id, outcome, idempotency_key,
            occurred_at, txn_token)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid)`,
        [
          event.teamId,
          event.actorId,
          [...event.actorRoles],
          event.action,
          event.objectType,
          event.objectId,
          event.outcome,
          event.idempotencyKey,
          event.timestamp,
          token,
        ],
      );

      // A key reused for a different request must not overwrite the original write's result.
      if (!previous) {
        await connection.query(
          `insert into caring_contacts.idempotency_records (team_id, idempotency_key, fingerprint, result)
           values ($1, $2, $3, $4::jsonb)`,
          [actor.teamId, idempotencyKey, fingerprint, JSON.stringify(encodeStoredValue(staged))],
        );
      }
      return staged;
    });
  }

  /**
   * Resolves an existing plan for a write: team scope, then capability, then version. `actions` is
   * a list because one write may be reachable by more than one capability -- a recorded death is
   * the case, and it is a safety property rather than a convenience.
   */
  async function resolveForWrite(
    connection: SqlConnection,
    input: PlanLifecycleInput,
    actor: CaringContactActor,
    actions: readonly CaringContactAction[],
  ): Promise<TransitionResult<SqlRow>> {
    // Row-level security already excludes another team's plan, so this returns nothing for it --
    // the same answer as for a plan that does not exist.
    const row = await selectPlanForUpdate(connection, input.planId);
    if (!row) return { ok: false, reason: REPOSITORY_REFUSALS.notFound };

    const team = toTeamId(textOf(row.team_id));
    const permitted = actions.some((action) => canPerformCaringContactAction(actor, action, { teamId: team }).allowed);
    if (!permitted) return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
    if (numberOf(row.version) !== input.expectedVersion) {
      return { ok: false, reason: REPOSITORY_REFUSALS.staleVersion };
    }
    return { ok: true, value: row };
  }

  async function lifecycleWrite(
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
      stage: async (connection) => {
        const resolved = await resolveForWrite(connection, input, context.actor, [action]);
        if (!resolved.ok) return resolved;
        const moved = applyPlanTransition(toPlan(resolved.value), { type: transition });
        if (!moved.ok) return moved;

        const completedAt = isTerminalPlan(moved.value.state) ? clock.now() : null;
        await writePlan(connection, moved.value, completedAt);

        // Re-read rather than patching the row in memory: what the caller gets back is then what
        // the database actually holds, including any default or constraint it applied.
        const stored = await readPlanRecord(connection, input.planId);
        if (!stored) throw new Error(`caring-contacts: plan ${input.planId} vanished inside its own transaction`);
        return { ok: true, value: toPlanRecord(stored.planRow, stored.contactRows) };
      },
    });
  }

  /**
   * The one path every contact-status write takes. `requiresActivePlan` is true only for the write
   * that BEGINS a dispatch — see the module header for why the ordering of the checks below is
   * itself a contract.
   */
  async function contactStatusWrite(
    method: string,
    permission: CaringContactAction,
    input: ContactStatusInput,
    action: ContactAction,
    context: WriteContext,
    requiresActivePlan: boolean,
    recordDispatchAttempt = false,
  ): Promise<TransitionResult<StoredContact>> {
    return runWrite<StoredContact>({
      method,
      input,
      context,
      auditAction: method,
      objectType: "contact",
      objectId: input.contactId,
      stage: async (connection) => {
        const planRow = await selectPlanForUpdate(connection, input.planId);
        if (!planRow) return { ok: false, reason: REPOSITORY_REFUSALS.notFound };

        const team = toTeamId(textOf(planRow.team_id));
        if (!canPerformCaringContactAction(context.actor, permission, { teamId: team }).allowed) {
          return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
        }

        const contactResult = await connection.query(
          `select ${CONTACT_COLUMNS} from caring_contacts.contacts where plan_id = $1 and id = $2 for update`,
          [input.planId, input.contactId],
        );
        const contactRow = contactResult.rows[0];
        if (!contactRow) return { ok: false, reason: REPOSITORY_REFUSALS.notFound };
        if (numberOf(contactRow.version) !== input.expectedContactVersion) {
          return { ok: false, reason: REPOSITORY_REFUSALS.staleVersion };
        }

        // Deliberately AFTER the version check. See the module header.
        if (requiresActivePlan && textOf(planRow.state) !== "active") {
          return { ok: false, reason: REPOSITORY_REFUSALS.contactDispatchRequiresActivePlan };
        }

        const stored = toStoredContact(contactRow);
        const moved = applyContactTransition(stored.contact, action);
        if (!moved.ok) return moved;
        await writeContact(connection, moved.value);

        if (recordDispatchAttempt) {
          // One row per attempt at one contact. The unique (contact_id, attempt) constraint is what
          // stops a replayed dispatch becoming a second recorded message.
          const attempts = await connection.query(
            "select coalesce(max(attempt), 0) + 1 as attempt from caring_contacts.contact_dispatches where contact_id = $1",
            [input.contactId],
          );
          await connection.query(
            `insert into caring_contacts.contact_dispatches (contact_id, team_id, attempt, idempotency_key)
             values ($1, $2, $3, $4)`,
            [input.contactId, team, numberOf(attempts.rows[0].attempt), context.idempotencyKey],
          );
        }

        return { ok: true, value: { contact: moved.value, planned: stored.planned } };
      },
    });
  }

  /** Reads run in their own team-scoped transaction; they write nothing and need no audit token. */
  async function runRead<T>(context: ReadContext, work: (connection: SqlConnection) => Promise<T>): Promise<T> {
    return inTransaction(context.actor.teamId, null, work);
  }

  async function readPlanRecord(
    connection: SqlConnection,
    planId: PlanId,
  ): Promise<{ planRow: SqlRow; contactRows: SqlRow[] } | null> {
    const result = await connection.query(`select ${PLAN_COLUMNS} from caring_contacts.plans where id = $1`, [planId]);
    const planRow = result.rows[0];
    if (!planRow) return null;
    return { planRow, contactRows: await selectContacts(connection, planId) };
  }

  return {
    async createPlan(input: CreatePlanInput, context: WriteContext) {
      return runWrite<PlanRecord>({
        method: "createPlan",
        input,
        context,
        auditAction: "createPlan",
        objectId: input.planId,
        stage: async (connection) => {
          const { actor } = context;
          if (!canPerformCaringContactAction(actor, "claimPlan", { teamId: actor.teamId }).allowed) {
            return { ok: false, reason: REPOSITORY_REFUSALS.permissionDenied };
          }

          // Both questions cross team boundaries, so both are asked through SECURITY DEFINER
          // functions that answer with a boolean and disclose nothing else. A team-scoped SELECT
          // would answer "no" for another team's plan, which is how two teams end up contacting one
          // person on the same day.
          const exists = await connection.query("select caring_contacts.plan_exists($1) as present", [input.planId]);
          if (exists.rows[0].present === true) {
            return { ok: false, reason: REPOSITORY_REFUSALS.planAlreadyExists };
          }
          const open = await connection.query("select caring_contacts.patient_has_non_terminal_plan($1) as present", [
            input.patientId,
          ]);
          if (open.rows[0].present === true) {
            return { ok: false, reason: REPOSITORY_REFUSALS.duplicateActivePlan };
          }

          const schedule = buildApprovedSchedule({
            dischargeAt: input.dischargeAt,
            sendingPreference: input.sendingPreference,
            firstContactDate: input.firstContactDate,
            firstContactReason: input.firstContactReason,
          });
          if (!schedule.ok) return schedule;

          await connection.query(
            `insert into caring_contacts.plans
               (id, team_id, patient_id, referral_id, pathway_version_id, state, version, outcome,
                discharge_at, completed_at, sending_preference, patient_name, patient_mobile_number,
                patient_identifiers)
             values ($1, $2, $3, $4, $5, 'draft', 1, 'inProgress', $6, null, $7, $8, $9, $10)`,
            [
              input.planId,
              actor.teamId,
              input.patientId,
              input.referralId,
              input.pathwayVersionId,
              input.dischargeAt,
              input.sendingPreference,
              input.patientDetail.patientName,
              input.patientDetail.patientMobileNumber,
              [...input.patientDetail.patientIdentifiers],
            ],
          );

          // Sendability comes from `sendableContacts`, never from `send_at`: an absorbed entry
          // carries a real send instant and would otherwise go out as a second message that day.
          // Storing it terminal means it cannot be dispatched at all.
          const sendable = new Set(sendableContacts(schedule.contacts).map((planned) => planned.sequence));
          for (const planned of schedule.contacts) {
            await connection.query(
              `insert into caring_contacts.contacts
                 (id, plan_id, team_id, sequence, state, version, cadence_label, calendar_day, send_at,
                  message_type, suppressed_reason)
               values ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10)`,
              [
                contactIdentifierFor(input.planId, planned.sequence),
                input.planId,
                actor.teamId,
                planned.sequence,
                sendable.has(planned.sequence) ? "scheduled" : "suppressed",
                planned.cadenceLabel,
                planned.calendarDay,
                planned.sendAt,
                planned.messageType,
                planned.suppressed?.reason ?? null,
              ],
            );
          }

          // Cultural identity goes to the reporting projection and nowhere near the plan row.
          if (input.patientDetail.culturalIdentity !== null) {
            await connection.query(
              `insert into caring_contacts.cultural_identity_reports (plan_id, team_id, cultural_identity)
               values ($1, $2, $3)`,
              [input.planId, actor.teamId, input.patientDetail.culturalIdentity],
            );
          }

          const stored = await readPlanRecord(connection, input.planId);
          if (!stored) throw new Error(`caring-contacts: plan ${input.planId} vanished inside its own transaction`);
          return { ok: true, value: toPlanRecord(stored.planRow, stored.contactRows) };
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
        stage: async (connection) => {
          const resolved = await resolveForWrite(connection, input, context.actor, ["withdrawPlan"]);
          if (!resolved.ok) return resolved;

          // The third-party refusal lives in ../hospital-events and is not restated here.
          const withdrawal = applyWithdrawalRequest(toPlan(resolved.value), { origin: input.origin });
          if (!withdrawal.ok) return withdrawal;

          const completedAt = isTerminalPlan(withdrawal.value.plan.state) ? clock.now() : null;
          await writePlan(connection, withdrawal.value.plan, completedAt);
          await cancelAllNonTerminalContacts(connection, await selectContactsForUpdate(connection, input.planId));

          const stored = await readPlanRecord(connection, input.planId);
          if (!stored) throw new Error(`caring-contacts: plan ${input.planId} vanished inside its own transaction`);
          return { ok: true, value: toPlanRecord(stored.planRow, stored.contactRows) };
        },
      });
    },

    async recordHospitalStatusEvent(input: HospitalStatusInput, context: WriteContext) {
      // A death and its correction additionally accept triggerServiceSafetyStop, the one capability
      // every role holds. Recording a death must never be blocked by a permission check: a refusal
      // would leave a plan sending to someone who has died.
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
        stage: async (connection) => {
          const resolved = await resolveForWrite(connection, input, context.actor, actions);
          if (!resolved.ok) return resolved;

          const applied = applyHospitalStatusEvent(toPlan(resolved.value), input.event);
          if (!applied.ok) return applied;

          const completedAt = isTerminalPlan(applied.value.plan.state) ? clock.now() : null;
          if (applied.value.plan.version !== numberOf(resolved.value.version)) {
            await writePlan(connection, applied.value.plan, completedAt);
          }

          const { contactOutcome } = applied.value;
          const stopsEverything = contactOutcome.type === "cancelUnsent" || contactOutcome.type === "stopAll";
          const cancelled = stopsEverything
            ? await cancelAllNonTerminalContacts(connection, await selectContactsForUpdate(connection, input.planId))
            : 0;

          const stored = await readPlanRecord(connection, input.planId);
          if (!stored) throw new Error(`caring-contacts: plan ${input.planId} vanished inside its own transaction`);

          const value: HospitalStatusOutcome = {
            record: toPlanRecord(stored.planRow, stored.contactRows),
            exceptions: applied.value.exceptions,
            contactsCancelled: cancelled,
          };
          if (applied.value.incident) value.incident = applied.value.incident;
          return { ok: true, value };
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
      if (!mayReadOwnTeam(context, READ_ACTIONS.plan)) return null;
      return runRead(context, async (connection) => {
        const stored = await readPlanRecord(connection, planId);
        return stored ? toPlanRecord(stored.planRow, stored.contactRows) : null;
      });
    },

    async listPlans(context: ReadContext) {
      if (!mayReadOwnTeam(context, READ_ACTIONS.plan)) return [];
      return runRead(context, async (connection) => {
        const plans = await connection.query(`select ${PLAN_COLUMNS} from caring_contacts.plans order by id`);
        const contacts = await connection.query(
          `select ${CONTACT_COLUMNS} from caring_contacts.contacts order by plan_id, sequence`,
        );
        const byPlan = new Map<string, SqlRow[]>();
        for (const row of contacts.rows) {
          const key = textOf(row.plan_id);
          const bucket = byPlan.get(key);
          if (bucket) bucket.push(row);
          else byPlan.set(key, [row]);
        }
        return plans.rows.map((row) => toPlanRecord(row, byPlan.get(textOf(row.id)) ?? []));
      });
    },

    async listContacts(planId: PlanId, context: ReadContext) {
      if (!mayReadOwnTeam(context, READ_ACTIONS.contacts)) return [];
      return runRead(context, async (connection) => {
        // Scoped through the plan, so a contact whose plan is invisible is invisible too.
        const stored = await readPlanRecord(connection, planId);
        return stored ? stored.contactRows.map(toStoredContact) : [];
      });
    },

    async listSendableContacts(planId: PlanId, context: ReadContext) {
      if (!mayReadOwnTeam(context, READ_ACTIONS.contacts)) return [];
      return runRead(context, async (connection) => {
        const stored = await readPlanRecord(connection, planId);
        if (!stored) return [];
        // Keyed off the stored contact state, set from `sendableContacts` at creation and then only
        // ever moved by the lifecycle. Nothing here looks at `send_at`.
        return stored.contactRows.filter((row) => textOf(row.state) === "scheduled").map(toStoredContact);
      });
    },

    async listAuditEvents(context: ReadContext) {
      if (!mayReadOwnTeam(context, READ_ACTIONS.auditTrail)) return [];
      return runRead(context, async (connection) => {
        const result = await connection.query(
          `select team_id, actor_id, actor_roles, action, object_type, object_id, outcome,
                  idempotency_key, occurred_at
           from caring_contacts.audit_events order by id`,
        );
        return result.rows.map(toAuditEvent);
      });
    },

    async getEpisode(planId: PlanId, context: ReadContext): Promise<Episode | null> {
      if (!mayReadOwnTeam(context, READ_ACTIONS.episode)) return null;
      return runRead(context, async (connection) => {
        const stored = await readPlanRecord(connection, planId);
        if (!stored) return null;
        const { planRow, contactRows } = stored;

        // Cultural identity is read from the projection, never from the plan row -- the plan row
        // has no such column, which is the point.
        const cultural = await connection.query(
          "select cultural_identity from caring_contacts.cultural_identity_reports where plan_id = $1",
          [planId],
        );
        const culturalIdentity = cultural.rows[0] ? textOf(cultural.rows[0].cultural_identity) : null;

        const detail: EpisodePatientDetail = {
          patientName: textOf(planRow.patient_name),
          patientMobileNumber: textOf(planRow.patient_mobile_number),
          patientIdentifiers: [...((planRow.patient_identifiers as string[] | null) ?? [])],
          culturalIdentity,
        };
        const states = contactRows.map((row) => textOf(row.state) as ContactState);

        return {
          state: textOf(planRow.state) as PlanState,
          patientName: detail.patientName,
          patientMobileNumber: detail.patientMobileNumber,
          patientIdentifiers: detail.patientIdentifiers,
          culturalIdentity: detail.culturalIdentity,
          planDates: {
            dischargeAt: instantOf(planRow.discharge_at),
            completedAt:
              planRow.completed_at === null || planRow.completed_at === undefined
                ? null
                : instantOf(planRow.completed_at),
          },
          pathwayVersionId: textOf(planRow.pathway_version_id) as PathwayVersionId,
          teamId: toTeamId(textOf(planRow.team_id)),
          outcome: textOf(planRow.outcome),
          counts: {
            contactsScheduled: contactRows.filter(
              (row) => row.suppressed_reason === null || row.suppressed_reason === undefined,
            ).length,
            contactsSent: states.filter((state) => DISPATCHED_CONTACT_STATES.includes(state)).length,
            contactsDelivered: states.filter((state) => state === "delivered").length,
          },
        };
      });
    },
  };
}
