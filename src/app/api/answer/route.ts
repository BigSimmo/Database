import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer, demoSummary } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { answerQuestionWithScope } from "@/lib/rag/rag";
=======
import { answerQuestionWithScope, summarizeDocument } from "@/lib/rag";
>>>>>>> theirs
=======
import { answerQuestionWithScope, summarizeDocument } from "@/lib/rag";
>>>>>>> theirs
=======
import { answerQuestionWithScope, summarizeDocument } from "@/lib/rag";
>>>>>>> theirs
import { jsonError, PublicApiError } from "@/lib/http";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  consumeSummaryRateLimits,
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
import { answerServerTimingEntries, buildServerTimingHeader } from "@/lib/server-timing";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
import * as serverAuth from "@/lib/supabase/auth";
import { answerRequestSchema, type AnswerRequestBody } from "@/lib/validation/answer-request";
import { answerFeedbackMetadata } from "@/lib/answer-feedback-token";
import { documentSummaryQuestion } from "@/lib/answer-contract";

export const runtime = "nodejs";

const emptyScopeAnswer =
  "The selected filters did not match any indexed documents, so I cannot generate an answer for that scope.";

function buildDemoAnswerPayload(body: AnswerRequestBody, fallbackReason?: string) {
  const answer =
    body.summaryMode && body.documentId
      ? demoSummary(body.documentId)
      : demoAnswer(body.query, body.documentId, body.documentIds);
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
    body = answerBody;
    if (answerBody.summaryMode) {
      return jsonError(
        new PublicApiError("Document summaries require the streaming answer endpoint.", 400, {
          code: "summary_mode_stream_required",
        }),
        400,
      );
    }
    if (isDemoMode()) {
      return NextResponse.json({ ...buildDemoAnswerPayload(answerBody), interactionId });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    const accessScope = resolveRetrievalAccessScope(access.ownerId);

    if (answerBody.summaryMode) {
      const decision = await consumeSummaryRateLimits({
        supabase,
        subject: access.rateLimitSubject,
      });
      if (decision.rateLimit.limited) {
        return rateLimitJsonResponse(
          decision.bucket === "document_summarize"
            ? "Too many document summary requests. Retry shortly."
            : "Too many answer requests. Retry shortly.",
          decision.rateLimit,
        );
      }
    } else {
      const rateLimit = await consumeSubjectApiRateLimit({
        supabase,
        subject: access.rateLimitSubject,
        bucket: "answer",
        allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
      });
      if (rateLimit.limited) {
        return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
      }
    }

    const scope = await resolveSearchScope({
      supabase,
      accessScope,
      documentIds: answerBody.documentIds ?? (answerBody.documentId ? [answerBody.documentId] : undefined),
      filters: answerBody.filters,
    });
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
    const answer =
      answerBody.summaryMode && answerBody.documentId
        ? await summarizeDocument(answerBody.documentId, access.ownerId, { signal: request.signal })
        : await answerQuestionWithScope({
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
      query: answerBody.summaryMode ? documentSummaryQuestion : answerBody.query,
      ownerId: access.ownerId,
      answer: governedResponse.telemetryAnswer,
    });

    // Durations only — see server-timing.ts for the trust-boundary constraint.
    const serverTiming = buildServerTimingHeader(
      answerServerTimingEntries(answer.latencyTimings, Date.now() - routeStartedAt),
    );
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
