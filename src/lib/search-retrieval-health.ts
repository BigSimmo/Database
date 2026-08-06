import type { SearchRetrievalHealth } from "@/lib/types";

/**
 * Decide whether a search's empty/short result set is trustworthy.
 *
 * Retrieval deliberately fails soft: `searchTextChunkCandidates` records the RPC
 * error in `hybrid_rpc_errors` and returns an empty candidate list, so one bad
 * layer cannot take the whole search down. That is the right availability
 * trade-off and the wrong honesty one — downstream, a broken index and a topic
 * the corpus genuinely lacks are the same thing: zero rows behind HTTP 200.
 *
 * In a clinical reference tool the asymmetry matters. "No results" is read as
 * "no guidance exists", so a silent retrieval failure does not merely lose a
 * result, it manufactures a false negative. This turns the telemetry the
 * retrieval layer already records into something the reader can be shown.
 *
 * Pure and query-free by construction: only RPC names cross the boundary, never
 * the query, so the reason is safe to render, log, and persist.
 */
export function retrievalHealthFromTelemetry(telemetry: {
  hybrid_rpc_errors?: Record<string, string> | null;
}): SearchRetrievalHealth | null {
  const failedRpcs = Object.keys(telemetry.hybrid_rpc_errors ?? {}).sort();
  if (failedRpcs.length === 0) return null;
  return { degraded: true, reason: `retrieval_rpc_error:${failedRpcs.join(",")}` };
}
