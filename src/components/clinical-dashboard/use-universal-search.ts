"use client";

import { useEffect, useRef, useState } from "react";

import type {
  UniversalSearchAnswerAction,
  UniversalSearchGroup,
  UniversalSearchInterpretation,
  UniversalSearchTopHit,
} from "@/lib/universal-search";
// Value import from the leaf module only: universal-search.ts itself is server-only
// (snapshot catalogues, rag, supabase) and must never enter the client bundle.
import { universalSearchDomains, type UniversalSearchDomain } from "@/lib/universal-search-domains";
import { consumeUniversalSearchNdjson } from "@/lib/universal-search-stream";
import type { AppModeId } from "@/lib/app-modes";
import { useAuthSession } from "@/lib/supabase/client";

export type UniversalSearchState = {
  groups: UniversalSearchGroup[];
  loading: boolean;
  /** The query the current groups were computed for (guards stale renders). */
  query: string;
  /** Query understanding for the "Showing results for… / Did you mean" affordance. */
  interpretation?: UniversalSearchInterpretation;
  /** Intent-aware order to render groups in (a permutation of the returned domains). */
  domainOrder?: UniversalSearchDomain[];
  /** Single highlighted best-bet across domains, when a confident match exists. */
  topHit?: UniversalSearchTopHit;
  /** Jump into Answer mode for question-like queries. */
  answerAction?: UniversalSearchAnswerAction;
  contextMode?: AppModeId;
  preferredDomains?: UniversalSearchDomain[];
};

type UniversalSearchResult = {
  groups: UniversalSearchGroup[];
  query: string;
  complete: boolean;
  interpretation?: UniversalSearchInterpretation;
  domainOrder?: UniversalSearchDomain[];
  topHit?: UniversalSearchTopHit;
  answerAction?: UniversalSearchAnswerAction;
  contextMode?: AppModeId;
  preferredDomains?: UniversalSearchDomain[];
};

type UniversalSearchCacheEntry = {
  value: UniversalSearchResult;
  expiresAt: number;
};

const debounceMs = 250;
const minQueryLength = 2;

// Small client-side LRU so backspace/retype and revisited prefixes resolve instantly instead of
// re-hitting the server. Module-scoped so the phone and tablet+ command surfaces share it. The
// key includes the auth signature, so one identity's cached results are never served to another
// (a signed-out user has a different key than the signed-in session that produced them).
// Entries expire after resultCacheTtlMs so a long session cannot retain stale typeahead forever.
const resultCacheMax = 100;
const resultCacheTtlMs = 5 * 60 * 1000;
const resultCache = new Map<string, UniversalSearchCacheEntry>();

function cacheKeyFor(
  query: string,
  contextMode: AppModeId,
  excludedDomainsKey: string,
  limitPerDomain: number,
  authSignature: string,
) {
  // JSON-array key so no field can collide with another via a shared delimiter (auth header
  // values and the query itself can contain spaces, commas, etc.).
  return JSON.stringify([authSignature, contextMode, excludedDomainsKey, limitPerDomain, query]);
}

// Non-mutating read used during render (must stay pure — no recency side effect here).
function peekResultCache(key: string): UniversalSearchResult | undefined {
  const cached = resultCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    resultCache.delete(key);
    return undefined;
  }
  return cached.value;
}

// Recency bump for a cache hit, called from the effect (not render) to keep render pure.
function touchResultCache(key: string) {
  const cached = resultCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) resultCache.delete(key);
    return;
  }
  resultCache.delete(key);
  resultCache.set(key, cached);
}

function writeResultCache(key: string, value: UniversalSearchResult) {
  resultCache.delete(key);
  resultCache.set(key, { value, expiresAt: Date.now() + resultCacheTtlMs });
  if (resultCache.size > resultCacheMax) {
    const oldest = resultCache.keys().next().value;
    if (oldest !== undefined) resultCache.delete(oldest);
  }
}

/** Test-only: clear the module-scoped universal search LRU between cases. */
export function clearUniversalSearchCacheForTests() {
  resultCache.clear();
}

/**
 * Cross-entity typeahead for the command surface: debounced GET
 * /api/search/universal excluding the active mode's own domain (its results
 * already come from the mode search itself). Race handling mirrors the
 * dashboard's monotonic searchRequestSeqRef — stale responses are dropped,
 * never committed; visible groups are derived from the fetched query so a
 * stale result set is never rendered against a newer query.
 */
export function useUniversalSearch(args: {
  query: string;
  enabled: boolean;
  contextMode: AppModeId;
  excludeDomains?: readonly UniversalSearchDomain[];
  limitPerDomain?: number;
}): UniversalSearchState {
  const { authorizationHeader } = useAuthSession();
  const [result, setResult] = useState<UniversalSearchResult>({ groups: [], query: "", complete: true });
  const requestSeqRef = useRef(0);
  const prevAuthRef = useRef(authorizationHeader);
  const trimmedQuery = args.query.trim();
  const active = args.enabled && trimmedQuery.length >= minQueryLength;
  const limitPerDomain = args.limitPerDomain ?? 3;
  const excludedDomainsKey = universalSearchDomains.filter((domain) => args.excludeDomains?.includes(domain)).join(",");
  const authSignature = JSON.stringify(authorizationHeader ?? {});
  const cacheKey = active
    ? cacheKeyFor(trimmedQuery, args.contextMode, excludedDomainsKey, limitPerDomain, authSignature)
    : null;

  useEffect(() => {
    const authChanged = prevAuthRef.current !== authorizationHeader;
    prevAuthRef.current = authorizationHeader;

    if (!active || !cacheKey) {
      // Invalidate any in-flight request; visible state is derived, so no reset needed.
      requestSeqRef.current += 1;
      return undefined;
    }
    const key = cacheKey;

    if (authChanged) {
      setResult({ groups: [], query: "", complete: true });
    }

    // Instant path: a previously fetched query needs no fetch. The render below reads the cache
    // directly (setState in an effect body would force a cascading render), so only bump recency
    // and invalidate any older in-flight request here.
    if (peekResultCache(key)) {
      touchResultCache(key);
      requestSeqRef.current += 1;
      return undefined;
    }

    const requestId = ++requestSeqRef.current;

    // Cancel the superseded request on the next keystroke: dropping the stale response client-side
    // is not enough — abort frees the server/DB work too.
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const excludedDomains = new Set(excludedDomainsKey ? excludedDomainsKey.split(",") : []);
      const domains = universalSearchDomains.filter((domain) => !excludedDomains.has(domain));
      const params = new URLSearchParams({
        q: trimmedQuery,
        limit: String(limitPerDomain),
        domains: domains.join(","),
        mode: args.contextMode,
        stream: "ndjson",
      });
      fetch(`/api/search/universal?${params.toString()}`, { headers: authorizationHeader, signal: controller.signal })
        .then(async (response) => {
          if (requestId !== requestSeqRef.current) return;
          if (!response.ok) {
            setResult({ groups: [], query: trimmedQuery, contextMode: args.contextMode, complete: true });
            return;
          }
          const payload = await consumeUniversalSearchNdjson(response, {
            signal: controller.signal,
            onGroup: (group, streamedQuery) => {
              if (controller.signal.aborted || requestId !== requestSeqRef.current || streamedQuery !== trimmedQuery) {
                return;
              }

              setResult((current) => {
                if (controller.signal.aborted || requestId !== requestSeqRef.current) return current;
                const groups =
                  current.query === trimmedQuery && current.contextMode === args.contextMode && !current.complete
                    ? current.groups.filter((candidate) => candidate.kind !== group.kind)
                    : [];
                if (!group.error && group.items.length > 0) groups.push(group);
                return {
                  groups,
                  query: trimmedQuery,
                  contextMode: args.contextMode,
                  complete: false,
                };
              });
            },
          });
          if (controller.signal.aborted || requestId !== requestSeqRef.current) return;
          const next: UniversalSearchResult = {
            groups: (payload.groups ?? []).filter((group) => !group.error && group.items.length > 0),
            query: trimmedQuery,
            complete: true,
            interpretation: payload.interpretation,
            domainOrder: payload.domainOrder,
            topHit: payload.topHit,
            answerAction: payload.answerAction,
            contextMode: payload.contextMode ?? args.contextMode,
            preferredDomains: payload.preferredDomains,
          };
          writeResultCache(key, next);
          setResult(next);
        })
        .catch((error: unknown) => {
          // An aborted fetch is a superseded keystroke, not a failure — leave state to the newer request.
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          if (requestId !== requestSeqRef.current) return;
          setResult({ groups: [], query: trimmedQuery, contextMode: args.contextMode, complete: true });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, cacheKey, trimmedQuery, excludedDomainsKey, limitPerDomain, authorizationHeader, args.contextMode]);

  if (!active) return { groups: [], loading: false, query: "" };

  // Prefer a cached snapshot for this exact query so backspace/retype is instant; otherwise fall
  // back to the fetched state, which only counts as fresh once its query matches the current one.
  const cached = cacheKey ? peekResultCache(cacheKey) : undefined;
  if (cached) {
    return {
      groups: cached.groups,
      loading: false,
      query: cached.query,
      interpretation: cached.interpretation,
      domainOrder: cached.domainOrder,
      topHit: cached.topHit,
      answerAction: cached.answerAction,
      contextMode: cached.contextMode,
      preferredDomains: cached.preferredDomains,
    };
  }
  const fresh = result.query === trimmedQuery && result.contextMode === args.contextMode;
  return {
    groups: fresh ? result.groups : [],
    loading: !fresh || !result.complete,
    query: result.query,
    interpretation: fresh ? result.interpretation : undefined,
    domainOrder: fresh ? result.domainOrder : undefined,
    topHit: fresh ? result.topHit : undefined,
    answerAction: fresh ? result.answerAction : undefined,
    contextMode: fresh ? result.contextMode : undefined,
    preferredDomains: fresh ? result.preferredDomains : undefined,
  };
}
