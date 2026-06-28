import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export function normalizeQueryText(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashQueryText(query: string) {
  return createHash("sha256").update(normalizeQueryText(query)).digest("hex");
}

function queryHashStorageText(query: string) {
  return `redacted-query:${hashQueryText(query)}`;
}

// Raw clinical search queries are potential PHI. Unless raw retention is
// explicitly enabled, persist only a deterministic hash placeholder (RET-H4).
// The `query`/`normalized_query` columns are NOT NULL, so the placeholder keeps
// joins/dedup possible without storing patient-identifying text.
export function queryTextForStorage(query: string): string {
  return env.RAG_PERSIST_RAW_QUERY_TEXT ? query : queryHashStorageText(query);
}

export function normalizedQueryTextForStorage(query: string): string {
  return env.RAG_PERSIST_RAW_QUERY_TEXT ? normalizeQueryText(query) : queryHashStorageText(query);
}

export function queryCacheKeyForStorage(cacheKey: string): string {
  return env.RAG_PERSIST_RAW_QUERY_TEXT ? cacheKey : `redacted-cache:${hashQueryText(cacheKey)}`;
}

export function queryDerivedTokensForStorage(tokens: string[]): string[] {
  return env.RAG_PERSIST_RAW_QUERY_TEXT ? tokens : [];
}

// Privacy metadata to fold into a logged row's `metadata` jsonb: a stable hash
// for joins/dedup and a flag recording whether raw text was retained.
export function queryPrivacyMetadata(query: string) {
  return {
    query_hash: hashQueryText(query),
    raw_query_retained: env.RAG_PERSIST_RAW_QUERY_TEXT,
  };
}
