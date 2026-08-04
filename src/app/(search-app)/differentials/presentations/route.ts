import { type NextRequest, NextResponse } from "next/server";

import { getPresentationWorkflowSelectionForDiagnosisIds } from "@/lib/differentials";

function presentationsRedirectLocation(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("query") ?? request.nextUrl.searchParams.get("q"))?.trim();
  const selectedIds = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selection = getPresentationWorkflowSelectionForDiagnosisIds(selectedIds);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (selection?.diagnosisIds.length) params.set("ids", selection.diagnosisIds.join(","));
  const pathname = `/differentials/presentations/${selection?.workflow.id ?? "acute-confusion-encephalopathy"}`;
  const suffix = params.toString();
  // Relative Location so redirects stay same-origin in the browser even when
  // the server request URL uses a bind address like 0.0.0.0.
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export function GET(request: NextRequest) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: presentationsRedirectLocation(request),
    },
  });
}

export const HEAD = GET;
