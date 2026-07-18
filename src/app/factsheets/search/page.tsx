import type { Metadata } from "next";

import { filterFactsheets } from "@/components/factsheets/factsheets-data";
import { FactsheetsSearchPage } from "@/components/factsheets/factsheets-search-page";

export const metadata: Metadata = { title: "Search Patient Information | Clinical KB" };

// App Router hands repeated query params (?q=a&q=b) through as string[]; collapse to
// the first value the way the DSM/Services search routes do, so a malformed link
// filters on one value instead of throwing on `.trim()`.
function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FactsheetsSearchRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; category?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim();
  const category = firstValue(params.category);
  const results = filterFactsheets(query, category);
  return <FactsheetsSearchPage query={query} category={category} results={results} />;
}
