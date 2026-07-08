import { NextResponse } from "next/server";

import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import { deriveGovernanceFromSections, normalizeMedicationSlug } from "@/lib/medication-records";

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

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = normalizeMedicationSlug(slug);
    const payload = publicMedicationDetailPayload(normalizedSlug);
    if (!payload) return notFoundResponse(normalizedSlug);

    return medicationResponse({
      ...payload,
      demoMode: isDemoMode() || isLocalNoAuthMode(),
      publicAccess: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
