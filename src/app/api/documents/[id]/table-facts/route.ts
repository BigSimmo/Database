import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { invalidateRagCachesForOwner } from "@/lib/rag/rag";
import { committedIndexGeneration, isCommittedGenerationMetadata } from "@/lib/reindex-pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { enforceDocumentReadRateLimit, withOwnerReadScope } from "@/lib/public-api-access";
import { tableReviewMetadata, tableReviewSchema } from "@/lib/table-review";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRouteParams } from "@/lib/validation/params";

export const runtime = "nodejs";

const updateSchema = tableReviewSchema.extend({
  factId: z.string().uuid(),
});
const tableFactsRouteParamsSchema = z.object({ id: z.string().uuid() });

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

async function loadOwnedDocument(args: {
  supabase: ReturnType<typeof createAdminClient>;
  documentId: string;
  ownerId: string;
}) {
  const { data, error } = await args.supabase
    .from("documents")
    .select("id,metadata")
    .eq("id", args.documentId)
    .eq("owner_id", args.ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, tableFactsRouteParamsSchema, "Invalid document id.");
    if (isDemoMode()) return NextResponse.json({ tableFacts: [], demoMode: true });

    const supabase = createAdminClient();
    const { access, rateLimit } = await enforceDocumentReadRateLimit(request, supabase);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Document requests are rate limited. Try again shortly.", rateLimit);
    }

    const { data: document, error: documentError } = await withOwnerReadScope(
      supabase.from("documents").select("id,metadata").eq("id", id),
      access.ownerId,
    ).maybeSingle();
    if (documentError) throw new Error(documentError.message);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    const committedGeneration = committedIndexGeneration(document.metadata);

    const { data, error } = await supabase
      .from("document_table_facts")
      .select("*")
      .eq("document_id", id)
      .order("page_number", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const tableFacts = (data ?? [])
      .filter((fact) => isCommittedGenerationMetadata({ rowMetadata: fact.metadata, committedGeneration }))
      .map((fact) => ({
        id: fact.id,
        document_id: fact.document_id,
        page_number: fact.page_number,
        table_title: fact.table_title,
        row_label: fact.row_label,
        clinical_parameter: fact.clinical_parameter,
        threshold_value: fact.threshold_value,
        action: fact.action,
        normalized_terms: fact.normalized_terms,
        source_chunk_id: fact.source_chunk_id,
        source_image_id: fact.source_image_id,
        created_at: fact.created_at,
      }));
    return NextResponse.json({ tableFacts });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const { id } = parseRouteParams({ id: rawId }, tableFactsRouteParamsSchema, "Invalid document id.");
    if (isDemoMode()) return NextResponse.json({ error: "Table review is unavailable in demo mode." }, { status: 400 });

    const parsed = await parseJsonBody(request, updateSchema, "Table review payload is invalid.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase, { administrator: true });

    const rateLimit = await consumeApiRateLimit({
      supabase,
      ownerId: user.id,
      bucket: "document_admin",
      allowInMemoryFallbackOnUnavailable: true,
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Too many document administration requests. Retry shortly.", rateLimit);
    }

    const document = await loadOwnedDocument({ supabase, documentId: id, ownerId: user.id });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    const committedGeneration = committedIndexGeneration(document.metadata);

    const { data: fact, error: factError } = await supabase
      .from("document_table_facts")
      .select("*")
      .eq("id", parsed.factId)
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (factError) throw new Error(factError.message);
    if (!fact) return NextResponse.json({ error: "Table fact not found." }, { status: 404 });
    if (!isCommittedGenerationMetadata({ rowMetadata: fact.metadata, committedGeneration })) {
      return NextResponse.json({ error: "Table fact not found." }, { status: 404 });
    }

    let sourceImage: { id: string; metadata: unknown } | null = null;
    if (fact.source_image_id) {
      const { data: image, error: imageError } = await supabase
        .from("document_images")
        .select("id,metadata")
        .eq("id", fact.source_image_id)
        .eq("document_id", id)
        .maybeSingle();
      if (imageError) throw new Error(imageError.message);
      if (image && !isCommittedGenerationMetadata({ rowMetadata: image.metadata, committedGeneration })) {
        return NextResponse.json({ error: "Table fact not found." }, { status: 404 });
      }
      sourceImage = image;
    }

    const reviewMetadata = tableReviewMetadata({
      reviewClass: parsed.reviewClass,
      notes: parsed.notes,
      confidence: parsed.confidence,
      reviewerId: user.id,
    });
    const nextMetadata = { ...metadataRecord(fact.metadata), ...reviewMetadata };
    const { data: updatedFact, error: updateError } = await supabase
      .from("document_table_facts")
      .update({ metadata: nextMetadata })
      .eq("id", parsed.factId)
      .eq("owner_id", user.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    if (sourceImage && fact.source_image_id) {
      const { error: imageUpdateError } = await supabase
        .from("document_images")
        .update({
          metadata: { ...metadataRecord(sourceImage.metadata), ...reviewMetadata },
          searchable: parsed.reviewClass === "clinical_useful" || parsed.reviewClass === "reference",
        })
        .eq("id", fact.source_image_id);
      if (imageUpdateError) throw new Error(imageUpdateError.message);
    }

    invalidateRagCachesForOwner(user.id);
    return NextResponse.json({ tableFact: updatedFact });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error, error.status);
    return jsonError(error, 500);
  }
}
