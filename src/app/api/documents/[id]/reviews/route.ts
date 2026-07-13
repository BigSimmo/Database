import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { invalidateRagCachesForOwner } from "@/lib/rag";
import { sourceReviewDecisionSchema } from "@/lib/source-review";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z
  .object({
    decision: sourceReviewDecisionSchema,
    reason: z.string().trim().min(3).max(2000),
    evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
    reviewDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .default(null),
    replacementDocumentId: z.string().uuid().nullable().optional().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.decision === "approved" || value.decision === "locally_reviewed") && !value.evidenceReferences.length) {
      context.addIssue({
        code: "custom",
        path: ["evidenceReferences"],
        message: "Evidence is required for promotion.",
      });
    }
    if (value.decision === "superseded" && !value.replacementDocumentId) {
      context.addIssue({ code: "custom", path: ["replacementDocumentId"], message: "A replacement is required." });
    }
  });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, paramsSchema, "Invalid document id.");
    if (isDemoMode())
      return NextResponse.json({ error: "Source reviews are unavailable in demo mode." }, { status: 400 });

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const body = await parseJsonBody(request, bodySchema, "Invalid source review.");
    const rateLimit = await consumeApiRateLimit({ supabase, ownerId: user.id, bucket: "source_review" });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many source review requests. Retry shortly.", rateLimit);

    const { data, error } = await supabase.rpc("record_source_review", {
      p_document_id: id,
      p_reviewer_id: user.id,
      p_decision: body.decision,
      p_reason: body.reason,
      p_evidence_references: body.evidenceReferences,
      p_review_date: body.reviewDate,
      p_replacement_document_id: body.replacementDocumentId,
    });
    if (error) {
      if (/document not found/i.test(error.message)) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }
      throw new PublicApiError("Source review could not be recorded.", 400, { code: "source_review_rejected" });
    }

    invalidateRagCachesForOwner(user.id);
    return NextResponse.json({ review: data }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error, error.status);
    return jsonError(error, 500);
  }
}
