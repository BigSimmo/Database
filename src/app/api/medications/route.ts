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
import { defaultMedicationRecords, fetchOwnerMedicationRowsWithSeed } from "@/lib/medication-seed";
import {
  medicationSourceStatus,
  medicationValidationStatus,
  rowGovernance,
  rowToMedicationRecord,
} from "@/lib/medication-records";
import {
  medicationToSearchResult,
  rankMedicationRecords,
  type MedicationRecord,
  type MedicationSearchMatch,
} from "@/lib/medications";
import { publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const MEDICATION_MAX_RECORDS = 500;

const medicationListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: queryInteger({ fallback: 50, min: 1, max: 100 }),
  fields: z.enum(["index"]).optional(),
});

// `fields=index` strips the heavy per-record content (stats/sections/quick are
// ~99% of the ~3.4 MB catalog) for callers that only need identity-level
// ranking, e.g. the answer surface's cross-mode links. The records keep the
// full MedicationRecord shape so rankers and badge helpers work unchanged.
function toIndexRecords(records: MedicationRecord[]): MedicationRecord[] {
  return records.map((record) => ({
    slug: record.slug,
    name: record.name,
    class: record.class,
    subclass: record.subclass,
    category: record.category,
    accent: record.accent,
    tag: record.tag,
    schedule: record.schedule,
    stats: [],
    sections: [],
    quick: [],
  }));
}

function medicationResponse(payload: Record<string, unknown>, options: { request?: Request; fixture?: boolean } = {}) {
  return NextResponse.json(payload, { headers: fixtureResponseHeaders(options.request, options) });
}

function matchesPayload(matches: MedicationSearchMatch[]) {
  return matches.map((match) => ({
    medication: match.medication,
    result: medicationToSearchResult(match),
    score: match.score,
    reasons: match.reasons,
  }));
}

function publicMedicationPayload(q: string | undefined, limit: number, fields?: "index") {
  const records = fields === "index" ? toIndexRecords(defaultMedicationRecords()) : defaultMedicationRecords();
  const governance = Object.fromEntries(
    records.map((record) => [
      record.slug,
      {
        sourceStatus: medicationSourceStatus("current"),
        validationStatus: medicationValidationStatus("locally_reviewed"),
      },
    ]),
  );
  const matches = q ? rankMedicationRecords(records, q, limit) : undefined;
  return {
    records,
    matches: matches ? matchesPayload(matches) : undefined,
    total: records.length,
    governance,
  };
}

export async function GET(request: Request) {
  try {
    const { q, limit, fields } = parseRequestQuery(request, medicationListQuerySchema, "Invalid medication query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return medicationResponse(
        {
          ...publicMedicationPayload(q, limit, fields),
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
      return rateLimitJsonResponse("Medication requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return medicationResponse(
        {
          ...publicMedicationPayload(q, limit, fields),
          publicAccess: true,
        },
        { request, fixture: true },
      );
    }

    const rows = await fetchOwnerMedicationRowsWithSeed(supabase, access.ownerId, MEDICATION_MAX_RECORDS);
    const fullRecords = rows.map(rowToMedicationRecord);
    const records = fields === "index" ? toIndexRecords(fullRecords) : fullRecords;
    const governanceBySlug = Object.fromEntries(rows.map((row) => [row.slug, rowGovernance(row)]));

    return medicationResponse({
      records,
      matches: q ? matchesPayload(rankMedicationRecords(records, q, limit)) : undefined,
      total: rows.length,
      governance: governanceBySlug,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
