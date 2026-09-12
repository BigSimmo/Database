import { evaluateShadowCandidateMatchCounts } from "@/lib/rag/rag-coverage";
import type { SearchTelemetry } from "@/lib/rag/rag-contracts";
import type { RagQueryPlan, SearchResult } from "@/lib/types";

export type SearchTiming = {
  startedAt: number;
  phases: Record<string, number>;
  shadowPlan?: RagQueryPlan;
  shadowCandidateResults?: SearchResult[];
  shadowState?: "pending" | "completed" | "failed" | "cancelled";
  closeShadow?: () => void;
};

/** The child shares caller cancellation, but legacy completion may cancel it independently. */
export function startShadowSearch(
  timing: SearchTiming,
  parentSignal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<{ candidateResults: SearchResult[] } | null>,
) {
  const child = new AbortController();
  let closed = false;
  const abort = () => child.abort();
  if (parentSignal?.aborted) abort();
  else parentSignal?.addEventListener("abort", abort, { once: true });
  timing.shadowState = "pending";
  timing.closeShadow = () => {
    if (closed) return;
    closed = true;
    parentSignal?.removeEventListener("abort", abort);
    if (timing.shadowState === "pending") timing.shadowState = "cancelled";
    child.abort();
  };
  // Consume every rejection, including synchronous adapter failures, without logging private text.
  void Promise.resolve()
    .then(() => {
      child.signal.throwIfAborted();
      return operation(child.signal);
    })
    .then(
      (result) => {
        if (closed) return;
        timing.shadowState = "completed";
        timing.shadowCandidateResults = result?.candidateResults ?? [];
      },
      () => {
        if (!closed) timing.shadowState = child.signal.aborted ? "cancelled" : "failed";
      },
    );
}

export function closeShadowSearch(timing: SearchTiming) {
  timing.closeShadow?.();
}

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
  closeShadowSearch(timing);
  if (timing.shadowState) search.telemetry.shadow_retrieval_state = timing.shadowState;
  if (timing.shadowPlan && timing.shadowState === "completed" && !search.telemetry.candidate_match_counts) {
    search.telemetry.candidate_match_counts = evaluateShadowCandidateMatchCounts(
      timing.shadowPlan,
      timing.shadowCandidateResults ?? [],
    );
  }
  search.telemetry.retrieval_phase_latencies_ms = { ...timing.phases };
  search.telemetry.search_total_latency_ms = Date.now() - timing.startedAt;
  return search;
}
