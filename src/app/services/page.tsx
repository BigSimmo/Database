import { Suspense } from "react";

import { ServicesHomePage } from "@/components/services/services-home-page";
import { ServicesNavigatorPage } from "@/components/services/services-navigator-page";

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

  if (!hasSubmittedSearch) {
    return <ServicesHomePage />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[color:var(--surface-wash)]" />}>
      <ServicesNavigatorPage />
    </Suspense>
  );
}
