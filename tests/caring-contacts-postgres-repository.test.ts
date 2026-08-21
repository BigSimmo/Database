// tests/caring-contacts-postgres-repository.test.ts
//
// The SAME store contract as tests/caring-contacts-repository.test.ts, run against the Postgres
// implementation. One suite, two factories: every proof made in Tasks 9 and 10 was made against
// the in-memory store, and duplicating the tests would let the two stores drift apart exactly
// where the drift is least visible and most dangerous.
//
// Note what this file NO LONGER does. Task 11a gave it a `beforeEach` that pre-created the referral
// and pathway version every contract fixture names, plus a call clearing the audit trail those
// inserts produced, because migration 0003 made both links same-team foreign keys while the
// Postgres store still had no `createReferral` or `savePathwayVersion` to create them with. That
// scaffolding meant the two contract runs started from DIFFERENT preconditions and the contract
// could no longer prove this store validates its own parents. Task 11b implemented both methods, so
// the contract now creates its parents through the repository and the scaffolding is gone. Do not
// reintroduce it: a fixture that reaches around the store is a fixture the store is not being
// tested by.
//
// Needs a real Postgres named by CARING_CONTACTS_DATABASE_URL. It never skips — see
// caring-contacts/run-db-tests.mjs.
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fixedClock } from "@/lib/caring-contacts/clock";
import { createPostgresRepository } from "@/lib/caring-contacts/db/postgres-repository";
import { actorId, idempotencyKey, teamId } from "@/lib/caring-contacts/ids";
import type { Actor } from "@/lib/caring-contacts/permissions";

import { describeCaringContactRepositoryContract } from "./helpers/caring-contacts-repository-contract";
import {
  applyCaringContactsMigrations,
  createCaringContactsTestPool,
  dropCaringContactsSchema,
  poolAsSqlConnectionPool,
  truncateCaringContactsData,
} from "./helpers/caring-contacts-postgres";

let pool: Pool;

beforeAll(async () => {
  pool = createCaringContactsTestPool();
  await dropCaringContactsSchema(pool);
  await applyCaringContactsMigrations(pool);
}, 120_000);

// Each contract test builds its own store and expects an empty one. The schema is shared, so the
// rows are cleared between tests rather than the schema being rebuilt.
afterEach(async () => {
  await truncateCaringContactsData(pool);
});

afterAll(async () => {
  await pool?.end();
});

describeCaringContactRepositoryContract("postgres", (clock, options) =>
  createPostgresRepository(poolAsSqlConnectionPool(pool), clock, options),
);

// ---------------------------------------------------------------------------
// The reachability control for the shared contract's first-ever-stop race.
//
// That test asserts the BEHAVIOUR both stores owe: exactly one of two simultaneous first stops
// wins. What it cannot assert is that the race window was entered at all. If the two writes were
// ever serialised, the loser would be refused by the DOMAIN check rather than by the store's
// guarded singleton upsert, and the test would pass unchanged -- failing open into meaninglessness
// rather than going red. The two cases are indistinguishable by refusal reason on purpose: the
// guard deliberately answers with the reason the domain gives, so the stores cannot drift on the
// wire text. The control therefore has to come from somewhere else.
//
// It comes from the incident history. A loser that genuinely reached the window has already
// written its own `service_stops` row before losing the singleton; a serialised loser is refused before
// writing one. So TWO rows means the race happened. That table exists in one store only, which is
// why this half lives here rather than in the shared contract -- and why neither half is redundant.
// ---------------------------------------------------------------------------
describe("the first-ever-stop race is genuinely reached (postgres only)", () => {
  /** 2026-03-02 11:00 AWST, the instant the shared contract fixes its own clock to. */
  const NOW = "2026-03-02T03:00:00.000Z";

  const NORTH: Actor = {
    id: actorId("RACE-ACTOR-NORTH"),
    teamId: teamId("RACE-TEAM-NORTH"),
    roles: ["coordinator"],
  };
  const SOUTH: Actor = {
    id: actorId("RACE-ACTOR-SOUTH"),
    teamId: teamId("RACE-TEAM-SOUTH"),
    roles: ["coordinator"],
  };

  it("leaves two incident rows, proving both writers entered the window", async () => {
    const store = createPostgresRepository(poolAsSqlConnectionPool(pool), fixedClock(NOW));

    // Warm one pooled connection per caller, so neither spends its head start opening one. Two
    // TEAMS, not two actors: every write registers its own team first, and that insert queues a
    // second same-team writer until the first commits -- so same-team callers never reach the race.
    await Promise.all([store.getServiceState({ actor: NORTH }), store.getServiceState({ actor: SOUTH })]);

    const [first, second] = await Promise.all([
      store.stopService(
        { reason: "wrong-recipient", note: "the first responder's own account" },
        { actor: NORTH, idempotencyKey: idempotencyKey("race-control-north") },
      ),
      store.stopService(
        { reason: "duplicate-send", note: "a later account of something else entirely" },
        { actor: SOUTH, idempotencyKey: idempotencyKey("race-control-south") },
      ),
    ]);

    // The outcome, restated here only so a failure of the control below cannot be mistaken for a
    // failure of the behaviour the shared contract already pins.
    expect([first, second].filter((result) => result.ok)).toHaveLength(1);

    // THE CONTROL. Read as the migration role deliberately: whether the window was entered is a
    // question about the whole table, not about either team's scoped view of it.
    const incidents = await pool.query("select count(*)::int as recorded from caring_contacts.service_stops");
    expect(incidents.rows[0].recorded).toBe(2);
  });
});
