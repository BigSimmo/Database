import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { PublicApiError, jsonError } from "@/lib/http";
import { consumeApiRateLimit, type ApiRateLimitResult } from "@/lib/api-rate-limit";
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
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const answerSchema = z.object({
  query: z.string().trim().min(1),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  filters: searchScopeFiltersSchema.optional(),
  queryMode: clinicalQueryModeSchema.optional().default("auto"),
  skipCache: z.boolean().optional().default(false),
});

type AnswerBody = z.infer<typeof answerSchema>;

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

  if (error instanceof Error) {
    return {
      message: "Answer generation failed. Retry with a narrower question.",
      status: 503,
      details: { code: error.name },
    };
  }

  return {
    message: "Search processing is temporarily unavailable.",
    status: 503,
  };
}

function logStreamError(error: unknown) {
  console.error("Search stream failed", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function streamAnswer(body: AnswerBody, ownerId?: string) {
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
                documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
                filters: body.filters,
              });
          if (scope?.documentIds?.length === 0) {
            send("final", {
              answer:
                "The selected filters did not match any indexed documents, so I cannot generate a source-backed answer for that scope.",
              grounded: false,
              confidence: "unsupported",
              citations: [],
              sources: [],
              scope: { ...scope, queryMode: body.queryMode },
              sourceGovernanceWarnings: sourceGovernanceWarnings({ results: [] }),
            });
            return;
          }
          const singleDocumentScope = Boolean(
            body.documentId && !body.documentIds?.length && scope?.activeFilterCount === 0,
          );
          const answer = isDemoMode()
            ? (() => {
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
                    queryClass:
                      queryClassForClinicalMode(body.queryMode) ?? classifyRagQuery(answerFocusQuery).queryClass,
                    results: sources,
                    routeMode: demo.routingMode,
                    retrievalStrategy: "hybrid",
                  }),
                  demoMode: true,
                };
              })()
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
              });
          const warnings = sourceGovernanceWarnings({
            results: answer.sources ?? [],
            relevance: answer.relevance ?? answer.smartPanel?.relevance ?? null,
          });
          if (hasDangerSourceGovernanceWarning(warnings)) {
            send("final", {
              ...answer,
              answer: sourceGovernanceRefusalAnswer,
              grounded: false,
              confidence: "unsupported",
              citations: [],
              scope: scope ? { ...scope, queryMode: body.queryMode } : undefined,
              sourceGovernanceWarnings: warnings,
            });
            return;
          }

          send("final", {
            ...answer,
            scope: scope ? { ...scope, queryMode: body.queryMode } : undefined,
            sourceGovernanceWarnings: warnings,
          });
        } catch (error) {
          logStreamError(error);
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
    const body = answerSchema.parse(await request.json());
    if (isDemoMode()) return streamAnswer(body);

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    const rateLimit = await consumeApiRateLimit({
      supabase,
      ownerId: user.id,
      bucket: "answer",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) return rateLimitStream(rateLimit);

    return streamAnswer(body, user.id);
  } catch (error) {
    if (error instanceof Error && error.name === "AuthenticationError") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
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
