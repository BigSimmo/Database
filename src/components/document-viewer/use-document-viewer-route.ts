"use client";

import { useCallback, useEffect, useState } from "react";

import { documentPageHref } from "@/lib/document-viewer-navigation";

/**
 * Keeps the document viewer page/chunk route in sync with the URL without
 * remounting the viewer (page flips replace the current history entry + local state).
 * Keeping PDF pagination out of the browser-history stack ensures the page-level
 * Back control returns to the route visited before this document.
 */
export function useDocumentViewerRoute({
  documentId,
  initialPage,
  chunkId,
}: {
  documentId: string;
  initialPage: number;
  chunkId?: string;
}) {
  const [activeRoute, setActiveRoute] = useState(() => ({ page: initialPage, chunkId }));
  const activePage = activeRoute.page;
  const activeChunkId = activeRoute.chunkId;

  useEffect(() => {
    const syncFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const parsedPage = Number.parseInt(params.get("page") ?? "", 10);
      setActiveRoute({
        page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
        chunkId: params.get("chunk") ?? undefined,
      });
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  const navigateToPage = useCallback(
    (page: number) => {
      const nextPage = Math.max(1, Math.trunc(page));
      if (nextPage === activePage) return;
      window.history.replaceState(null, "", documentPageHref(documentId, nextPage));
      setActiveRoute({ page: nextPage, chunkId: undefined });
    },
    [activePage, documentId],
  );

  return {
    activePage,
    activeChunkId,
    navigateToPage,
  };
}
