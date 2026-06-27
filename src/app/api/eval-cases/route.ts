import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import { clinicalQueryModeSchema } from "@/lib/clinical-query-mode";
import { env, isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { queryPrivacyMetadata, queryTextForStorage } from "@/lib/query-privacy";
import { searchScopeFiltersSchema } from "@/lib/search-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const evalCaptureSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  rating: z.enum(["good", "needs_fixing"]).optional(),
  feedbackType: z
    .enum([
      "verified",
      "needs_correction",
      "source_insufficient",
      "wrong_source",
      "missing_source",
      "unsupported_answer",
      "numeric_error",
      "outdated_guidance",
    ])
    .optional(),
  note: z.string().trim().max(1000).optional().default(""),
  answer: z.string().trim().max(12000).optional().default(""),
  queryMode: clinicalQueryModeSchema.optional().default("auto"),
  queryClass: z
    .enum([
      "document_lookup",
      "table_threshold",
      "medication_dose_risk",
      "comparison",
      "broad_summary",
      "unsupported_or_general",
    ])
    .optional(),
  filters: searchScopeFiltersSchema.optional(),
  sourceChunkIds: z.array(z.string().trim().min(1)).max(80).optional().default([]),
  citedChunkIds: z.array(z.string().trim().min(1)).max(80).optional().default([]),
  sourceFiles: z.array(z.string().trim().min(1).max(512)).max(20).optional().default([]),
  sourceGovernanceWarnings: z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
  unverifiedNumericTokens: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  expectedDocumentId: z.string().uuid().optional(),
  expectedChunkId: z.string().uuid().optional(),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueUuidValues(values: string[]) {
  return uniqueValues(values).filter((value) => uuidPattern.test(value));
}

function feedbackRating(data: z.infer<typeof evalCaptureSchema>) {
  if (data.rating) return data.rating;
  return data.feedbackType === "verified" ? "good" : "needs_fixing";
}

function missReasonFor(data: z.infer<typeof evalCaptureSchema>, rating: "good" | "needs_fixing") {
  if (data.feedbackType === "verified" || rating === "good") return "answer_good_eval";
  if (data.feedbackType) return data.feedbackType;
  return "answer_needs_fixing";
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Eval capture is unavailable in demo mode." }, { status: 400 });

    const parsed = evalCaptureSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new PublicApiError("Eval capture payload is invalid.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const normalizedQuery = parsed.data.query.toLowerCase().replace(/\s+/g, " ").trim();
    const sourceChunkIds = uniqueUuidValues(parsed.data.sourceChunkIds);
    const citedChunkIds = uniqueUuidValues(parsed.data.citedChunkIds);
    const sourceFiles = uniqueValues(parsed.data.sourceFiles);
    const rating = feedbackRating(parsed.data);
    const missReason = missReasonFor(parsed.data, rating);
    // Caller-supplied expected_* FKs are UUID-validated and FK-checked for existence,
    // but neither enforces ownership. Confirm they resolve to rows owned by the
    // caller so eval data can't be attributed to another tenant's document/chunk.
    let expectedDocumentId: string | null = null;
    if (parsed.data.expectedDocumentId) {
      const { data: ownedDoc } = await supabase
        .from("documents")
        .select("id")
        .eq("id", parsed.data.expectedDocumentId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (ownedDoc) expectedDocumentId = parsed.data.expectedDocumentId;
    }
    let expectedChunkId: string | null = null;
    if (parsed.data.expectedChunkId) {
      const { data: chunkRow } = await supabase
        .from("document_chunks")
        .select("document_id")
        .eq("id", parsed.data.expectedChunkId)
        .maybeSingle();
      if (chunkRow?.document_id) {
        const { data: ownedChunkDoc } = await supabase
          .from("documents")
          .select("id")
          .eq("id", chunkRow.document_id)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (ownedChunkDoc) expectedChunkId = parsed.data.expectedChunkId;
      }
    }
    const { data, error } = await supabase
      .from("rag_query_misses")
      .insert({
        owner_id: user.id,
        // Raw clinical queries are potential PHI: store the normalized form unless
        // raw retention is explicitly enabled (RET-H4), matching every other
        // rag_query_misses / rag_queries writer.
        query: queryTextForStorage(parsed.data.query),
        normalized_query: normalizedQuery,
        query_class: parsed.data.queryClass ?? parsed.data.queryMode,
        top_files: sourceFiles,
        top_chunk_ids: sourceChunkIds,
        cited_chunk_ids: citedChunkIds,
        miss_reason: missReason,
        expected_document_id: expectedDocumentId,
        expected_chunk_id: expectedChunkId ?? citedChunkIds[0] ?? sourceChunkIds[0] ?? null,
        candidate_aliases: normalizedClinicalSearchTokens(parsed.data.query).slice(0, 12),
        promoted_eval_case: true,
        promoted_at: new Date().toISOString(),
        metadata: {
          ...queryPrivacyMetadata(parsed.data.query),
          interaction: "answer_eval_capture",
          rating,
          feedback_type: parsed.data.feedbackType ?? null,
          // Verbatim clinical note/answer are the larger PHI surface; only retain
          // them when raw retention is explicitly enabled (RET-H4).
          note: env.RAG_PERSIST_RAW_QUERY_TEXT ? parsed.data.note : "",
          answer: env.RAG_PERSIST_RAW_QUERY_TEXT ? parsed.data.answer : "",
          query_class: parsed.data.queryClass ?? null,
          query_mode: parsed.data.queryMode,
          filters: parsed.data.filters ?? {},
          source_governance_warnings: parsed.data.sourceGovernanceWarnings,
          unverified_numeric_tokens: parsed.data.unverifiedNumericTokens,
          source_chunk_ids_rejected: parsed.data.sourceChunkIds.length - sourceChunkIds.length,
          cited_chunk_ids_rejected: parsed.data.citedChunkIds.length - citedChunkIds.length,
          captured_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error, 400);
  }
}
