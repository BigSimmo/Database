import type { Metadata } from "next";

import { idsCompareHref, type CompareCatalogItem, type CompareStarterChip } from "@/components/compare";
import { DsmComparisonPage } from "@/components/dsm/dsm-comparison-page";
import { defaultDsmComparisonSlugs, getDsmDiagnosis, listDsmDiagnosisSummaries, type DsmDiagnosis } from "@/lib/dsm";

export const metadata: Metadata = {
  title: "Compare DSM diagnoses | Clinical KB",
  description: "Compare core criteria, features, specifiers, and differential flags across DSM diagnosis records.",
};

type DsmComparisonRouteProps = {
  searchParams?: Promise<{ ids?: string | string[] }>;
};

function selectedDiagnoses(value?: string | string[]) {
  const requested =
    (Array.isArray(value) ? value[0] : value)
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  const seen = new Set<string>();
  const diagnoses: DsmDiagnosis[] = [];
  for (const slug of requested) {
    if (seen.has(slug) || diagnoses.length >= 3) continue;
    const diagnosis = getDsmDiagnosis(slug);
    if (!diagnosis) continue;
    seen.add(slug);
    diagnoses.push(diagnosis);
  }
  return diagnoses;
}

function catalogItems(): CompareCatalogItem[] {
  return listDsmDiagnosisSummaries().map((summary) => ({
    id: summary.slug,
    title: summary.title,
    snippet: summary.summary,
    tag: summary.icd_code,
  }));
}

function starterChips(): CompareStarterChip[] {
  return [
    {
      id: "mdd-bp2-pdd",
      label: "MDD vs bipolar II vs PDD",
      href: idsCompareHref("/dsm/compare", [...defaultDsmComparisonSlugs]),
    },
  ];
}

export default async function DsmComparisonRoute({ searchParams }: DsmComparisonRouteProps) {
  const params = searchParams ? await searchParams : {};
  return (
    <DsmComparisonPage diagnoses={selectedDiagnoses(params.ids)} catalog={catalogItems()} starters={starterChips()} />
  );
}
