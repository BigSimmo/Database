import { NextResponse } from "next/server";
import { healthResponse } from "@/lib/health-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// #L29: Railway's healthcheck target, so it cannot be gated behind auth or a
// durable per-request rate limit — the limiter itself would need a database
// round trip to check, defeating the point of bounding unauthenticated
// Supabase load. This route's response never depends on the caller (it always
// forces the deep probe, allows it unauthenticated, and omits every
// diagnostic field regardless of any token header — see the options below),
// so a short in-process cache of the whole computed result is safe: a burst
// of hits within the window shares one Supabase probe instead of paying for
// one each.
const READY_CACHE_TTL_MS = 2_000;
let cachedReady: { expiresAt: number; body: unknown; status: number } | null = null;

export async function GET(request: Request) {
  const now = Date.now();
  if (cachedReady && cachedReady.expiresAt > now) {
    return NextResponse.json(cachedReady.body, {
      status: cachedReady.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const response = await healthResponse(request, {
    forceDeep: true,
    allowUnauthenticatedDeep: true,
    includeSlo: false,
    includeCache: false,
    includeCoalescing: false,
    includeSpend: false,
    includeOperatorDiagnostics: false,
    // The one that matters for deployment. See the guard in `health-response.ts`: the
    // site-content audit takes ~7s and Railway allows each healthcheck attempt 10, which cost
    // this project 24 rolled-back production deploys before it was found. Readiness stays a
    // question about this container.
    includeSiteContent: false,
  });
  const body = (await response.clone().json()) as unknown;
  cachedReady = { expiresAt: now + READY_CACHE_TTL_MS, body, status: response.status };
  return response;
}
