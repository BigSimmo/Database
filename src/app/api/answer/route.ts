import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag";
import { jsonError, PublicApiError } from "@/lib/http";
import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { publicAccessContext } from "@/lib/public-api-access";
import { classifyRagQuery } from "@/lib/clinical-search";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { clinicalQueryModeSchema, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";
import {
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import { parseJsonBody } from "@/lib/validation/body";
import { createAdminClient } from "@/lib/supabase/admin";
import * as serverAuth from "@/lib/supabase/auth";
import type { RagAnswer } from "@/lib/types";

export const runtime = "nodejs";

const answerSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  filters: searchScopeFiltersSchema.optional(),
  queryMode: clinicalQueryModeSchema.optional().default("auto"),
  skipCache: z.boolean().optional().default(false),
});

function answerDegradedModeSignal(answer?: Pick<RagAnswer, "degradedMode" | "answerQualityTier" | "fallbackReason">) {
  if (answer?.degradedMode) return answer.degradedMode;
  const active = answer?.answerQualityTier === "source_only";
  return {
    active,
    reason: active ? (answer?.fallbackReason ?? "source_only") : null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, answerSchema, "Invalid answer request.");
    if (isDemoMode()) {
      const answer = demoAnswer(body.query, body.documentId, body.documentIds);
      const answerFocusQuery = queryForClinicalMode(body.query, body.queryMode);
      const smartApiPlan = buildSmartRagApiPlan({
        query: answerFocusQuery,
        queryClass: queryClassForClinicalMode(body.queryMode) ?? classifyRagQuery(answerFocusQuery).queryClass,
        results: answer.sources,
        routeMode: answer.routingMode,
        retrievalStrategy: "hybrid",
      });
      return NextResponse.json({
        ...answer,
        responseMode: smartApiPlan.displayMode,
        smartApiPlan,
        demoMode: true,
        degradedMode: answerDegradedModeSignal(answer),
      });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    const publicOnly = !access.authenticated && !isLocalNoAuthMode();

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "answer",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
    }

    const scope = await resolveSearchScope({
      supabase,
      ownerId: access.ownerId,
      publicOnly,
      documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
      filters: body.filters,
    });
    if (scope.documentIds?.length === 0) {
      return NextResponse.json({
        answer:
          "The selected filters did not match any indexed documents, so I cannot generate an answer for that scope.",
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: [],
        degradedMode: answerDegradedModeSignal(),
        scope: { ...scope, queryMode: body.queryMode },
        sourceGovernanceWarnings: sourceGovernanceWarnings({ results: [] }),
      });
    }

    const singleDocumentScope = Boolean(body.documentId && !body.documentIds?.length && scope.activeFilterCount === 0);
    const answer = await answerQuestionWithScope({
      query: body.query,
      documentId: singleDocumentScope ? body.documentId : undefined,
      documentIds: singleDocumentScope
        ? undefined
        : (scope.documentIds ?? body.documentIds ?? (body.documentId ? [body.documentId] : undefined)),
      ownerId: access.ownerId,
      allowGlobalSearch: !access.ownerId,
      queryMode: body.queryMode,
      skipCache: body.skipCache,
      signal: request.signal,
    });
    const warnings = sourceGovernanceWarnings({
      results: answer.sources ?? [],
      relevance: answer.relevance ?? answer.smartPanel?.relevance ?? null,
    });
    const shouldUseSourceGovernanceRefusal =
      answer.grounded !== false && answer.confidence !== "unsupported" && answer.responseMode !== "evidence_gap";
    if (shouldUseSourceGovernanceRefusal && hasDangerSourceGovernanceWarning(warnings)) {
      // Build the refusal explicitly — never spread ...answer here, or the original
      // (refused) sources/smartPanel/smartApiPlan would still reach the client and
      // defeat the refusal. Keep only the safe "unsupported" contract fields, matching
      // the empty-scope branch above.
      return NextResponse.json({
        answer: sourceGovernanceRefusalAnswer,
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: [],
        degradedMode: answerDegradedModeSignal(answer),
        scope: { ...scope, queryMode: body.queryMode },
        sourceGovernanceWarnings: warnings,
      });
    }

    return NextResponse.json({
      ...answer,
      degradedMode: answerDegradedModeSignal(answer),
      scope: { ...scope, queryMode: body.queryMode },
      sourceGovernanceWarnings: warnings,
    });
  } catch (error) {
    if (error instanceof serverAuth.AuthenticationError) {
      return serverAuth.unauthorizedResponse(error);
    }
    if (error instanceof z.ZodError) {
      return jsonError(error, 400);
    }
    if (error instanceof PublicApiError) {
      return jsonError(error, error.status);
    }
    if (error instanceof Error) {
      return jsonError(
        new PublicApiError("Answer generation failed. Retry with a narrower question.", 500, { code: error.name }),
        500,
      );
    }
    return jsonError("Answer generation failed.", 500);
  }
}
