import type { Metadata } from "next";

import {
  idsCompareHref,
  parseCompareIds,
  type CompareCatalogItem,
  type CompareStarterChip,
} from "@/components/compare";
import { DsmComparisonPage } from "@/components/dsm/dsm-comparison-page";
import { defaultDsmComparisonSlugs, listDsmDiagnosisSummaries, resolveDsmCompareIds } from "@/lib/dsm";

export const metadata: Metadata = {
  title: "Compare DSM diagnoses | PsychSift",
  description: "Compare core criteria, features, specifiers, and differential flags across DSM diagnosis records.",
};

type DsmComparisonRouteProps = {
  searchParams?: Promise<{ ids?: string | string[] }>;
};

function selectedComparison(value?: string | string[]) {
  return resolveDsmCompareIds(parseCompareIds(Array.isArray(value) ? value[0] : value, 3));
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
  const { diagnoses, selectedIds } = selectedComparison(params.ids);
  return (
    <DsmComparisonPage
      diagnoses={diagnoses}
      selectedIds={selectedIds}
      catalog={catalogItems()}
      starters={starterChips()}
    />
  );
}
