import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { defaultMedicationRecords, ensureMedicationsSeeded } from "@/lib/medication-seed";
import {
  medicationSourceStatus,
  medicationValidationStatus,
  rowGovernance,
  rowToMedicationRecord,
  type MedicationRecordRow,
} from "@/lib/medication-records";
import { medicationToSearchResult, rankMedicationRecords, type MedicationSearchMatch } from "@/lib/medications";
import { hasPublicApiAuthSignal, publicAccessContext } from "@/lib/public-api-access";
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
});

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

function publicMedicationPayload(q: string | undefined, limit: number) {
  const records = defaultMedicationRecords();
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
    const { q, limit } = parseRequestQuery(request, medicationListQuerySchema, "Invalid medication query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return medicationResponse({
        ...publicMedicationPayload(q, limit),
        demoMode: true,
      });
    }

    if (!hasPublicApiAuthSignal(request)) {
      return medicationResponse({
        ...publicMedicationPayload(q, limit),
        publicAccess: true,
      });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "medications",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Medication requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return medicationResponse({
        ...publicMedicationPayload(q, limit),
        publicAccess: true,
      });
    }

    const fetchRecords = async () => {
      const { data, error } = await supabase
        .from("medication_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .order("name")
        .limit(MEDICATION_MAX_RECORDS);
      if (error) throw new Error(error.message);
      return (data ?? []) as MedicationRecordRow[];
    };

    let rows = await fetchRecords();
    if (rows.length === 0) {
      try {
        await ensureMedicationsSeeded(supabase, access.ownerId);
      } catch (seedError) {
        console.error(`[medications] auto-seed failed for owner ${access.ownerId}`, seedError);
      }
      rows = await fetchRecords();
    }

    const records = rows.map(rowToMedicationRecord);
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
