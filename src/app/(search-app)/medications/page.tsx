import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appModeHomeHref, appModeSelectionHref } from "@/lib/app-modes";
import { readSearchNavigationContext } from "@/lib/search-navigation-context";

export const metadata: Metadata = {
  title: "Medication - PsychSift",
  description: "Medication dosing, safety, and monitoring guidance from indexed sources.",
};

type MedicationsRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function searchParamsFromRecord(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry);
    } else {
      search.set(key, value);
    }
  }
  return search;
}

/**
 * The Medication mode home has no page of its own any more.
 *
 * Like most other modes, `/medications` now forwards to the shared home at
 * `/?mode=prescribing` when idle, instead of rendering its own "Dose / Safety /
 * Monitoring / Access" shortcut tiles — those held no patient- or drug-specific
 * data, only navigational shortcuts that populated and ran a search, so retiring
 * them removes no clinical content.
 *
 * Unlike the ten-plus-Documents modes in `consolidatedModeHomePaths`
 * (`@/lib/consolidated-mode-home-redirect`), Medication is deliberately kept out
 * of that shared map: there is no `/medications/search` route, so the map's
 * generic `${pathname}/search` submitted-target logic would send a submitted
 * medication search to a page that doesn't exist. Its own bespoke redirect below
 * keeps the branch that already worked (submitted searches resolving to the
 * dashboard-owned prescribing results surface at `/?mode=prescribing&q=…&run=1`,
 * rendered by `ClinicalDashboard` via `MedicationPrescribingWorkspace`) and adds
 * the missing unsubmitted branch alongside it. `src/proxy.ts` mirrors both
 * branches for a fast 307; this stays as its backstop.
 */
export default async function MedicationsHomeRoute({ searchParams }: MedicationsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstSearchParam(params.q) ?? firstSearchParam(params.query) ?? "").trim();
  const focus = firstSearchParam(params.focus) === "1";
  const hasSubmittedSearch = firstSearchParam(params.run) === "1" && query.length > 0;

  if (hasSubmittedSearch) {
    const navigationContext = readSearchNavigationContext(searchParamsFromRecord(params));
    redirect(
      appModeHomeHref("prescribing", {
        query,
        focus,
        run: true,
        queryMode: navigationContext.queryMode,
        scopeFilters: navigationContext.scopeFilters,
        scopeRef: navigationContext.scopeRef,
      }),
    );
  } else {
    redirect(appModeSelectionHref("prescribing"));
  }
}
