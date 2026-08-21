// src/lib/caring-contacts-server/pool.ts
//
// Adapts a `pg` connection pool to the driver-free `SqlConnectionPool` abstraction the Postgres
// caring-contact store takes (../caring-contacts/db/postgres-repository.ts keeps the sealed
// domain itself free of a `pg` dependency). `withConnection` holds ONE connection for the whole
// callback -- every store transaction spans several statements, and a pool that handed a
// different connection to each one would break both the transaction and the transaction-local
// team scope it depends on. This mirrors the adapter tests/helpers/caring-contacts-postgres.ts
// uses for the contract suite, so the two never drift on what "one connection per transaction"
// means.
import "server-only";

import { Pool } from "pg";

import type { SqlConnectionPool, SqlRow } from "@/lib/caring-contacts/db/postgres-repository";

export function createCaringContactsPool(url: string): SqlConnectionPool {
  const pool = new Pool({ connectionString: url });
  return {
    async withConnection(work) {
      const client = await pool.connect();
      try {
        return await work({
          async query(text, values) {
            const result = await client.query(text, values ? [...values] : undefined);
            return { rows: result.rows as SqlRow[], rowCount: result.rowCount ?? 0 };
          },
        });
      } finally {
        client.release();
      }
    },
  };
}
