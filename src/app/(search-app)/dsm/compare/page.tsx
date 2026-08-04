import type { Metadata } from "next";

import { DsmComparisonPage } from "@/components/dsm/dsm-comparison-page";
import { defaultDsmComparisonSlugs, getDsmDiagnosis, type DsmDiagnosis } from "@/lib/dsm";

export const metadata: Metadata = {
  title: "Compare DSM diagnoses | Clinical KB",
  description: "Compare core criteria, features, specifiers, and differential flags across DSM diagnosis records.",
};

type DsmComparisonRouteProps = {
  searchParams?: Promise<{ ids?: string | string[] }>;
};

function selectedDiagnoses(value?: string | string[]) {
  const requested = (Array.isArray(value) ? value[0] : value)
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const slugs = requested?.length ? requested : [...defaultDsmComparisonSlugs];
  const seen = new Set<string>();
  const diagnoses: DsmDiagnosis[] = [];
  for (const slug of slugs) {
    if (seen.has(slug) || diagnoses.length >= 3) continue;
    const diagnosis = getDsmDiagnosis(slug);
    if (!diagnosis) continue;
    seen.add(slug);
    diagnoses.push(diagnosis);
  }
  return diagnoses;
}

export default async function DsmComparisonRoute({ searchParams }: DsmComparisonRouteProps) {
  const params = searchParams ? await searchParams : {};
  return <DsmComparisonPage diagnoses={selectedDiagnoses(params.ids)} />;
}
