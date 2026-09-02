import type { Metadata } from "next";

import { DsmSearchPage } from "@/components/dsm/dsm-search-page";
import { dsmCategories, listDsmDiagnosisSummaries } from "@/lib/dsm";

export const metadata: Metadata = {
  title: "Search DSM diagnoses | PsychSift",
  description:
    "Search the local DSM diagnosis catalogue by title, ICD code, category, criteria, and clinical features.",
};

type DsmSearchRouteProps = {
  searchParams?: Promise<{
    q?: string | string[];
    query?: string | string[];
    ids?: string | string[];
  }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DsmSearchRoute({ searchParams }: DsmSearchRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
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
      categories={dsmCategories}
      results={listDsmDiagnosisSummaries({ query })}
      initialIds={initialIds}
    />
  );
}
