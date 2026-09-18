import type { Metadata } from "next";

import { SourcesCataloguePage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Source catalogue",
  description: "Filter and sort the ranked clinical source catalogue by quality, jurisdiction, publisher and usage.",
};

type SourcesSearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Thin async wrapper only — Next 16 serves `searchParams` as a `Promise`, so
 * unwrapping it is the one thing here that has to be async. The catalogue reads
 * them because the filter, sort and page slice all run on the server now:
 * this route used to serialise all 866 entries into every response.
 */
export default async function SourcesSearchPage({ searchParams }: SourcesSearchPageProps) {
  return <SourcesCataloguePage searchParams={searchParams ? await searchParams : {}} />;
}
