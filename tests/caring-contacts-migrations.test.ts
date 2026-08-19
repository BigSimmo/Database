// tests/caring-contacts-migrations.test.ts
//
// The caring-contact schema, proven against a real Postgres.
//
// Everything here runs as `caring_contacts_app` or `caring_contacts_anon`, never as the migration
// superuser — a superuser bypasses row-level security outright, so a policy assertion made as one
// would pass against a schema with no policies at all.
//
// The five load-bearing proofs, in the order the brief states them:
//   1. an anonymous session sees nothing and may write nothing;
//   2. a cross-team select returns ZERO ROWS, not an error that would reveal the row exists;
//   3. a second non-terminal plan for one patient is refused by a unique partial index;
//   4. a second dispatch record for one (contact, attempt) is refused by a unique constraint;
//   5. a change committed without an audit event in the same transaction FAILS.
import { readdirSync } from "node:fs";
import path from "node:path";

import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ANON_ROLE,
  applyCaringContactsMigrations,
  caringContactsMigrations,
  createCaringContactsPool,
  dropCaringContactsSchema,
  insertAuditEvent,
  nextAuditToken,
  runInTeamSession,
  seedPlan,
  truncateCaringContactsData,
} from "./helpers/caring-contacts-postgres";

const TEAM_NORTH = "TEAM-NORTH";
const TEAM_SOUTH = "TEAM-SOUTH";

/** Tables that hold, or point directly at, one identified patient's record. */
const PATIENT_BEARING_TABLES: readonly string[] = Object.freeze([
  "referrals",
  "plans",
  "contacts",
  "contact_dispatches",
  "cultural_identity_reports",
  "audit_events",
  "retention_state",
  "idempotency_records",
  "plan_assignments",
  "plan_reassignments",
  "pathway_version_approvals",
]);

let pool: Pool;

beforeAll(async () => {
  pool = createCaringContactsPool();
  await dropCaringContactsSchema(pool);
  await applyCaringContactsMigrations(pool);
}, 120_000);

afterAll(async () => {
  await pool?.end();
});

beforeEach(async () => {
  await truncateCaringContactsData(pool);
});

describe("caring-contact migrations", () => {
  it("replays without error, so a re-run of the migration set is safe", async () => {
    await applyCaringContactsMigrations(pool);
    const { rows } = await pool.query<{ count: string }>(
      "select count(*)::text as count from information_schema.tables where table_schema = 'caring_contacts'",
    );
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(12);
  });

  it("uses no CREATE INDEX CONCURRENTLY, which cannot run inside a migration transaction", () => {
    // Comments are stripped first: the migrations discuss the prohibition in prose, and a scan
    // that reads its own warning as a violation is a scan that reports the wrong thing.
    const withoutComments = (sql: string) => sql.replace(/--[^\n]*/g, "");
    const offences = caringContactsMigrations()
      .filter((migration) => /create\s+(unique\s+)?index\s+concurrently/i.test(withoutComments(migration.sql)))
      .map((migration) => migration.name);
    expect(offences).toEqual([]);

    // Positive control: the scanner does find the statement when it is really there.
    expect(withoutComments("create index concurrently x on y (z)")).toMatch(/create\s+index\s+concurrently/i);
  });

  it("declares every table the domain needs", async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'caring_contacts'",
    );
    const tables = rows.map((row) => row.table_name);
    for (const expected of [
      "teams",
      "actors",
      "referrals",
      "plans",
      "contacts",
      "pathway_versions",
      "audit_events",
      "service_state",
      "retention_state",
      "cultural_identity_reports",
      "pathway_version_approvals",
      "plan_assignments",
      "plan_reassignments",
      "notification_preferences",
      "training_records",
      "service_restart_approvals",
    ]) {
      expect(tables).toContain(expected);
    }
  });

  it("keeps cultural identity off the patient row and in its own reporting projection", async () => {
    const { rows: onPlans } = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'caring_contacts' and table_name in ('plans', 'contacts', 'referrals')
         and column_name ilike '%cultural%'`,
    );
    expect(onPlans).toEqual([]);

    const { rows: projection } = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'caring_contacts' and table_name = 'cultural_identity_reports'`,
    );
    expect(projection.map((row) => row.column_name)).toContain("cultural_identity");
  });

  it("enables and forces row-level security on every patient-bearing table", async () => {
    const { rows } = await pool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'caring_contacts' and c.relkind = 'r'`,
    );
    const byName = new Map(rows.map((row) => [row.relname, row]));
    for (const table of PATIENT_BEARING_TABLES) {
      expect(byName.get(table)?.relrowsecurity, `${table} row security`).toBe(true);
      expect(byName.get(table)?.relforcerowsecurity, `${table} forced row security`).toBe(true);
    }
  });

  describe("row-level security", () => {
    beforeEach(async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-N", patientId: "PATIENT-N" });
    });

    it("shows a team its own rows, so the denials below mean scoping and not absence", async () => {
      const rows = await runInTeamSession(pool, { teamId: TEAM_NORTH }, async (client) => {
        const result = await client.query("select id from caring_contacts.plans");
        return result.rows;
      });
      expect(rows.map((row) => row.id)).toEqual(["PLAN-N"]);
    });

    it("returns ZERO ROWS to another team, never an error that would reveal the row exists", async () => {
      const result = await runInTeamSession(pool, { teamId: TEAM_SOUTH }, async (client) => ({
        plans: (await client.query("select id from caring_contacts.plans")).rows,
        byId: (await client.query("select id from caring_contacts.plans where id = $1", ["PLAN-N"])).rows,
        contacts: (await client.query("select id from caring_contacts.contacts")).rows,
        audit: (await client.query("select id from caring_contacts.audit_events")).rows,
      }));

      expect(result.plans).toEqual([]);
      expect(result.byId).toEqual([]);
      expect(result.contacts).toEqual([]);
      expect(result.audit).toEqual([]);
    });

    it("refuses a cross-team write instead of silently rewriting another team's plan", async () => {
      const updated = await runInTeamSession(
        pool,
        { teamId: TEAM_SOUTH, auditToken: nextAuditToken() },
        async (client) => {
          await client.query("insert into caring_contacts.teams (id) values ($1) on conflict do nothing", [TEAM_SOUTH]);
          await insertAuditEvent(client, {
            teamId: TEAM_SOUTH,
            actorId: "ACTOR-SOUTH",
            actorRoles: ["coordinator"],
            action: "pausePlan",
            objectType: "plan",
            objectId: "PLAN-N",
            outcome: "denied",
            idempotencyKey: "cross-team",
          });
          const result = await client.query("update caring_contacts.plans set state = 'paused' where id = $1", [
            "PLAN-N",
          ]);
          return result.rowCount;
        },
      );
      expect(updated).toBe(0);

      const { rows } = await pool.query<{ state: string }>(
        "select state from caring_contacts.plans where id = 'PLAN-N'",
      );
      expect(rows[0].state).toBe("active");
    });

    it("denies an anonymous session: nothing readable, and nothing writable", async () => {
      const readable = await runInTeamSession(pool, { teamId: TEAM_NORTH, role: ANON_ROLE }, async (client) => ({
        plans: (await client.query("select id from caring_contacts.plans")).rows,
        contacts: (await client.query("select id from caring_contacts.contacts")).rows,
        audit: (await client.query("select id from caring_contacts.audit_events")).rows,
      }));
      expect(readable.plans).toEqual([]);
      expect(readable.contacts).toEqual([]);
      expect(readable.audit).toEqual([]);

      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH, role: ANON_ROLE, auditToken: nextAuditToken() }, (client) =>
          client.query("update caring_contacts.plans set state = 'paused' where id = 'PLAN-N'"),
        ),
      ).rejects.toThrow(/permission denied/i);
    });

    it("denies a session that names no team at all", async () => {
      const rows = await runInTeamSession(pool, { teamId: null }, async (client) => {
        const result = await client.query("select id from caring_contacts.plans");
        return result.rows;
      });
      expect(rows).toEqual([]);
    });
  });

  describe("one non-terminal plan per patient", () => {
    it("refuses a second active plan for the same patient", async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-1", patientId: "PATIENT-1" });

      await expect(seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-2", patientId: "PATIENT-1" })).rejects.toThrow(
        /plans_one_non_terminal_per_patient/,
      );
    });

    it("refuses a second active plan raised by a different team", async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-1", patientId: "PATIENT-1" });

      await expect(seedPlan(pool, { teamId: TEAM_SOUTH, planId: "PLAN-2", patientId: "PATIENT-1" })).rejects.toThrow(
        /plans_one_non_terminal_per_patient/,
      );
    });

    it("allows a new plan once the previous one has ended", async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-1", patientId: "PATIENT-1", state: "withdrawn" });
      await expect(
        seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-2", patientId: "PATIENT-1" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("one dispatch record per contact attempt", () => {
    beforeEach(async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-N", patientId: "PATIENT-N" });
    });

    async function recordDispatch(attempt: number): Promise<void> {
      await runInTeamSession(pool, { teamId: TEAM_NORTH, auditToken: nextAuditToken() }, async (client) => {
        await insertAuditEvent(client, {
          teamId: TEAM_NORTH,
          actorId: "SYSTEM-DISPATCHER",
          actorRoles: ["contactDispatcher"],
          action: "startContactDispatch",
          objectType: "contact",
          objectId: "PLAN-N--contact-1",
          outcome: "allowed",
          idempotencyKey: `dispatch-${attempt}`,
        });
        await client.query(
          `insert into caring_contacts.contact_dispatches (contact_id, team_id, attempt, idempotency_key)
           values ($1, $2, $3, $4)`,
          ["PLAN-N--contact-1", TEAM_NORTH, attempt, `dispatch-${attempt}`],
        );
      });
    }

    it("accepts successive attempts for one contact", async () => {
      await recordDispatch(1);
      await expect(recordDispatch(2)).resolves.toBeUndefined();
    });

    it("refuses a duplicate dispatch record for the same contact and attempt", async () => {
      await recordDispatch(1);
      await expect(recordDispatch(1)).rejects.toThrow(/contact_dispatches_unique_attempt/);
    });
  });

  describe("audit insertion happens in the same transaction as the change", () => {
    beforeEach(async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-N", patientId: "PATIENT-N" });
    });

    it("accepts a change that writes its audit event in the same transaction", async () => {
      await runInTeamSession(pool, { teamId: TEAM_NORTH, auditToken: nextAuditToken() }, async (client) => {
        await insertAuditEvent(client, {
          teamId: TEAM_NORTH,
          actorId: "ACTOR-1",
          actorRoles: ["coordinator"],
          action: "pausePlan",
          objectType: "plan",
          objectId: "PLAN-N",
          outcome: "allowed",
          idempotencyKey: "audited-pause",
        });
        await client.query("update caring_contacts.plans set state = 'paused', version = 2 where id = 'PLAN-N'");
      });

      const { rows } = await pool.query<{ state: string }>(
        "select state from caring_contacts.plans where id = 'PLAN-N'",
      );
      expect(rows[0].state).toBe("paused");
    });

    it("REFUSES a direct update that writes no audit event, and leaves the row untouched", async () => {
      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH, auditToken: nextAuditToken() }, (client) =>
          client.query("update caring_contacts.plans set state = 'paused', version = 2 where id = 'PLAN-N'"),
        ),
      ).rejects.toThrow(/caring-contacts-audit-required/);

      const { rows } = await pool.query<{ state: string; version: number }>(
        "select state, version from caring_contacts.plans where id = 'PLAN-N'",
      );
      expect(rows[0]).toMatchObject({ state: "active", version: 1 });
    });

    it("REFUSES a change made outside an audited transaction at all", async () => {
      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH }, (client) =>
          client.query("update caring_contacts.contacts set state = 'cancelled', version = 2 where plan_id = 'PLAN-N'"),
        ),
      ).rejects.toThrow(/caring-contacts-audit-required/);

      const { rows } = await pool.query<{ state: string }>(
        "select state from caring_contacts.contacts where plan_id = 'PLAN-N'",
      );
      expect(rows.every((row) => row.state === "scheduled")).toBe(true);
    });

    it("REFUSES a delete that writes no audit event", async () => {
      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH }, (client) =>
          client.query("delete from caring_contacts.contacts where plan_id = 'PLAN-N'"),
        ),
      ).rejects.toThrow(/caring-contacts-audit-required/);

      const { rows } = await pool.query<{ count: string }>(
        "select count(*)::text as count from caring_contacts.contacts where plan_id = 'PLAN-N'",
      );
      expect(Number(rows[0].count)).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Migration 0003 — the workspace schema.
//
// Every assertion below is made against the RUNNING DATABASE as `caring_contacts_app`, never by
// reading the SQL text and never as the migration superuser. A superuser bypasses row-level
// security outright, and a regex over a migration file proves that a string was written rather
// than that the database refuses anything.
// ---------------------------------------------------------------------------
describe("the workspace schema", () => {
  const STOP_ONE = "11111111-1111-4111-8111-111111111111";
  const STOP_TWO = "22222222-2222-4222-8222-222222222222";

  const RESTART_APPROVERS = Object.freeze([
    { role: "incidentLead", actorId: "ACTOR-INCIDENT-LEAD" },
    { role: "privacySecurityOwner", actorId: "ACTOR-PRIVACY-OWNER" },
    { role: "clinicalProgrammeLead", actorId: "ACTOR-PROGRAMME-LEAD" },
  ] as const);

  async function registerTeam(teamId: string): Promise<void> {
    await runInTeamSession(pool, { teamId, auditToken: nextAuditToken() }, async (client) => {
      await client.query("insert into caring_contacts.teams (id) values ($1) on conflict do nothing", [teamId]);
    });
  }

  /** Records a stop against the singleton row, upserting because there is only ever one row. */
  async function recordStop(teamId: string, stopId: string): Promise<void> {
    await registerTeam(teamId);
    await runInTeamSession(pool, { teamId, auditToken: nextAuditToken() }, async (client) => {
      await insertAuditEvent(client, {
        teamId,
        actorId: "ACTOR-RESPONDER",
        actorRoles: ["teamLead"],
        action: "stopService",
        objectType: "service",
        objectId: stopId,
        outcome: "allowed",
        idempotencyKey: `stop-${stopId}`,
      });
      await client.query(
        `insert into caring_contacts.service_state
           (stopped, stopped_by, stopped_at, reported_by_team_id, stop_id, stopped_reason, stop_note, updated_at)
         values (true, 'ACTOR-RESPONDER', now(), $1, $2, 'wrong-recipient', 'A message reached the wrong number.', now())
         on conflict (singleton) do update set
           stopped = true,
           stopped_by = excluded.stopped_by,
           stopped_at = excluded.stopped_at,
           reported_by_team_id = excluded.reported_by_team_id,
           stop_id = excluded.stop_id,
           stopped_reason = excluded.stopped_reason,
           stop_note = excluded.stop_note,
           updated_at = excluded.updated_at`,
        [teamId, stopId],
      );
    });
  }

  async function restartService(teamId: string): Promise<void> {
    await runInTeamSession(pool, { teamId, auditToken: nextAuditToken() }, async (client) => {
      await insertAuditEvent(client, {
        teamId,
        actorId: "ACTOR-RESPONDER",
        actorRoles: ["teamLead"],
        action: "restartService",
        objectType: "service",
        objectId: "service",
        outcome: "allowed",
        idempotencyKey: "restart-service",
      });
      await client.query(
        `update caring_contacts.service_state
         set stopped = false, stop_id = null, stopped_reason = null, stop_note = null, updated_at = now()`,
      );
    });
  }

  async function approveRestart(teamId: string, stopId: string, role: string, actorId: string): Promise<void> {
    await runInTeamSession(pool, { teamId, auditToken: nextAuditToken() }, async (client) => {
      await insertAuditEvent(client, {
        teamId,
        actorId,
        actorRoles: ["teamLead"],
        action: "approveServiceRestart",
        objectType: "service",
        objectId: stopId,
        outcome: "allowed",
        idempotencyKey: `approve-${stopId}-${role}-${actorId}`,
      });
      await client.query(
        `insert into caring_contacts.service_restart_approvals
           (stop_id, role, actor_id, approved_at, approved_by_team_id)
         values ($1, $2, $3, now(), $4)`,
        [stopId, role, actorId, teamId],
      );
    });
  }

  /** Inserts a plan naming the referral and pathway version given, creating no parent rows. */
  async function insertPlanNaming(options: {
    teamId: string;
    planId: string;
    patientId: string;
    referralId: string;
    pathwayVersionId: string;
  }): Promise<void> {
    await runInTeamSession(pool, { teamId: options.teamId, auditToken: nextAuditToken() }, async (client) => {
      await insertAuditEvent(client, {
        teamId: options.teamId,
        actorId: "ACTOR-COORDINATOR",
        actorRoles: ["coordinator"],
        action: "createPlan",
        objectType: "plan",
        objectId: options.planId,
        outcome: "allowed",
        idempotencyKey: `create-${options.planId}`,
      });
      await client.query(
        `insert into caring_contacts.plans
           (id, team_id, patient_id, referral_id, pathway_version_id, state, version, outcome,
            discharge_at, sending_preference, patient_name, patient_mobile_number, patient_identifiers)
         values ($1, $2, $3, $4, $5, 'active', 1, 'inProgress', '2026-03-02T02:00:00.000Z', 'morning',
                 'Seed Patient', '+61 491 570 156', array['UR-1'])`,
        [options.planId, options.teamId, options.patientId, options.referralId, options.pathwayVersionId],
      );
    });
  }

  async function claimAssignment(teamId: string, planId: string, ownerId: string): Promise<void> {
    await runInTeamSession(pool, { teamId, auditToken: nextAuditToken() }, async (client) => {
      await insertAuditEvent(client, {
        teamId,
        actorId: ownerId,
        actorRoles: ["coordinator"],
        action: "claimPlan",
        objectType: "plan",
        objectId: planId,
        outcome: "allowed",
        idempotencyKey: `claim-${planId}-${ownerId}`,
      });
      await client.query(
        `insert into caring_contacts.plan_assignments
           (plan_id, team_id, owner_id, claimed_at, coverage_from, coverage_until)
         values ($1, $2, $3, now(), '2026-03-02', '2026-03-09')`,
        [planId, teamId, ownerId],
      );
    });
  }

  it("keeps every caring-contact migration out of the Clinical KB migration directory", () => {
    const caringContactMigrations = readdirSync(path.join(process.cwd(), "caring-contacts", "supabase", "migrations"));
    expect(caringContactMigrations).toContain("0003_caring_contacts_workspace.sql");
    const repositoryMigrations = readdirSync(path.join(process.cwd(), "supabase", "migrations"));
    for (const file of caringContactMigrations) {
      expect(repositoryMigrations).not.toContain(file);
    }
  });

  describe("the service stop is a singleton, not one row per team", () => {
    it("refuses a second service_state row outright", async () => {
      await recordStop(TEAM_NORTH, STOP_ONE);

      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH, auditToken: nextAuditToken() }, (client) =>
          client.query(
            `insert into caring_contacts.service_state
               (stopped, stopped_by, stopped_at, reported_by_team_id, stop_id, stopped_reason)
             values (true, 'ACTOR-OTHER', now(), $1, $2, 'duplicate-send')`,
            [TEAM_NORTH, STOP_TWO],
          ),
        ),
      ).rejects.toThrow(/service_state_pkey/);
    });

    it("refuses a row that tries to escape the singleton key", async () => {
      await recordStop(TEAM_NORTH, STOP_ONE);

      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH, auditToken: nextAuditToken() }, (client) =>
          client.query(
            `insert into caring_contacts.service_state
               (singleton, stopped, stopped_by, stopped_at, reported_by_team_id, stop_id, stopped_reason)
             values (false, true, 'ACTOR-OTHER', now(), $1, $2, 'duplicate-send')`,
            [TEAM_NORTH, STOP_TWO],
          ),
        ),
      ).rejects.toThrow(/service_state_is_singleton/);
    });

    it("shows a stop raised by one team to EVERY other team", async () => {
      // Contrast this deliberately with "returns ZERO ROWS to another team" above: a plan raised by
      // TEAM-NORTH is invisible to TEAM-SOUTH, and that is the whole point of the team-scope policy.
      // The service stop is the one thing that must NOT behave that way. A team-scoped stop would
      // read as "the service is running" to every team but the one that reported the incident,
      // while the sending path they had all been told to halt kept running.
      await registerTeam(TEAM_SOUTH);
      await recordStop(TEAM_NORTH, STOP_ONE);

      const rows = await runInTeamSession(pool, { teamId: TEAM_SOUTH }, async (client) => {
        const result = await client.query<{ stopped: boolean; reported_by_team_id: string }>(
          "select stopped, reported_by_team_id from caring_contacts.service_state",
        );
        return result.rows;
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].stopped).toBe(true);
      expect(rows[0].reported_by_team_id).toBe(TEAM_NORTH);
    });

    it("still shows a session that names NO team nothing at all", async () => {
      await recordStop(TEAM_NORTH, STOP_ONE);

      const rows = await runInTeamSession(pool, { teamId: null }, async (client) => {
        const result = await client.query("select stopped from caring_contacts.service_state");
        return result.rows;
      });

      expect(rows).toEqual([]);
    });
  });

  describe("restart approvals are keyed on the stop, never on the team", () => {
    it("refuses a second approval from the same person under a different role", async () => {
      await recordStop(TEAM_NORTH, STOP_ONE);
      await approveRestart(TEAM_NORTH, STOP_ONE, "incidentLead", "ACTOR-X");

      await expect(approveRestart(TEAM_NORTH, STOP_ONE, "privacySecurityOwner", "ACTOR-X")).rejects.toThrow(
        /service_restart_approvals_unique_stop_actor/,
      );
    });

    it("refuses a second approval in the same role from a different person", async () => {
      await recordStop(TEAM_NORTH, STOP_ONE);
      await approveRestart(TEAM_NORTH, STOP_ONE, "incidentLead", "ACTOR-X");

      await expect(approveRestart(TEAM_NORTH, STOP_ONE, "incidentLead", "ACTOR-Y")).rejects.toThrow(
        /service_restart_approvals_unique_stop_role/,
      );
    });

    it("lets the SAME three people approve a LATER stop", async () => {
      // Keyed on the team, the approvals recorded for a first incident would permanently bar their
      // approvers from approving any later one, so a team's second incident could never be
      // restarted. Keyed on the stop, "three different people per restart" holds per incident.
      await recordStop(TEAM_NORTH, STOP_ONE);
      for (const approver of RESTART_APPROVERS) {
        await approveRestart(TEAM_NORTH, STOP_ONE, approver.role, approver.actorId);
      }
      await restartService(TEAM_NORTH);

      await recordStop(TEAM_NORTH, STOP_TWO);
      for (const approver of RESTART_APPROVERS) {
        await expect(approveRestart(TEAM_NORTH, STOP_TWO, approver.role, approver.actorId)).resolves.toBeUndefined();
      }

      const { rows } = await pool.query<{ count: string }>(
        "select count(*)::text as count from caring_contacts.service_restart_approvals",
      );
      expect(Number(rows[0].count)).toBe(6);
    });
  });

  describe("a plan may only name a referral and pathway version that exist, in its own team", () => {
    beforeEach(async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-N", patientId: "PATIENT-N" });
    });

    it("refuses a plan whose pathway version has no parent row", async () => {
      await expect(
        insertPlanNaming({
          teamId: TEAM_NORTH,
          planId: "PLAN-BAD-PATHWAY",
          patientId: "PATIENT-BAD-PATHWAY",
          referralId: "PLAN-N-REFERRAL",
          pathwayVersionId: "PATHWAY-THAT-WAS-NEVER-CREATED",
        }),
      ).rejects.toThrow(/plans_pathway_version_fk/);
    });

    it("refuses a plan whose referral has no parent row", async () => {
      await expect(
        insertPlanNaming({
          teamId: TEAM_NORTH,
          planId: "PLAN-BAD-REFERRAL",
          patientId: "PATIENT-BAD-REFERRAL",
          referralId: "REFERRAL-THAT-WAS-NEVER-CREATED",
          pathwayVersionId: "PLAN-N-PATHWAY",
        }),
      ).rejects.toThrow(/plans_referral_fk/);
    });

    it("refuses a plan that reaches across teams for its referral", async () => {
      // Foreign-key checks are performed by the system and are NOT subject to row-level security,
      // so a bare key would happily let TEAM-NORTH's plan point at TEAM-SOUTH's referral. The key
      // is composite so the team travels with the link.
      await seedPlan(pool, { teamId: TEAM_SOUTH, planId: "PLAN-S", patientId: "PATIENT-S" });

      await expect(
        insertPlanNaming({
          teamId: TEAM_NORTH,
          planId: "PLAN-CROSS-TEAM",
          patientId: "PATIENT-CROSS-TEAM",
          referralId: "PLAN-S-REFERRAL",
          pathwayVersionId: "PLAN-N-PATHWAY",
        }),
      ).rejects.toThrow(/plans_referral_fk/);
    });

    it("accepts a plan whose referral and pathway version both belong to its own team", async () => {
      await expect(
        insertPlanNaming({
          teamId: TEAM_NORTH,
          planId: "PLAN-SECOND",
          patientId: "PATIENT-SECOND",
          referralId: "PLAN-N-REFERRAL",
          pathwayVersionId: "PLAN-N-PATHWAY",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("the new workspace tables carry the same guarantees as the old ones", () => {
    beforeEach(async () => {
      await seedPlan(pool, { teamId: TEAM_NORTH, planId: "PLAN-N", patientId: "PATIENT-N" });
    });

    it("returns ZERO ROWS from plan_assignments to another team", async () => {
      await claimAssignment(TEAM_NORTH, "PLAN-N", "ACTOR-NORTH");
      await registerTeam(TEAM_SOUTH);

      const rows = await runInTeamSession(pool, { teamId: TEAM_SOUTH }, async (client) => {
        const result = await client.query("select plan_id from caring_contacts.plan_assignments");
        return result.rows;
      });

      expect(rows).toEqual([]);
    });

    it("shows a team its own assignment, so the denial above means scoping and not absence", async () => {
      await claimAssignment(TEAM_NORTH, "PLAN-N", "ACTOR-NORTH");

      const rows = await runInTeamSession(pool, { teamId: TEAM_NORTH }, async (client) => {
        const result = await client.query<{ plan_id: string }>("select plan_id from caring_contacts.plan_assignments");
        return result.rows;
      });

      expect(rows.map((row) => row.plan_id)).toEqual(["PLAN-N"]);
    });

    it("REFUSES an assignment written with no audit event in the same transaction", async () => {
      await expect(
        runInTeamSession(pool, { teamId: TEAM_NORTH, auditToken: nextAuditToken() }, (client) =>
          client.query(
            `insert into caring_contacts.plan_assignments (plan_id, team_id, owner_id, claimed_at)
             values ('PLAN-N', $1, 'ACTOR-NORTH', now())`,
            [TEAM_NORTH],
          ),
        ),
      ).rejects.toThrow(/caring-contacts-audit-required/);

      const { rows } = await pool.query<{ count: string }>(
        "select count(*)::text as count from caring_contacts.plan_assignments",
      );
      expect(Number(rows[0].count)).toBe(0);
    });

    it("keeps coverage windows as AWST calendar days rather than instants", async () => {
      const { rows } = await pool.query<{ column_name: string; data_type: string }>(
        `select column_name, data_type from information_schema.columns
         where table_schema = 'caring_contacts' and table_name = 'plan_assignments'
           and column_name in ('coverage_from', 'coverage_until')
         order by column_name`,
      );
      expect(rows).toEqual([
        { column_name: "coverage_from", data_type: "text" },
        { column_name: "coverage_until", data_type: "text" },
      ]);
    });
  });
});
