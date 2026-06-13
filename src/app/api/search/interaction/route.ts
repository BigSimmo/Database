import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const normalizedQuery = body.query.toLowerCase().replace(/\s+/g, " ").trim();
    await createAdminClient()
      .from("rag_query_misses")
      .insert({
        owner_id: null,
        query: body.query,
        normalized_query: normalizedQuery,
        query_class: body.queryClass ?? null,
        clicked_document_id: body.documentId,
        clicked_chunk_id: body.chunkId ?? null,
        top_files: body.fileName ? [body.fileName] : [],
        top_chunk_ids: body.chunkId ? [body.chunkId] : [],
        miss_reason: "clicked_result",
        candidate_aliases: normalizedClinicalSearchTokens(body.query).slice(0, 10),
        candidate_labels: body.title
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
        },
      });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
