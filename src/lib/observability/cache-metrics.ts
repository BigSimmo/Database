// In-process cache-lookup counters for the retrieval hot path.
//
// The cache hit-rate half of the /api/health silent-degradation counters (see
// docs/observability-slos.md). Its sibling `answer-slo.ts` aggregates
// `rag_queries` over a trailing window; cache effectiveness instead has to be
// measured where the lookups actually happen (the search-cache orchestration in
// searchChunksWithTelemetry) so it also covers requests that never write a
// rag_queries row — coalesced or fully cache-served.
//
// Counters are cumulative since process start (Prometheus-style): a host-native
// scraper derives a windowed hit-rate from the delta between two polls, which is
// exactly what a counter is for. `hitRate` is a convenience for eyeballing a
// single probe. Only cache-enabled lookups are recorded — a request that skips
// the cache (skipCache / TTL or size 0) is neither a hit nor a miss.

let lookups = 0;
let hits = 0;

/** Record one retrieval-cache lookup with its outcome. Cheap; safe on the hot path. */
export function recordCacheLookup(hit: boolean): void {
  lookups += 1;
  if (hit) hits += 1;
}

export type CacheMetricsSnapshot = {
  lookups: number;
  hits: number;
  misses: number;
  // 0..1; 0 when there have been no lookups yet (avoid divide-by-zero noise).
  hitRate: number;
};

export function cacheMetricsSnapshot(): CacheMetricsSnapshot {
  const misses = lookups - hits;
  return { lookups, hits, misses, hitRate: lookups > 0 ? hits / lookups : 0 };
}

/** Test-only: reset the counters between cases. */
export function resetCacheMetrics(): void {
  lookups = 0;
  hits = 0;
}

/**
 * Classify the outcome of the two-layer search-cache lookup so the counter
 * reflects real cache effectiveness. Retrieval consults the process-local cache
 * first and the shared (`rag_response_cache`) cache second; a request served by
 * *either* layer is a hit, so a cold process falling through to a warm shared
 * cache is not miscounted as a miss. When the search cache is disabled for this
 * request (`cacheEnabled` false — skipCache, or TTL/size 0) the lookup is
 * `"skip"` and recorded as neither; this is gated up front because the shared
 * lookup only short-circuits on skipCache/TTL, so a size-0 deployment would
 * otherwise record disabled lookups as misses and read as false degradation.
 * Pure, so the orchestration stays trivial and this stays unit-tested.
 */
export function classifySearchCacheOutcome(
  cacheEnabled: boolean,
  localHit: boolean,
  sharedResult: { kind: "hit" | "miss" } | null | undefined,
): "hit" | "miss" | "skip" {
  if (!cacheEnabled) return "skip";
  if (localHit || sharedResult?.kind === "hit") return "hit";
  if (sharedResult?.kind === "miss") return "miss";
  return "skip";
}
