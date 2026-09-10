import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Preview query and result shaping for the enrichment repair and health surfaces (#W98GR7).
 *
 * Kept out of the scripts so the decision logic is unit-testable without a database. The
 * Scripts supply the client; the query can be tested without loading provider configuration.
 */

/** One row of `public.repair_strict_enrichment_gate_batch`'s result set. */
export type StrictGateRepairRow = {
  document_id: string;
  missing: string[] | null;
  repaired: string[] | null;
  status: string | null;
};

export type StrictGateRepairSummary = {
  total: number;
  completed: number;
  deferred: number;
  /**
   * Rows where the repair returned `indexing_v3_agent_jobs` to a claimable state. Before
   * 20260907041700 this was always 0 because the function never touched that table, which is
   * why a stuck document stayed stuck however often the repair ran.
   */
  agentJobsReset: number;
};

export function strictGateRepairSummary(rows: readonly StrictGateRepairRow[]): StrictGateRepairSummary {
  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    deferred: rows.filter((row) => row.status === "deferred").length,
    agentJobsReset: rows.filter((row) => (row.repaired ?? []).includes("agent_job_reset")).length,
  };
}

export function formatStrictGateRepairRows(rows: readonly StrictGateRepairRow[]): string {
  if (rows.length === 0) return "  no documents required repair";
  return rows
    .map((row) => {
      const missing = (row.missing ?? []).join(",") || "none";
      const repaired = (row.repaired ?? []).join(",") || "none";
      return `  ${row.document_id}  ${String(row.status ?? "unknown").padEnd(9)}  missing=${missing}  repaired=${repaired}`;
    })
    .join("\n");
}

/** Counts of documents in each terminal or at-risk enrichment state. */
export type EnrichmentHealthCounts = {
  /** Terminal by name: excluded from claim_indexing_v3_agent_jobs' `status not in (...)`. */
  needsEnrichmentArtifacts: number;
  /** Terminal in effect: `status = 'failed'` is reached only once attempts are exhausted. */
  failedExhausted: number;
  /**
   * Not yet terminal by status, but out of retries, so the claim query's
   * `attempt_count < max_attempts` guard excludes it anyway. Disjoint from the two above,
   * so the three sum without double counting. APPROXIMATE IN BOTH DIRECTIONS, not a floor:
   * max_attempts is per-row and PostgREST cannot compare two columns, so the collector
   * compares against the default of 3 — over-counting a row whose max_attempts was raised
   * above 3 and not yet stuck, and under-counting one lowered below it and already stuck.
   */
  attemptsExhausted: number;
  /** Indexed documents whose artifacts do not satisfy the strict gate. */
  gateFailing: number;
};

export type EnrichmentHealthVerdict = {
  counts: EnrichmentHealthCounts;
  /** Documents that can never be claimed again without an operator repair. */
  stuck: number;
  ok: boolean;
  lines: string[];
};

/**
 * A stuck document reports as `indexed` with an empty artifact family and no error anywhere,
 * so the only way to see it is to count it. Silent corruption, not a crash — which is why
 * this check exists and why zero was never evidence of health before it did.
 */
export function assessEnrichmentHealth(
  counts: EnrichmentHealthCounts,
  options: { failOnStuck?: boolean } = {},
): EnrichmentHealthVerdict {
  const stuck = counts.needsEnrichmentArtifacts + counts.failedExhausted + counts.attemptsExhausted;
  const lines = [
    `needs_enrichment_artifacts : ${counts.needsEnrichmentArtifacts}`,
    `failed (attempts spent)    : ${counts.failedExhausted}`,
    `attempts exhausted         : ${counts.attemptsExhausted}`,
    `indexed but gate-failing   : ${counts.gateFailing}`,
  ];
  if (stuck > 0) {
    lines.push(
      "",
      `${stuck} document(s) cannot be claimed again by indexing-v3-agent without an operator repair.`,
      "Preview with: npm run repair:enrichment-gate",
      "Apply with:   npm run repair:enrichment-gate -- --apply",
    );
  } else {
    lines.push("", "No document is permanently excluded from enrichment claim eligibility.");
  }
  return { counts, stuck, ok: stuck === 0 || options.failOnStuck !== true, lines };
}

/** One row of `public.document_strict_gate_status`, as the preview query selects it. */
export type StrictGateStatusRow = {
  document_id: string;
  gate_passed: boolean | null;
  missing: string[] | null;
  enrichment_status: string | null;
  indexing_v3_agent_status: string | null;
  quality_extraction_quality: string | null;
};

/** Read the same SQL candidate query used by apply, including authoritative job state. */
export async function selectStrictGateRepairCandidates(
  client: Pick<SupabaseClient<Database>, "rpc">,
  limit: number,
): Promise<StrictGateStatusRow[]> {
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 500)) : 50;
  const result = await client.rpc("preview_strict_enrichment_gate_repair", { p_limit: boundedLimit });
  if (result.error) throw new Error(result.error.message);
  if (!Array.isArray(result.data)) throw new Error("Enrichment repair preview returned no candidate list.");
  return result.data as StrictGateStatusRow[];
}
