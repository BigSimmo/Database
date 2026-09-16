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

  // `probes: "readiness"` is the whole contract, and it replaced six `include*: false` lines.
  //
  // Those six were a deny-list, and a deny-list on this endpoint is a deploy outage waiting for
  // its next entry. Whatever gets added to the deep branch is live on Railway's healthcheck
  // until somebody remembers to come back here and switch it off by name. Nobody did, for the
  // ~7 s site-content integrity audit, on an endpoint Railway allows ten seconds: 24 consecutive
  // production deploys built, started cleanly, answered too slowly and were rolled back, and the
  // live site sat on three-day-old code while `main` moved on.
  //
  // Now the endpoint states what it is instead of listing what it is not, so a probe added later
  // is diagnostic-only unless someone deliberately says otherwise in `health-response.ts`.
  // Readiness is a question about THIS CONTAINER: configuration, and one bounded Supabase
  // `select ... limit 1`. Nothing shared, nothing whole-corpus, nothing unbounded.
  const response = await healthResponse(request, {
    forceDeep: true,
    allowUnauthenticatedDeep: true,
    probes: "readiness",
  });
  const body = (await response.clone().json()) as unknown;
  cachedReady = { expiresAt: now + READY_CACHE_TTL_MS, body, status: response.status };
  return response;
}
