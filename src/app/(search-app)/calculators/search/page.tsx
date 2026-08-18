import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalculatorsSearchPage } from "@/components/calculators";

export const metadata: Metadata = {
  title: "Search clinical calculators | Clinical KB",
  description: "Search source-cited psychiatry scores and clinical decision calculators by indication and name.",
};

type CalculatorsSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toURLSearchParams(params: Awaited<CalculatorsSearchParams>) {
  const normalized = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => normalized.append(key, item));
    else if (value !== undefined) normalized.set(key, value);
  }
  return normalized;
}

/**
 * Submitted calculator searches.
 *
 * Split out of the bare `/calculators` path when that became a redirect onto the
 * shared home: results need a route of their own, or `appModeHomeHref` would send
 * a submitted query back through the redirect and loop.
 *
 * The legacy `?query=` canonicalisation moves with the results rather than staying
 * behind on the redirect stub, so an old deep link still lands on `?q=` here
 * instead of being normalised against a path that no longer renders anything.
 */
export default async function CalculatorsSearchRoute({ searchParams }: { searchParams: CalculatorsSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const primaryQuery = readFirstSearchParam(resolvedSearchParams.q)?.trim();
  const legacyQuery = readFirstSearchParam(resolvedSearchParams.query)?.trim();
  const query = primaryQuery || legacyQuery;

  if (resolvedSearchParams.query !== undefined) {
    const canonicalSearchParams = toURLSearchParams(resolvedSearchParams);
    if (query) canonicalSearchParams.set("q", query);
    else canonicalSearchParams.delete("q");
    canonicalSearchParams.delete("query");
    const suffix = canonicalSearchParams.toString();
    redirect(suffix ? `/calculators/search?${suffix}` : "/calculators/search");
  }

  if (!query) redirect("/?mode=calculators");

  return <CalculatorsSearchPage initialQuery={query} />;
}
