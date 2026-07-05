import { NextResponse } from "next/server";

import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getMedicationRecord } from "@/lib/medications";
import { ensureMedicationsSeeded } from "@/lib/medication-seed";
import {
  deriveGovernanceFromSections,
  normalizeMedicationSlug,
  rowGovernance,
  rowToMedicationRecord,
  type MedicationRecordRow,
} from "@/lib/medication-records";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

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

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = normalizeMedicationSlug(slug);

    if (isDemoMode() || isLocalNoAuthMode()) {
      const record = getMedicationRecord(normalizedSlug);
      if (!record) return notFoundResponse(normalizedSlug);
      const governance = deriveGovernanceFromSections(record);
      return medicationResponse({
        record,
        governance: {
          sourceStatus: governance.source_status,
          validationStatus: governance.validation_status,
        },
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    const rateLimit = await consumeApiRateLimit({
      supabase,
      ownerId: user.id,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Medication requests are rate limited. Try again shortly.", rateLimit);
    }

    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from("medication_records")
        .select("*")
        .eq("owner_id", user.id)
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
        .eq("owner_id", user.id);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) === 0) {
        try {
          await ensureMedicationsSeeded(supabase, user.id);
        } catch (seedError) {
          console.error(`[medications] auto-seed failed for owner ${user.id}`, seedError);
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
