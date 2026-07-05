import { NextResponse } from "next/server";

import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import { ensureMedicationsSeeded } from "@/lib/medication-seed";
import {
  deriveGovernanceFromSections,
  normalizeMedicationSlug,
  rowGovernance,
  rowToMedicationRecord,
  type MedicationRecordRow,
} from "@/lib/medication-records";
import { hasPublicApiAuthSignal, publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

function medicationResponse(payload: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(payload, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "private, no-store" },
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
      return medicationResponse({
        ...payload,
        demoMode: true,
      });
    }

    if (!hasPublicApiAuthSignal(request)) {
      const payload = publicMedicationDetailPayload(normalizedSlug);
      if (!payload) return notFoundResponse(normalizedSlug);
      return medicationResponse({
        ...payload,
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
      return rateLimitJsonResponse("Medication requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      const payload = publicMedicationDetailPayload(normalizedSlug);
      if (!payload) return notFoundResponse(normalizedSlug);
      return medicationResponse({
        ...payload,
        publicAccess: true,
      });
    }

    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from("medication_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .eq("slug", normalizedSlug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as MedicationRecordRow | null) ?? null;
    };

    let row = await fetchRecord();
    if (!row) {
      const { count, error: countError } = await supabase
        .from("medication_records")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", access.ownerId);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) === 0) {
        try {
          await ensureMedicationsSeeded(supabase, access.ownerId);
        } catch (seedError) {
          console.error(`[medications] auto-seed failed for owner ${access.ownerId}`, seedError);
        }
        row = await fetchRecord();
      }
    }
    if (!row) return notFoundResponse(normalizedSlug);

    return medicationResponse({
      record: rowToMedicationRecord(row),
      governance: rowGovernance(row),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
