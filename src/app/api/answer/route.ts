import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag";
import { jsonError, PublicApiError } from "@/lib/http";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { classifyRagQuery } from "@/lib/clinical-search";
import { buildSmartRagApiPlan } from "@/lib/smart-rag-api";
import { clinicalQueryModeSchema, queryClassForClinicalMode, queryForClinicalMode } from "@/lib/clinical-query-mode";
import { resolveSearchScope, searchScopeFiltersSchema } from "@/lib/search-scope";
import {
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "@/lib/source-governance";
import { createAdminClient } from "@/lib/supabase/admin";
import * as serverAuth from "@/lib/supabase/auth";

export const runtime = "nodejs";

const answerSchema = z.object({
  query: z.string().trim().min(1),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  filters: searchScopeFiltersSchema.optional(),
  queryMode: clinicalQueryModeSchema.optional().default("auto"),
  skipCache: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const body = answerSchema.parse(await request.json());
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
      });
    }

    const supabase = createAdminClient();
    const user = await serverAuth.requireAuthenticatedUser(request, supabase);

    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "answer" });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
    }

    const scope = await resolveSearchScope({
      supabase,
      ownerId: user.id,
      documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
      filters: body.filters,
    });
    if (scope.documentIds?.length === 0) {
      return NextResponse.json({
        answer:
          "The selected filters did not match any indexed documents, so I cannot generate a source-backed answer for that scope.",
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: [],
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
      ownerId: user.id,
      queryMode: body.queryMode,
      skipCache: body.skipCache,
    });
    const warnings = sourceGovernanceWarnings({
      results: answer.sources ?? [],
      relevance: answer.relevance ?? answer.smartPanel?.relevance ?? null,
    });
    if (hasDangerSourceGovernanceWarning(warnings)) {
      return NextResponse.json({
        ...answer,
        answer: sourceGovernanceRefusalAnswer,
        grounded: false,
        confidence: "unsupported",
        citations: [],
        scope: { ...scope, queryMode: body.queryMode },
        sourceGovernanceWarnings: warnings,
      });
    }

    return NextResponse.json({
      ...answer,
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
