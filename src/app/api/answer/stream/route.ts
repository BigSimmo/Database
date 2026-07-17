import { randomUUID } from "node:crypto";
import { z } from "zod";
import { demoAnswer, demoSummary } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { PublicApiError, jsonError } from "@/lib/http";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
  type ApiRateLimitResult,
} from "@/lib/api-rate-limit";
import { publicAccessContext } from "@/lib/public-api-access";
import {
  answerDegradedModeSignal,
  buildGovernedAnswerClientResponse,
  buildGovernedDemoAnswerClientResponse,
} from "@/lib/answer-response";
import { answerQuestionWithScope, summarizeDocument, type AnswerProgressEvent } from "@/lib/rag";
import { classifyRagQuery } from "@/lib/clinical-search";
import { annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope } from "@/lib/search-scope";
import { resolveRetrievalAccessScope, type RetrievalAccessScope } from "@/lib/owner-scope";
import { sourceGovernanceWarnings } from "@/lib/source-governance";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { isSupabaseApiKeyConfigurationError, nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";
import { safeErrorLogDetails } from "@/lib/privacy";
import { startSseHeartbeat } from "@/lib/sse-heartbeat";
import { parseJsonBody } from "@/lib/validation/body";
import { answerRequestSchema, type AnswerRequestBody } from "@/lib/validation/answer-request";
import type { AnswerStreamEventMap, AnswerStreamEventName } from "@/lib/answer-stream-contract";
import { toPublicAnswerProgressEvent } from "@/lib/answer-progress-public";
import { answerFeedbackMetadata } from "@/lib/answer-feedback-token";

export const runtime = "nodejs";

const emptyScopeAnswer =
  "The selected filters did not match any indexed documents, so I cannot generate an answer for that scope.";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function rateLimitStream(rateLimit: ApiRateLimitResult) {
  return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
}

function documentSummaryRateLimitStream(rateLimit: ApiRateLimitResult) {
  return rateLimitJsonResponse("Too many document summary requests. Retry shortly.", rateLimit);
}

function streamErrorPayload(error: unknown) {
  if (error instanceof PublicApiError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details?.code ? { code: error.details.code } : undefined,
    };
  }

  // Production has no demo fallback for a misconfigured Supabase key, so tag the
  // SSE error with a stable code operators can spot in the client/network tab.
  if (isSupabaseApiKeyConfigurationError(error)) {
    return {
      message: "Answer generation failed. Retry with a narrower question.",
      status: 500,
      details: { code: "supabase_api_key_configuration" },
    };
  }

  if (error instanceof Error) {
    return {
      message: "Answer generation failed. Retry with a narrower question.",
      // Match the non-streaming /api/answer route, which returns 500 for a
      // generic answer-generation failure.
      status: 500,
      details: { code: error.name },
    };
  }

  return {
    message: "Search processing is temporarily unavailable.",
    status: 503,
  };
}

function streamAnswerFeedbackMetadata(interactionId: string, answer: string) {
  return isDemoMode() ? { interactionId } : answerFeedbackMetadata(interactionId, answer);
}

function logStreamError(error: unknown, signal?: AbortSignal) {
  // Client aborts (Stop button / watchdog) and expected sub-500 degradations are
  // operational noise, not failures — the caller still surfaces them to the client
  // via the SSE error event. Only genuine server-fault stream failures are logged.
  if ((error instanceof DOMException && error.name === "AbortError") || signal?.aborted) return;
  if (error instanceof PublicApiError && error.status < 500) return;
  logger.error("Search stream failed", safeErrorLogDetails(error));
}

function buildDemoStreamAnswer(body: AnswerRequestBody, fallbackReason?: string) {
  const demo =
    body.summaryMode && body.documentId
      ? demoSummary(body.documentId)
      : demoAnswer(body.query, body.documentId, body.documentIds);
  const answerFocusQuery = queryForClinicalMode(body.query, body.queryMode);
  const sources = annotateSearchResults(answerFocusQuery, demo.sources);
  const relevance = buildEvidenceRelevance(answerFocusQuery, sources);
  return buildGovernedDemoAnswerClientResponse(
    {
      ...demo,
      sources,
      relevance,
      smartPanel: demo.smartPanel ? { ...demo.smartPanel, relevance } : demo.smartPanel,
      smartApiPlan: buildSmartRagApiPlan({
        query: answerFocusQuery,
        queryClass: queryClassForClinicalMode(body.queryMode) ?? classifyRagQuery(answerFocusQuery).queryClass,
        results: sources,
        routeMode: demo.routingMode,
        retrievalStrategy: "hybrid",
      }),
    },
    fallbackReason,
  );
}

function streamAnswer(body: AnswerRequestBody, accessScope: RetrievalAccessScope, signal?: AbortSignal) {
  const ownerId = accessScope.ownerId;
  const encoder = new TextEncoder();
  const interactionId = randomUUID();
  // A Request signal is normally aborted when the HTTP client disconnects, but
  // a ReadableStream consumer can also cancel its body independently. Combine
  // both paths so retrieval and generation never continue after either kind of
  // cancellation (and do not emit a misleading SSE error after cancellation).
  const streamAbortController = new AbortController();
  const abortFromRequest = () => {
    if (!streamAbortController.signal.aborted) {
      streamAbortController.abort(signal?.reason ?? new DOMException("The request was aborted.", "AbortError"));
    }
  };
  if (signal?.aborted) abortFromRequest();
  else signal?.addEventListener("abort", abortFromRequest, { once: true });
  const streamSignal = streamAbortController.signal;

  return new Response(
    new ReadableStream({
      async start(controller) {
        const streamStartedAt = Date.now();
        let completionSent = false;
        const send = <Name extends AnswerStreamEventName>(event: Name, data: AnswerStreamEventMap[Name]) => {
          try {
            controller.enqueue(encoder.encode(encodeSse(event, data)));
          } catch {
            // The client may cancel between generation callbacks. Once the
            // stream is closed there is no remaining consumer for this frame.
          }
        };
        const sendProgress = (event: unknown) => {
          const publicEvent = toPublicAnswerProgressEvent(event);
          if (!publicEvent || (publicEvent.stage === "complete" && completionSent)) return;
          if (publicEvent.stage === "complete") completionSent = true;
          send("progress", publicEvent);
        };
        const sendComplete = () => {
          sendProgress({ stage: "complete", elapsedMs: Date.now() - streamStartedAt });
        };
        const sendFinal = (data: AnswerStreamEventMap["final"]) => {
          sendComplete();
          send("final", data);
        };
        // Generation can go silent for long stretches while the model reasons
        // and deterministic gates run; heartbeat comments keep the connection
        // visibly alive without exposing provisional clinical prose.
        const stopHeartbeat = startSseHeartbeat((frame) => controller.enqueue(encoder.encode(frame)));
        const onProgress = (event: AnswerProgressEvent) => sendProgress(event);
        try {
          sendProgress({ stage: "scoping" });
          const scope = isDemoMode()
            ? null
            : await resolveSearchScope({
                supabase: createAdminClient(),
                accessScope,
                documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
                filters: body.filters,
              });
          sendProgress({ stage: "retrieving" });
          if (scope?.documentIds?.length === 0) {
            sendFinal({
              answer: emptyScopeAnswer,
              grounded: false,
              confidence: "unsupported",
              citations: [],
              sources: [],
              degradedMode: answerDegradedModeSignal(),
              scope: { ...scope, queryMode: body.queryMode },
              sourceGovernanceWarnings: sourceGovernanceWarnings({ results: [] }),
              ...answerFeedbackMetadata(interactionId, emptyScopeAnswer),
            });
            return;
          }
          if (isDemoMode()) {
            sendFinal({ ...buildDemoStreamAnswer(body), interactionId });
            return;
          }

          const singleDocumentScope = Boolean(
            body.documentId && !body.documentIds?.length && scope?.activeFilterCount === 0,
          );
          if (body.summaryMode) {
            sendProgress({ stage: "analyzing", message: "Reading the committed document sections." });
            sendProgress({ stage: "generating", message: "Building the governed clinical summary." });
          }
          const answer =
            body.summaryMode && body.documentId
              ? await summarizeDocument(body.documentId, ownerId, { signal: streamSignal })
              : await answerQuestionWithScope({
                  query: body.query,
                  documentId: singleDocumentScope ? body.documentId : undefined,
                  documentIds: singleDocumentScope
                    ? undefined
                    : (scope?.documentIds ?? body.documentIds ?? (body.documentId ? [body.documentId] : undefined)),
                  ownerId,
                  accessScope,
                  allowGlobalSearch: !ownerId,
                  queryMode: body.queryMode,
                  onProgress,
                  signal: streamSignal,
                });
          const governedResponse = buildGovernedAnswerClientResponse(answer);

          logAnswerDiagnostics({
            supabase: createAdminClient(),
            query: body.query,
            ownerId,
            answer: governedResponse.telemetryAnswer,
          });

          sendFinal({
            ...governedResponse.payload,
            scope: scope ? { ...scope, queryMode: body.queryMode } : undefined,
            ...streamAnswerFeedbackMetadata(interactionId, governedResponse.payload.answer),
          });
        } catch (error) {
          // Parity with /api/answer (PR #315): outside production, a misconfigured
          // Supabase API key degrades to a visible demo answer instead of a stream
          // error — the UI's answer search uses this route, not /api/answer.
          const fallbackReason = nonProductionSupabaseDemoFallbackReason(error);
          if (fallbackReason) {
            sendFinal({ ...buildDemoStreamAnswer(body, fallbackReason), interactionId });
            return;
          }
          // Cancellation is a terminal client state, not an SSE failure. In
          // particular, never enqueue an error after the client has cancelled
          // the body: it can race with a new attempt and appear as a duplicate
          // visible failure in the browser.
          if (streamSignal.aborted) return;
          logStreamError(error, streamSignal);
          const streamError = streamErrorPayload(error);
          send("error", { error: streamError.message, status: streamError.status, details: streamError.details });
        } finally {
          stopHeartbeat();
          signal?.removeEventListener("abort", abortFromRequest);
          // The client may have already cancelled the stream (Stop button /
          // watchdog abort), in which case close() throws on a closed stream.
          try {
            controller.close();
          } catch {
            // Stream already closed or cancelled — nothing left to release.
          }
        }
      },
      cancel(reason) {
        if (!streamSignal.aborted) {
          streamAbortController.abort(reason ?? new DOMException("The stream was cancelled.", "AbortError"));
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, answerRequestSchema, "Invalid answer request.");
    if (isDemoMode()) return streamAnswer(body, resolveRetrievalAccessScope(), request.signal);

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "answer",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) return rateLimitStream(rateLimit);

    if (body.summaryMode) {
      // Streamed full-document summaries use the same paid provider path as the
      // legacy summary endpoint. Preserve the general answer ceiling, then also
      // enforce the stricter summary quota before the SSE stream can start.
      const summaryRateLimit = await consumeSubjectApiRateLimit({
        supabase,
        subject: access.rateLimitSubject,
        bucket: "document_summarize",
      });
      if (summaryRateLimit.limited) return documentSummaryRateLimitStream(summaryRateLimit);
    }

    return streamAnswer(body, resolveRetrievalAccessScope(access.ownerId), request.signal);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(error);
    }
    if (error instanceof z.ZodError) {
      return jsonError(error, 400);
    }
    if (error instanceof PublicApiError) {
      return jsonError(error, error.status);
    }
    if (error instanceof Error) {
      return jsonError(new PublicApiError("Answer processing failed.", 500, { code: error.name }), 500);
    }
    return jsonError("Answer processing failed.", 500);
  }
}
