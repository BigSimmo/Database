import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { classifyMigrationBody, hasNoExecutableSql } from "./helpers/migration-sql";

/**
 * Sixteen migration files execute nothing. Each one exists for a reason — remote
 * history recorded the version, so deleting the local file breaks Supabase Preview
 * sync with "Remote migration versions not found in local migrations directory" —
 * but "executes nothing" is also exactly what an accidentally-emptied migration
 * looks like, so every one of them has to be declared rather than assumed.
 *
 * The guard runs in BOTH directions:
 *   forward  — every declared version still has a local file, and that file still
 *              executes nothing (so neither deleting nor re-arming one is silent);
 *   reverse  — every file that executes nothing is declared here (so a seventeenth
 *              no-op migration cannot be added without saying why).
 *
 * The reverse pass is the half that was missing: before it, the list was checked
 * against the filesystem but the filesystem was never checked against the list, so
 * nothing on disk could fail this test. #DW3XK8.
 */

const migrationsDir = join(process.cwd(), "supabase/migrations");
const MIGRATION_FILE = /^(\d{14})_.*\.sql$/;

/**
 * Versions whose original file was renamed or renumbered away. Nothing carries the
 * version's own name any more, so a synthetic `_historical_version_placeholder.sql`
 * holds the slot for remote history.
 */
const KNOWN_ORPHAN_VERSIONS: Record<string, string> = {
  "20260713110000": "Renumbered away; placeholder holds the remote-history slot.",
  "20260713120000": "Renumbered away; placeholder holds the remote-history slot.",
  "20260713121000": "Renumbered away; placeholder holds the remote-history slot.",
  "20260713122000": "Renumbered away; placeholder holds the remote-history slot.",
  "20260717133000": "Renumbered away; placeholder holds the remote-history slot.",
  "20260718223000": "Renumbered away; placeholder holds the remote-history slot.",
};

/**
 * Versions that still carry their original file name, whose body was deliberately
 * emptied or neutralized. Unlike the orphans above, these files ARE represented by
 * a current migration filename prefix — the reason they execute nothing is written
 * in each file's own header, and is restated here so the reverse pass can be
 * fail-closed without re-reading prose.
 */
const NEUTRALIZED_MIGRATIONS: Record<string, string> = {
  "20260607183245":
    "Remote history placeholder — the equivalent schema changes are tracked in later consolidated migrations.",
  "20260614185707":
    "Remote history placeholder — the equivalent schema changes are tracked locally in 20260615001000_indexing_reliability_recovery.sql.",
  "20260620015106":
    "Remote history placeholder — the equivalent schema changes are tracked locally in 20260620000000_retrieval_accuracy_speed.sql.",
  "20260620021712":
    "Remote history placeholder — the equivalent schema changes are tracked locally in 20260616001000_ingestion_job_state_rpcs.sql.",
  "20260620021731":
    "Remote history placeholder — the equivalent schema changes are tracked locally in 20260616001000_ingestion_job_state_rpcs.sql.",
  "20260623125600":
    "Remote history placeholder — the equivalent schema changes are tracked locally in 20260623030000_api_rate_limits.sql.",
  "20260629100000":
    "Duplicate of 20260629060603_rag_queries_retention.sql; both versions reached remote history, so this one is kept inert to preserve ordering without re-running the purge function or cron schedule.",
  "20260702170000":
    "Neutralized match_document_chunks_text rewrite. It would ERROR (adding an output column to a set-returning function needs a DROP first) and would REGRESS the live function, which already carries the N+1 batching plus a superior title-boost path. Kept inert purely to preserve migration ordering.",
  "20260708160000":
    "Neutralized 2026-07-09. Supabase Preview branch mouqbgieqejpamctasbu (PR #433) recorded this stem; the transactional index creation lives in 20260708170000_ingestion_jobs_one_open_per_document.sql.",
  "20260709150000":
    "Neutralized 2026-07-13. Production recorded this ACL reconciliation under its generated version 20260709062443, which is in the repository; this later duplicate stem stays inert so branches that saw it keep monotonic history.",
};

function migrationFileNames(): string[] {
  return readdirSync(migrationsDir).filter((name) => MIGRATION_FILE.test(name));
}

function versionOf(fileName: string): string {
  return MIGRATION_FILE.exec(fileName)![1];
}

describe("migration history placeholders", () => {
  it("keeps a local sql file for every declared no-op version", () => {
    const versions = new Set(migrationFileNames().map(versionOf));
    const declared = [...Object.keys(KNOWN_ORPHAN_VERSIONS), ...Object.keys(NEUTRALIZED_MIGRATIONS)];

    const missing = declared.filter((version) => !versions.has(version));
    expect(
      missing,
      "a declared no-op version lost its local file — remote history still records it, so Supabase Preview " +
        "will fail with 'Remote migration versions not found in local migrations directory'",
    ).toEqual([]);
  });

  it("declares every migration that executes nothing", () => {
    const declared = new Set([...Object.keys(KNOWN_ORPHAN_VERSIONS), ...Object.keys(NEUTRALIZED_MIGRATIONS)]);
    const inert = migrationFileNames().filter((name) =>
      hasNoExecutableSql(readFileSync(join(migrationsDir, name), "utf8")),
    );

    // Anti-vacuous: the classifier must keep finding the whole declared population.
    // Sixteen files execute nothing as of 2026-09-02. A scan that finds fewer has
    // either broken or is looking at the wrong directory — either way it would then
    // pass the undeclared check below for the wrong reason.
    expect(
      inert.length,
      `fewer inert migrations (${inert.length}) than declarations (${declared.size}) — the classifier, the ` +
        "migrations path, or a declared file has changed; the undeclared check below cannot be trusted until this is",
    ).toBeGreaterThanOrEqual(declared.size);

    const undeclared = inert.filter((name) => !declared.has(versionOf(name)));
    expect(
      undeclared,
      "these migrations execute nothing and are not declared above. If that is deliberate, add the version to " +
        "NEUTRALIZED_MIGRATIONS with the reason from the file's own header. If it is not, the migration was " +
        "emptied by accident.",
    ).toEqual([]);
  });

  it("keeps every declared no-op migration inert", () => {
    const declared = new Set([...Object.keys(KNOWN_ORPHAN_VERSIONS), ...Object.keys(NEUTRALIZED_MIGRATIONS)]);
    const rearmed = migrationFileNames()
      .filter((name) => declared.has(versionOf(name)))
      .filter((name) => !hasNoExecutableSql(readFileSync(join(migrationsDir, name), "utf8")));

    expect(
      rearmed,
      "a migration declared as a no-op now carries executable SQL. Remote history already records these versions " +
        "as applied, so the new statements would never run on any database that has them — remove the declaration " +
        "and ship the change as a new migration instead.",
    ).toEqual([]);
  });

  it("every declaration carries a real reason", () => {
    const entries = [...Object.entries(KNOWN_ORPHAN_VERSIONS), ...Object.entries(NEUTRALIZED_MIGRATIONS)];
    const thin = entries.filter(([, reason]) => reason.trim().length <= 20).map(([version]) => version);
    expect(thin, "a declaration without an explanation is the same as no declaration").toEqual([]);
  });

  it("classifies the three inert shapes and does not swallow real DDL", () => {
    expect(classifyMigrationBody("-- Remote history placeholder.\n-- superseded.\n")).toBe("comment_only");
    expect(classifyMigrationBody("-- note\nselect 1;\n")).toBe("select_1");
    expect(classifyMigrationBody("-- note\nselect 1 where false;\n")).toBe("select_1_where_false");
    expect(classifyMigrationBody("/* block */\n")).toBe("comment_only");

    // The failure that matters: real DDL must never read as inert, including when
    // it sits under a header comment or beside a placeholder-looking statement.
    expect(classifyMigrationBody("create index if not exists x_idx on public.documents(id);")).toBe("executable");
    expect(
      classifyMigrationBody("-- SUPERSEDED\nselect 1;\ncreate index if not exists x_idx on public.documents(id);"),
    ).toBe("executable");
    expect(classifyMigrationBody("select 1 where true;")).toBe("executable");
    expect(hasNoExecutableSql("comment on table public.documents is 'x';")).toBe(false);
  });
});
