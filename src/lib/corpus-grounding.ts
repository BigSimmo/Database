import type { createAdminClient } from "@/lib/supabase/admin";
import type { CorpusGroundingVerdict } from "@/lib/types";
import { normalizedClinicalSearchTokens } from "@/lib/clinical-search";

// Finding #11 (corpus-grounded relevance): the deterministic query analyzer cannot tell an
// in-corpus bare topic ("bipolar disorder") from an invented one ("florbizone syndrome
// management") — both land in the unsupported soft tail with identical confidence, and the LLM
// classifier fallback answers or refuses nondeterministically. Only the corpus can separate
// them, so this module classifies the query's content tokens against corpus statistics served
// by the `corpus_topic_term_stats` RPC (scoped exactly like retrieval):
//
//   * a token is ABSENT when no committed chunk has ever seen it (and no title matches) — the
//     signature of invented/unknown terms. Any absent token => "out_of_corpus". Typos are also
//     absent, and stay rescuable: the caller skips the LLM but the downstream short-circuit
//     still runs trigram correction before giving up.
//   * a token is a TOPIC ANCHOR when it matches at least one indexed document title AND its
//     title share stays under the genericity ceiling. Title words that headline a large share
//     of the corpus ("management" ~18%, "guideline" ~20% of titles, measured live 2026-07-07)
//     are scaffolding, not topics; real topics measure far lower (assessment 3.0%, disorder
//     1.6%, bipolar/anorexia <0.1%). No absent tokens + at least one anchor => "in_corpus_topic".
//   * anything else => "inconclusive", which callers must treat as "behave exactly as before"
//     (LLM classifier fallback + memoization). DB errors, demo mode, and a missing RPC also
//     fail open to "inconclusive" so this can never take retrieval down.
export type { CorpusGroundingVerdict };

export type CorpusGroundingResult = {
  verdict: CorpusGroundingVerdict;
  anchorTerms: string[];
  absentTerms: string[];
};

export type CorpusTopicTermStats = {
  term: string;
  has_ts_signal: boolean;
  title_doc_count: number;
  chunk_present: boolean;
  total_doc_count: number;
};

// Title-share above this is corpus scaffolding ("management" 18.2%, "guideline" 19.6% measured
// live), well clear of the largest measured real topic share ("assessment" 3.0%).
const topicGenericityCeiling = 0.05;
const maxGroundingTerms = 8;
const termStatsCacheTtlMs = 10 * 60 * 1000;
const termStatsCacheMaxEntries = 1024;

const termStatsCache = new Map<string, { expiresAt: number; stats: CorpusTopicTermStats }>();

export function resetCorpusGroundingCacheForTests() {
  termStatsCache.clear();
}

function cacheKey(ownerScopeKey: string, term: string) {
  return `${ownerScopeKey}|${term}`;
}

function readCachedStats(ownerScopeKey: string, term: string): CorpusTopicTermStats | null {
  const cached = termStatsCache.get(cacheKey(ownerScopeKey, term));
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    termStatsCache.delete(cacheKey(ownerScopeKey, term));
    return null;
  }
  return cached.stats;
}

function storeCachedStats(ownerScopeKey: string, stats: CorpusTopicTermStats) {
  if (termStatsCache.size >= termStatsCacheMaxEntries) {
    const oldestKey = termStatsCache.keys().next().value;
    if (oldestKey !== undefined) termStatsCache.delete(oldestKey);
  }
  termStatsCache.set(cacheKey(ownerScopeKey, stats.term), {
    expiresAt: Date.now() + termStatsCacheTtlMs,
    stats,
  });
}

export function corpusGroundingTerms(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const token of normalizedClinicalSearchTokens(query)) {
    if (/^\d+$/.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
    if (terms.length >= maxGroundingTerms) break;
  }
  return terms;
}

export function classifyCorpusGroundingFromStats(stats: CorpusTopicTermStats[]): CorpusGroundingResult {
  // Stopword-ish tokens stem to an empty tsquery and carry no corpus signal either way.
  const signals = stats.filter((entry) => entry.has_ts_signal);
  if (signals.length === 0) return { verdict: "inconclusive", anchorTerms: [], absentTerms: [] };

  const totalDocs = signals[0]?.total_doc_count ?? 0;
  if (totalDocs <= 0) return { verdict: "inconclusive", anchorTerms: [], absentTerms: [] };

  const absentTerms = signals
    .filter((entry) => !entry.chunk_present && entry.title_doc_count === 0)
    .map((entry) => entry.term);
  const anchorTerms = signals
    .filter((entry) => entry.title_doc_count >= 1 && entry.title_doc_count / totalDocs <= topicGenericityCeiling)
    .map((entry) => entry.term);

  if (absentTerms.length > 0) return { verdict: "out_of_corpus", anchorTerms, absentTerms };
  if (anchorTerms.length > 0) return { verdict: "in_corpus_topic", anchorTerms, absentTerms };
  return { verdict: "inconclusive", anchorTerms, absentTerms };
}

export async function classifyCorpusGrounding(args: {
  supabase: ReturnType<typeof createAdminClient>;
  query: string;
  // The exact owner_filter retrieval will use (null = unscoped, zero-UUID = public docs only).
  ownerFilter: string | null;
}): Promise<CorpusGroundingResult> {
  const terms = corpusGroundingTerms(args.query);
  if (terms.length === 0) return { verdict: "inconclusive", anchorTerms: [], absentTerms: [] };

  const ownerScopeKey = args.ownerFilter ?? "unscoped";
  const stats: CorpusTopicTermStats[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    const cached = readCachedStats(ownerScopeKey, term);
    if (cached) stats.push(cached);
    else missing.push(term);
  }

  if (missing.length > 0) {
    try {
      const { data, error } = await args.supabase.rpc("corpus_topic_term_stats", {
        terms: missing,
        owner_filter: args.ownerFilter,
      });
      if (error) throw error;
      const rows = (data ?? []) as CorpusTopicTermStats[];
      // A term the RPC did not echo back got dropped SQL-side (blank after trim); treat the
      // whole classification as inconclusive rather than guessing.
      if (rows.length !== missing.length) return { verdict: "inconclusive", anchorTerms: [], absentTerms: [] };
      for (const row of rows) {
        storeCachedStats(ownerScopeKey, row);
        stats.push(row);
      }
    } catch {
      // Fail open: missing RPC (migration not applied), transient DB error, demo mode — the
      // caller keeps today's behaviour (LLM classifier fallback + soft-tail short-circuit).
      return { verdict: "inconclusive", anchorTerms: [], absentTerms: [] };
    }
  }

  return classifyCorpusGroundingFromStats(stats);
}
