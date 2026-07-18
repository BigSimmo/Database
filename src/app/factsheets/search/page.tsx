import type { Metadata } from "next";

import { filterFactsheets } from "@/components/factsheets/factsheets-data";
import { FactsheetsSearchPage } from "@/components/factsheets/factsheets-search-page";

export const metadata: Metadata = { title: "Search Patient Information | Clinical KB" };

export default async function FactsheetsSearchRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const query = (q ?? "").trim();
  const results = filterFactsheets(query, category);
  return <FactsheetsSearchPage query={query} category={category} results={results} />;
}
