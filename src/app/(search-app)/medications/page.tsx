import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appModeHomeHref } from "@/lib/app-modes";
import { readSearchNavigationContext } from "@/lib/search-navigation-context";

import { MedicationsHomeClient } from "./medications-home-client";

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
 * The Medication mode home.
 *
 * Replaces the former blanket 307 alias to `/?mode=prescribing`: `/` is now the
 * single shared home for every mode, so prescribing needs its own home like every
 * other mode. `/medications` is always-standalone and owns its body via
 * `MedicationsHomeClient` (the shared shell does not mount the dashboard here).
 *
 * Submitted deep links (`q` + `run=1`) still resolve to the dashboard-owned
 * prescribing results surface at `/?mode=prescribing&q=…&run=1`, preserving old
 * bookmarks from when this path was a full redirect.
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
  }

  return <MedicationsHomeClient />;
}
