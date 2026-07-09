import { NextResponse } from "next/server";
import { z } from "zod";

<<<<<<< HEAD
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { defaultMedicationRecords } from "@/lib/medication-seed";
import { medicationSourceStatus, medicationValidationStatus } from "@/lib/medication-records";
=======
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { defaultMedicationRecords, fetchOwnerMedicationRowsWithSeed } from "@/lib/medication-seed";
import {
  medicationSourceStatus,
  medicationValidationStatus,
  rowGovernance,
  rowToMedicationRecord,
} from "@/lib/medication-records";
>>>>>>> origin/main
import {
  medicationToSearchResult,
  rankMedicationRecords,
  type MedicationRecord,
  type MedicationSearchMatch,
} from "@/lib/medications";
<<<<<<< HEAD
=======
import { publicAccessContext, shouldResolvePublicCatalogAccess } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
>>>>>>> origin/main
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

<<<<<<< HEAD
=======
const MEDICATION_MAX_RECORDS = 500;

>>>>>>> origin/main
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

<<<<<<< HEAD
=======
// `fields=index` strips the heavy per-record content (stats/sections/quick are
// ~99% of the ~3.4 MB catalog) for callers that only need identity-level
// ranking, e.g. the answer surface's cross-mode links. The records keep the
// full MedicationRecord shape so rankers and badge helpers work unchanged.
>>>>>>> origin/main
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

function medicationResponse(payload: Record<string, unknown>) {
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
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

<<<<<<< HEAD
    return medicationResponse({
      ...publicMedicationPayload(q, limit, fields),
      demoMode: isDemoMode() || isLocalNoAuthMode(),
      publicAccess: true,
    });
  } catch (error) {
=======
    if (isDemoMode() || isLocalNoAuthMode()) {
      return medicationResponse({
        ...publicMedicationPayload(q, limit, fields),
        demoMode: true,
      });
    }

    if (!shouldResolvePublicCatalogAccess(request)) {
      return medicationResponse({
        ...publicMedicationPayload(q, limit, fields),
        publicAccess: true,
      });
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
      return rateLimitJsonResponse("Medication requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return medicationResponse({
        ...publicMedicationPayload(q, limit, fields),
        publicAccess: true,
      });
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
>>>>>>> origin/main
    return jsonError(error);
  }
}
