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
 * This script prints remote-only / local-only versions and exits 1 when any
 * remote-only versions remain. It is intended for workflow_dispatch / live
 * alignment checks (uses service-role secrets).
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

  const migrationsDir = join(process.cwd(), "supabase/migrations");
  const local = new Set(localMigrationVersions(migrationsDir));
  console.log(`Local migration versions: ${local.size}`);

  const { rows: remoteRows, source } = await fetchRemoteVersions(url, serviceKey);
  const remote = new Set(remoteRows.map((row) => row.version));
  const remoteOnly = [...remote].filter((version) => !local.has(version)).sort();
  const localOnly = [...local].filter((version) => !remote.has(version)).sort();

  console.log(`Remote migration versions: ${remote.size} (read via ${source})`);
  console.log(`Remote-only (Preview blockers): ${remoteOnly.length}`);
  for (const version of remoteOnly) {
    const row = remoteRows.find((item) => item.version === version);
    console.log(`  - ${version}${row?.name ? ` (${row.name})` : ""}`);
  }
  console.log(`Local-only (pending apply): ${localOnly.length}`);
  for (const version of localOnly.slice(0, 30)) {
    console.log(`  - ${version}`);
  }
  if (localOnly.length > 30) {
    console.log(`  … ${localOnly.length - 30} more`);
  }

  if (remoteOnly.length > 0) {
    throw new Error(
      `${remoteOnly.length} remote migration version(s) are missing from supabase/migrations. ` +
        `Hosted Supabase Preview will fail until local files exist for those versions ` +
        `(or remote history is repaired).`,
    );
  }

  console.log("Migration history alignment OK: every remote version exists locally.");
}

const invokedDirectly = process.argv[1] && /check-migration-history-alignment\.(ts|mts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
