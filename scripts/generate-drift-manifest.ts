import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * drift:manifest — regenerates supabase/drift-manifest.json.
 *
 * Replays supabase/schema.sql from scratch into a disposable Supabase Postgres
 * Docker container (the same image family the hosted platform runs), then
 * captures public.schema_drift_snapshot() from that pristine database. The
 * result is the expected-state side of `npm run check:drift`.
 *
 * Requires Docker. Never touches the live project. Run this whenever
 * supabase/schema.sql changes — the manifest embeds schema.sql's sha256 and
 * both check:drift and tests/supabase-schema.test.ts fail while it is stale.
 *
 * Flags:
 *   --keep        leave the container running (for inspection / DR rehearsal)
 *   --port <n>    host port for the scratch Postgres (default 56599)
 *   --container <name>  override the scratch container name for concurrent worktrees
 *   --image <x>   override the Postgres image tag
 */

const IMAGE_DEFAULT = "supabase/postgres:17.6.1.127";
const CONTAINER_DEFAULT = "clinical-kb-drift-manifest";

const repoUrl = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function docker(args: string[], input?: string): string {
  return execFileSync("docker", args, {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function main() {
  const image = arg("--image") ?? IMAGE_DEFAULT;
  const port = arg("--port") ?? "56599";
  const container = arg("--container") ?? CONTAINER_DEFAULT;
  const keep = process.argv.includes("--keep");

  try {
    docker(["info", "--format", "{{.ServerVersion}}"]);
  } catch {
    throw new Error(
      "Docker is required for drift:manifest (it replays schema.sql into a scratch container). Start Docker and retry.",
    );
  }

  const schemaSql = readFileSync(repoUrl("supabase/schema.sql"), "utf8");
  const rolesSql = readFileSync(repoUrl("supabase/roles.sql"), "utf8");
  const scaffoldSql = readFileSync(repoUrl("scripts/sql/drift-replay-scaffold.sql"), "utf8");
  const { normalizedSchemaSha256 } = await import("./check-drift");

  console.log(`Starting scratch container ${container} (${image}) on port ${port}…`);
  try {
    docker(["rm", "-f", container]);
  } catch {
    // not running — fine
  }
  const startedAt = Date.now();
  const scratchPassword = randomBytes(16).toString("hex");
  docker(["run", "-d", "--name", container, "-e", `POSTGRES_PASSWORD=${scratchPassword}`, "-p", `${port}:5432`, image]);

  try {
    // The Supabase image briefly accepts connections before its init migrations
    // deliberately restart Postgres. Require sustained readiness so replay does
    // not race that shutdown window.
    let consecutiveReadyChecks = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        docker(["exec", container, "pg_isready", "-U", "postgres", "-q"]);
        consecutiveReadyChecks += 1;
        if (consecutiveReadyChecks >= 5) break;
      } catch {
        consecutiveReadyChecks = 0;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (consecutiveReadyChecks < 5) {
      throw new Error("scratch Postgres did not remain ready after initialization");
    }

    const psql = (user: string, sql: string) =>
      docker(
        ["exec", "-i", container, "psql", "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
        sql,
      );

    console.log("Applying role bootstrap (postgres)…");
    psql("postgres", rolesSql);
    const storageSchemaOwner = docker([
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "select pg_catalog.pg_get_userbyid(nspowner) from pg_catalog.pg_namespace where nspname = 'storage';",
    ]).trim();
    if (!storageSchemaOwner) {
      throw new Error("bare Supabase image does not expose an owner for the storage schema");
    }
    console.log("Applying storage scaffold as the discovered bare-image storage owner…");
    psql(storageSchemaOwner, scaffoldSql);
    console.log("Replaying supabase/schema.sql from scratch (postgres)…");
    psql("postgres", schemaSql);
    const replaySeconds = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(`Replay complete in ${replaySeconds}s (container start included).`);

    const raw = docker(
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      "select public.schema_drift_snapshot()::text;",
    ).trim();
    const snapshot = JSON.parse(raw) as Record<string, unknown>;
    delete snapshot.captured_at;

    const manifest = {
      generated_at: new Date().toISOString(),
      generator: "scripts/generate-drift-manifest.ts",
      postgres_image: image,
      schema_sha256: normalizedSchemaSha256(schemaSql),
      replay_seconds: Number(replaySeconds),
      snapshot,
    };
    writeFileSync(repoUrl("supabase/drift-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log("Wrote supabase/drift-manifest.json");
    console.log("Next: run `npm run check:drift` against live (needs service-role env).");
  } finally {
    if (keep) {
      console.log(`Container ${container} kept running on port ${port} (--keep).`);
    } else {
      try {
        docker(["rm", "-f", container]);
      } catch {
        console.warn(`Could not remove container ${container}; remove it manually.`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
