import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSummary, getDemoDocument } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { summarizeDocument } from "@/lib/rag";
import { jsonError } from "@/lib/http";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
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
        return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      }
      return NextResponse.json({ ...demoSummary(id), demoMode: true });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "document_summarize" });
    if (rateLimit.limited)
      return rateLimitJsonResponse("Too many document summary requests. Retry shortly.", rateLimit);
    return NextResponse.json(await summarizeDocument(id, user.id));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message === "Document not found.") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return jsonError(error);
  }
}
