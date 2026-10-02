import { NextResponse } from "next/server";
import { healthResponse } from "@/lib/health-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = await healthResponse(request);

  // #L29: an anonymous `GET /api/health?deep=1` folded `checks.supabase =
  // "unauthorized"` into the same 503 "degraded" shape healthResponse() uses
  // for a genuine outage. A monitor that pages on 5xx cannot tell "the
  // service is down" from "this caller omitted a bearer token" from that
  // status code alone. Reclassify that one case as 401 here, in the route,
  // without changing healthResponse() itself — /api/health/ready always
  // passes allowUnauthenticatedDeep: true and never hits this branch, so it
  // is unaffected.
  if (response.status === 503) {
    const body = (await response.clone().json()) as { checks?: Record<string, string> };
    if (body.checks?.supabase === "unauthorized") {
      return NextResponse.json(body, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
  }

  return response;
}
