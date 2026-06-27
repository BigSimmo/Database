import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import { isDemoMode } from "@/lib/env";
import { normalizeQueryText, queryPrivacyMetadata, queryTextForStorage } from "@/lib/query-privacy";
import { createAdminClient } from "@/lib/supabase/admin";
import * as serverAuth from "@/lib/supabase/auth";

export const runtime = "nodejs";

const interactionSchema = z.object({
  query: z.string().trim().min(1),
  documentId: z.string().uuid(),
  chunkId: z.string().uuid().optional(),
  fileName: z.string().trim().max(240).optional(),
  title: z.string().trim().max(240).optional(),
  queryClass: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const body = interactionSchema.parse(await request.json());
    if (isDemoMode()) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminClient();
    // Carry the authenticated owner through so the miss row is attributable and
    // owner-cleanable instead of being orphaned with owner_id: null (RET-H4).
    const user = await serverAuth.requireAuthenticatedUser(request, supabase);
    // Only attribute the clicked document/labels to the miss row when the document
    // belongs to the caller. Otherwise a client could inject an arbitrary (or
    // cross-owner) document_id + free-text label into the miss-promotion pipeline
    // (scripts/promote-query-misses). The query telemetry is still recorded.
    const { data: ownedDocument } = await supabase
      .from("documents")
      .select("id")
      .eq("id", body.documentId)
      .eq("owner_id", user.id)
      .maybeSingle();
    const documentOwned = Boolean(ownedDocument);
    await supabase.from("rag_query_misses").insert({
      owner_id: user.id,
      query: queryTextForStorage(body.query),
      normalized_query: normalizeQueryText(body.query),
      query_class: body.queryClass ?? null,
      clicked_document_id: documentOwned ? body.documentId : null,
      clicked_chunk_id: documentOwned ? (body.chunkId ?? null) : null,
      top_files: documentOwned && body.fileName ? [body.fileName] : [],
      top_chunk_ids: documentOwned && body.chunkId ? [body.chunkId] : [],
      miss_reason: "clicked_result",
      candidate_aliases: normalizedClinicalSearchTokens(body.query).slice(0, 10),
      candidate_labels:
        documentOwned && body.title
          ? [
              {
                label: body.title,
                label_type: "document_type",
                document_id: body.documentId,
                confidence: 0.6,
              },
            ]
          : [],
      metadata: {
        interaction: "source_open",
        ...queryPrivacyMetadata(body.query),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof serverAuth.AuthenticationError) {
      return serverAuth.unauthorizedResponse(error);
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
