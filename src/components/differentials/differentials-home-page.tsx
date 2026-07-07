"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DifferentialsHome } from "@/components/clinical-dashboard/differentials-home";
import { ModeHomeMain } from "@/components/mode-home-template";
import { appModeHomeHref, appModeQueryMode } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import type { DocumentMatch } from "@/lib/types";

type DifferentialsHomePageProps = {
  query?: string;
  autoRunSearch?: boolean;
};

export function DifferentialsHomePage({ query = "", autoRunSearch = false }: DifferentialsHomePageProps) {
  const router = useRouter();
  const trimmedQuery = query.trim();
  const [loading, setLoading] = useState(false);
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);

  const runSearch = useCallback(async (searchText: string) => {
    const normalized = searchText.trim();
    if (!normalized) return;

    setLoading(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalized,
          mode: "differentials",
          queryMode: appModeQueryMode("differentials", "auto"),
          documentLimit: 30,
          topK: 20,
        }),
      });

      if (!response.ok) {
        setDocumentMatches([]);
        return;
      }

      const payload = (await response.json()) as { documentMatches?: DocumentMatch[] };
      setDocumentMatches(payload.documentMatches ?? []);
    } catch {
      setDocumentMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
          router.push(appModeHomeHref("differentials", { query: nextQuery, run: true, focus: true }));
        }}
      />
    </ModeHomeMain>
  );
}
