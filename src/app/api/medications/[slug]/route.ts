import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import { publicMedicationGovernance, normalizeMedicationSlug } from "@/lib/medication-records";
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
import type { MedicationRecord } from "@/lib/medications";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

function medicationResponse(
  payload: Record<string, unknown>,
  init: { status?: number; request?: Request; fixture?: boolean } = {},
) {
  return NextResponse.json(payload, {
    status: init.status ?? 200,
    headers: fixtureResponseHeaders(init.request, init),
  });
}

function notFoundResponse(slug: string) {
  return publicErrorResponse(`No medication found for "${slug}".`, 404, { code: "medication_not_found" });
}

function publicMedicationDetailPayload(slug: string) {
  const record = getMedicationRecord(slug);
  if (!record) return null;
  return {
    record,
    governance: publicMedicationGovernance(record),
  };
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = normalizeMedicationSlug(slug);

    if (isDemoMode() || isLocalNoAuthMode()) {
      const payload = publicMedicationDetailPayload(normalizedSlug);
      if (!payload) return notFoundResponse(normalizedSlug);
      return medicationResponse(
        {
          ...payload,
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
      return rateLimitJsonResponse("Medication requests are rate limited. Try again shortly.", rateLimit);
    }

    const seed = publicMedicationDetailPayload(normalizedSlug);
    const seeds = seed ? [seed] : [];
    // Bounded, like the list route: this read had no budget either, so a slow database left a
    // medication detail page waiting indefinitely instead of degrading. Deliberately NOT cached —
    // `readCanonicalSiteContentRecords` reserves the uncached path for detail reads so an operator
    // always sees their own publication immediately.
    const observed: { source: "canonical_public" | "seed_uninitialized" } = { source: "canonical_public" };
    const canonical = await readCatalogueWithSeedFallback({
      kind: "medication",
      scope: catalogueDetailScope,
      seeds,
      budgetMs: catalogueListFallbackBudgetMs,
      read: async (signal) => {
        const result = await readCanonicalSiteContentRecords({
          supabase,
          kind: "medication",
          slug: normalizedSlug,
          signal,
          seeds,
          mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
            record: finalRenderPayload as unknown as MedicationRecord,
            governance: {
              ...publicMedicationGovernance(finalRenderPayload as unknown as MedicationRecord),
              ...canonicalSiteContentGovernance(canonicalRecord),
            },
          }),
        });
        observed.source = result.source;
        return result.records;
      },
    });
    const payload = canonical.records[0];
    // A fallback with no seed for this slug means the read failed, not that the medication is
    // absent: see `catalogueUnavailableNotice` for why a 404 here would be a false clinical claim.
    if (!payload) {
      if (canonical.degraded) {
        return publicErrorResponse(catalogueUnavailableNotice, 503, { code: "medication_catalogue_unavailable" });
      }
      return notFoundResponse(normalizedSlug);
    }
    return medicationResponse(
      {
        ...payload,
        publicAccess: true,
        // Never drop `degraded` on the floor: this record is the in-bundle copy, which can lag
        // anything published since the last release.
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
