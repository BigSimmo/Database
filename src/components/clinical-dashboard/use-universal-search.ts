"use client";

import { useEffect, useRef, useState } from "react";

import type {
  UniversalSearchAnswerAction,
  UniversalSearchDomain,
  UniversalSearchGroup,
  UniversalSearchInterpretation,
  UniversalSearchTopHit,
} from "@/lib/universal-search";
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
};

type UniversalSearchResult = {
  groups: UniversalSearchGroup[];
  query: string;
  interpretation?: UniversalSearchInterpretation;
  domainOrder?: UniversalSearchDomain[];
  topHit?: UniversalSearchTopHit;
  answerAction?: UniversalSearchAnswerAction;
};

const debounceMs = 250;
const minQueryLength = 2;

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
  excludeDomain?: UniversalSearchDomain;
  limitPerDomain?: number;
}): UniversalSearchState {
  const { authorizationHeader } = useAuthSession();
  const [result, setResult] = useState<UniversalSearchResult>({ groups: [], query: "" });
  const requestSeqRef = useRef(0);
  const prevAuthRef = useRef(authorizationHeader);
  const trimmedQuery = args.query.trim();
  const active = args.enabled && trimmedQuery.length >= minQueryLength;
  const limitPerDomain = args.limitPerDomain ?? 3;
  const excludeDomain = args.excludeDomain;

  useEffect(() => {
    const authChanged = prevAuthRef.current !== authorizationHeader;
    prevAuthRef.current = authorizationHeader;

    if (!active) {
      // Invalidate any in-flight request; visible state is derived, so no reset needed.
      requestSeqRef.current += 1;
      return undefined;
    }

    if (authChanged) {
      setResult({ groups: [], query: "" });
    }

    const requestId = ++requestSeqRef.current;
    const timer = window.setTimeout(() => {
      const domains = (["documents", "medications", "services", "forms", "differentials", "tools"] as const).filter(
        (domain) => domain !== excludeDomain,
      );
      const params = new URLSearchParams({
        q: trimmedQuery,
        limit: String(limitPerDomain),
        domains: domains.join(","),
      });
      fetch(`/api/search/universal?${params.toString()}`, { headers: authorizationHeader })
        .then(async (response) => {
          if (requestId !== requestSeqRef.current) return;
          if (!response.ok) {
            setResult({ groups: [], query: trimmedQuery });
            return;
          }
          const payload = (await response.json()) as Partial<UniversalSearchResult>;
          if (requestId !== requestSeqRef.current) return;
          setResult({
            groups: (payload.groups ?? []).filter((group) => !group.error && group.items.length > 0),
            query: trimmedQuery,
            interpretation: payload.interpretation,
            domainOrder: payload.domainOrder,
            topHit: payload.topHit,
            answerAction: payload.answerAction,
          });
        })
        .catch(() => {
          if (requestId !== requestSeqRef.current) return;
          setResult({ groups: [], query: trimmedQuery });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [active, trimmedQuery, excludeDomain, limitPerDomain, authorizationHeader]);

  if (!active) return { groups: [], loading: false, query: "" };
  const fresh = result.query === trimmedQuery;
  return {
    groups: fresh ? result.groups : [],
    loading: !fresh,
    query: result.query,
    interpretation: fresh ? result.interpretation : undefined,
    domainOrder: fresh ? result.domainOrder : undefined,
    topHit: fresh ? result.topHit : undefined,
    answerAction: fresh ? result.answerAction : undefined,
  };
}
