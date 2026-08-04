// Server-Timing response header for the hot API routes, so per-request latency is
// visible in browser DevTools / curl without querying rag_queries telemetry.
// Only durations and short metric names are emitted — never query text, ids, or
// any user data (the header crosses the trust boundary to the client).

export type ServerTimingEntry = {
  name: string;
  durMs?: number;
  desc?: string;
};

// RFC 9110 token characters, conservatively narrowed: metric names must be short
// lowercase snake-case tokens; anything else is dropped rather than escaped.
const metricNamePattern = /^[a-z][a-z0-9_-]{0,63}$/;

function sanitizeDescription(desc: string) {
  // Header values cannot contain CR/LF; double quotes would terminate the quoted-string.
  return desc.replace(/[\r\n"\\]/g, " ").slice(0, 80);
}

export function buildServerTimingHeader(entries: ServerTimingEntry[]): string | null {
  const parts: string[] = [];
  for (const entry of entries) {
    if (!metricNamePattern.test(entry.name)) continue;
    let part = entry.name;
    if (typeof entry.durMs === "number" && Number.isFinite(entry.durMs)) {
      part += `;dur=${Math.max(0, Math.round(entry.durMs))}`;
    }
    if (entry.desc) {
      part += `;desc="${sanitizeDescription(entry.desc)}"`;
    }
    parts.push(part);
  }
  return parts.length ? parts.join(", ") : null;
}

// Per-request preamble timings: the identity, rate-limit and scope round trips
// every answer/search request pays before retrieval starts. These are the stages
// no other telemetry covers — rag_queries only records timings from retrieval
// onward, so without these the preamble is invisible.
//
// On a streaming route only the stages that complete before the response headers
// flush can be reported here (auth, ratelimit); in-stream stages cannot reach a
// response header, and routing them through the SSE contract would put
// instrumentation inside a governed client payload. /api/answer covers the
// remaining stages over the same resolveSearchScope + RAG path.
export function preambleServerTimingEntries(timings: {
  authMs?: number;
  rateLimitMs?: number;
  scopeMs?: number;
}): ServerTimingEntry[] {
  const entries: ServerTimingEntry[] = [];
  const push = (name: string, durMs: number | undefined) => {
    if (typeof durMs === "number" && Number.isFinite(durMs)) entries.push({ name, durMs });
  };
  push("auth", timings.authMs);
  push("ratelimit", timings.rateLimitMs);
  push("scope", timings.scopeMs);
  return entries;
}

// Answer-route timings from RagAnswer.latencyTimings (all values are millisecond
// durations computed in rag.ts). Missing fields are simply omitted.
export function answerServerTimingEntries(
  latencyTimings:
    | {
        search_latency_ms?: number;
        generation_latency_ms?: number;
        embedding_latency_ms?: number;
        supabase_rpc_latency_ms?: number;
        rerank_latency_ms?: number;
        total_latency_ms?: number;
      }
    | undefined,
  routeTotalMs: number,
): ServerTimingEntry[] {
  const entries: ServerTimingEntry[] = [];
  const push = (name: string, durMs: number | undefined) => {
    if (typeof durMs === "number" && Number.isFinite(durMs)) entries.push({ name, durMs });
  };
  push("search", latencyTimings?.search_latency_ms);
  push("rpc", latencyTimings?.supabase_rpc_latency_ms);
  push("embedding", latencyTimings?.embedding_latency_ms);
  push("rerank", latencyTimings?.rerank_latency_ms);
  push("generation", latencyTimings?.generation_latency_ms);
  push("answer", latencyTimings?.total_latency_ms);
  push("total", routeTotalMs);
  return entries;
}
