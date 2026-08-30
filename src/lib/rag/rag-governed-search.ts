import { rankClinicalResults } from "@/lib/clinical-search";
import { embedTextWithTelemetry } from "@/lib/openai";
import { searchGovernedCorpora } from "@/lib/rag/rag-candidate-sources";
import { evaluateShadowCandidateMatchCounts } from "@/lib/rag/rag-coverage";
import type { SearchChunksArgs, SearchTelemetry } from "@/lib/rag/rag-contracts";
import { attachDocumentRankingMetadata, attachPageVisualEvidence } from "@/lib/rag/rag-hydration";
import { isSourceOnlyMode, SOURCE_ONLY_EMBEDDING_SKIP_REASON } from "@/lib/rag/rag-provider";
import { applySecondStageRerankIfNeeded } from "@/lib/rag/rag-second-stage";
import { selectRetrievalEvidence } from "@/lib/retrieval-selection";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { RagQueryClass, RagQueryPlan, SearchResult } from "@/lib/types";

type GovernedModeResult = { candidateResults: SearchResult[]; results: SearchResult[]; served: boolean };

/** Run one v3 candidate lane; shadow observes it while canary serves its public-only output. */
export async function routeGovernedSearch(input: {
  args: SearchChunksArgs;
  supabase: ReturnType<typeof createAdminClient>;
  queryPlan: RagQueryPlan;
  telemetry: SearchTelemetry;
}): Promise<GovernedModeResult | null> {
  const { args, queryPlan, supabase, telemetry } = input;
  if (args.ragQueryPlanMode === "legacy") return null;
  const shadow = args.ragQueryPlanMode === "shadow";
  if (!args.governedCorpusComponents || !args.ragRequestContext) {
    return shadow ? null : { candidateResults: [], results: [], served: true };
  }
  const providerSourceOnly = isSourceOnlyMode();
  const sourceOnly = providerSourceOnly || Boolean(args.lexicalOnly);
  const retrievalMode = shadow || sourceOnly ? "text" : args.forceEmbedding ? "vector" : "hybrid";
  const documentFilters = args.documentIds?.length ? args.documentIds : args.documentId ? [args.documentId] : undefined;
  const query = queryPlan.originalQuery;
  const queryClass = (telemetry.query_class ?? "broad_summary") as RagQueryClass;
  const candidateMultiplier = queryClass === "comparison" ? 7 : 5;
  const candidateFloor = queryClass === "comparison" ? 72 : 48;
  const startedAt = Date.now();
  let embeddingLatencyMs = 0;
  let rpcCalls = 0;
  const candidateResults = await searchGovernedCorpora({
    supabase,
    queryVariants: [query],
    queryPlan,
    retrievalMode,
    embedQuery: async (embeddingQuery, signal) => {
      const embeddingStartedAt = Date.now();
      try {
        const result = await embedTextWithTelemetry(embeddingQuery, { signal });
        telemetry.embedding_cache_hit = result.cacheHit;
        return result.embedding;
      } finally {
        embeddingLatencyMs += Date.now() - embeddingStartedAt;
      }
    },
    documentFilters,
    matchCount: Math.max((args.topK ?? 8) * candidateMultiplier, candidateFloor),
    minSimilarity: args.minSimilarity,
    snapshot: args.ragRequestContext.snapshot,
    components: args.governedCorpusComponents,
    targetSiteDomains: queryPlan.targetSiteDomains,
    internationalCoverageGap: Boolean(args.governedInternationalCoverageGap),
    signal: args.signal,
    maxRpcCalls: shadow ? 1 : 3,
    onRpcCall: () => {
      rpcCalls += 1;
    },
  });
  telemetry.governed_candidate_rpc_calls = rpcCalls;
  telemetry.governed_candidate_count = candidateResults.length;
  telemetry.governed_candidate_site_domains = queryPlan.targetSiteDomains;
  telemetry.candidate_match_counts = evaluateShadowCandidateMatchCounts(queryPlan, candidateResults);
  telemetry.embedding_latency_ms += embeddingLatencyMs;
  telemetry.supabase_rpc_latency_ms += Math.max(0, Date.now() - startedAt - embeddingLatencyMs);
  if (shadow) return { candidateResults, results: [], served: false };
  if (retrievalMode === "text") {
    telemetry.embedding_skipped = true;
    telemetry.embedding_skip_reason = providerSourceOnly ? SOURCE_ONLY_EMBEDDING_SKIP_REASON : "lexical_only";
  }

  const hydrated = await attachDocumentRankingMetadata(supabase, candidateResults, undefined);
  const selection = selectRetrievalEvidence({
    query,
    queryClass,
    results: rankClinicalResults(query, hydrated),
    topK: args.topK ?? 8,
    maxResultsPerDocument: queryClass === "comparison" ? 2 : 4,
  });
  telemetry.retrieval_intent = selection.intent;
  telemetry.retrieval_selection = selection.summary;
  let results = await attachPageVisualEvidence(supabase, selection.results);
  results = applySecondStageRerankIfNeeded({
    queryClass,
    results,
    telemetry,
    topK: args.topK ?? 8,
  });
  telemetry.retrieval_strategy =
    retrievalMode === "text" ? "text_fast_path" : retrievalMode === "vector" ? "vector_fallback" : "hybrid";
  return { candidateResults, results, served: true };
}
