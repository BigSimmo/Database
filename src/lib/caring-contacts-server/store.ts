// src/lib/caring-contacts-server/store.ts
//
// The one place route handlers ask for a caring-contact store. Picks the store the same way the
// rest of this seam works: postgres when CARING_CONTACTS_DATABASE_URL is configured (and cleared
// by assertNotClinicalKbProject), the in-memory reference store otherwise -- so the workspace runs
// with no database at all. That in-memory fallback is what the demo and this repository's offline
// test suite run against.
//
// Memoised at module scope, built lazily on the first call. Two reasons, not one:
//   * the Postgres branch would otherwise build a brand-new `pg.Pool` on every call -- and once a
//     route handler calls this per request (Task 14+), that is unbounded connection growth with
//     nothing ever ending a pool;
//   * the in-memory branch holds the workspace's only copy of its data (Maps in
//     ../caring-contacts/in-memory-repository.ts). An unmemoised call would hand back a fresh,
//     empty store on every request, and nothing written by one request would ever be visible to
//     the next -- silently breaking the demo, not just wasting resources.
// Node's module cache makes the single `cachedStore` below a process-wide singleton. The
// Clinical-KB-separation guard still runs before a pool is ever constructed, including on this
// first call -- memoisation only means it runs once, never that it is skipped.
import "server-only";

import { systemClock } from "@/lib/caring-contacts/clock";
import { createPostgresRepository } from "@/lib/caring-contacts/db/postgres-repository";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository } from "@/lib/caring-contacts/repository";

import { assertNotClinicalKbProject, caringContactsDatabaseUrl } from "./config";
import { createCaringContactsPool } from "./pool";

let cachedStore: Promise<CaringContactRepository> | null = null;

export async function caringContactsStore(): Promise<CaringContactRepository> {
  if (!cachedStore) {
    cachedStore = buildStore();
  }
  return cachedStore;
}

async function buildStore(): Promise<CaringContactRepository> {
  const url = caringContactsDatabaseUrl();
  if (!url) {
    return createInMemoryRepository(systemClock());
  }

  // Kept alongside createCaringContactsPool's own internal check -- defence in depth on the one
  // path that ever constructs a pool, not a substitute for it.
  assertNotClinicalKbProject(url);
  const pool = createCaringContactsPool(url);
  return createPostgresRepository(pool, systemClock());
}
