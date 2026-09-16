import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { deriveGovernanceFromSnapshot, normalizeDifferentialSlug } from "@/lib/differential-records";
import type { DifferentialPresentationWorkflow, DifferentialRecord } from "@/lib/differential-snapshot";
import { loadDifferentialSnapshot } from "@/lib/differential-seed";
import {
  getDifferentialDetailContext,
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
  catalogueUnavailableNotice,
  readCatalogueWithSeedFallback,
} from "@/lib/site-content/catalogue-seed-fallback";
import {
  canonicalSiteContentGovernance,
  readCanonicalSiteContentRecords,
} from "@/lib/site-content/site-content-publication";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const differentialDetailQuerySchema = z.object({
  kind: z.enum(["presentation", "diagnosis"]).optional().default("diagnosis"),
});

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
  return publicErrorResponse(`No differential record found for "${slug}".`, 404, {
    code: "differential_not_found",
  });
}

/**
 * A fallback that fired with no in-bundle copy of this slug means the read failed, not that the
 * record is absent — so the reader is told the database is unreachable rather than being told, on
 * the strength of a timeout, that the diagnosis does not exist. See `catalogueUnavailableNotice`.
 */
function catalogueUnavailableResponse() {
  return publicErrorResponse(catalogueUnavailableNotice, 503, { code: "differential_catalogue_unavailable" });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = normalizeDifferentialSlug(slug);
    const { kind } = parseRequestQuery(request, differentialDetailQuerySchema, "Invalid differential detail query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      const snapshot = loadDifferentialSnapshot();
      const governance = deriveGovernanceFromSnapshot(snapshot);
      if (kind === "presentation") {
        const workflow = getPresentationWorkflow(normalizedSlug);
        if (!workflow) return notFoundResponse(normalizedSlug);
        return differentialResponse(
          {
            workflow,
            governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
            demoMode: true,
          },
          { request, fixture: true },
        );
      }
      const record = getDifferentialRecord(normalizedSlug);
      if (!record) return notFoundResponse(normalizedSlug);
      return differentialResponse(
        {
          record,
          detailContext: getDifferentialDetailContext(record),
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
    if (kind === "presentation") {
      const seedWorkflow = getPresentationWorkflow(normalizedSlug);
      const seeds = seedWorkflow
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
      // Bounded, like the list route: this read had no budget either, so a slow database left the
      // detail page waiting indefinitely instead of degrading. Deliberately NOT cached —
      // `readCanonicalSiteContentRecords` reserves the uncached path for detail reads so an
      // operator always sees their own publication immediately.
      const observed: { source: "canonical_public" | "seed_uninitialized" } = { source: "canonical_public" };
      const canonical = await readCatalogueWithSeedFallback({
        kind: "presentation",
        scope: catalogueDetailScope,
        seeds,
        budgetMs: catalogueListFallbackBudgetMs,
        read: async (signal) => {
          const result = await readCanonicalSiteContentRecords({
            supabase,
            kind: "presentation",
            slug: normalizedSlug,
            signal,
            seeds,
            // Canonical payloads were seeded before presentation scope existed, so
            // they are relabelled here too — see scopeDifferentialRecord.
            mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
              workflow: scopePresentationWorkflow(finalRenderPayload as unknown as DifferentialPresentationWorkflow),
              governance: canonicalSiteContentGovernance(canonicalRecord),
            }),
          });
          observed.source = result.source;
          return result.records;
        },
      });
      const payload = canonical.records[0];
      if (!payload) return canonical.degraded ? catalogueUnavailableResponse() : notFoundResponse(normalizedSlug);
      return differentialResponse(
        {
          ...payload,
          publicAccess: true,
          // Never drop `degraded` on the floor: this is the in-bundle copy, which can lag anything
          // published since the last release.
          ...(canonical.degraded ? { retainedSnapshot: true as const } : {}),
        },
        { request, fixture: observed.source === "seed_uninitialized" },
      );
    }

    const seedRecord = getDifferentialRecord(normalizedSlug);
    const seeds = seedRecord
      ? [
          {
            record: seedRecord,
            governance: {
              sourceStatus: seedGovernance.source_status,
              validationStatus: seedGovernance.validation_status,
              lastReviewedAt: null,
              reviewDueAt: null,
            },
          },
        ]
      : [];
    // Same budget and fallback as the presentation branch above; see the comment there.
    const observed: { source: "canonical_public" | "seed_uninitialized" } = { source: "canonical_public" };
    const canonical = await readCatalogueWithSeedFallback({
      kind: "differential",
      scope: catalogueDetailScope,
      seeds,
      budgetMs: catalogueListFallbackBudgetMs,
      read: async (signal) => {
        const result = await readCanonicalSiteContentRecords({
          supabase,
          kind: "differential",
          slug: normalizedSlug,
          signal,
          seeds,
          mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
            record: scopeDifferentialRecord(finalRenderPayload as unknown as DifferentialRecord),
            governance: canonicalSiteContentGovernance(canonicalRecord),
          }),
        });
        observed.source = result.source;
        return result.records;
      },
    });
    const payload = canonical.records[0];
    if (!payload) return canonical.degraded ? catalogueUnavailableResponse() : notFoundResponse(normalizedSlug);
    return differentialResponse(
      {
        ...payload,
        detailContext: getDifferentialDetailContext(payload.record),
        publicAccess: true,
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
