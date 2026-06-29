import { loadEnvConfig } from "@next/env";
import {
  abandonedReindexGenerationTotal,
  hasAbandonedReindexGenerations,
  type AbandonedReindexGenerationCounts,
} from "@/lib/reindex-pipeline";
import { safeErrorLogDetails } from "@/lib/privacy";
import { assertSupabaseHealthy, probeSupabaseHealth } from "@/lib/supabase/health";
import { confirm } from "./cli-utils";

loadEnvConfig(process.cwd());

type CleanupResult = {
  ok?: boolean;
  dry_run?: boolean;
  document_count?: number;
  document_ids?: string[];
  counts?: AbandonedReindexGenerationCounts;
};

function parseArgs(argv: string[]) {
  const valueFor = (name: string) => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
    if (inline) return inline;
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    apply: argv.includes("--apply"),
    yes: argv.includes("--yes"),
    documentId: valueFor("document-id") ?? null,
    limit: Number.parseInt(valueFor("limit") ?? "", 10),
  };
}

function formatCounts(counts: AbandonedReindexGenerationCounts) {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "  none";
  return entries.map(([table, count]) => `  ${table.padEnd(26)}: ${count}`).join("\n");
}

async function main() {
  const [{ env, requireServerEnv }, { createAdminClient }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
  ]);
  requireServerEnv();

  const args = parseArgs(process.argv.slice(2));
  const limit = Number.isFinite(args.limit) ? args.limit : 100;
  const supabase = createAdminClient();

  console.log("=== Abandoned Reindex Generation Cleanup ===");
  console.log(`Supabase project: ${env.SUPABASE_PROJECT_NAME ?? "unknown"} (${env.SUPABASE_PROJECT_REF ?? "unknown"})`);
  console.log(`Mode            : ${args.apply ? "apply" : "dry-run"}`);
  console.log(`Document filter : ${args.documentId ?? "all eligible documents"}`);
  console.log(`Document limit  : ${limit}`);
  console.log("");

  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Abandoned reindex generation cleanup");

  const { data, error } = await supabase.rpc("cleanup_abandoned_document_index_generations", {
    p_document_id: args.documentId,
    p_limit: limit,
    p_dry_run: true,
  });
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as CleanupResult;
  const counts = result.counts ?? {};
  const total = abandonedReindexGenerationTotal(counts);
  console.log(`Eligible documents: ${result.document_count ?? 0}`);
  console.log(`Artifact rows      : ${total}`);
  console.log("Rows by table:");
  console.log(formatCounts(counts));

  if (!hasAbandonedReindexGenerations(counts)) {
    console.log("\nNo abandoned staged generation rows found.");
    return;
  }

  if (!args.apply) {
    console.log("\nDry run only. Re-run with --apply to delete these abandoned staged rows.");
    return;
  }

  if (!args.yes) {
    const shouldApply = await confirm("Delete the abandoned staged generation rows listed above?");
    if (!shouldApply) {
      console.log("\nNo changes applied.");
      return;
    }
  }

  const applied = await supabase.rpc("cleanup_abandoned_document_index_generations", {
    p_document_id: args.documentId,
    p_limit: limit,
    p_dry_run: false,
  });
  if (applied.error) throw new Error(applied.error.message);

  console.log("\nAbandoned staged generation cleanup applied.");
}

main().catch((error) => {
  console.error("Abandoned reindex generation cleanup failed", safeErrorLogDetails(error));
  process.exitCode = 1;
});
