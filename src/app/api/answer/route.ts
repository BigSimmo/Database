import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag";
import { jsonError, PublicApiError } from "@/lib/http";
import { consumePublicAnswerRateLimit } from "@/lib/public-rate-limit";

export const runtime = "nodejs";

const answerSchema = z.object({
  query: z.string().trim().min(1),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
});

export async function POST(request: Request) {
  try {
    const body = answerSchema.parse(await request.json());
    if (isDemoMode()) {
      return NextResponse.json({
        ...demoAnswer(body.query, body.documentId, body.documentIds),
        demoMode: true,
      });
    }

    const rateLimit = consumePublicAnswerRateLimit(request.headers);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many public answer requests. Retry shortly." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const answer = await answerQuestionWithScope({
      query: body.query,
      documentId: body.documentId,
      documentIds: body.documentIds,
      ownerId: undefined,
    });
    return NextResponse.json(answer);
  } catch (error) {
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
