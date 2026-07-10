import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import { buildServerTimingHeader, type ServerTimingEntry } from "@/lib/server-timing";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import {
  runUniversalSearch,
  universalSearchDomains,
  type UniversalSearchDomain,
  type UniversalSearchResponse,
} from "@/lib/universal-search";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

// Typeahead-friendly GET: cross-entity federated search over documents + the registry
// catalogues. Only an explicit demo/local deploy serves synthetic fixtures. Unlike the pure
// registry routes (which can short-circuit unauthenticated callers to an in-bundle catalogue),
// the documents domain must reach the live retrieval pipeline, so every non-demo caller runs the
// real search: anonymous callers are scoped to the public corpus (ownerId undefined ->
// allowGlobalSearch) and rate limited, and owners get their own records. Serving demo documents
// to live public callers here previously leaked the synthetic corpus (see runUniversalSearch demo
// path); it must never be reachable in production.
const universalSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: queryInteger({ fallback: 5, min: 1, max: 10 }),
  domains: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const requested = value
        .split(",")
        .map((domain) => domain.trim())
        .filter((domain): domain is UniversalSearchDomain => (universalSearchDomains as string[]).includes(domain));
      return requested.length ? requested : undefined;
    }),
});

function universalResponse(
  payload: Record<string, unknown> & Partial<Pick<UniversalSearchResponse, "groups" | "tookMs">>,
) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  // Per-domain + total durations for DevTools; names/durations only (no query data).
  const timingEntries: ServerTimingEntry[] = (payload.groups ?? []).map((group) => ({
    name: group.kind,
    durMs: group.latencyMs,
  }));
  if (typeof payload.tookMs === "number") timingEntries.push({ name: "total", durMs: payload.tookMs });
  const serverTiming = buildServerTimingHeader(timingEntries);
  if (serverTiming) headers["Server-Timing"] = serverTiming;
  return NextResponse.json(payload, { headers });
}

export async function GET(request: Request) {
  try {
    const { q, limit, domains } = parseRequestQuery(request, universalSearchQuerySchema, "Invalid universal query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      const payload = await runUniversalSearch({ query: q, limitPerDomain: limit, domains, demo: true });
      return universalResponse({ ...payload, demoMode: true });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Universal search requests are rate limited. Try again shortly.", rateLimit);
    }

    // demo:false + supabase always run the live pipeline. An anonymous caller (ownerId
    // undefined) is scoped to the public corpus via allowGlobalSearch and the real default
    // catalogues — never the synthetic demo fixtures.
    const payload = await runUniversalSearch({
      query: q,
      limitPerDomain: limit,
      domains,
      supabase,
      ownerId: access.ownerId,
      demo: false,
    });
    return universalResponse(access.ownerId ? payload : { ...payload, publicAccess: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
