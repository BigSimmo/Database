import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { answerQuestionWithScope } from "@/lib/rag";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const answerSchema = z.object({
  query: z.string().trim().min(2),
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

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const answer = await answerQuestionWithScope({
      query: body.query,
      documentId: body.documentId,
      documentIds: body.documentIds,
      ownerId: user.id,
    });
    return NextResponse.json(answer);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error, 400);
  }
}
