import { loadEnvConfig } from "@next/env";

import { createAdminClient } from "@/lib/supabase/admin";

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
