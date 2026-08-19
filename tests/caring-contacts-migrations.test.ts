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
