/**
 * Shared normalization for migration SQL bodies.
 *
 * Two independent contracts need the same answer to "does this file execute
 * anything?" — `tests/migration-history-placeholders.test.ts` (every no-op
 * migration must be declared) and `tests/migration-history-guards.test.ts`
 * (a `no_ddl` drift-allowlist guard must point at a genuinely empty file).
 * Keeping one implementation is what stops those two drifting into disagreeing
 * about the same file.
 */

/** Comments removed, whitespace collapsed. */
export function stripMigrationSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The three shapes a deliberately inert migration takes in this repository.
 * `comment_only` files carry an explanatory header and nothing else;
 * `select_1` and `select_1_where_false` are neutralized bodies kept so remote
 * history keeps a matching local file. Anything else is `executable` — it
 * changes the database and is not a placeholder.
 */
export type MigrationBodyKind = "comment_only" | "select_1" | "select_1_where_false" | "executable";

export function classifyMigrationBody(sql: string): MigrationBodyKind {
  const body = stripMigrationSql(sql);
  if (body === "") return "comment_only";
  if (/^select\s+1\s*;?$/i.test(body)) return "select_1";
  if (/^select\s+1\s+where\s+false\s*;?$/i.test(body)) return "select_1_where_false";
  return "executable";
}

/** True when the file records history but applies no DDL and no data change. */
export function hasNoExecutableSql(sql: string): boolean {
  return classifyMigrationBody(sql) !== "executable";
}
