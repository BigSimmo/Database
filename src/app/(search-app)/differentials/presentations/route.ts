import { type NextRequest, NextResponse } from "next/server";

import { getDifferentialRecord, getPresentationWorkflowSelectionForDiagnosisIds } from "@/lib/differentials";

function presentationsRedirectLocation(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("query") ?? request.nextUrl.searchParams.get("q"))?.trim();
  const selectedIds = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  // Keep every known catalogue id (cross-workflow compare pairs), but drop
  // unknowns and normalize case so redirects never advertise junk slugs.
  const knownIds = Array.from(new Set(selectedIds.filter((id) => Boolean(getDifferentialRecord(id)))));
  const selection = getPresentationWorkflowSelectionForDiagnosisIds(knownIds);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (knownIds.length) params.set("ids", knownIds.join(","));
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
