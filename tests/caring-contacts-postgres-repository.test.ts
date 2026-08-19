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
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { createPostgresRepository } from "@/lib/caring-contacts/db/postgres-repository";

import { describeCaringContactRepositoryContract } from "./helpers/caring-contacts-repository-contract";
import {
  applyCaringContactsMigrations,
  createCaringContactsPool,
  dropCaringContactsSchema,
  clearCaringContactsAuditEvents,
  poolAsSqlConnectionPool,
  seedPlanParents,
  truncateCaringContactsData,
} from "./helpers/caring-contacts-postgres";

let pool: Pool;

beforeAll(async () => {
  pool = createCaringContactsPool();
  await dropCaringContactsSchema(pool);
  await applyCaringContactsMigrations(pool);
}, 120_000);

// The referral and pathway version every contract fixture names. Migration 0003 made
// `plans.referral_id` and `plans.pathway_version_id` real same-team foreign keys, so a plan
// naming a referral nobody created is now refused by the database. The contract is store-agnostic
// and cannot create them itself until the Postgres store implements `createReferral` and
// `savePathwayVersion`, so the Postgres harness creates them here. No assertion is relaxed: this
// makes an invalid fixture valid, exactly as the same change did for `seedPlan`.
beforeEach(async () => {
  await seedPlanParents(pool, {
    teamId: "TEAM-NORTH",
    referralIds: ["REFERRAL-1", "REFERRAL-2"],
    pathwayVersionIds: ["PATHWAY-1"],
  });
  await seedPlanParents(pool, {
    teamId: "TEAM-SOUTH",
    referralIds: ["REFERRAL-3"],
    pathwayVersionIds: ["PATHWAY-2"],
  });
  // Seeding a referral is itself an audited change, so it writes an audit event. That event is
  // the fixture's bookkeeping and not part of what the store did, and the contract asserts on the
  // exact contents of the trail, so it is cleared before the test runs.
  await clearCaringContactsAuditEvents(pool);
});

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
