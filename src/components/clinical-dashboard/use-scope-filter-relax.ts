import { relaxDocumentScopeFilters } from "@/components/clinical-dashboard/clinical-dashboard-helpers";
import { useEventCallback } from "@/components/clinical-dashboard/use-event-callback";
import type { ClinicalQueryMode } from "@/lib/clinical-query-mode";
import type { SearchScopeFilters } from "@/lib/search-scope";

/**
 * Stable handler that re-runs the current Documents search against a relaxed
 * server-side scope.
 *
 * A hook rather than an inline callback in `ClinicalDashboard` for the reason
 * `check:maintainability-budgets` enforces: that component is at its no-growth
 * line budget, so new behaviour belongs in a cohesive module beside it. The
 * transform itself lives in `relaxDocumentScopeFilters`, which is framework-free
 * and unit-tested; this only binds it to the dashboard's state and keeps the
 * identity fixed so the results panel does not re-render per keystroke.
 */
export function useScopeFilterRelax<Mode>(
  query: string,
  queryMode: ClinicalQueryMode,
  searchMode: Mode,
  setScopeFilters: (filters: SearchScopeFilters) => void,
  runSearch: (
    query: string,
    mode: Mode,
    filters: SearchScopeFilters,
    queryMode: ClinicalQueryMode,
    replaceExistingAnswer: boolean,
  ) => unknown,
) {
  return useEventCallback((filters: SearchScopeFilters) =>
    relaxDocumentScopeFilters({ filters, query, queryMode, searchMode, setScopeFilters, runSearch }),
  );
}
