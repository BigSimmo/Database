import type { Metadata } from "next";

import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import {
  acuteConfusionPresentationWorkflow,
  getPresentationWorkflowSelectionForDiagnosisIds,
} from "@/lib/differentials";

export const metadata: Metadata = {
  title: "Compare differentials | Clinical KB",
  description: "Compare selected differential diagnoses side by side with safety and bedside context.",
};

type DifferentialCompareRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; ids?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialCompareRoute({ searchParams }: DifferentialCompareRouteProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = firstSearchParam(resolvedSearchParams.query ?? resolvedSearchParams.q)?.trim() ?? "";
  const selectedIds = (firstSearchParam(resolvedSearchParams.ids) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const selection = getPresentationWorkflowSelectionForDiagnosisIds(selectedIds);
  const workflow = selection?.workflow ?? acuteConfusionPresentationWorkflow;
  const resolvedIds = selection?.diagnosisIds ?? [];

  return (
    <DifferentialPresentationWorkflowPage
      query={query}
      presentationSlug={workflow.id}
      selectedIds={resolvedIds}
      workflow={selection ? workflow : undefined}
    />
  );
}
