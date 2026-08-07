import { defaultServiceSlug } from "@/lib/services";
import ServicesPageClient from "./services-page-client";

type ServicesSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ServicesIndexRoute({ searchParams }: { searchParams: ServicesSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = (
    readFirstSearchParam(resolvedSearchParams.q) ??
    readFirstSearchParam(resolvedSearchParams.query) ??
    ""
  ).trim();
  const hasSubmittedSearch = readFirstSearchParam(resolvedSearchParams.run) === "1" && query.length > 0;

  return (
    <ServicesPageClient defaultServiceSlug={defaultServiceSlug() ?? null} hasSubmittedSearch={hasSubmittedSearch} />
  );
}
