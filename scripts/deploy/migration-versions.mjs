/**
 * Shared migration-version parsing for the deploy pre-deploy gate
 * (`scripts/deploy/await-migrations.mjs`) and the live migration-history
 * checker (`scripts/check-migration-history-alignment.ts`). Both need the same
 * answer to "what version does this file on disk represent" and "what is
 * missing" — extracted here so the two implementations cannot drift apart.
 */
import { readdirSync } from "node:fs";

/** Matches a supabase/migrations file name: `<14-digit-timestamp>_<name>.sql`. */
export const MIGRATION_VERSION_PATTERN = /^(\d{14})_.*\.sql$/;

/**
 * List the migration versions present in a `supabase/migrations`-shaped
 * directory, sorted ascending. Non-matching file names (README, `.gitkeep`,
 * etc.) are ignored rather than failing the read.
 *
 * @param {string} migrationsDir
 * @returns {string[]}
 */
export function listLocalMigrationVersions(migrationsDir) {
  const versions = readdirSync(migrationsDir)
    .map((name) => MIGRATION_VERSION_PATTERN.exec(name)?.[1] ?? null)
    .filter((version) => version !== null);
  return /** @type {string[]} */ (versions).sort();
}

/**
 * Expected versions absent from the live set, sorted ascending.
 *
 * Live-only extras (versions present live but not expected) are deliberately
 * ignored: an older-commit redeploy or a rollback legitimately expects fewer
 * versions than live history already holds, and that must not be treated as a
 * gate failure.
 *
 * @param {Iterable<string>} expected
 * @param {Iterable<string>} live
 * @returns {string[]}
 */
export function missingVersions(expected, live) {
  const liveSet = new Set(live);
  return [...new Set(expected)].filter((version) => !liveSet.has(version)).sort();
}
