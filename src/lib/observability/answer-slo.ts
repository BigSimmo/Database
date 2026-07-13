// Answer-pipeline SLO snapshot for the deep /api/health probe.
//
// The repo's defining failure mode is *silent degradation*: hybrid retrieval RPCs
// can die while the app keeps returning 200s from fallbacks (see
// docs/observability-slos.md). This turns the two load-bearing reliability signals
// from that doc — the `hybrid_rpc_errors` rate and the degraded/source-only rate —
// into a scrapeable counter so host-native alerting can poll them instead of
// running the SQL by hand. It only aggregates `rag_queries.metadata` (never raw
// query text, which is redacted at write time), and runs behind the secret-gated
// deep probe. Cache hit-rate is exposed separately by cache-metrics.ts because it
// is an in-process hot-path counter rather than a trailing database aggregate.

export type AnswerSloSnapshot = {
  windowMinutes: number;
  totalQueries: number;
  hybridRpcErrorQueries: number;
  degradedQueries: number;
  // Subsets of degradedQueries broken out by the two dominant answer-generation waste
  // classes: reasoning/answer token starvation (fallback_reason contains
  // "max_output_tokens") and generation timeouts (contains "timeout"). These are exactly
  // the failure modes the OPENAI_MAX_OUTPUT_TOKENS raise + reasoning-effort drop target,
  // surfaced as scrapeable counters so a regression is visible without hand-running SQL.
  truncationFallbackQueries: number;
  timeoutFallbackQueries: number;
  // 0..1; 0 when there were no queries in the window (avoid divide-by-zero noise).
  hybridRpcErrorRate: number;
  degradedRate: number;
  truncationFallbackRate: number;
  timeoutFallbackRate: number;
};

type CountResult = { count: number | null; error: unknown };

// Minimal structural view of the PostgREST count query we use. The Supabase admin
// client is assignable to this (same pattern as src/lib/supabase/health.ts), so the
// route passes it directly and tests pass a small fake.
type SloCountBuilder = PromiseLike<CountResult> & {
  gt(column: string, value: string): SloCountBuilder;
  eq(column: string, value: string): SloCountBuilder;
  is(column: string, value: null): SloCountBuilder;
  not(column: string, operator: string, value: null): SloCountBuilder;
  ilike(column: string, pattern: string): SloCountBuilder;
};

export type SloProbeClient = {
  from(table: string): {
    select(columns: string, options: { count: "exact"; head: true }): SloCountBuilder;
  };
};

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Count answered queries in the trailing window and how many carried a
 * `hybrid_rpc_errors` map or an explicit provider-generation fallback flag. Throws on
 * a query error so the caller can mark the probe degraded rather than report a
 * falsely-healthy zero.
 */
export async function answerSloSnapshot(client: SloProbeClient, windowMinutes = 60): Promise<AnswerSloSnapshot> {
  const sinceIso = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const base = () =>
    client
      .from("rag_queries")
      .select("*", { count: "exact", head: true })
      .gt("created_at", sinceIso)
      // Search observations share rag_queries but carry a dedicated event_type.
      // Answer text is privacy-redacted to null by default, so it cannot be the
      // discriminator without hiding normal production answers from the SLO.
      .is("metadata->>event_type", null);

  const [total, hybrid, degraded, truncation, timeout] = await Promise.all([
    base(),
    base().not("metadata->hybrid_rpc_errors", "is", null),
    // Source-only/extractive answers can be intentional and healthy. Count only
    // model-generation failures that actually forced a local fallback.
    base().eq("metadata->>provider_generation_degraded", "true"),
    // fallback_reason values look like "...generation_fallback:provider_incomplete_max_output_tokens"
    // and "...generation_fallback:provider_timeout" (confirmed in live rag_queries).
    base().ilike("metadata->>fallback_reason", "%max_output_tokens%"),
    base().ilike("metadata->>fallback_reason", "%timeout%"),
  ]);

  for (const result of [total, hybrid, degraded, truncation, timeout]) {
    if (result.error) {
      if (result.error instanceof Error) throw result.error;
      // Supabase surfaces a plain PostgrestError object ({ message, code, ... }),
      // not an Error — pull the message out rather than stringify to "[object Object]".
      const message =
        result.error && typeof result.error === "object" && "message" in result.error
          ? String((result.error as { message?: unknown }).message ?? "")
          : String(result.error);
      throw new Error(message || "answer SLO count query failed");
    }
  }

  const totalQueries = total.count ?? 0;
  const hybridRpcErrorQueries = hybrid.count ?? 0;
  const degradedQueries = degraded.count ?? 0;
  const truncationFallbackQueries = truncation.count ?? 0;
  const timeoutFallbackQueries = timeout.count ?? 0;

  return {
    windowMinutes,
    totalQueries,
    hybridRpcErrorQueries,
    degradedQueries,
    truncationFallbackQueries,
    timeoutFallbackQueries,
    hybridRpcErrorRate: rate(hybridRpcErrorQueries, totalQueries),
    degradedRate: rate(degradedQueries, totalQueries),
    truncationFallbackRate: rate(truncationFallbackQueries, totalQueries),
    timeoutFallbackRate: rate(timeoutFallbackQueries, totalQueries),
  };
}
