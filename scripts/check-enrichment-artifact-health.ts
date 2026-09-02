import { loadEnvConfig } from "@next/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeErrorLogDetails } from "@/lib/privacy";
import { assertSupabaseHealthy, probeSupabaseHealth } from "@/lib/supabase/health";
import { assessEnrichmentHealth, type EnrichmentHealthCounts } from "@/lib/enrichment-repair";

loadEnvConfig(process.cwd());

/**
 * check:enrichment-health — the monitoring #W98GR7 recorded as absent.
 *
 * `needs_enrichment_artifacts` appeared in no script and no workflow, so a document that
 * reached a terminal enrichment state reported as `indexed` with an empty artifact family
 * and nothing counted it. Silent corruption, not a crash — which is exactly why zero was
 * never evidence of health before this existed.
 *
 * PROVIDER-BACKED. It reads the live clinical database and is deliberately NOT in
 * verify:cheap, verify:pr-local, or any CI job — running it needs the same explicit
 * confirmation as any other live read (AGENTS.md, "API and provider confirmation boundary").
 * `--fail-on-stuck` makes a non-zero count exit 1, for an operator who wants it actionable
 * rather than informational.
 *
 * The counts come from indexing_v3_agent_jobs itself rather than from the
 * `indexing_v3_agent_status` mirror on documents.metadata. The mirror is what the
 * document_strict_gate_status view exposes and would have been easier to query, but a
 * divergence between recorded state and reality is the whole subject of this issue, so the
 * check reads the table claim_indexing_v3_agent_jobs actually reads.
 */
async function main() {
  const [{ env, requireServerEnv }, { createAdminClient }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
  ]);
  requireServerEnv();

  const failOnStuck = process.argv.includes("--fail-on-stuck");
  const supabase = createAdminClient();

  console.log("=== Enrichment Artifact Health ===");
  console.log(`Supabase project: ${env.SUPABASE_PROJECT_NAME ?? "unknown"} (${env.SUPABASE_PROJECT_REF ?? "unknown"})`);
  console.log("");

  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Enrichment artifact health check");

  // indexing_v3_agent_jobs is not in the generated Database types (it is a worker-state
  // table added by migration), so query it through an untyped client the same way
  // src/lib/ingestion-mutation-safety.ts does.
  const jobs = supabase as unknown as SupabaseClient;

  const countJobs = async (build: (query: ReturnType<SupabaseClient["from"]>) => PromiseLike<unknown>) => {
    const result = (await build(jobs.from("indexing_v3_agent_jobs"))) as {
      count: number | null;
      error: { message?: string } | null;
    };
    if (result.error) throw new Error(result.error.message ?? String(result.error));
    return result.count ?? 0;
  };

  const gateFailing = await supabase
    .from("document_strict_gate_status")
    .select("document_id", { count: "exact", head: true })
    .eq("document_status", "indexed")
    .eq("gate_passed", false);
  if (gateFailing.error) throw new Error(gateFailing.error.message);

  const counts: EnrichmentHealthCounts = {
    needsEnrichmentArtifacts: await countJobs((query) =>
      query.select("id", { count: "exact", head: true }).eq("status", "needs_enrichment_artifacts"),
    ),
    failedExhausted: await countJobs((query) =>
      query.select("id", { count: "exact", head: true }).eq("status", "failed"),
    ),
    // `attempt_count < max_attempts` is the guard that actually excludes a row from
    // claim_indexing_v3_agent_jobs, and max_attempts is per-row (default 3). PostgREST
    // cannot compare two columns, so this counts rows at or past the default: APPROXIMATE IN
    // BOTH DIRECTIONS, over-counting a row whose max_attempts was raised above 3 and is not
    // yet stuck, and under-counting one lowered below it that already is. Reported as such
    // rather than presented as precise.
    //
    // The `.not(col, "in", ...)` shape has no other use in this repo and no test exercises it
    // against a live PostgREST endpoint, so treat this one count as unverified wire syntax
    // until the script has been run once against the project.
    attemptsExhausted: await countJobs((query) =>
      query
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("completed","failed","needs_enrichment_artifacts")')
        .gte("attempt_count", 3),
    ),
    gateFailing: gateFailing.count ?? 0,
  };

  const verdict = assessEnrichmentHealth(counts, { failOnStuck });
  for (const line of verdict.lines) console.log(line);

  if (!verdict.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Enrichment artifact health check failed", safeErrorLogDetails(error));
  process.exitCode = 1;
});
