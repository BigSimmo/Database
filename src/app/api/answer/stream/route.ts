import { z } from "zod";
import { demoAnswer } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { PublicApiError, jsonError } from "@/lib/http";
import { answerQuestionWithScope, type AnswerProgressEvent } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const answerSchema = z.object({
  query: z.string().trim().min(2),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
});

type AnswerBody = z.infer<typeof answerSchema>;

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
          const answer = isDemoMode()
            ? { ...demoAnswer(body.query, body.documentId, body.documentIds), demoMode: true }
            : await answerQuestionWithScope({
                query: body.query,
                documentId: body.documentId,
                documentIds: body.documentIds,
                ownerId,
                onProgress,
              });
          send("final", answer);
        } catch (error) {
          const publicError =
            error instanceof PublicApiError
              ? error
              : new PublicApiError("Answer generation failed. Retry with a narrower question.", 500);
          send("error", { error: publicError.message });
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
    return streamAnswer(body, user.id);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error, 400);
  }
}
