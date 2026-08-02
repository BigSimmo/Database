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
 */

type RemoteRow = { version: string; name: string | null };

function localMigrationVersions(migrationsDir: string): string[] {
  return readdirSync(migrationsDir)
    .map((name) => {
      const match = /^(\d{14})_.*\.sql$/.exec(name);
      return match?.[1] ?? null;
    })
    .filter((version): version is string => Boolean(version))
    .sort();
}

async function fetchRemoteVersions(url: string, serviceKey: string): Promise<RemoteRow[]> {
  // Read supabase_migrations via Accept-Profile when the project exposes that
  // schema to the Data API. Preview alignment itself only needs local files to
  // cover remote versions; this check is diagnostic for live history drift.
  const profileResponse = await fetch(`${url}/rest/v1/schema_migrations?select=version,name&order=version.asc`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Accept-Profile": "supabase_migrations",
    },
  });
  if (profileResponse.ok) {
    return (await profileResponse.json()) as RemoteRow[];
  }

  const profileText = await profileResponse.text();
  throw new Error(
    `Unable to read remote schema_migrations via Accept-Profile ` +
      `(status ${profileResponse.status}: ${profileText.slice(0, 240)})`,
  );
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

  const remoteRows = await fetchRemoteVersions(url, serviceKey);
  const remote = new Set(remoteRows.map((row) => row.version));
  const remoteOnly = [...remote].filter((version) => !local.has(version)).sort();
  const localOnly = [...local].filter((version) => !remote.has(version)).sort();

  console.log(`Remote migration versions: ${remote.size}`);
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
