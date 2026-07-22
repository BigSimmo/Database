import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const M13_HEALTH_MARKER = "commit_document_index_generation.preserve_legacy_artifacts_migration";
const M13_MIGRATION = "20260702000000_commit_generation_preserve_legacy_artifacts.sql";

type SchemaHealth = {
  ok?: boolean;
  missing?: unknown;
};

function missingMarkers(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const missing = (data as SchemaHealth).missing;
  return Array.isArray(missing) ? missing.map(String) : [];
}

async function main() {
  try {
    const { createRequire, Module } = await import("module");
    const req = createRequire(import.meta.url);
    const resolved = req.resolve("server-only");
    if (resolved) {
      const serverOnlyStub = new Module(resolved);
      serverOnlyStub.exports = {};
      serverOnlyStub.loaded = true;
      req.cache[resolved] = serverOnlyStub;
    }
  } catch {
    // ignore
  }

  // Production-target guard (mirrors check-july8-live-batch). This is a live
  // migration-verification probe whose PASS operator docs cite as proof the M13
  // guard is applied before reindex cleanup. Without this check it would accept a
  // staging target and greenlight while production (sjrfecxgysukkwxsowpy) is still
  // stale, so refuse any non-production project before touching the RPC.
  const { env, requireServerEnv } = await import("@/lib/env");
  const { checkSupabaseProjectConfig, expectedSupabaseProject, formatSupabaseProjectCheck } =
    await import("@/lib/supabase/project");
  requireServerEnv();
  const projectCheck = checkSupabaseProjectConfig(
    {
      NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_PROJECT_REF: env.SUPABASE_PROJECT_REF,
      SUPABASE_PROJECT_NAME: env.SUPABASE_PROJECT_NAME,
      SUPABASE_STAGING_PROJECT_REF: env.SUPABASE_STAGING_PROJECT_REF,
      SUPABASE_STAGING_PROJECT_NAME: env.SUPABASE_STAGING_PROJECT_NAME,
    },
    { requireMetadata: true },
  );
  if (projectCheck.status === "missing" || projectCheck.status === "mismatch") {
    throw new Error(formatSupabaseProjectCheck(projectCheck));
  }
  if (projectCheck.observed.environment !== "production") {
    throw new Error(
      `[M13 Migration] must target production ${expectedSupabaseProject.name} (${expectedSupabaseProject.ref}), not staging ${projectCheck.expected.ref}.`,
    );
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_schema_health");
  if (error) {
    console.error("[M13 Migration] FAIL: search_schema_health unavailable:", error.message);
    process.exit(1);
  }

  const missing = missingMarkers(data);
  if (missing.includes(M13_HEALTH_MARKER)) {
    console.error(
      `[M13 Migration] FAIL: live commit_document_index_generation is missing the preserve-legacy-artifacts guard.`,
    );
    console.error(`Apply ${M13_MIGRATION} via the normal Supabase migration workflow, then run:`);
    console.error("  npm run reindex:health");
    console.error("  npm run check:indexing");
    process.exit(1);
  }

  if (missing.includes("commit_document_index_generation.signature")) {
    console.error("[M13 Migration] FAIL: commit_document_index_generation RPC is missing on the live project.");
    process.exit(1);
  }

  console.log("[M13 Migration] PASS: commit generation preserve-legacy guard is live.");
  if (missing.length > 0) {
    console.log("[M13 Migration] Note: search_schema_health reported other missing items:", missing.join(", "));
  }
}

main().catch((error) => {
  console.error("[M13 Migration] FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
