import { NextResponse } from "next/server";

import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import {
  deriveGovernanceFromSnapshot,
  normalizeDifferentialSlug,
  rowGovernance,
  rowToDifferentialRecord,
  rowToPresentationWorkflow,
  type DifferentialRecordRow,
} from "@/lib/differential-records";
import { ensureDifferentialsSeeded, loadDifferentialSnapshot } from "@/lib/differential-seed";
import { getDifferentialRecord, getPresentationWorkflow } from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { hasPublicApiAuthSignal, publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

function differentialResponse(payload: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(payload, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function notFoundResponse(slug: string) {
  return differentialResponse({ error: `No differential presentation found for "${slug}".` }, { status: 404 });
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
      return differentialResponse({
        workflow,
        candidates,
        governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
        demoMode: true,
      });
    }

    if (!hasPublicApiAuthSignal(request)) {
      const snapshot = loadDifferentialSnapshot();
      const workflow = getPresentationWorkflow(normalizedSlug);
      if (!workflow) return notFoundResponse(normalizedSlug);
      const governance = deriveGovernanceFromSnapshot(snapshot);
      const candidates = workflow.candidates.flatMap((candidate) => {
        const record = getDifferentialRecord(candidate.slug);
        if (!record) return [];
        return [{ ...candidate, record }];
      });
      return differentialResponse({
        workflow,
        candidates,
        governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
        publicAccess: true,
      });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "differentials",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Differential requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      const snapshot = loadDifferentialSnapshot();
      const workflow = getPresentationWorkflow(normalizedSlug);
      if (!workflow) return notFoundResponse(normalizedSlug);
      const governance = deriveGovernanceFromSnapshot(snapshot);
      const candidates = workflow.candidates.flatMap((candidate) => {
        const record = getDifferentialRecord(candidate.slug);
        if (!record) return [];
        return [{ ...candidate, record }];
      });
      return differentialResponse({
        workflow,
        candidates,
        governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
        publicAccess: true,
      });
    }

    const fetchPresentation = async () => {
      const { data, error } = await supabase
        .from("differential_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .eq("kind", "presentation")
        .eq("slug", normalizedSlug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as DifferentialRecordRow | null) ?? null;
    };

    let row = await fetchPresentation();
    if (!row) {
      const { count, error: countError } = await supabase
        .from("differential_records")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", access.ownerId);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) === 0) {
        try {
          await ensureDifferentialsSeeded(supabase, access.ownerId);
        } catch (seedError) {
          console.error(`[differentials] auto-seed failed for owner ${access.ownerId}`, seedError);
        }
        row = await fetchPresentation();
      }
    }
    if (!row) return notFoundResponse(normalizedSlug);

    const workflow = rowToPresentationWorkflow(row);
    const candidateSlugs = workflow.candidates.map((candidate) => candidate.slug);
    const { data: diagnosisRows, error: diagnosisError } = await supabase
      .from("differential_records")
      .select("*")
      .eq("owner_id", access.ownerId)
      .eq("kind", "diagnosis")
      .in("slug", candidateSlugs);
    if (diagnosisError) throw new Error(diagnosisError.message);

    const diagnosisBySlug = new Map(
      ((diagnosisRows ?? []) as DifferentialRecordRow[]).map((diagnosisRow) => [
        diagnosisRow.slug,
        rowToDifferentialRecord(diagnosisRow),
      ]),
    );
    const candidates = workflow.candidates.flatMap((candidate) => {
      const record = diagnosisBySlug.get(candidate.slug) ?? getDifferentialRecord(candidate.slug);
      if (!record) return [];
      return [{ ...candidate, record }];
    });

    return differentialResponse({
      workflow,
      candidates,
      governance: rowGovernance(row),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
