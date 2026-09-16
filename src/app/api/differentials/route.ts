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
  scopeDifferentialRecord,
  scopePresentationWorkflow,
  type DifferentialPresentationMatch,
  type DifferentialRecordMatch,
} from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import {
  catalogueListFallbackBudgetMs,
  catalogueListScope,
  readCatalogueWithSeedFallback,
} from "@/lib/site-content/catalogue-seed-fallback";
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
    // The catalogue size, not `records.length`. With `q` present `records` holds
    // the ranked matches, so measuring it made `total` the match count — which is
    // already in `records`/`matches` — while the other three branches here report
    // the catalogue (`snapshot.presentations.length` above, `rows.length` on both
    // owner paths). A caller asking "how many differentials are there" got the
    // size of its own result set back, so the differentials filter could not
    // state the catalogue figure and had to omit it.
    total: differentialRecords.length,
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
      const presentationSeeds = snapshot.presentations.map((workflow) => ({
        workflow,
        governance: {
          sourceStatus: seedGovernance.source_status,
          validationStatus: seedGovernance.validation_status,
        },
      }));
      // Bounded, and degrades to the in-bundle catalogue rather than hanging — the same treatment
      // `/api/medications` was given, and for the same reason: this read had no budget at all, so
      // a slow database left the Differentials mode waiting indefinitely instead of showing
      // something. See src/lib/site-content/catalogue-seed-fallback.ts.
      const observed: { source: "canonical_public" | "seed_uninitialized" } = { source: "canonical_public" };
      const canonical = await readCatalogueWithSeedFallback({
        kind: "presentation",
        // The list cooldown scope, not search's: a search giving up at 1200 ms is no evidence that
        // this read, allowed 6000 ms, would also fail.
        scope: catalogueListScope,
        seeds: presentationSeeds,
        budgetMs: catalogueListFallbackBudgetMs,
        read: async (signal) => {
          const result = await readCanonicalSiteContentRecords({
            supabase,
            kind: "presentation",
            slug: null,
            signal,
            // One public projection, no caller identity. Same reasoning as the registry list route.
            cache: true,
            seeds: presentationSeeds,
            mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
              workflow: scopePresentationWorkflow(finalRenderPayload as unknown as DifferentialPresentationWorkflow),
              governance: canonicalSiteContentGovernance(canonicalRecord),
            }),
          });
          observed.source = result.source;
          return result.records;
        },
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
          // `catalogue-seed-fallback` is explicit that `degraded` must never be dropped on the
          // floor: seeds can lag anything published since the last release, so the reader has to
          // be told the list may be stale.
          ...(canonical.degraded ? { retainedSnapshot: true as const } : {}),
        },
        // Not widened to cover `canonical.degraded`: `fixture` lengthens public caching, which
        // would pin a stale seed list in front of a database that may recover in thirty seconds.
        { request, fixture: observed.source === "seed_uninitialized" },
      );
    }
    const diagnosisSeeds = differentialRecords.map((record) => ({
      record,
      governance: { sourceStatus: seedGovernance.source_status, validationStatus: seedGovernance.validation_status },
    }));
    // Same budget and fallback as the presentation branch above; see the comment there.
    const observed: { source: "canonical_public" | "seed_uninitialized" } = { source: "canonical_public" };
    const canonical = await readCatalogueWithSeedFallback({
      kind: "differential",
      scope: catalogueListScope,
      seeds: diagnosisSeeds,
      budgetMs: catalogueListFallbackBudgetMs,
      read: async (signal) => {
        const result = await readCanonicalSiteContentRecords({
          supabase,
          kind: "differential",
          slug: null,
          signal,
          // One public projection, no caller identity. Same reasoning as the registry list route.
          cache: true,
          seeds: diagnosisSeeds,
          mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
            record: scopeDifferentialRecord(finalRenderPayload as unknown as DifferentialRecord),
            governance: canonicalSiteContentGovernance(canonicalRecord),
          }),
        });
        observed.source = result.source;
        return result.records;
      },
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
        ...(canonical.degraded ? { retainedSnapshot: true as const } : {}),
      },
      { request, fixture: observed.source === "seed_uninitialized" },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
