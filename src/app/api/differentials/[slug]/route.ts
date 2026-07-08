import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
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
import { publicAccessContext, shouldResolvePublicCatalogAccess } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const differentialDetailQuerySchema = z.object({
  kind: z.enum(["presentation", "diagnosis"]).optional().default("diagnosis"),
});

function differentialResponse(payload: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(payload, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function notFoundResponse(slug: string) {
  return differentialResponse({ error: `No differential record found for "${slug}".` }, { status: 404 });
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
        return differentialResponse({
          workflow,
          governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
          demoMode: true,
        });
      }
      const record = getDifferentialRecord(normalizedSlug);
      if (!record) return notFoundResponse(normalizedSlug);
      return differentialResponse({
        record,
        governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
        demoMode: true,
      });
    }

    if (!shouldResolvePublicCatalogAccess(request)) {
      const snapshot = loadDifferentialSnapshot();
      const governance = deriveGovernanceFromSnapshot(snapshot);
      if (kind === "presentation") {
        const workflow = getPresentationWorkflow(normalizedSlug);
        if (!workflow) return notFoundResponse(normalizedSlug);
        return differentialResponse({
          workflow,
          governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
          publicAccess: true,
        });
      }
      const record = getDifferentialRecord(normalizedSlug);
      if (!record) return notFoundResponse(normalizedSlug);
      return differentialResponse({
        record,
        governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
        publicAccess: true,
      });
    }

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

    if (!access.ownerId) {
      const snapshot = loadDifferentialSnapshot();
      const governance = deriveGovernanceFromSnapshot(snapshot);
      if (kind === "presentation") {
        const workflow = getPresentationWorkflow(normalizedSlug);
        if (!workflow) return notFoundResponse(normalizedSlug);
        return differentialResponse({
          workflow,
          governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
          publicAccess: true,
        });
      }
      const record = getDifferentialRecord(normalizedSlug);
      if (!record) return notFoundResponse(normalizedSlug);
      return differentialResponse({
        record,
        governance: { sourceStatus: governance.source_status, validationStatus: governance.validation_status },
        publicAccess: true,
      });
    }

    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from("differential_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .eq("kind", kind)
        .eq("slug", normalizedSlug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as DifferentialRecordRow | null) ?? null;
    };

    let row = await fetchRecord();
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
        row = await fetchRecord();
      }
    }
    if (!row) return notFoundResponse(normalizedSlug);

    if (kind === "presentation") {
      return differentialResponse({ workflow: rowToPresentationWorkflow(row), governance: rowGovernance(row) });
    }

    return differentialResponse({ record: rowToDifferentialRecord(row), governance: rowGovernance(row) });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
