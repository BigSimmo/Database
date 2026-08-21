// src/lib/caring-contacts-server/store.ts
//
// The one place route handlers ask for a caring-contact store. Picks the store the same way the
// rest of this seam works: postgres when CARING_CONTACTS_DATABASE_URL is configured (and cleared
// by assertNotClinicalKbProject), the in-memory reference store otherwise -- so the workspace runs
// with no database at all. That in-memory fallback is what the demo and this repository's offline
// test suite run against.
import "server-only";

import { systemClock } from "@/lib/caring-contacts/clock";
import { createPostgresRepository } from "@/lib/caring-contacts/db/postgres-repository";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository } from "@/lib/caring-contacts/repository";

import { assertNotClinicalKbProject, caringContactsDatabaseUrl } from "./config";
import { createCaringContactsPool } from "./pool";

export async function caringContactsStore(): Promise<CaringContactRepository> {
  const url = caringContactsDatabaseUrl();
  if (!url) {
    return createInMemoryRepository(systemClock());
  }

  assertNotClinicalKbProject(url);
  const pool = createCaringContactsPool(url);
  return createPostgresRepository(pool, systemClock());
}
