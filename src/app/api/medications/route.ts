import { NextResponse } from "next/server";
import { z } from "zod";

import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { defaultMedicationRecords } from "@/lib/medication-seed";
import { medicationSourceStatus, medicationValidationStatus } from "@/lib/medication-records";
import {
  medicationToSearchResult,
  rankMedicationRecords,
  type MedicationRecord,
  type MedicationSearchMatch,
} from "@/lib/medications";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

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

    return medicationResponse({
      ...publicMedicationPayload(q, limit, fields),
      demoMode: isDemoMode() || isLocalNoAuthMode(),
      publicAccess: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
