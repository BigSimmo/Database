"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DifferentialsHome } from "@/components/clinical-dashboard/differentials-home";
import { ModeHomeMain } from "@/components/mode-home-template";
import { appModeHomeHref } from "@/lib/app-modes";
import { differentialsSearchRequestBody } from "@/lib/differentials-search-request";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { readSearchNavigationContext } from "@/lib/search-navigation-context";
import type { DocumentMatch } from "@/lib/types";

type DifferentialsHomePageProps = {
  query?: string;
  autoRunSearch?: boolean;
};

export function DifferentialsHomePage({ query = "", autoRunSearch = false }: DifferentialsHomePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const routedSearchContext = useMemo(
    () => readSearchNavigationContext(new URLSearchParams(searchParamString)),
    [searchParamString],
  );
  const trimmedQuery = query.trim();
  const [loading, setLoading] = useState(false);
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);
  const [evidenceQuery, setEvidenceQuery] = useState<string | null>(null);
  const searchRequestSeqRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (searchText: string, signal?: AbortSignal) => {
      const normalized = searchText.trim();
      if (!normalized) return;
      const requestId = ++searchRequestSeqRef.current;

      setLoading(true);
      setEvidenceQuery(null);
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(differentialsSearchRequestBody(new URLSearchParams(searchParamString), normalized)),
          signal,
        });

        if (requestId !== searchRequestSeqRef.current) return;
        if (!response.ok) {
          setDocumentMatches([]);
          return;
        }

        const payload = (await response.json()) as { documentMatches?: DocumentMatch[] };
        if (requestId !== searchRequestSeqRef.current) return;
        setEvidenceQuery(normalized);
        setDocumentMatches(payload.documentMatches ?? []);
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        if (requestId !== searchRequestSeqRef.current) return;
        setDocumentMatches([]);
      } finally {
        if (requestId === searchRequestSeqRef.current) setLoading(false);
      }
    },
    [searchParamString],
  );

  useEffect(() => {
    if (!autoRunSearch || !trimmedQuery) return undefined;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch(trimmedQuery, controller.signal);
    return () => {
      controller.abort();
      if (searchAbortRef.current === controller) searchAbortRef.current = null;
    };
  }, [autoRunSearch, trimmedQuery, runSearch]);

  const navigateToSearch = useCallback(
    (nextQuery: string) => {
      router.push(
        appModeHomeHref("differentials", {
          query: nextQuery,
          run: true,
          focus: true,
          queryMode: routedSearchContext.queryMode,
          scopeFilters: routedSearchContext.scopeFilters,
        }),
      );
    },
    [router, routedSearchContext.queryMode, routedSearchContext.scopeFilters],
  );

  // `autoRunSearch` is true on /differentials?q=…&run=1 — that mounts the tall
  // SearchResultsView. Empty homes stay centred; results must top-align or the
  // Best Answer / query band are clipped above the phone scrollport.
  const showingResults = autoRunSearch;

  return (
    <ModeHomeMain contentAlign={showingResults ? "start" : "center"}>
      <DifferentialsHome
        query={query}
        loading={loading}
        searchSubmitted={autoRunSearch}
        documentMatches={documentMatches}
        evidenceQuery={evidenceQuery}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        onRunSearch={navigateToSearch}
        onSuggestedSearch={navigateToSearch}
      />
    </ModeHomeMain>
  );
}
