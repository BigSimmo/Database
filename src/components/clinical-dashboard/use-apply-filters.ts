import type { RefObject } from "react";

import { useEventCallback } from "@/components/clinical-dashboard/use-event-callback";
import type { ClinicalQueryMode } from "@/lib/clinical-query-mode";
import type { SearchNavigationContext } from "@/lib/search-navigation-context";
import type { SearchScopeFilters } from "@/lib/search-scope";

type AskFn = (
  searchText: string,
  contextOverride?: SearchNavigationContext,
  replaceExistingAnswer?: boolean,
) => unknown;

/**
 * Stable handler that commits a staged Documents filter apply and re-runs the
 * current search against the newly selected source scope.
 *
 * A hook rather than an inline callback in `ClinicalDashboard` for the reason
 * `check:maintainability-budgets` enforces: that component is at its no-growth
 * line budget, so new behaviour belongs in a cohesive module beside it.
 */
export function useApplyFilters(
  query: string,
  queryMode: ClinicalQueryMode,
  setScopeFilters: (filters: SearchScopeFilters) => void,
  setSelectedDocumentIds: (documentIds: string[]) => void,
  askRef: RefObject<AskFn>,
) {
  return useEventCallback((filters: SearchScopeFilters, documentIds: string[]) => {
    setScopeFilters(filters);
    setSelectedDocumentIds(documentIds);
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    // Let the selected-source state commit before `ask` builds the private
    // scope reference. Calling the live ref prevents a stale render closure
    // from submitting the previous source selection.
    window.requestAnimationFrame(() => {
      void askRef.current(trimmedQuery, { queryMode, scopeFilters: filters }, true);
    });
  });
}
