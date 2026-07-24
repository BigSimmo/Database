import { FormsHomePage } from "@/components/forms/forms-home-page";
import { FormsSearchResultsPage } from "@/components/forms/forms-search-results-page";

type FormsSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FormsPage({ searchParams }: { searchParams: FormsSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = (
    readFirstSearchParam(resolvedSearchParams.q) ??
    readFirstSearchParam(resolvedSearchParams.query) ??
    ""
  ).trim();
  const hasSubmittedSearch = readFirstSearchParam(resolvedSearchParams.run) === "1" && query.length > 0;

  if (!hasSubmittedSearch) {
    return <FormsHomePage />;
  }

  return <FormsSearchResultsPage query={query} />;
}
