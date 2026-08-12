import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ServicesHomePage } from "@/components/services/services-home-page";
import { ServicesNavigatorPage } from "@/components/services/services-navigator-page";
import { defaultServiceSlug } from "@/lib/services";

import ServicesLoading from "./loading";

type ServicesSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toURLSearchParams(params: Awaited<ServicesSearchParams>) {
  const normalized = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => normalized.append(key, item));
    } else if (value !== undefined) {
      normalized.set(key, value);
    }
  }
  return normalized;
}

export default async function ServicesIndexRoute({ searchParams }: { searchParams: ServicesSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const hasSubmittedSearch = readFirstSearchParam(resolvedSearchParams.run) === "1";
  const primaryQuery = readFirstSearchParam(resolvedSearchParams.q)?.trim();
  const legacyQuery = readFirstSearchParam(resolvedSearchParams.query)?.trim();

  if (hasSubmittedSearch && !primaryQuery && legacyQuery) {
    const canonicalSearchParams = toURLSearchParams(resolvedSearchParams);
    canonicalSearchParams.set("q", legacyQuery);
    canonicalSearchParams.delete("query");
    redirect(`/services?${canonicalSearchParams.toString()}`);
  }

  if (!hasSubmittedSearch) {
    // Computed server-side so the client route chunk never bundles the
    // services snapshot behind @/lib/services.
    return <ServicesHomePage defaultServiceSlug={defaultServiceSlug() ?? null} />;
  }

  return (
    <Suspense fallback={<ServicesLoading />}>
      <ServicesNavigatorPage />
    </Suspense>
  );
}
