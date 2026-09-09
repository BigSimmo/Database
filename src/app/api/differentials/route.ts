import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { deriveGovernanceFromSnapshot, type DifferentialRecordKind } from "@/lib/differential-records";
import type { DifferentialPresentationWorkflow, DifferentialRecord } from "@/lib/differential-snapshot";
import { loadDifferentialSnapshot } from "@/lib/differential-seed";
import {
  differentialRecords,
  rankDifferentialRecords,
  rankPresentationWorkflows,
  type DifferentialPresentationMatch,
  type DifferentialRecordMatch,
} from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import {
  canonicalSiteContentGovernance,
  readCanonicalSiteContentRecords,
} from "@/lib/site-content/site-content-publication";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

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

function differentialResponse(
  payload: Record<string, unknown>,
  options: { request?: Request; fixture?: boolean } = {},
) {
  return NextResponse.json(payload, { headers: fixtureResponseHeaders(options.request, options) });
}

function recordMatchesPayload(matches: DifferentialRecordMatch[]) {
  return matches.map((match) => ({ record: match.record, score: match.score, reasons: match.reasons }));
}

function presentationMatchesPayload(matches: DifferentialPresentationMatch[]) {
  return matches.map((match) => ({ workflow: match.workflow, score: match.score, reasons: match.reasons }));
}

function publicDifferentialPayload(kind: DifferentialRecordKind, q: string | undefined, limit: number) {
  const snapshot = loadDifferentialSnapshot();
  const governance = deriveGovernanceFromSnapshot(snapshot);
  if (kind === "presentation") {
    const ranked = q ? rankPresentationWorkflows(snapshot.presentations, q, limit) : null;
    return {
      presentations: ranked ? ranked.map((match) => match.workflow) : snapshot.presentations,
      matches: ranked ? presentationMatchesPayload(ranked) : undefined,
      total: snapshot.presentations.length,
      governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
    };
  }
  const ranked = q ? rankDifferentialRecords(differentialRecords, q, limit, [], true) : null;
  const records = ranked ? ranked.map((match) => match.record) : differentialRecords;
  return {
    records,
    matches: ranked ? recordMatchesPayload(ranked) : undefined,
    total: records.length,
    governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
  };
}

export async function GET(request: Request) {
  try {
    const { kind, q, limit } = parseRequestQuery(request, differentialListQuerySchema, "Invalid differential query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return differentialResponse(
        {
          publicAccess: true,
          ...publicDifferentialPayload(kind, q, limit),
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
      return rateLimitJsonResponse("Differential requests are rate limited. Try again shortly.", rateLimit);
    }

    const snapshot = loadDifferentialSnapshot();
    const seedGovernance = deriveGovernanceFromSnapshot(snapshot);
    if (kind === "presentation") {
      const canonical = await readCanonicalSiteContentRecords({
        supabase,
        kind: "presentation",
        slug: null,
        seeds: snapshot.presentations.map((workflow) => ({
          workflow,
          governance: {
            sourceStatus: seedGovernance.source_status,
            validationStatus: seedGovernance.validation_status,
          },
        })),
        mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
          workflow: finalRenderPayload as unknown as DifferentialPresentationWorkflow,
          governance: canonicalSiteContentGovernance(canonicalRecord),
        }),
      });
      const presentations = canonical.records.map((entry) => entry.workflow);
      const ranked = q ? rankPresentationWorkflows(presentations, q, limit) : null;
      return differentialResponse(
        {
          publicAccess: true,
          presentations: ranked ? ranked.map((match) => match.workflow) : presentations,
          matches: ranked ? presentationMatchesPayload(ranked) : undefined,
          total: presentations.length,
          governance: Object.fromEntries(canonical.records.map((entry) => [entry.workflow.id, entry.governance])),
        },
        { request, fixture: canonical.source === "seed_uninitialized" },
      );
    }
    const canonical = await readCanonicalSiteContentRecords({
      supabase,
      kind: "differential",
      slug: null,
      seeds: differentialRecords.map((record) => ({
        record,
        governance: { sourceStatus: seedGovernance.source_status, validationStatus: seedGovernance.validation_status },
      })),
      mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
        record: finalRenderPayload as unknown as DifferentialRecord,
        governance: canonicalSiteContentGovernance(canonicalRecord),
      }),
    });
    const records = canonical.records.map((entry) => entry.record);
    const ranked = q ? rankDifferentialRecords(records, q, limit) : null;
    return differentialResponse(
      {
        publicAccess: true,
        records: ranked ? ranked.map((match) => match.record) : records,
        matches: ranked ? recordMatchesPayload(ranked) : undefined,
        total: records.length,
        governance: Object.fromEntries(canonical.records.map((entry) => [entry.record.slug, entry.governance])),
      },
      { request, fixture: canonical.source === "seed_uninitialized" },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
