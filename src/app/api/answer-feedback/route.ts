import { NextResponse } from "next/server";
import { z } from "zod";
import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { verifyAnswerFeedbackToken } from "@/lib/answer-feedback-token";

export const runtime = "nodejs";

const uuid = z.string().uuid();
const bodySchema = z
  .object({
    interactionId: uuid,
    feedbackCategory: z.enum([
      "verified",
      "needs_correction",
      "source_insufficient",
      "wrong_source",
      "missing_source",
      "unsupported_answer",
      "numeric_error",
      "outdated_guidance",
    ]),
    answerHash: z.string().regex(/^[a-f0-9]{64}$/),
    feedbackToken: z.string().trim().min(1).max(1024),
    citedSourceIds: z.array(uuid).max(80).optional().default([]),
    sourceIds: z.array(uuid).max(80).optional().default([]),
    route: z.string().trim().max(100).nullable().optional().default(null),
    model: z.string().trim().max(100).nullable().optional().default(null),
    providerRequestIds: z.array(z.string().trim().min(1).max(200)).max(10).optional().default([]),
  })
  .strict();

export async function POST(request: Request) {
  try {
    if (isDemoMode())
      return NextResponse.json({ error: "Answer feedback is unavailable in demo mode." }, { status: 400 });
    const body = await parseJsonBody(request, bodySchema, "Invalid answer feedback.");
    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "answer_feedback",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many feedback requests. Retry shortly.", rateLimit);

    if (
      !verifyAnswerFeedbackToken({
        token: body.feedbackToken,
        interactionId: body.interactionId,
        answerHash: body.answerHash,
      })
    ) {
      throw new PublicApiError("Answer feedback could not be verified. Run the question again.", 400, {
        code: "invalid_feedback_token",
      });
    }

    const { error } = await supabase.from("rag_answer_feedback").insert({
      interaction_id: body.interactionId,
      owner_id: access.ownerId ?? null,
      feedback_category: body.feedbackCategory,
      answer_hash: body.answerHash,
      cited_source_ids: [...new Set(body.citedSourceIds)],
      source_ids: [...new Set(body.sourceIds)],
      route: body.route,
      model: body.model,
      provider_request_ids: [...new Set(body.providerRequestIds)],
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Feedback has already been recorded for this answer." }, { status: 409 });
      }
      throw new PublicApiError("Answer feedback could not be saved.", 500, { code: "feedback_insert_failed" });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error, error.status);
    return jsonError(error, 500);
  }
}
