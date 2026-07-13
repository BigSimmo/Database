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
import { clinicalQueryModeSchema, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";
import { resolveRetrievalAccessScope, type RetrievalAccessScope } from "@/lib/owner-scope";
import { sourceGovernanceWarnings } from "@/lib/source-governance";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerException } from "@/lib/observability/error-capture";
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { isSupabaseApiKeyConfigurationError, nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";
import { safeErrorLogDetails } from "@/lib/privacy";
import { startSseHeartbeat } from "@/lib/sse-heartbeat";
import { parseJsonBody } from "@/lib/validation/body";
import { toPublicAnswerProgressEvent } from "@/lib/answer-progress-public";
import { answerFeedbackMetadata } from "@/lib/answer-feedback-token";

export const runtime = "nodejs";

const answerSchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    documentId: z.string().uuid().optional(),
    documentIds: z.array(z.string().uuid()).max(25).optional(),
    filters: searchScopeFiltersSchema.optional(),
    queryMode: clinicalQueryModeSchema.optional().default("auto"),
    summaryMode: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    if (value.summaryMode && !value.documentId) {
      context.addIssue({
        code: "custom",
        path: ["documentId"],
        message: "Document summary mode requires a document id.",
      });
    }
  });

type AnswerBody = z.infer<typeof answerSchema>;
const emptyScopeAnswer =
  "The selected filters did not match any indexed documents, so I cannot generate an answer for that scope.";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function rateLimitStream(rateLimit: ApiRateLimitResult) {
  return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
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
  logger.error("Search stream failed", safeErrorLogDetails(error));
  // Report only server-fault failures: client aborts (Stop button / watchdog) and
  // expected sub-500 degradations are operational noise, not incidents.
  if ((error instanceof DOMException && error.name === "AbortError") || signal?.aborted) return;
  if (error instanceof PublicApiError && error.status < 500) return;
  void captureServerException(error, { route: "api/answer/stream", source: "stream" });
}

function buildDemoStreamAnswer(body: AnswerBody, fallbackReason?: string) {
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

function streamAnswer(body: AnswerBody, accessScope: RetrievalAccessScope, signal?: AbortSignal) {
  const ownerId = accessScope.ownerId;
  const encoder = new TextEncoder();
  const interactionId = randomUUID();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const streamStartedAt = Date.now();
        let completionSent = false;
        const send = (event: string, data: unknown) => {
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
        const sendFinal = (data: unknown) => {
          sendComplete();
          send("final", data);
        };
        // Generation can go silent for long stretches (strong-route reasoning
        // before the first output token); heartbeat comments keep the
        // connection visibly alive for proxies and the client's stall watchdog.
        const stopHeartbeat = startSseHeartbeat((frame) => controller.enqueue(encoder.encode(frame)));
        const onProgress = (event: AnswerProgressEvent) => sendProgress(event);
        // Stream the answer prose as it generates (content-preserving) and signal a reset when a
        // provisional answer is being revised by the quality gates.
        const onToken = (delta: string) => send("token", { delta });
        const onRevising = () => send("revising", {});

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
              ? await summarizeDocument(body.documentId, ownerId)
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
                  onToken,
                  onRevising,
                  signal,
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
          logStreamError(error, signal);
          const streamError = streamErrorPayload(error);
          send("error", { error: streamError.message, status: streamError.status, details: streamError.details });
        } finally {
          stopHeartbeat();
          // The client may have already cancelled the stream (Stop button /
          // watchdog abort), in which case close() throws on a closed stream.
          try {
            controller.close();
          } catch {
            // Stream already closed or cancelled — nothing left to release.
          }
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
    const body = await parseJsonBody(request, answerSchema, "Invalid answer request.");
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

    return streamAnswer(body, resolveRetrievalAccessScope(access.ownerId), request.signal);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(error);
    }
    if (error instanceof z.ZodError) {
      return jsonError(error, 400);
    }
    const clientAborted = (error instanceof DOMException && error.name === "AbortError") || request.signal.aborted;
    if (error instanceof PublicApiError) {
      if (error.status >= 500 && !clientAborted) {
        void captureServerException(error, { route: "api/answer/stream", status: error.status });
      }
      return jsonError(error, error.status);
    }
    if (error instanceof Error) {
      if (!clientAborted) {
        void captureServerException(error, { route: "api/answer/stream", status: 500 });
      }
      return jsonError(new PublicApiError("Answer processing failed.", 500, { code: error.name }), 500);
    }
    if (!clientAborted) {
      void captureServerException(error, { route: "api/answer/stream", status: 500 });
    }
    return jsonError("Answer processing failed.", 500);
  }
}
