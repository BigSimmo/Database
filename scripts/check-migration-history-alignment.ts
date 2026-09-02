import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * Compare local supabase/migrations versions against live
 * supabase_migrations.schema_migrations.
 *
 * Hosted Supabase Preview fails with:
 *   "Remote migration versions not found in local migrations directory"
 * when the remote history table contains versions that are absent locally
 * (common after rename/renumber without history repair).
 *
 * This script prints remote-only / local-only versions and exits 1 when either
 * side is missing a version. It is intended for workflow_dispatch / live
 * alignment checks (uses service-role secrets).
 *
 * WHY LOCAL-ONLY IS ALSO FATAL: AGENTS.md makes "check:drift AND
 * check:migration-history green" the gate that a migration merged to main
 * actually reached production. check:drift compares the object inventory only,
 * so a migration whose effect is a pg_cron job row, a COMMENT ON, an ALTER
 * DATABASE SET, a data-only fix or a grant on a non-public schema leaves no
 * trace it can see. While a merged-but-unapplied version was merely printed as
 * "pending apply", both halves stayed green for that class — the #Q5JHBJ
 * failure shape this programme exists for. The push-triggered run can start
 * before the Supabase integration's apply (measured at 34 s), so pending
 * versions are re-read a bounded number of times before the run fails, and
 * `--allow-pending` remains available for a deliberate pre-apply check.
 *
 * TRANSPORT: the history table lives in the `supabase_migrations` schema, which
 * this project does not expose to the Data API — a direct PostgREST read returns
 * 406 PGRST106, so the original Accept-Profile read could never succeed here. It
 * went unnoticed until 2026-08-19 because the live-drift workflow's drift
 * comparison always failed first and skipped this step; once Phase 6.2 cleared
 * the last drift finding, this became the sole reason the job stayed red (and
 * pinned issue #1963 stayed open) against a clean database. The read now goes
 * through public.migration_history_versions(), a service-role-only security
 * definer RPC (migration 20260820120000), with the Accept-Profile read retained
 * as a fallback for any environment that does expose the schema. See
 * docs/database-drift-detection.md and docs/audit/live-drift-forensics-2026-08.md.
 */

export const MIGRATION_HISTORY_VERSIONS_MIGRATION = "20260820120000_migration_history_versions_rpc.sql";

type RemoteRow = { version: string; name: string | null };
type RemoteRead = { rows: RemoteRow[]; source: "rpc" | "accept-profile" };

export type AlignmentDiff = { remoteOnly: string[]; localOnly: string[] };

/** Number of history reads before pending versions are treated as unapplied. */
export const PENDING_SETTLE_ATTEMPTS = 4;
/** Wait between those reads; 4 attempts covers ~90 s against a ~34 s apply. */
export const PENDING_SETTLE_MS = 30_000;

export function parseAlignmentOptions(argv: string[]): { allowPending: boolean } {
  return { allowPending: argv.includes("--allow-pending") };
}

export function diffMigrationHistory(local: Iterable<string>, remote: Iterable<string>): AlignmentDiff {
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  return {
    remoteOnly: [...remoteSet].filter((version) => !localSet.has(version)).sort(),
    localOnly: [...localSet].filter((version) => !remoteSet.has(version)).sort(),
  };
}

function versionList(versions: string[]): string {
  return versions.length > 10
    ? `${versions.slice(0, 10).join(", ")}, … ${versions.length - 10} more`
    : versions.join(", ");
}

/**
 * The single verdict. Returns null only when the histories agree (or when
 * pending versions were explicitly allowed); never downgrades either side to a
 * warning.
 */
export function alignmentFailureMessage(diff: AlignmentDiff, options: { allowPending: boolean }): string | null {
  const problems: string[] = [];
  if (diff.remoteOnly.length > 0) {
    problems.push(
      `${diff.remoteOnly.length} remote migration version(s) are missing from supabase/migrations ` +
        `(${versionList(diff.remoteOnly)}). Hosted Supabase Preview will fail until local files exist ` +
        `for those versions (or remote history is repaired).`,
    );
  }
  if (!options.allowPending && diff.localOnly.length > 0) {
    problems.push(
      `${diff.localOnly.length} local migration version(s) are absent from live migration history ` +
        `(${versionList(diff.localOnly)}). A merged migration that never applied is silent drift: ` +
        `check:drift compares object state only, so effects outside that inventory (cron job rows, ` +
        `COMMENT ON, ALTER DATABASE SET, data-only fixes, grants on non-public schemas) leave no other ` +
        `signal. Re-run once the Supabase integration has applied them, or pass --allow-pending for a ` +
        `deliberate pre-apply check.`,
    );
  }
  return problems.length > 0 ? problems.join("\n") : null;
}

/**
 * Read live history, and when versions are still pending re-read a bounded
 * number of times: the live-drift run is triggered by the push that merges the
 * migration, so it can legitimately observe history a few seconds before the
 * integration applies it.
 */
export async function resolveAlignment(args: {
  localVersions: string[];
  readRemote: () => Promise<RemoteRead>;
  allowPending: boolean;
  attempts?: number;
  waitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<{ diff: AlignmentDiff; read: RemoteRead }> {
  const attempts = Math.max(1, args.attempts ?? PENDING_SETTLE_ATTEMPTS);
  const waitMs = args.waitMs ?? PENDING_SETTLE_MS;
  const sleep = args.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = args.log ?? ((message: string) => console.log(message));

  let read = await args.readRemote();
  let diff = diffMigrationHistory(
    args.localVersions,
    read.rows.map((row) => row.version),
  );

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    if (args.allowPending || diff.localOnly.length === 0) break;
    log(
      `${diff.localOnly.length} version(s) not yet in live history; re-reading in ${Math.round(waitMs / 1000)}s ` +
        `(attempt ${attempt + 1}/${attempts}) in case the Supabase integration is still applying them.`,
    );
    await sleep(waitMs);
    read = await args.readRemote();
    diff = diffMigrationHistory(
      args.localVersions,
      read.rows.map((row) => row.version),
    );
  }

  return { diff, read };
}

function localMigrationVersions(migrationsDir: string): string[] {
  return readdirSync(migrationsDir)
    .map((name) => {
      const match = /^(\d{14})_.*\.sql$/.exec(name);
      return match?.[1] ?? null;
    })
    .filter((version): version is string => Boolean(version))
    .sort();
}

function authHeaders(serviceKey: string): Record<string, string> {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

/**
 * Preferred path: the service-role-only RPC. Returns null (rather than throwing)
 * only when the function itself is absent, so a project that has not yet applied
 * the migration can still fall back to Accept-Profile. Every other failure —
 * including a live database with no history table — is a real error and throws.
 */
async function fetchViaRpc(url: string, serviceKey: string): Promise<RemoteRow[] | null> {
  const response = await fetch(`${url}/rest/v1/rpc/migration_history_versions`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { ...authHeaders(serviceKey), "Content-Type": "application/json" },
    body: "{}",
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 || /PGRST202|could not find the function|schema cache/i.test(text)) {
      return null;
    }
    throw new Error(`migration_history_versions() RPC failed (status ${response.status}: ${text.slice(0, 240)})`);
  }

  const payload = (await response.json()) as { probe?: string; versions?: RemoteRow[] } | null;
  if (!payload || typeof payload !== "object") {
    throw new Error("migration_history_versions() returned an unexpected payload");
  }
  if (payload.probe !== "ok") {
    throw new Error(
      `migration_history_versions() reports probe "${payload.probe ?? "unknown"}": the target database has no ` +
        `supabase_migrations.schema_migrations table, so migration history cannot be compared. ` +
        `Check that this is the intended project.`,
    );
  }
  return payload.versions ?? [];
}

/** Legacy path, kept for any project that exposes supabase_migrations to PostgREST. */
async function fetchViaAcceptProfile(url: string, serviceKey: string): Promise<RemoteRow[]> {
  const response = await fetch(`${url}/rest/v1/schema_migrations?select=version,name&order=version.asc`, {
    signal: AbortSignal.timeout(10_000),
    headers: { ...authHeaders(serviceKey), "Accept-Profile": "supabase_migrations" },
  });
  if (response.ok) {
    return (await response.json()) as RemoteRow[];
  }
  const text = await response.text();
  throw new Error(
    `Unable to read remote schema_migrations via Accept-Profile ` +
      `(status ${response.status}: ${text.slice(0, 240)})`,
  );
}

export async function fetchRemoteVersions(url: string, serviceKey: string): Promise<RemoteRead> {
  const viaRpc = await fetchViaRpc(url, serviceKey);
  if (viaRpc) {
    return { rows: viaRpc, source: "rpc" };
  }

  try {
    return { rows: await fetchViaAcceptProfile(url, serviceKey), source: "accept-profile" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Migration history is unreadable on this project. public.migration_history_versions() is not ` +
        `available — apply supabase/migrations/${MIGRATION_HISTORY_VERSIONS_MIGRATION} through the normal ` +
        `reviewed migration path. For production, merge the reviewed migration to main in an approved window; ` +
        `the configured Supabase GitHub integration deploys it, after which the live schema-drift and ` +
        `migration-history gates must both pass. For non-production, use the documented approved linked-project ` +
        `procedure. The direct read also failed. ${detail}`,
    );
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const { allowPending } = parseAlignmentOptions(process.argv.slice(2));
  const migrationsDir = join(process.cwd(), "supabase/migrations");
  const localVersions = localMigrationVersions(migrationsDir);
  console.log(`Local migration versions: ${localVersions.length}`);

  const { diff, read } = await resolveAlignment({
    localVersions,
    readRemote: () => fetchRemoteVersions(url, serviceKey),
    allowPending,
  });

  console.log(`Remote migration versions: ${read.rows.length} (read via ${read.source})`);
  console.log(`Remote-only (Preview blockers): ${diff.remoteOnly.length}`);
  for (const version of diff.remoteOnly) {
    const row = read.rows.find((item) => item.version === version);
    console.log(`  - ${version}${row?.name ? ` (${row.name})` : ""}`);
  }
  console.log(
    `Local-only (${allowPending ? "pending apply, allowed" : "merged but not applied"}): ${diff.localOnly.length}`,
  );
  for (const version of diff.localOnly.slice(0, 30)) {
    console.log(`  - ${version}`);
  }
  if (diff.localOnly.length > 30) {
    console.log(`  … ${diff.localOnly.length - 30} more`);
  }

  const failure = alignmentFailureMessage(diff, { allowPending });
  if (failure) {
    throw new Error(failure);
  }

  console.log("Migration history alignment OK: local and live migration history hold the same versions.");
}

const invokedDirectly = process.argv[1] && /check-migration-history-alignment\.(ts|mts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
