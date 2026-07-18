import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import { rankFormRecords, formRecords } from "@/lib/forms";
import { deriveGovernanceColumns, type RegistryRecordKind } from "@/lib/registry-records";
import {
  fetchOwnerRegistryRows,
  mergeRegistryGovernanceWithDefaults,
  mergeRegistryRecordsWithDefaults,
} from "@/lib/registry-seed";
import { rankServiceRecords, serviceRecords, type ServiceRecord, type ServiceSearchMatch } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

// The list is a small curated per-owner set that clients fetch in full and
// rank client-side, so the whole set must be returned (never truncated) or
// rows past the cap become invisible to Services/Forms search and undercount
// the home footers. This ceiling is a defensive bound well above realistic
// registry sizes; `limit` only bounds the ranked `matches` for a `q` query.
const REGISTRY_MAX_RECORDS = 500;

const registryListQuerySchema = z.object({
  kind: z.enum(["service", "form"]),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
});

function rankRecords(kind: RegistryRecordKind, records: ServiceRecord[], query: string, limit: number) {
  return kind === "form" ? rankFormRecords(records, query, limit) : rankServiceRecords(records, query, limit);
}

function registryResponse(payload: Record<string, unknown>, options: { request?: Request; fixture?: boolean } = {}) {
  return NextResponse.json(payload, { headers: fixtureResponseHeaders(options.request, options) });
}

function matchesPayload(matches: ServiceSearchMatch[]) {
  return matches.map((match) => ({ record: match.service, score: match.score, reasons: match.reasons }));
}

function publicRegistryPayload(kind: RegistryRecordKind, q: string | undefined, limit: number) {
  const records = kind === "form" ? formRecords : serviceRecords;
  const governance = Object.fromEntries(
    records.map((record) => {
      const derived = deriveGovernanceColumns(record);
      return [record.slug, { sourceStatus: derived.source_status, validationStatus: derived.validation_status }];
    }),
  );
  return {
    records,
    matches: q ? matchesPayload(rankRecords(kind, records, q, limit)) : undefined,
    total: records.length,
    governance,
  };
}

export async function GET(request: Request) {
  try {
    const { kind, q, limit } = parseRequestQuery(request, registryListQuerySchema, "Invalid registry query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return registryResponse(
        {
          ...publicRegistryPayload(kind, q, limit),
          demoMode: true,
        },
        { request, fixture: true },
      );
    }

    // Anonymous callers still resolve access + rate limit: publicAccessContext skips the
    // Supabase auth round-trip for requests with no session cookie/bearer, but every caller
    // (authenticated or not) must pass the registry limiter before we serve the full catalog.
    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Registry requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return registryResponse(
        {
          ...publicRegistryPayload(kind, q, limit),
          publicAccess: true,
        },
        { request, fixture: true },
      );
    }

    const rows = await fetchOwnerRegistryRows(supabase, access.ownerId, kind, REGISTRY_MAX_RECORDS);
    const records = mergeRegistryRecordsWithDefaults(kind, rows);
    const governanceBySlug = mergeRegistryGovernanceWithDefaults(kind, rows);

    return registryResponse({
      records,
      matches: q ? matchesPayload(rankRecords(kind, records, q, limit)) : undefined,
      total: records.length,
      governance: governanceBySlug,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
