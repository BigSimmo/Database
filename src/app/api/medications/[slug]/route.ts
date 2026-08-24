import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError } from "@/lib/http";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import {
  deriveGovernanceFromSections,
  normalizeMedicationSlug,
  rowGovernance,
  rowToMedicationRecord,
  type MedicationRecordRow,
} from "@/lib/medication-records";
import { publicAccessContext } from "@/lib/public-api-access";
import { readCanonicalSiteContentRecords } from "@/lib/site-content/site-content-publication";
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
  return medicationResponse({ error: `No medication found for "${slug}".` }, { status: 404 });
}

function publicMedicationDetailPayload(slug: string) {
  const record = getMedicationRecord(slug);
  if (!record) return null;
  const governance = deriveGovernanceFromSections(record);
  return {
    record,
    governance: {
      sourceStatus: governance.source_status,
      validationStatus: governance.validation_status,
    },
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
    const canonical = await readCanonicalSiteContentRecords({
      supabase,
      kind: "medication",
      slug: normalizedSlug,
      seeds: seed ? [seed] : [],
      mapRecord: (raw) => {
        const row = raw as unknown as MedicationRecordRow;
        return { record: rowToMedicationRecord(row), governance: rowGovernance(row) };
      },
    });
    const payload = canonical.records[0];
    if (!payload) return notFoundResponse(normalizedSlug);
    return medicationResponse(
      { ...payload, publicAccess: true },
      { request, fixture: canonical.source === "seed_uninitialized" },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
