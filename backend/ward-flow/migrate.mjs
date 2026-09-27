import { readFile } from 'node:fs/promises';
import { readConfig } from './config.mjs';
import { createStore, openDatabase } from './database.mjs';

let pool;
try {
  const config = readConfig();
  const apply = process.argv.includes('--apply');
  const check = process.argv.includes('--check');
  if (apply === check) throw new Error('Select exactly one migration action');
  const adminUser = process.env.WARD_PG_ADMIN_USER;
  if (apply && !adminUser?.trim()) throw new Error('An Entra database administrator is required');
  pool = await openDatabase({ ...config.database, user: apply ? adminUser : config.database.user });
  if (apply) {
    // Run only from a VNet-connected client signed in as the existing database administrator.
    await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  }
  if (apply) {
    const result = await pool.query('SELECT version FROM ward_flow.schema_version WHERE version = 1');
    if (result.rows.length !== 1) throw new Error('Schema verification failed');
  } else {
    await createStore(pool).ready();
  }
  console.log(apply ? 'Database schema applied and version verified' : 'Backend identity and schema verified');
} catch {
  console.error('Database connection/schema unavailable. Check private network access, Entra identity and database grants.');
  process.exitCode = 1;
} finally { await pool?.end(); }
