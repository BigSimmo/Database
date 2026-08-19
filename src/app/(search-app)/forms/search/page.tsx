import type { Metadata } from "next";

import { FormsSearchResultsPage } from "@/components/forms/forms-search-results-page";

export const metadata: Metadata = {
  title: "Search clinical forms | Clinical KB",
  description: "Search the WA MHA 2014 forms register by code, title and clinical purpose.",
};

type RouteProps = {
  searchParams?: Promise<{ q?: string | string[]; query?: string | string[]; run?: string | string[] }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted forms searches.
 *
 * Split out of the bare `/forms` path when that became a redirect onto the shared
 * home: results need a route of their own, or `appModeHomeHref` would send a
 * submitted query back through the redirect and loop.
 */
export default async function FormsSearchRoute(props: RouteProps) {
  const params = props.searchParams ? await props.searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
  return <FormsSearchResultsPage query={query} />;
}
