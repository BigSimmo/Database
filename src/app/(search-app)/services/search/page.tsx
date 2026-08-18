import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ServicesNavigatorPage } from "@/components/services/services-navigator-page";

import ServicesLoading from "../loading";

export const metadata: Metadata = {
  title: "Search clinical services | Clinical KB",
  description: "Search the private services registry by need, catchment, eligibility and referral route.",
};

type ServicesSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toURLSearchParams(params: Awaited<ServicesSearchParams>) {
  const normalized = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => normalized.append(key, item));
    else if (value !== undefined) normalized.set(key, value);
  }
  return normalized;
}

/**
 * Submitted services searches.
 *
 * Split out of the bare `/services` path when that became a redirect onto the
 * shared home: results need a route of their own, or `appModeHomeHref` would
 * send a submitted query back through the redirect and loop.
 *
 * The legacy `?query=` canonicalisation moves with the results rather than
 * staying behind on the redirect stub. `ServicesNavigatorPage` reads the query
 * from the URL, so an old deep link that still says `query=` has to be rewritten
 * to `q=` here or it reaches the results surface with nothing to search for.
 */
export default async function ServicesSearchRoute({ searchParams }: { searchParams: ServicesSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const primaryQuery = readFirstSearchParam(resolvedSearchParams.q)?.trim();
  const legacyQuery = readFirstSearchParam(resolvedSearchParams.query)?.trim();

  if (!primaryQuery && legacyQuery) {
    const canonicalSearchParams = toURLSearchParams(resolvedSearchParams);
    canonicalSearchParams.set("q", legacyQuery);
    canonicalSearchParams.delete("query");
    redirect(`/services/search?${canonicalSearchParams.toString()}`);
  }

  return (
    <Suspense fallback={<ServicesLoading />}>
      <ServicesNavigatorPage />
    </Suspense>
  );
}
