import { redirect } from "next/navigation";

import { getPresentationWorkflowSelectionForDiagnosisIds } from "@/lib/differentials";

type DifferentialPresentationsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; ids?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialPresentationsRoute({ searchParams }: DifferentialPresentationsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.query ?? params.q)?.trim();
  const ids = firstSearchParam(params.ids)?.trim();
  const selectedIds = (ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selection = getPresentationWorkflowSelectionForDiagnosisIds(selectedIds);
  const destinationParams = new URLSearchParams();
  if (query) destinationParams.set("q", query);
  if (selection?.diagnosisIds.length) destinationParams.set("ids", selection.diagnosisIds.join(","));
  const suffix = destinationParams.size ? `?${destinationParams.toString()}` : "";
  redirect(`/differentials/presentations/${selection?.workflow.id ?? "acute-confusion-encephalopathy"}${suffix}`);
}
