import { loadEnvConfig } from "@next/env";
import { safeErrorLogDetails } from "@/lib/privacy";
import { assertSupabaseHealthy, probeSupabaseHealth } from "@/lib/supabase/health";
import {
  formatStrictGateRepairRows,
  selectStrictGateRepairCandidates,
  strictGateRepairSummary,
  type StrictGateRepairRow,
  type StrictGateStatusRow,
} from "@/lib/enrichment-repair";
import { confirm } from "./cli-utils";

loadEnvConfig(process.cwd());

/**
 * repair:enrichment-gate — the caller `repair_strict_enrichment_gate_batch` never had.
 *
 * The function was designed in 20260625033425 to reconcile a document whose recorded
 * enrichment state disagrees with the artifacts actually present, and nothing in the
 * repository invoked it: a document stuck at `needs_enrichment_artifacts`, or with its
 * attempt budget exhausted, is excluded from `claim_indexing_v3_agent_jobs` forever and had
 * no recovery path at all (#W98GR7).
 *
 * Operator-invoked, following scripts/cleanup-abandoned-reindex-generations.ts: dry run by
 * default, mutates only under `--apply` plus a confirmation, health-probes first. It is
 * deliberately NOT wired to a worker loop, a scheduled workflow, or an admin route — this
 * writes to live clinical document rows, and the repository's provider-confirmation boundary
 * puts that behind a person, not an automation.
 *
 * WHAT --apply ACTUALLY DOES, because the operator authorizes more than a metadata
 * reconcile. For a gate-failing document it queues a pending `ingestion_jobs` row, and
 * worker/main.ts ignores the incoming stage, so that is a FULL RE-INGESTION: download,
 * extract or OCR, chunk, OpenAI embeddings, image captioning. That is real provider spend and
 * a cross-border transfer of clinical document text. It takes the atomic reindex path
 * (isAtomicReindexCandidate is `status === "indexed"`, which every candidate is), so the old
 * generation stays live until the new one commits and no document is unsearchable in between.
 *
 * The RPC has no dry-run parameter, so the preview reruns the function's own candidate
 * predicate rather than approximating it (see selectStrictGateRepairCandidates). It is still
 * a separate read: the corpus can change between the two, so the apply output is
 * authoritative and is printed in full.
 */
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
    limit: Number.parseInt(valueFor("limit") ?? "", 10),
  };
}

async function main() {
  const [{ env, requireServerEnv }, { createAdminClient }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
  ]);
  requireServerEnv();

  const args = parseArgs(process.argv.slice(2));
  const limit = Number.isFinite(args.limit) ? args.limit : 50;
  const supabase = createAdminClient();

  console.log("=== Strict Enrichment Gate Repair ===");
  console.log(`Supabase project: ${env.SUPABASE_PROJECT_NAME ?? "unknown"} (${env.SUPABASE_PROJECT_REF ?? "unknown"})`);
  console.log(`Mode            : ${args.apply ? "apply" : "dry-run"}`);
  console.log(`Document limit  : ${limit}`);
  console.log("");

  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Strict enrichment gate repair");

  const preview = await supabase
    .from("document_strict_gate_status")
    .select(
      "document_id, gate_passed, missing, enrichment_status, indexing_v3_agent_status, quality_extraction_quality",
    )
    .eq("document_status", "indexed")
    .order("document_updated_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (preview.error) throw new Error(preview.error.message);

  const candidates = selectStrictGateRepairCandidates((preview.data ?? []) as StrictGateStatusRow[], limit);
  const failing = candidates.filter((row) => row.gate_passed !== true).length;
  console.log(`Repair candidates: ${candidates.length}`);
  console.log(`  gate-failing   : ${failing}  (each queues a full re-ingestion)`);
  console.log(`  gate-passing   : ${candidates.length - failing}  (recorded state reconciled only)`);
  console.log("  note           : a lower bound on the gate-passing side — the open-ingestion-job");
  console.log("                   disjunct is not visible from this view. Never an undercount of");
  console.log("                   the gate-failing side, which is the one that costs money.");

  if (!args.apply) {
    console.log("\nDry run only. Re-run with --apply to reconcile these documents.");
    console.log("Apply reconciles documents.metadata, document_index_quality and ingestion_jobs,");
    console.log("and returns indexing_v3_agent_jobs rows to a claimable state where they are stuck.");
    console.log("Each gate-failing document is queued for a FULL RE-INGESTION with OpenAI embedding");
    console.log("and caption calls — real provider spend, against live clinical documents.");
    return;
  }

  // A mutating operator script must not act on ambient env. Fail closed rather than repair
  // whatever project the shell happens to be pointed at.
  const expectedProjectRef = "sjrfecxgysukkwxsowpy";
  if (env.SUPABASE_PROJECT_REF !== expectedProjectRef) {
    throw new Error(
      `Refusing to apply: SUPABASE_PROJECT_REF is ${env.SUPABASE_PROJECT_REF ?? "unset"}, expected ${expectedProjectRef}.`,
    );
  }

  if (!args.yes) {
    console.log("");
    console.log(`This reconciles up to ${limit} document(s) on ${expectedProjectRef} and queues about`);
    console.log(`${failing} full re-ingestion(s), each making OpenAI embedding and caption calls.`);
    const shouldApply = await confirm("Proceed?");
    if (!shouldApply) {
      console.log("\nNo changes applied.");
      return;
    }
  }

  const applied = await supabase.rpc("repair_strict_enrichment_gate_batch", { p_limit: limit });
  if (applied.error) throw new Error(applied.error.message);

  const rows = (applied.data ?? []) as StrictGateRepairRow[];
  const summary = strictGateRepairSummary(rows);
  console.log("");
  console.log(formatStrictGateRepairRows(rows));
  console.log("");
  console.log(`Documents repaired : ${summary.total}`);
  console.log(`  completed        : ${summary.completed}`);
  console.log(`  deferred         : ${summary.deferred}`);
  console.log(`  agent jobs reset : ${summary.agentJobsReset}`);
  if (summary.agentJobsReset > 0) {
    console.log("\nReset agent jobs are claimable again on the next indexing-v3-agent run.");
  }
}

main().catch((error) => {
  console.error("Strict enrichment gate repair failed", safeErrorLogDetails(error));
  process.exitCode = 1;
});
