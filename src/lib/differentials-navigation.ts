import { getPresentationWorkflowSelectionForDiagnosisIds } from "@/lib/differentials";

export function differentialRouteWithQuery(path: string, query: string, selectedIds?: Iterable<string>) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set("q", trimmedQuery);
  const ids = selectedIds ? Array.from(selectedIds, (id) => id.trim()).filter(Boolean) : [];
  if (ids.length > 0) params.set("ids", ids.join(","));
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function differentialSelectedCompareHref(query: string, selectedIds: Iterable<string>) {
  const selection = getPresentationWorkflowSelectionForDiagnosisIds(selectedIds);
  return differentialRouteWithQuery(
    `/differentials/presentations/${selection?.workflow.id ?? "acute-confusion-encephalopathy"}`,
    query,
    selection?.diagnosisIds,
  );
}
