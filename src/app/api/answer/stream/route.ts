import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { PublicApiError, jsonError } from "@/lib/http";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  type ApiRateLimitResult,
} from "@/lib/api-rate-limit";
import { publicAccessContext } from "@/lib/public-api-access";
import { answerQuestionWithScope, type AnswerProgressEvent } from "@/lib/rag";
import { classifyRagQuery } from "@/lib/clinical-search";
import { annotateSearchResults, buildEvidenceRelevance } from "@/lib/evidence-relevance";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { clinicalQueryModeSchema, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";
import {
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseApiKeyConfigurationError, nonProductionSupabaseDemoFallbackReason } from "@/lib/supabase/errors";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/validation/body";
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

type AnswerBody = z.infer<typeof answerSchema>;

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
  return new Response(
    encodeSse("error", {
      error: "Too many answer requests. Retry shortly.",
      status: 429,
      details: { retryAfterSeconds: rateLimit.retryAfterSeconds, resetAt: rateLimit.resetAt },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    },
  );
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
  logger.error("Search stream failed", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function buildDemoStreamAnswer(body: AnswerBody, fallbackReason?: string) {
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

function streamAnswer(body: AnswerBody, ownerId?: string, signal?: AbortSignal, publicOnly = false) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        };
        const onProgress = (event: AnswerProgressEvent) => send("progress", event);

        try {
          send("progress", { stage: "retrieving", message: "Searching indexed documents." });
          const scope = isDemoMode()
            ? null
            : await resolveSearchScope({
                supabase: createAdminClient(),
                ownerId,
                publicOnly,
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
                allowGlobalSearch: !ownerId,
                queryMode: body.queryMode,
                skipCache: body.skipCache,
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

          send("final", {
            ...answer,
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
          controller.close();
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
    if (isDemoMode()) return streamAnswer(body, undefined, request.signal);

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    const publicOnly = !access.authenticated && !isLocalNoAuthMode();

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "answer",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) return rateLimitStream(rateLimit);

    return streamAnswer(body, access.ownerId, request.signal, publicOnly);
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
