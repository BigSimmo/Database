import { type NextRequest } from "next/server";

import { getPresentationWorkflowSelectionForDiagnosisIds } from "@/lib/differentials";

export function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("query") ?? request.nextUrl.searchParams.get("q"))?.trim();
  const selectedIds = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selection = getPresentationWorkflowSelectionForDiagnosisIds(selectedIds);
  const destinationParams = new URLSearchParams();
  if (query) destinationParams.set("q", query);
  if (selection?.diagnosisIds.length) destinationParams.set("ids", selection.diagnosisIds.join(","));
  const suffix = destinationParams.size ? `?${destinationParams.toString()}` : "";
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/differentials/presentations/${selection?.workflow.id ?? "acute-confusion-encephalopathy"}${suffix}`,
    },
  });
}

export const HEAD = GET;
