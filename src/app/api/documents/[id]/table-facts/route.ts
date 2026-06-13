import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { invalidateRagCachesForOwner } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { tableReviewMetadata, tableReviewSchema } from "@/lib/table-review";

export const runtime = "nodejs";

const updateSchema = tableReviewSchema.extend({
  factId: z.string().uuid(),
});

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

async function assertDocumentOwner(args: {
  supabase: ReturnType<typeof createAdminClient>;
  documentId: string;
  ownerId: string;
}) {
  const { data, error } = await args.supabase
    .from("documents")
    .select("id")
    .eq("id", args.documentId)
    .eq("owner_id", args.ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) return NextResponse.json({ tableFacts: [], demoMode: true });

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    if (!(await assertDocumentOwner({ supabase, documentId: id, ownerId: user.id }))) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("document_table_facts")
      .select("*")
      .eq("document_id", id)
      .order("page_number", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ tableFacts: data ?? [] });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) return NextResponse.json({ error: "Table review is unavailable in demo mode." }, { status: 400 });

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new PublicApiError("Table review payload is invalid.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    if (!(await assertDocumentOwner({ supabase, documentId: id, ownerId: user.id }))) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { data: fact, error: factError } = await supabase
      .from("document_table_facts")
      .select("*")
      .eq("id", parsed.data.factId)
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (factError) throw new Error(factError.message);
    if (!fact) return NextResponse.json({ error: "Table fact not found." }, { status: 404 });

    const reviewMetadata = tableReviewMetadata({
      reviewClass: parsed.data.reviewClass,
      notes: parsed.data.notes,
      confidence: parsed.data.confidence,
      reviewerId: user.id,
    });
    const nextMetadata = { ...metadataRecord(fact.metadata), ...reviewMetadata };
    const { data: updatedFact, error: updateError } = await supabase
      .from("document_table_facts")
      .update({ metadata: nextMetadata })
      .eq("id", parsed.data.factId)
      .eq("owner_id", user.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    if (fact.source_image_id) {
      const { data: image } = await supabase
        .from("document_images")
        .select("id,metadata")
        .eq("id", fact.source_image_id)
        .eq("document_id", id)
        .maybeSingle();
      if (image) {
        await supabase
          .from("document_images")
          .update({
            metadata: { ...metadataRecord(image.metadata), ...reviewMetadata },
            searchable: parsed.data.reviewClass === "clinical_useful" || parsed.data.reviewClass === "reference",
          })
          .eq("id", fact.source_image_id);
      }
    }

    invalidateRagCachesForOwner(user.id);
    return NextResponse.json({ tableFact: updatedFact });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error, 400);
  }
}
