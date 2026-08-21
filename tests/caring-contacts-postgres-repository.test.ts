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
import { afterAll, afterEach, beforeAll } from "vitest";

import { createPostgresRepository } from "@/lib/caring-contacts/db/postgres-repository";

import { describeCaringContactRepositoryContract } from "./helpers/caring-contacts-repository-contract";
import {
  applyCaringContactsMigrations,
  createCaringContactsPool,
  dropCaringContactsSchema,
  poolAsSqlConnectionPool,
  truncateCaringContactsData,
} from "./helpers/caring-contacts-postgres";

let pool: Pool;

beforeAll(async () => {
  pool = createCaringContactsPool();
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
