import type { Metadata } from "next";

import { OnCallSearchPage } from "@/components/on-call/on-call-search-page";

export const metadata: Metadata = {
  title: "Search On Call | PsychSift",
  description: "Search across your on-call contacts, playbook, referrals, orientation, teaching and logistics.",
};

type OnCallSearchRouteProps = {
  // No `run`: this page renders results for whatever query it is given, so
  // there is no idle state for `run=1` to trigger. A deep link carrying it
  // still works; the parameter simply has nothing to do here.
  searchParams?: Promise<{ q?: string | string[]; query?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted On Call searches, and the browse-all state for an empty query.
 *
 * `consolidatedModeHomePaths` maps `/on-call` onto the shared home, and a
 * submitted deep link forwards here through `appModeHomeHref`; without a real
 * page at this path that forward would loop
 * (tests/consolidated-mode-home-redirect.test.ts). `OnCallSearchPage` filters
 * `useOnCallEntries()`'s client cache with `rankOnCallEntries` — no server
 * search endpoint — and mounts the shared `SearchResultsHeaderBand`
 * (`resultsSurface: "results-band"` in the mode registry; see
 * `tests/search-results-band-adoption.test.ts`).
 */
export default async function OnCallSearchRoute({ searchParams }: OnCallSearchRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstSearchParam(params.q) ?? firstSearchParam(params.query) ?? "").trim();

  return <OnCallSearchPage initialQuery={query} />;
}
