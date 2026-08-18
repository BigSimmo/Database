import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalculatorsHomePage, CalculatorsSearchPage } from "@/components/calculators";

export const metadata: Metadata = {
  title: "Calculators - Clinical KB",
  description: "Psychiatry clinical decision calculators and rating scales with source-cited scoring guidance.",
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

export default async function CalculatorsRoute({ searchParams }: { searchParams: CalculatorsSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const hasSubmittedSearch = readFirstSearchParam(resolvedSearchParams.run) === "1";
  const primaryQuery = readFirstSearchParam(resolvedSearchParams.q)?.trim();
  const legacyQuery = readFirstSearchParam(resolvedSearchParams.query)?.trim();
  const query = primaryQuery || legacyQuery;

  if (resolvedSearchParams.query !== undefined) {
    const canonicalSearchParams = toURLSearchParams(resolvedSearchParams);
    if (query) canonicalSearchParams.set("q", query);
    else canonicalSearchParams.delete("q");
    canonicalSearchParams.delete("query");
    const suffix = canonicalSearchParams.toString();
    redirect(suffix ? `/calculators?${suffix}` : "/calculators");
  }

  if (!hasSubmittedSearch || !query) return <CalculatorsHomePage />;

  return <CalculatorsSearchPage initialQuery={query} />;
}
