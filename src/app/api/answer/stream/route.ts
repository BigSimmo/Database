import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { PublicApiError, jsonError } from "@/lib/http";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
  type ApiRateLimitResult,
} from "@/lib/api-rate-limit";
import { publicAccessContext } from "@/lib/public-api-access";
import { toClientAnswerPayload } from "@/lib/answer-client-payload";
import { answerQuestionWithScope, type AnswerProgressEvent } from "@/lib/rag";
import { classifyRagQuery } from "@/lib/clinical-search";
import { annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope } from "@/lib/search-scope";
import { resolveRetrievalAccessScope, type RetrievalAccessScope } from "@/lib/owner-scope";
import {
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
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
import type { RagAnswer } from "@/lib/types";

export const runtime = "nodejs";

function answerDegradedModeSignal(answer?: Pick<RagAnswer, "degradedMode" | "answerQualityTier" | "fallbackReason">) {
  if (answer?.degradedMode) return answer.degradedMode;
  const active = answer?.answerQualityTier === "source_only";
  return {
    active,
    reason: active ? (answer?.fallbackReason ?? "source_only") : null,
  };
}

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

function logStreamError(error: unknown) {
  logger.error("Search stream failed", safeErrorLogDetails(error));
}

function buildDemoStreamAnswer(body: AnswerRequestBody, fallbackReason?: string) {
  const demo = demoAnswer(body.query, body.documentId, body.documentIds);
  const answerFocusQuery = queryForClinicalMode(body.query, body.queryMode);
  const sources = annotateSearchResults(answerFocusQuery, demo.sources);
  const relevance = buildEvidenceRelevance(answerFocusQuery, sources);
  return {
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
    demoMode: true,
    degradedMode: fallbackReason ? { active: true, reason: fallbackReason } : answerDegradedModeSignal(demo),
    ...(fallbackReason ? { fallbackMode: "non_production_demo", fallbackReason } : {}),
  };
}

function streamAnswer(body: AnswerRequestBody, accessScope: RetrievalAccessScope, signal?: AbortSignal) {
  const ownerId = accessScope.ownerId;
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = <Name extends AnswerStreamEventName>(event: Name, data: AnswerStreamEventMap[Name]) => {
          try {
            controller.enqueue(encoder.encode(encodeSse(event, data)));
          } catch {
            // The client may cancel between generation callbacks. Once the
            // stream is closed there is no remaining consumer for this frame.
          }
        };
        // Generation can go silent for long stretches while the model reasons
        // and deterministic gates run; heartbeat comments keep the
        // connection visibly alive for proxies and the client's stall watchdog.
        const stopHeartbeat = startSseHeartbeat((frame) => controller.enqueue(encoder.encode(frame)));
        const onProgress = (event: AnswerProgressEvent) => send("progress", event);
        try {
          send("progress", { stage: "retrieving", message: "Searching indexed documents." });
          const scope = isDemoMode()
            ? null
            : await resolveSearchScope({
                supabase: createAdminClient(),
                accessScope,
                documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
                filters: body.filters,
              });
          if (scope?.documentIds?.length === 0) {
            send("final", {
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
            return;
          }
          const singleDocumentScope = Boolean(
            body.documentId && !body.documentIds?.length && scope?.activeFilterCount === 0,
          );
          const answer = isDemoMode()
            ? buildDemoStreamAnswer(body)
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
                signal,
              });
          const warnings = sourceGovernanceWarnings({
            results: answer.sources ?? [],
            relevance: answer.relevance ?? answer.smartPanel?.relevance ?? null,
          });
          const shouldUseSourceGovernanceRefusal =
            answer.grounded !== false && answer.confidence !== "unsupported" && answer.responseMode !== "evidence_gap";
          if (shouldUseSourceGovernanceRefusal && hasDangerSourceGovernanceWarning(warnings)) {
            // Explicit refusal payload — do not spread ...answer (see /api/answer):
            // the refused sources/smartPanel/smartApiPlan must not reach the client.
            if (!isDemoMode()) {
              void logAnswerDiagnostics({
                supabase: createAdminClient(),
                query: body.query,
                ownerId,
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
            }
            send("final", {
              answer: sourceGovernanceRefusalAnswer,
              grounded: false,
              confidence: "unsupported",
              citations: [],
              sources: [],
              degradedMode: answerDegradedModeSignal(answer),
              scope: scope ? { ...scope, queryMode: body.queryMode } : undefined,
              sourceGovernanceWarnings: warnings,
            });
            return;
          }

          if (!isDemoMode()) {
            logAnswerDiagnostics({ supabase: createAdminClient(), query: body.query, ownerId, answer });
          }

          send("final", {
            // Boundary trim only — governance warnings and diagnostics above
            // consumed the full answer (see answer-client-payload.ts).
            ...toClientAnswerPayload(answer),
            degradedMode: answerDegradedModeSignal(answer),
            scope: scope ? { ...scope, queryMode: body.queryMode } : undefined,
            sourceGovernanceWarnings: warnings,
          });
        } catch (error) {
          logStreamError(error);
          // Parity with /api/answer (PR #315): outside production, a misconfigured
          // Supabase API key degrades to a visible demo answer instead of a stream
          // error — the UI's answer search uses this route, not /api/answer.
          const fallbackReason = nonProductionSupabaseDemoFallbackReason(error);
          if (fallbackReason) {
            send("final", buildDemoStreamAnswer(body, fallbackReason));
            return;
          }
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
