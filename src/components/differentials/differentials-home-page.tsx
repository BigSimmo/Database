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
  const searchRequestSeqRef = useRef(0);

  const runSearch = useCallback(
    async (searchText: string) => {
      const normalized = searchText.trim();
      if (!normalized) return;
      const requestId = ++searchRequestSeqRef.current;

      setLoading(true);
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(differentialsSearchRequestBody(new URLSearchParams(searchParamString), normalized)),
        });

        if (requestId !== searchRequestSeqRef.current) return;
        if (!response.ok) {
          setDocumentMatches([]);
          return;
        }

        const payload = (await response.json()) as { documentMatches?: DocumentMatch[] };
        if (requestId !== searchRequestSeqRef.current) return;
        setDocumentMatches(payload.documentMatches ?? []);
      } catch {
        if (requestId !== searchRequestSeqRef.current) return;
        setDocumentMatches([]);
      } finally {
        if (requestId === searchRequestSeqRef.current) setLoading(false);
      }
    },
    [searchParamString],
  );

  useEffect(() => {
    if (autoRunSearch && trimmedQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void runSearch(trimmedQuery);
    }
  }, [autoRunSearch, trimmedQuery, runSearch]);

  return (
    <ModeHomeMain>
      <DifferentialsHome
        query={query}
        loading={loading}
        documentMatches={documentMatches}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        onRunSearch={(nextQuery) => {
          router.push(
            appModeHomeHref("differentials", {
              query: nextQuery,
              run: true,
              focus: true,
              queryMode: routedSearchContext.queryMode,
              scopeFilters: routedSearchContext.scopeFilters,
            }),
          );
        }}
      />
    </ModeHomeMain>
  );
}
