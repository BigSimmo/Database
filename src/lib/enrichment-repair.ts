/**
 * Pure shaping for the enrichment repair and health surfaces (#W98GR7).
 *
 * Kept out of the scripts so the decision logic is unit-testable without a database. The
 * scripts own the provider I/O; everything that decides what a number MEANS lives here.
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
   * 20260902120000 this was always 0 because the function never touched that table, which is
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

/**
 * The `candidates` predicate from `repair_strict_enrichment_gate_batch`, reimplemented so the
 * operator script's dry run previews what apply will actually touch.
 *
 * The obvious preview — every indexed document, counting the gate-failing ones — is a
 * different and much coarser set: a gate-failing document whose recorded state already
 * correctly says `pending` is NOT a repair candidate, and a gate-passing document whose
 * recorded state disagrees IS one. A preview that reports "0 failing" while apply repairs 50
 * documents is worse than no preview, because dry-run-by-default is the safety property the
 * whole script rests on.
 *
 * ONE DISJUNCT IS NOT REPRODUCED: the SQL also treats a gate-passing document with an open
 * `ingestion_jobs` row as a candidate. That table is not in the view, so this is a LOWER
 * BOUND on the gate-passing side — apply may touch a few more than the preview shows, never
 * fewer, and never a gate-failing document the preview did not list. Callers say so.
 */
export function selectStrictGateRepairCandidates(
  rows: readonly StrictGateStatusRow[],
  limit: number,
): StrictGateStatusRow[] {
  const recorded = (value: string | null) => value ?? "";
  return rows
    .filter((row) =>
      row.gate_passed
        ? recorded(row.enrichment_status) !== "completed" ||
          recorded(row.indexing_v3_agent_status) !== "completed" ||
          recorded(row.quality_extraction_quality) !== "good"
        : recorded(row.enrichment_status) === "completed" || recorded(row.indexing_v3_agent_status) === "completed",
    )
    .slice(0, Math.max(1, Math.min(limit, 500)));
}
