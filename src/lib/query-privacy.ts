import { createHash, createHmac } from "node:crypto";
import { clinicalVocabularyMatches } from "@/lib/clinical-vocabulary";
import { env } from "@/lib/env";

export function normalizeQueryText(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

// Audit M15: an unsalted SHA-256 of a short, low-entropy clinical query is
// dictionary-reversible (hash candidate patient/drug strings offline and
// match) and lets any reader of the log tables correlate the same query
// across rows — undermining the redaction it implements. When
// RAG_QUERY_HASH_SECRET is set, the stored hash is a keyed pseudonym
// (HMAC-SHA256): not offline-reversible and not correlatable outside this
// deployment. Without the secret, the legacy unsalted digest is kept so
// existing stored rows still join/dedup; set the secret in any environment
// where real clinical queries are logged.
export function hashQueryText(query: string) {
  const normalized = normalizeQueryText(query);
  if (env.RAG_QUERY_HASH_SECRET) {
    return createHmac("sha256", env.RAG_QUERY_HASH_SECRET).update(normalized).digest("hex");
  }
  return createHash("sha256").update(normalized).digest("hex");
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

export function answerTextForStorage(answer: string | null | undefined): string | null {
  return env.RAG_PERSIST_ANSWER_TEXT && typeof answer === "string" ? answer : null;
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

// RET-H4-safe candidate aliases for the alias-promotion pipeline (rag-hybrid-findings
// item 17): every returned string is a canonical term from the curated clinical
// vocabulary that the query MATCHED — the output text comes from the fixed vocabulary
// table, never from the raw query — so patient-identifying text cannot leak even with
// raw retention off. This unblocks rag_query_misses.candidate_aliases, which was always
// empty under redaction and starved data-driven promotion into rag_aliases.
export function queryVocabularyAliasesForStorage(query: string, limit = 10): string[] {
  return Array.from(new Set(clinicalVocabularyMatches(query, limit).map((entry) => entry.canonical))).slice(0, limit);
}

// Privacy metadata to fold into a logged row's `metadata` jsonb: a stable hash
// for joins/dedup and a flag recording whether raw text was retained.
export function queryPrivacyMetadata(query: string) {
  return {
    query_hash: hashQueryText(query),
    raw_query_retained: env.RAG_PERSIST_RAW_QUERY_TEXT,
  };
}
