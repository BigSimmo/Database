import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSummary, getDemoDocument } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { documentSummaryQuestion } from "@/lib/answer-contract";
import { summarizeDocument } from "@/lib/rag/rag";
import { buildGovernedAnswerClientResponse, buildGovernedDemoAnswerClientResponse } from "@/lib/answer-response";
import { logAnswerDiagnostics } from "@/lib/answer-telemetry";
import { answerFeedbackMetadata } from "@/lib/answer-feedback-token";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { setAgentConversationId } from "@/lib/observability/agent-monitoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const summarizeRouteParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, summarizeRouteParamsSchema, "Invalid document id.");
    if (isDemoMode()) {
      if (!getDemoDocument(id)) {
        return publicErrorResponse("Demo document not found.", 404, { code: "document_not_found" });
      }
      return NextResponse.json({
        ...buildGovernedDemoAnswerClientResponse(demoSummary(id)),
        interactionId: randomUUID(),
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "document_summarize" });
    if (rateLimit.limited)
      return rateLimitJsonResponse("Too many document summary requests. Retry shortly.", rateLimit);
    // Group this request's LLM calls into one Sentry agent-monitoring conversation
    // before any OpenAI work starts. Synthetic UUID only — never document/query text.
    const interactionId = randomUUID();
    setAgentConversationId(interactionId);
    const answer = await summarizeDocument(id, user.id, { signal: request.signal });
    const governedResponse = buildGovernedAnswerClientResponse(answer);
    logAnswerDiagnostics({
      supabase,
      query: documentSummaryQuestion,
      ownerId: user.id,
      answer: governedResponse.telemetryAnswer,
    });
    return NextResponse.json({
      ...governedResponse.payload,
      ...answerFeedbackMetadata(interactionId, governedResponse.payload.answer),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message === "Document not found.") {
      return publicErrorResponse("Document not found.", 404, { code: "document_not_found" });
    }
    return jsonError(error);
  }
}
