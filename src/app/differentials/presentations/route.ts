import { type NextRequest, NextResponse } from "next/server";

import { getPresentationWorkflowSelectionForDiagnosisIds } from "@/lib/differentials";

export function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("query") ?? request.nextUrl.searchParams.get("q"))?.trim();
  const selectedIds = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selection = getPresentationWorkflowSelectionForDiagnosisIds(selectedIds);
  const destination = new URL(
    `/differentials/presentations/${selection?.workflow.id ?? "acute-confusion-encephalopathy"}`,
    request.url,
  );
  if (query) destination.searchParams.set("q", query);
  if (selection?.diagnosisIds.length) destination.searchParams.set("ids", selection.diagnosisIds.join(","));
  return NextResponse.redirect(destination);
}

export const HEAD = GET;
