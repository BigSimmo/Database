import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { deriveGovernanceFromSnapshot, normalizeDifferentialSlug } from "@/lib/differential-records";
import type { DifferentialPresentationWorkflow, DifferentialRecord } from "@/lib/differential-snapshot";
import { loadDifferentialSnapshot } from "@/lib/differential-seed";
import {
  getDifferentialRecord,
  getPresentationWorkflow,
  scopeDifferentialRecord,
  scopePresentationWorkflow,
} from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import {
  catalogueDetailScope,
  catalogueListFallbackBudgetMs,
  catalogueListScope,
  catalogueUnavailableNotice,
  readCatalogueWithSeedFallback,
} from "@/lib/site-content/catalogue-seed-fallback";
import {
  canonicalSiteContentGovernance,
  readCanonicalSiteContentRecords,
} from "@/lib/site-content/site-content-publication";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

function differentialResponse(
  payload: Record<string, unknown>,
  init: { status?: number; request?: Request; fixture?: boolean } = {},
) {
  return NextResponse.json(payload, {
    status: init.status ?? 200,
    headers: fixtureResponseHeaders(init.request, init),
  });
}

function notFoundResponse(slug: string) {
  return publicErrorResponse(`No differential presentation found for "${slug}".`, 404, {
    code: "differential_presentation_not_found",
  });
}

/**
 * A fallback that fired with no in-bundle copy of this slug means the read failed, not that the
 * presentation is absent — so the reader is told the database is unreachable rather than being
 * told, on the strength of a timeout, that it does not exist. See `catalogueUnavailableNotice`.
 */
function catalogueUnavailableResponse() {
  return publicErrorResponse(catalogueUnavailableNotice, 503, {
    code: "differential_presentation_catalogue_unavailable",
  });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = normalizeDifferentialSlug(slug);

    if (isDemoMode() || isLocalNoAuthMode()) {
      const snapshot = loadDifferentialSnapshot();
      const workflow = getPresentationWorkflow(normalizedSlug);
      if (!workflow) return notFoundResponse(normalizedSlug);
      const governance = deriveGovernanceFromSnapshot(snapshot);
      const candidates = workflow.candidates.flatMap((candidate) => {
        const record = getDifferentialRecord(candidate.slug);
        if (!record) return [];
        return [{ ...candidate, record }];
      });
      return differentialResponse(
        {
          workflow,
          candidates,
          governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
          demoMode: true,
        },
        { request, fixture: true },
      );
    }

    // Anonymous callers still resolve access + rate limit before we serve the seed detail:
    // publicAccessContext skips the Supabase auth round-trip when there's no session cookie/bearer,
    // but every caller must pass the registry limiter (M4/C1 — no anonymous bypass).
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
    const seedWorkflow = getPresentationWorkflow(normalizedSlug);
    const presentationSeeds = seedWorkflow
      ? [
          {
            workflow: seedWorkflow,
            governance: {
              sourceStatus: seedGovernance.source_status,
              validationStatus: seedGovernance.validation_status,
              lastReviewedAt: null,
              reviewDueAt: null,
            },
          },
        ]
      : [];
    const diagnosisSeeds = snapshot.diagnoses.map((record) => ({ record }));
    const observed: {
      presentation: "canonical_public" | "seed_uninitialized";
      population: "canonical_public" | "seed_uninitialized";
    } = { presentation: "canonical_public", population: "canonical_public" };

    // Both reads are bounded, and both start together.
    //
    // They were sequential, but the second does not depend on the first: it is `slug: null` either
    // way, because it hydrates `workflow.candidates` from the whole diagnosis catalogue. Awaiting
    // them in turn simply added one full catalogue round trip to the page's wall clock. The cost of
    // running them together is that a request for a presentation that does not exist now also pays
    // the population read; that is the rare path, and it is bounded by the same budget.
    //
    // Neither read had a budget before, so a slow database left this page waiting indefinitely.
    // Neither is cached: `readCanonicalSiteContentRecords` reserves the uncached path for detail
    // reads so an operator always sees their own publication immediately.
    const [presentation, diagnosisPopulation] = await Promise.all([
      readCatalogueWithSeedFallback({
        kind: "presentation",
        scope: catalogueDetailScope,
        seeds: presentationSeeds,
        budgetMs: catalogueListFallbackBudgetMs,
        read: async (signal) => {
          const result = await readCanonicalSiteContentRecords({
            supabase,
            kind: "presentation",
            slug: normalizedSlug,
            signal,
            seeds: presentationSeeds,
            mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
              workflow: scopePresentationWorkflow(finalRenderPayload as unknown as DifferentialPresentationWorkflow),
              governance: canonicalSiteContentGovernance(canonicalRecord),
            }),
          });
          observed.presentation = result.source;
          return result.records;
        },
      }),
      readCatalogueWithSeedFallback({
        kind: "differential",
        // The LIST cooldown scope, although this is a detail route: `slug: null` makes this the
        // same whole-catalogue query `/api/differentials` runs, under the same budget, so its
        // health is the same signal and they should share a cooldown.
        scope: catalogueListScope,
        seeds: diagnosisSeeds,
        budgetMs: catalogueListFallbackBudgetMs,
        read: async (signal) => {
          const result = await readCanonicalSiteContentRecords({
            supabase,
            kind: "differential",
            slug: null,
            signal,
            seeds: diagnosisSeeds,
            mapRecord: ({ finalRenderPayload }) => ({
              record: scopeDifferentialRecord(finalRenderPayload as unknown as DifferentialRecord),
            }),
          });
          observed.population = result.source;
          return result.records;
        },
      }),
    ]);
    const payload = presentation.records[0];
    if (!payload) return presentation.degraded ? catalogueUnavailableResponse() : notFoundResponse(normalizedSlug);
    const diagnosisBySlug = new Map(diagnosisPopulation.records.map(({ record }) => [record.slug, record]));
    const { workflow } = payload;
    const candidates = workflow.candidates.flatMap((candidate) => {
      const record = diagnosisBySlug.get(candidate.slug);
      if (!record) return [];
      return [{ ...candidate, record }];
    });

    return differentialResponse(
      {
        workflow,
        candidates,
        governance: payload.governance,
        publicAccess: true,
        // Never drop `degraded` on the floor. Either read falling back means part of what is on
        // screen is the in-bundle copy, which can lag anything published since the last release.
        ...(presentation.degraded || diagnosisPopulation.degraded ? { retainedSnapshot: true as const } : {}),
      },
      {
        request,
        fixture: observed.presentation === "seed_uninitialized" && observed.population === "seed_uninitialized",
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
