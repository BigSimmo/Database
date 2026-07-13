import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag";
import { jsonError, PublicApiError } from "@/lib/http";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { publicAccessContext } from "@/lib/public-api-access";
import { classifyRagQuery } from "@/lib/clinical-search";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope } from "@/lib/search-scope";
import { resolveRetrievalAccessScope } from "@/lib/owner-scope";
import {
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import { parseJsonBody } from "@/lib/validation/body";
import { toClientAnswerPayload } from "@/lib/answer-client-payload";
import { answerServerTimingEntries, buildServerTimingHeader } from "@/lib/server-timing";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
import * as serverAuth from "@/lib/supabase/auth";
import type { RagAnswer } from "@/lib/types";
import { answerRequestSchema, type AnswerRequestBody } from "@/lib/validation/answer-request";

export const runtime = "nodejs";

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
  const routeStartedAt = Date.now();
  let body: AnswerRequestBody | null = null;
  try {
    const answerBody = await parseJsonBody(request, answerRequestSchema, "Invalid answer request.");
    body = answerBody;
    if (isDemoMode()) {
      return NextResponse.json(buildDemoAnswerPayload(answerBody));
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    const accessScope = resolveRetrievalAccessScope(access.ownerId);

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
      accessScope,
      documentIds: answerBody.documentIds ?? (answerBody.documentId ? [answerBody.documentId] : undefined),
      filters: answerBody.filters,
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
        : (scope.documentIds ??
          answerBody.documentIds ??
          (answerBody.documentId ? [answerBody.documentId] : undefined)),
      ownerId: access.ownerId,
      accessScope,
      allowGlobalSearch: !access.ownerId,
      queryMode: answerBody.queryMode,
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
      void logAnswerDiagnostics({
        supabase,
        query: answerBody.query,
        ownerId: access.ownerId,
        answer: {
          ...answer,
          grounded: false,
          confidence: "unsupported",
          sources: [],
          responseMode: "evidence_gap",
          fallbackReason: "source_governance_refusal",
          routingReason: [answer.routingReason, "source_governance_refusal"].filter(Boolean).join("; "),
        },
      });
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

    // Durations only — see server-timing.ts for the trust-boundary constraint.
    const serverTiming = buildServerTimingHeader(
      answerServerTimingEntries(answer.latencyTimings, Date.now() - routeStartedAt),
    );
    return NextResponse.json(
      {
        // Boundary trim only — governance warnings and diagnostics above
        // consumed the full answer (see answer-client-payload.ts).
        ...toClientAnswerPayload(answer),
        degradedMode: answerDegradedModeSignal(answer),
        scope: { ...scope, queryMode: answerBody.queryMode },
        sourceGovernanceWarnings: warnings,
      },
      serverTiming ? { headers: { "Server-Timing": serverTiming } } : undefined,
    );
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
