import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { idsCompareHref, type CompareCatalogItem, type CompareStarterChip } from "@/components/compare";
import { DifferentialCompareQueuePage } from "@/components/differentials/differential-compare-queue-page";
import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import {
  differentialCompareQueueItems,
  differentialRecords,
  resolveDifferentialCompareHandoff,
  resolveDifferentialCompareLaunchHref,
} from "@/lib/differentials";

export const metadata: Metadata = {
  title: "Compare differentials | PsychSift",
  description: "Compare selected differential diagnoses side by side with safety and bedside context.",
};

type DifferentialCompareRouteProps = {
  searchParams?: Promise<{
    query?: string | string[];
    q?: string | string[];
    ids?: string | string[];
    workspace?: string | string[];
  }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Compare queue: empty state or selected diagnosis ids. Open comparison launches
 * a catalogue presentation workflow, or an ad-hoc workspace (`workspace=1`) when
 * selections span presentations.
 */
export default async function DifferentialCompareRoute({ searchParams }: DifferentialCompareRouteProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = firstSearchParam(resolvedSearchParams.query ?? resolvedSearchParams.q)?.trim() ?? "";
  const selectedIds = (firstSearchParam(resolvedSearchParams.ids) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const workspace = firstSearchParam(resolvedSearchParams.workspace)?.trim() === "1";

  const catalog: CompareCatalogItem[] = differentialRecords.map((record) => ({
    id: record.slug,
    title: record.title,
    snippet: record.clinicalHinge,
    tag: record.status,
  }));
  const extra = query ? { q: query } : undefined;
  const starters: CompareStarterChip[] = [
    {
      id: "delirium-dementia",
      label: "Delirium vs dementia",
      href: idsCompareHref("/differentials/compare", ["delirium", "dementia-neurocognitive-disorder"], extra),
    },
    {
      id: "intoxication-withdrawal",
      label: "Intoxication vs withdrawal",
      href: idsCompareHref("/differentials/compare", ["substance-intoxication", "substance-withdrawal"], extra),
    },
  ];

  if (!workspace) {
    return (
      <DifferentialCompareQueuePage
        query={query}
        items={differentialCompareQueueItems(selectedIds)}
        openComparisonHref={resolveDifferentialCompareLaunchHref(selectedIds, query)}
        catalog={catalog}
        starters={starters}
      />
    );
  }

  const handoff = resolveDifferentialCompareHandoff(selectedIds, query);
  if (handoff.kind === "presentation") {
    redirect(handoff.href);
  }

  return (
    <DifferentialPresentationWorkflowPage
      query={query}
      presentationSlug={handoff.selection.workflow.id}
      selectedIds={handoff.selection.diagnosisIds}
      workflow={handoff.selection.workflow}
    />
  );
}
