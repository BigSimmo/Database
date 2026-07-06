import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { publicAccessContext, shouldResolvePublicCatalogAccess } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import {
  runUniversalSearch,
  universalSearchDomains,
  type UniversalSearchDomain,
} from "@/lib/universal-search";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

// Typeahead-friendly GET: cross-entity federated search over documents + the registry
// catalogues. Access ladder mirrors /api/registry/records — demo/local serves fixtures,
// unauthenticated public serves the public catalogues, owners get their seeded records.
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
        .filter((domain): domain is UniversalSearchDomain =>
          (universalSearchDomains as string[]).includes(domain),
        );
      return requested.length ? requested : undefined;
    }),
});

function universalResponse(payload: Record<string, unknown>) {
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  try {
    const { q, limit, domains } = parseRequestQuery(request, universalSearchQuerySchema, "Invalid universal query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      const payload = await runUniversalSearch({ query: q, limitPerDomain: limit, domains, demo: true });
      return universalResponse({ ...payload, demoMode: true });
    }

    if (!shouldResolvePublicCatalogAccess(request)) {
      const payload = await runUniversalSearch({ query: q, limitPerDomain: limit, domains, demo: true });
      return universalResponse({ ...payload, publicAccess: true });
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

    if (!access.ownerId) {
      const payload = await runUniversalSearch({ query: q, limitPerDomain: limit, domains, demo: true });
      return universalResponse({ ...payload, publicAccess: true });
    }

    const payload = await runUniversalSearch({
      query: q,
      limitPerDomain: limit,
      domains,
      supabase,
      ownerId: access.ownerId,
      demo: false,
    });
    return universalResponse(payload);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
