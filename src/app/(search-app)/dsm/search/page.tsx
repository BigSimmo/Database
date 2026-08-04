import type { Metadata } from "next";

import { DsmSearchPage } from "@/components/dsm/dsm-search-page";
import { dsmCategories, dsmDiagnoses, listDsmDiagnosisSummaries } from "@/lib/dsm";

export const metadata: Metadata = {
  title: "Search DSM diagnoses | Clinical KB",
  description:
    "Search the local DSM diagnosis catalogue by title, ICD code, category, criteria, and clinical features.",
};

type DsmSearchRouteProps = {
  searchParams?: Promise<{
    q?: string | string[];
    query?: string | string[];
    category?: string | string[];
    ids?: string | string[];
  }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DsmSearchRoute({ searchParams }: DsmSearchRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
  const requestedCategory = firstValue(params.category)?.trim();
  const category = dsmCategories.some((item) => item.key === requestedCategory) ? requestedCategory : undefined;
  const rawIds = firstValue(params.ids) ?? "";
  const initialIds = rawIds
    ? rawIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  return (
    <DsmSearchPage
      query={query}
      category={category}
      categories={dsmCategories}
      results={listDsmDiagnosisSummaries({ query, category })}
      totalCount={dsmDiagnoses.length}
      initialIds={initialIds}
    />
  );
}
