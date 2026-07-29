import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag/rag";
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
import { sourceGovernanceWarnings } from "@/lib/source-governance";
import { parseJsonBody } from "@/lib/validation/body";
import {
  answerDegradedModeSignal,
  buildGovernedAnswerClientResponse,
  buildGovernedDemoAnswerClientResponse,
} from "@/lib/answer-response";
import { answerServerTimingEntries, buildServerTimingHeader, preambleServerTimingEntries } from "@/lib/server-timing";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
import * as serverAuth from "@/lib/supabase/auth";
import { answerRequestSchema, type AnswerRequestBody } from "@/lib/validation/answer-request";
import { answerFeedbackMetadata } from "@/lib/answer-feedback-token";

export const runtime = "nodejs";

const emptyScopeAnswer =
  "The selected filters did not match any indexed documents, so I cannot generate an answer for that scope.";

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
  return buildGovernedDemoAnswerClientResponse(
    {
      ...answer,
      responseMode: smartApiPlan.displayMode,
      smartApiPlan,
    },
    fallbackReason,
  );
}

export async function POST(request: Request) {
  const interactionId = randomUUID();
  const routeStartedAt = Date.now();
  let body: AnswerRequestBody | null = null;
  try {
    const answerBody = await parseJsonBody(request, answerRequestSchema, "Invalid answer request.");
    if (answerBody.summaryMode) {
      return jsonError(
        new PublicApiError("Document summaries require the streaming answer endpoint.", 400, {
          code: "summary_mode_stream_required",
        }),
        400,
      );
    }
    body = answerBody;
    if (isDemoMode()) {
      return NextResponse.json({ ...buildDemoAnswerPayload(answerBody), interactionId });
    }

    const supabase = createAdminClient();
    const authStartedAt = Date.now();
    const access = await publicAccessContext(request, supabase);
    const authMs = Date.now() - authStartedAt;
    const accessScope = resolveRetrievalAccessScope(access.ownerId);

    // Scope resolution has no data dependency on the rate-limit RPC, so the two
    // overlap instead of running back-to-back before retrieval starts. The
    // limiter must still be able to deny for free, so the scope queries are
    // aborted the moment it does — and threading a signal at all is what lets
    // a client disconnect cancel scope's paginated queries.
    const scopeAbort = new AbortController();
    const scopeStartedAt = Date.now();
    let scopeMs: number | undefined;
    const scopeSettled = resolveSearchScope({
      supabase,
      accessScope,
      documentIds: answerBody.documentIds ?? (answerBody.documentId ? [answerBody.documentId] : undefined),
      filters: answerBody.filters,
      signal: AbortSignal.any([request.signal, scopeAbort.signal]),
    }).then(
      (value) => {
        scopeMs = Date.now() - scopeStartedAt;
        return { ok: true as const, value };
      },
      // Settled, never rejected: the limiter can return before this promise is
      // awaited, and a floating rejection would take down the process.
      (error: unknown) => {
        scopeMs = Date.now() - scopeStartedAt;
        return { ok: false as const, error };
      },
    );

    const rateLimitStartedAt = Date.now();
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "answer",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    const rateLimitMs = Date.now() - rateLimitStartedAt;
    if (rateLimit.limited) {
      scopeAbort.abort();
      await scopeSettled;
      return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
    }

    const resolvedScope = await scopeSettled;
    if (!resolvedScope.ok) throw resolvedScope.error;
    const scope = resolvedScope.value;
    if (scope.documentIds?.length === 0) {
      return NextResponse.json({
        answer: emptyScopeAnswer,
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: [],
        degradedMode: answerDegradedModeSignal(),
        scope: { ...scope, queryMode: answerBody.queryMode },
        sourceGovernanceWarnings: sourceGovernanceWarnings({ results: [] }),
        ...answerFeedbackMetadata(interactionId, emptyScopeAnswer),
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
    const governedResponse = buildGovernedAnswerClientResponse(answer);
    logAnswerDiagnostics({
      supabase,
      query: answerBody.query,
      ownerId: access.ownerId,
      answer: governedResponse.telemetryAnswer,
    });

    // Durations only — see server-timing.ts for the trust-boundary constraint.
    const serverTiming = buildServerTimingHeader([
      ...preambleServerTimingEntries({ authMs, rateLimitMs, scopeMs }),
      ...answerServerTimingEntries(answer.latencyTimings, Date.now() - routeStartedAt),
    ]);
    return NextResponse.json(
      {
        ...governedResponse.payload,
        scope: { ...scope, queryMode: answerBody.queryMode },
        ...answerFeedbackMetadata(interactionId, governedResponse.payload.answer),
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
        return NextResponse.json(
          { ...buildDemoAnswerPayload(fallbackBody, fallbackReason), interactionId },
          { headers: { "X-Clinical-KB-Fallback": fallbackReason } },
        );
      }
      return jsonError(
        new PublicApiError("Answer generation failed. Retry with a narrower question.", 500, { code: error.name }),
        500,
      );
    }
    return jsonError("Answer generation failed.", 500);
  }
}
