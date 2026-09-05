export type CompletionGate = {
  counts: {
    sections: number;
    memory_cards: number;
    generated_labels: number;
    index_units: number;
  };
  presence: {
    title_embedding: boolean;
    summary_embedding: boolean;
  };
  quality: {
    extraction_quality: string;
    score: number;
  };
  missing: string[];
  result: "complete" | "deferred";
};

export type CompletionGateRow = {
  sections: number;
  memory_cards: number;
  generated_labels: number;
  index_units: number;
  title_embedding: boolean;
  summary_embedding: boolean;
  quality_extraction_quality: string;
  quality_score: number;
  missing: string[];
  gate_passed: boolean;
};

export type MissingArtifactPlan = {
  needs_sections: boolean;
  needs_memory: boolean;
  needs_labels: boolean;
  needs_index_units: boolean;
  needs_title_embedding: boolean;
  needs_summary_embedding: boolean;
  needs_core_embeddings: boolean;
  needs_quality_promotion: boolean;
};

export type DeferralDecision = {
  deferral_count: number;
  terminal: boolean;
  status: "deferred" | "needs_enrichment_artifacts";
  enrichment_status: "pending" | "needs_enrichment_artifacts";
  next_run_at: string | null;
  details: {
    code: "completion_gate_deferred" | "needs_enrichment_artifacts";
    missing: string[];
    counts: CompletionGate["counts"];
    presence: CompletionGate["presence"];
    deferral_count: number;
    max_deferrals: number;
  };
};

export type JobStatusRpcResult = {
  ok: boolean;
  gate_passed: boolean;
  missing: string[] | null;
  status: string;
};

export function agentFailureDecision(args: {
  attemptCount: number;
  maxAttempts: number;
  nowMs: number;
  retryDelayMs: number;
}) {
  const shouldRetry = args.attemptCount < args.maxAttempts;
  return {
    shouldRetry,
    status: shouldRetry ? "retry_pending" : "failed",
    jobStatus: shouldRetry ? "pending" : "failed",
    enrichmentStatus: shouldRetry ? "pending" : "failed",
    nextRunAt: shouldRetry ? new Date(args.nowMs + args.retryDelayMs).toISOString() : null,
  } as const;
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseJobStatusRpcResult(row: unknown, rpcName: string): JobStatusRpcResult | null {
  const direct = asObjectRecord(row);
  const nested = asObjectRecord(direct?.[rpcName]);
  const candidate = direct?.ok !== undefined ? direct : nested;
  if (!candidate) return null;

  const ok = candidate.ok === true;
  const gatePassed = candidate.gate_passed === true;
  const status = typeof candidate.status === "string" ? candidate.status : "missing_result";
  const missing =
    candidate.missing === null
      ? []
      : Array.isArray(candidate.missing)
        ? candidate.missing.map((item) => String(item))
        : ["completion_rpc_failed"];

  return { ok, gate_passed: gatePassed, status, missing };
}

export function completionGateFromRow(row: CompletionGateRow): CompletionGate {
  return {
    counts: {
      sections: row.sections,
      memory_cards: row.memory_cards,
      generated_labels: row.generated_labels,
      index_units: row.index_units,
    },
    presence: {
      title_embedding: row.title_embedding,
      summary_embedding: row.summary_embedding,
    },
    quality: {
      extraction_quality: row.quality_extraction_quality,
      score: row.quality_score,
    },
    missing: row.missing,
    result: row.gate_passed ? "complete" : "deferred",
  };
}

export function missingArtifactPlan(gate: CompletionGate): MissingArtifactPlan {
  const missing = new Set(gate.missing);
  const needsTitle = missing.has("title_embedding");
  const needsSummary = missing.has("summary_embedding");
  return {
    needs_sections: missing.has("sections"),
    needs_memory: missing.has("memory_cards"),
    needs_labels: missing.has("generated_labels"),
    needs_index_units: missing.has("index_units"),
    needs_title_embedding: needsTitle,
    needs_summary_embedding: needsSummary,
    needs_core_embeddings: needsTitle || needsSummary,
    needs_quality_promotion: gate.result === "complete" && gate.quality.extraction_quality !== "good",
  };
}

export function shouldRunVisualArtifacts(args: { eligible_images: number; generated_visual_units: number }): boolean {
  return args.eligible_images > 0 && args.generated_visual_units === 0;
}

export function metadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  fallback = 0,
): number {
  const value = Number(metadata?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function deferralDecision(args: {
  metadata: Record<string, unknown> | null | undefined;
  gate: CompletionGate;
  maxDeferrals: number;
  nowMs: number;
}): DeferralDecision {
  const deferralCount = metadataNumber(args.metadata, "indexing_v3_agent_deferral_count") + 1;
  const terminal = deferralCount >= args.maxDeferrals || args.gate.missing.includes("sections");
  const status = terminal ? "needs_enrichment_artifacts" : "deferred";
  const nextRunAt = terminal
    ? null
    : new Date(args.nowMs + Math.min(24 * 60 * 60_000, 15 * 60_000 * deferralCount)).toISOString();
  return {
    deferral_count: deferralCount,
    terminal,
    status,
    enrichment_status: terminal ? "needs_enrichment_artifacts" : "pending",
    next_run_at: nextRunAt,
    details: {
      code: terminal ? "needs_enrichment_artifacts" : "completion_gate_deferred",
      missing: args.gate.missing,
      counts: args.gate.counts,
      presence: args.gate.presence,
      deferral_count: deferralCount,
      max_deferrals: args.maxDeferrals,
    },
  };
}

/**
 * Claim limit for the agent endpoint.
 *
 * `Number(url.searchParams.get("limit"))` alone lets `?limit=abc` reach the
 * claim RPC as `NaN::integer`, which Postgres rejects with a cast error — a 500
 * before a single job is claimed. Mirror the ingestion-worker function: finite
 * check first, then truncate and clamp.
 */
export const AGENT_CLAIM_LIMIT_DEFAULT = 8;
export const AGENT_CLAIM_LIMIT_MAX = 50;

export function parseAgentClaimLimit(
  raw: string | null | undefined,
  fallback = AGENT_CLAIM_LIMIT_DEFAULT,
  max = AGENT_CLAIM_LIMIT_MAX,
): number {
  if (raw === null || raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

/** The endpoint claims and mutates jobs; only POST may reach it. */
export function isAllowedAgentMethod(method: string): boolean {
  return method === "POST";
}

export type ClaimedBatchResult<TJob> = {
  processed: number;
  deferred: number;
  failed: number;
  deferrals: Array<{ job: TJob; missing: string[] }>;
  failures: Array<{ job: TJob; error: string; failure_record_error: string | null }>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

/**
 * Run one claimed batch, isolating BOTH the per-job work and the per-job
 * failure recording.
 *
 * The bug this exists to prevent (audit L13): `markJobFailure` throws whenever
 * the status RPC returns `ok:false` or the database errors. Called unguarded in
 * the loop's catch, that throw escaped to the request-level catch and returned
 * 500 with every not-yet-processed job in the batch still `processing` under
 * its lock — invisible until the 45-minute stale reclaim, each one attempt
 * closer to the terminal `failed` state that is never re-queued. One job's
 * failure must never abandon its siblings, so the failure-recording call gets
 * its own guard and the loop continues.
 */
export async function runClaimedJobBatch<TJob>(
  jobs: readonly TJob[],
  handlers: {
    processJob: (job: TJob) => Promise<{ status: "completed" | "deferred"; missing: string[] }>;
    markJobFailure: (job: TJob, message: string) => Promise<unknown>;
  },
): Promise<ClaimedBatchResult<TJob>> {
  const result: ClaimedBatchResult<TJob> = {
    processed: 0,
    deferred: 0,
    failed: 0,
    deferrals: [],
    failures: [],
  };

  for (const job of jobs) {
    try {
      const outcome = await handlers.processJob(job);
      if (outcome.status === "completed") {
        result.processed += 1;
      } else {
        result.deferred += 1;
        result.deferrals.push({ job, missing: outcome.missing });
      }
    } catch (error) {
      const message = errorMessage(error);
      let failureRecordError: string | null = null;
      try {
        await handlers.markJobFailure(job, message);
      } catch (recordError) {
        failureRecordError = errorMessage(recordError);
      }
      result.failed += 1;
      result.failures.push({ job, error: message, failure_record_error: failureRecordError });
    }
  }

  return result;
}
