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

function safeTelemetryText(value: string | undefined) {
  const cleaned = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

async function ownedDocumentExists(args: {
  supabase: ReturnType<typeof createAdminClient>;
  ownerId: string;
  documentId: string;
}) {
  const { data, error } = await args.supabase
    .from("documents")
    .select("id")
    .eq("id", args.documentId)
    .eq("owner_id", args.ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function ownedChunkExists(args: {
  supabase: ReturnType<typeof createAdminClient>;
  documentId: string;
  chunkId: string | undefined;
}) {
  if (!args.chunkId) return false;
  const { data, error } = await args.supabase
    .from("document_chunks")
    .select("id")
    .eq("id", args.chunkId)
    .eq("document_id", args.documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

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
    const hasOwnedDocument = await ownedDocumentExists({ supabase, ownerId: user.id, documentId: body.documentId });
    const hasOwnedChunk = hasOwnedDocument
      ? await ownedChunkExists({ supabase, documentId: body.documentId, chunkId: body.chunkId })
      : false;
    const clickedDocumentId = hasOwnedDocument ? body.documentId : null;
    const clickedChunkId = hasOwnedChunk ? body.chunkId! : null;
    const safeFileName = clickedDocumentId ? safeTelemetryText(body.fileName) : null;
    const safeTitle = clickedDocumentId ? safeTelemetryText(body.title) : null;

    await supabase.from("rag_query_misses").insert({
      owner_id: user.id,
      query: queryTextForStorage(body.query),
      normalized_query: normalizeQueryText(body.query),
      query_class: body.queryClass ?? null,
      clicked_document_id: clickedDocumentId,
      clicked_chunk_id: clickedChunkId,
      top_files: safeFileName ? [safeFileName] : [],
      top_chunk_ids: clickedChunkId ? [clickedChunkId] : [],
      miss_reason: "clicked_result",
      candidate_aliases: normalizedClinicalSearchTokens(body.query).slice(0, 10),
      candidate_labels: safeTitle
        ? [
            {
              label: safeTitle,
              label_type: "document_type",
              document_id: clickedDocumentId,
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
