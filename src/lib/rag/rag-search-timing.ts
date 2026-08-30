import { evaluateShadowCandidateMatchCounts } from "@/lib/rag/rag-coverage";
import type { SearchTelemetry } from "@/lib/rag/rag-contracts";
import type { RagQueryPlan, SearchResult } from "@/lib/types";

export type SearchTiming = {
  startedAt: number;
  phases: Record<string, number>;
  shadowPlan?: RagQueryPlan;
};

export function createSearchTiming(): SearchTiming {
  return { startedAt: Date.now(), phases: {} };
}

export async function measureSearchPhase<T>(
  timing: SearchTiming,
  phase: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await operation();
  } finally {
    timing.phases[phase] = (timing.phases[phase] ?? 0) + (Date.now() - startedAt);
  }
}

export function finishSearch<T extends { results: SearchResult[]; telemetry: SearchTelemetry }>(
  timing: SearchTiming,
  search: T,
): T {
  if (timing.shadowPlan && !search.telemetry.candidate_match_counts) {
    search.telemetry.candidate_match_counts = evaluateShadowCandidateMatchCounts(timing.shadowPlan, search.results);
  }
  search.telemetry.retrieval_phase_latencies_ms = { ...timing.phases };
  search.telemetry.search_total_latency_ms = Date.now() - timing.startedAt;
  return search;
}
