import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export function normalizeQueryText(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashQueryText(query: string) {
  return createHash("sha256").update(normalizeQueryText(query)).digest("hex");
}

// Raw clinical search queries are potential PHI. Unless raw retention is
// explicitly enabled, store only the normalized form (needed for miss-promotion
// and dedup) in place of the verbatim text (RET-H4). The `query`/`normalized_query`
// columns are NOT NULL, so the normalized form is the safe stand-in.
export function queryTextForStorage(query: string): string {
  return env.RAG_PERSIST_RAW_QUERY_TEXT ? query : normalizeQueryText(query);
}

// Privacy metadata to fold into a logged row's `metadata` jsonb: a stable hash
// for joins/dedup and a flag recording whether raw text was retained.
export function queryPrivacyMetadata(query: string) {
  return {
    query_hash: hashQueryText(query),
    raw_query_retained: env.RAG_PERSIST_RAW_QUERY_TEXT,
  };
}
