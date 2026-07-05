import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import {
  deriveGovernanceFromSnapshot,
  rowGovernance,
  rowToDifferentialRecord,
  rowToPresentationWorkflow,
  type DifferentialRecordKind,
  type DifferentialRecordRow,
} from "@/lib/differential-records";
import { ensureDifferentialsSeeded, loadDifferentialSnapshot } from "@/lib/differential-seed";
import {
  differentialRecords,
  searchDifferentialRecords,
  searchPresentationWorkflows,
} from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { hasPublicApiAuthSignal, publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

const DIFFERENTIAL_MAX_RECORDS = 500;

const differentialListQuerySchema = z.object({
  kind: z.enum(["presentation", "diagnosis"]).optional().default("diagnosis"),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
});

function differentialResponse(payload: Record<string, unknown>) {
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}

function publicDifferentialPayload(kind: DifferentialRecordKind, q: string | undefined, limit: number) {
  const snapshot = loadDifferentialSnapshot();
  const governance = deriveGovernanceFromSnapshot(snapshot);
  if (kind === "presentation") {
    const presentations = q ? searchPresentationWorkflows(q).slice(0, limit) : snapshot.presentations;
    return {
      presentations,
      total: snapshot.presentations.length,
      governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
    };
  }
  const records = q ? searchDifferentialRecords(q).slice(0, limit) : differentialRecords;
  return {
    records,
    total: records.length,
    governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
  };
}

export async function GET(request: Request) {
  try {
    const { kind, q, limit } = parseRequestQuery(request, differentialListQuerySchema, "Invalid differential query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return differentialResponse({
        ...publicDifferentialPayload(kind, q, limit),
        demoMode: true,
      });
    }

    if (!hasPublicApiAuthSignal(request)) {
      return differentialResponse({
        ...publicDifferentialPayload(kind, q, limit),
        publicAccess: true,
      });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Differential requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return differentialResponse({
        ...publicDifferentialPayload(kind, q, limit),
        publicAccess: true,
      });
    }

    const fetchRecords = async (recordKind: DifferentialRecordKind) => {
      const { data, error } = await supabase
        .from("differential_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .eq("kind", recordKind)
        .order("title")
        .limit(DIFFERENTIAL_MAX_RECORDS);
      if (error) throw new Error(error.message);
      return (data ?? []) as DifferentialRecordRow[];
    };

    let rows = await fetchRecords(kind);
    if (rows.length === 0) {
      try {
        await ensureDifferentialsSeeded(supabase, access.ownerId);
      } catch (seedError) {
        console.error(`[differentials] auto-seed failed for owner ${access.ownerId}`, seedError);
      }
      rows = await fetchRecords(kind);
    }

    if (kind === "presentation") {
      const presentations = rows.map(rowToPresentationWorkflow);
      const filtered = q
        ? searchPresentationWorkflows(q)
            .filter((presentation) => presentations.some((row) => row.id === presentation.id))
            .slice(0, limit)
        : presentations;
      return differentialResponse({
        presentations: filtered,
        total: rows.length,
        governance: Object.fromEntries(rows.map((row) => [row.slug, rowGovernance(row)])),
      });
    }

    const records = rows.map(rowToDifferentialRecord);
    const filtered = q
      ? searchDifferentialRecords(q)
          .filter((record) => records.some((row) => row.slug === record.slug))
          .slice(0, limit)
      : records;
    return differentialResponse({
      records: filtered,
      total: rows.length,
      governance: Object.fromEntries(rows.map((row) => [row.slug, rowGovernance(row)])),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
