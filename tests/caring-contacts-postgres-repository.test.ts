// tests/caring-contacts-postgres-repository.test.ts
//
// The SAME store contract as tests/caring-contacts-repository.test.ts, run against the Postgres
// implementation. One suite, two factories: every proof made in Tasks 9 and 10 was made against
// the in-memory store, and duplicating the tests would let the two stores drift apart exactly
// where the drift is least visible and most dangerous.
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
