import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag";
import { jsonError, PublicApiError } from "@/lib/http";
<<<<<<< HEAD
import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
=======
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
>>>>>>> origin/main
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
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
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

type AnswerRequestBody = z.infer<typeof answerSchema>;

function answerDegradedModeSignal(answer?: Pick<RagAnswer, "degradedMode" | "answerQualityTier" | "fallbackReason">) {
  if (answer?.degradedMode) return answer.degradedMode;
  const active = answer?.answerQualityTier === "source_only";
  return {
    active,
    reason: active ? (answer?.fallbackReason ?? "source_only") : null,
  };
}

function buildDemoAnswerPayload(body: AnswerRequestBody, fallbackReason?: string) {
  const answer = demoAnswer(body.query, body.documentId, body.documentIds);
  const answerFocusQuery = queryForClinicalMode(body.query, body.queryMode);
  const smartApiPlan = buildSmartRagApiPlan({
    query: answerFocusQuery,
    queryClass: queryClassForClinicalMode(body.queryMode) ?? classifyRagQuery(answerFocusQuery).queryClass,
    results: answer.sources,
    routeMode: answer.routingMode,
    retrievalStrategy: "hybrid",
  });
  return {
    ...answer,
    responseMode: smartApiPlan.displayMode,
    smartApiPlan,
    demoMode: true,
    degradedMode: fallbackReason ? { active: true, reason: fallbackReason } : answerDegradedModeSignal(answer),
    ...(fallbackReason ? { fallbackMode: "non_production_demo", fallbackReason } : {}),
  };
}

export async function POST(request: Request) {
  let body: AnswerRequestBody | null = null;
  try {
    const answerBody = await parseJsonBody(request, answerSchema, "Invalid answer request.");
    body = answerBody;
    if (isDemoMode()) {
      return NextResponse.json(buildDemoAnswerPayload(answerBody));
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
<<<<<<< HEAD
=======
    const publicOnly = !access.authenticated && !isLocalNoAuthMode();
>>>>>>> origin/main

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "answer",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
    }

    const scope = await resolveSearchScope({
      supabase,
      ownerId: access.ownerId,
<<<<<<< HEAD
      documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
      filters: body.filters,
=======
      publicOnly,
      documentIds: answerBody.documentIds ?? (answerBody.documentId ? [answerBody.documentId] : undefined),
      filters: answerBody.filters,
>>>>>>> origin/main
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
        scope: { ...scope, queryMode: answerBody.queryMode },
        sourceGovernanceWarnings: sourceGovernanceWarnings({ results: [] }),
      });
    }

    const singleDocumentScope = Boolean(
      answerBody.documentId && !answerBody.documentIds?.length && scope.activeFilterCount === 0,
    );
    const answer = await answerQuestionWithScope({
      query: answerBody.query,
      documentId: singleDocumentScope ? answerBody.documentId : undefined,
      documentIds: singleDocumentScope
        ? undefined
<<<<<<< HEAD
        : (scope.documentIds ?? body.documentIds ?? (body.documentId ? [body.documentId] : undefined)),
      ownerId: access.ownerId,
      allowGlobalSearch: !access.ownerId,
      queryMode: body.queryMode,
      skipCache: body.skipCache,
=======
        : (scope.documentIds ??
          answerBody.documentIds ??
          (answerBody.documentId ? [answerBody.documentId] : undefined)),
      ownerId: access.ownerId,
      allowGlobalSearch: !access.ownerId,
      queryMode: answerBody.queryMode,
      skipCache: answerBody.skipCache,
>>>>>>> origin/main
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
        scope: { ...scope, queryMode: answerBody.queryMode },
        sourceGovernanceWarnings: warnings,
      });
    }

    logAnswerDiagnostics({ supabase, query: answerBody.query, ownerId: access.ownerId, answer });

    return NextResponse.json({
      ...answer,
      degradedMode: answerDegradedModeSignal(answer),
      scope: { ...scope, queryMode: answerBody.queryMode },
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
      const fallbackBody = body;
      const fallbackReason = fallbackBody ? nonProductionSupabaseDemoFallbackReason(error) : null;
      if (fallbackBody && fallbackReason) {
        return NextResponse.json(buildDemoAnswerPayload(fallbackBody, fallbackReason), {
          headers: { "X-Clinical-KB-Fallback": fallbackReason },
        });
      }
      return jsonError(
        new PublicApiError("Answer generation failed. Retry with a narrower question.", 500, { code: error.name }),
        500,
      );
    }
    return jsonError("Answer generation failed.", 500);
  }
}
