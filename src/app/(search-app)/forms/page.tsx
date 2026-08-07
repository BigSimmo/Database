import { defaultFormSlug } from "@/lib/forms";
import FormsPageClient from "./forms-page-client";
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

  return (
    <FormsPageClient
      defaultFormSlug={defaultFormSlug() ?? null}
      query={query}
      hasSubmittedSearch={hasSubmittedSearch}
    />
  );
}
